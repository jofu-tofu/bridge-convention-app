//! Witness-path derivation for v2 deal constraints (phase 1).
//!
//! A **witness** is a concrete (or symbolically concrete) authored auction
//! prefix that terminates at a chosen target surface. Given a witness, we can
//! intersect the hand-clauses of each surface on its path *per seat*, producing
//! much tighter `DealConstraints` than v1's global union.
//!
//! Phase 1 scope (additive only):
//! - `partition_clauses` — splits a surface's clauses into invertible "hand"
//!   clauses and non-invertible "context" clauses (`module.*`, `system.*`,
//!   `bridge.hasFiveCardMajor`, etc.).
//! - `enumerate_witnesses` — derives symbolic witnesses from authored data.
//!   Uses a **hybrid** strategy: `RouteExpr` when the target `StateEntry` has
//!   one (approach C), otherwise walks the target module's `LocalFsm` (approach
//!   E). In addition, it folds in base-system modules' "reach-to-responder"
//!   paths so that e.g. "1NT opener" is surfaced even though stayman's FSM
//!   starts in `idle` with no edge to traverse.
//! - `project_witness` — intersects per-seat hand clauses across all surfaces
//!   on the witness to produce `DealConstraints`.
//!
//! This module is intentionally additive. Nothing in v1
//! (`derive_deal_constraints`) is removed, and callers of the existing
//! pipeline are not touched.

use std::collections::{HashMap, HashSet, VecDeque};

use bridge_engine::types::{BidSuit, Call, DealConstraints, Seat, SeatConstraint};

use crate::types::bid_action::{BidActionType, BidSuitName};
use crate::types::meaning::BidMeaning;
use crate::types::rule_types::{
    LocalFsm, ObsPattern, ObsPatternAct, PhaseRef, RouteExpr, StateEntry, TurnRole,
};
use crate::types::{BidMeaningClause, ConventionModule};

use super::inversion::{compose_surface_clauses, invert_composition, InvertedConstraint};

// =====================================================================
// 1a. Clause partitioning
// =====================================================================

/// Fact-ids that `clause_to_primitive`/`invert_primitive` in
/// `fact_dsl/inversion.rs` can invert into bounds. Anything else is context.
fn is_hand_fact_id(fact_id: &str) -> bool {
    matches!(
        fact_id,
        "hand.hcp"
            | "hand.isBalanced"
            | "bridge.isBalanced"
            | "hand.suitLength.spades"
            | "hand.suitLength.hearts"
            | "hand.suitLength.diamonds"
            | "hand.suitLength.clubs"
    )
}

/// Split a surface's clauses into (hand, context) buckets.
///
/// Hand clauses are those `invert_composition` can reify into bounds.
/// Context clauses cover everything else (`module.*`, `system.*`,
/// `bridge.hasFiveCardMajor`, …) and are ignored for Phase-1 deal generation
/// purposes but retained for future auction/system evaluation phases.
pub fn partition_clauses(
    clauses: &[BidMeaningClause],
) -> (Vec<BidMeaningClause>, Vec<BidMeaningClause>) {
    let mut hand = Vec::new();
    let mut context = Vec::new();
    for c in clauses {
        if is_hand_fact_id(&c.fact_id) {
            hand.push(c.clone());
        } else {
            context.push(c.clone());
        }
    }
    (hand, context)
}

// =====================================================================
// 1b. ObsPattern reification (approach E)
// =====================================================================

fn bid_suit_from_name(name: &BidSuitName) -> BidSuit {
    match name {
        BidSuitName::Clubs => BidSuit::Clubs,
        BidSuitName::Diamonds => BidSuit::Diamonds,
        BidSuitName::Hearts => BidSuit::Hearts,
        BidSuitName::Spades => BidSuit::Spades,
        BidSuitName::Notrump => BidSuit::NoTrump,
    }
}

/// Attempt to reify an `ObsPattern` (from a `LocalFsm` transition or a
/// simple `RouteExpr`) into a concrete `Call`. Returns `None` when the
/// pattern is ambiguous.
///
/// The reifiable subset:
/// - `Open`/`Overcall` with explicit `strain` AND explicit `level` → direct
/// - `Pass`, `Double`, `Redouble`
///
/// Semantic acts (`Inquire`, `Show`, `Rebid`, …) and openings without strain
/// return `None`. Opening patterns without `level` are a special case handled
/// by `reify_obs_pattern_with_surface_hint` below — fixtures conventionally
/// omit level on FSM-transition ObsPatterns and place the concrete level on
/// the emitting `StateEntry.surfaces[i].encoding.default_call`.
pub fn reify_obs_pattern(pat: &ObsPattern) -> Option<Call> {
    let act = match pat.act {
        ObsPatternAct::Specific(a) => a,
        ObsPatternAct::Any => return None,
    };
    match act {
        BidActionType::Pass => Some(Call::Pass),
        BidActionType::Double => Some(Call::Double),
        BidActionType::Redouble => Some(Call::Redouble),
        BidActionType::Open | BidActionType::Overcall => {
            let level = pat.level?;
            let strain = pat.strain.as_ref().map(bid_suit_from_name)?;
            Some(Call::Bid { level, strain })
        }
        _ => None,
    }
}

/// Reify `pat` using `surfaces` from the transition's `from` state as a
/// tie-breaker for missing `level`. This is how we handle the fixture
/// convention of authoring `{ act: open, strain: notrump }` (no level)
/// on a transition whose originating state hosts a `default_call`
/// `1NT` surface for the opener.
fn reify_obs_pattern_with_surface_hint(
    pat: &ObsPattern,
    from_state_surfaces: &[BidMeaning],
) -> Option<Call> {
    if let Some(call) = reify_obs_pattern(pat) {
        return Some(call);
    }
    // Handle Open/Overcall with strain but no level.
    let act = match pat.act {
        ObsPatternAct::Specific(a) => a,
        ObsPatternAct::Any => return None,
    };
    if !matches!(act, BidActionType::Open | BidActionType::Overcall) {
        return None;
    }
    let strain = pat.strain.as_ref().map(bid_suit_from_name)?;
    // Search the from-state surfaces for a `Call::Bid { strain, .. }` and
    // pick the lowest level (canonical opening).
    let mut best: Option<Call> = None;
    for s in from_state_surfaces {
        if let Call::Bid {
            level,
            strain: s_strain,
        } = s.encoding.default_call
        {
            if s_strain == strain {
                match best {
                    Some(Call::Bid { level: cur, .. }) if level >= cur => {}
                    _ => {
                        best = Some(Call::Bid { level, strain });
                    }
                }
            }
        }
    }
    best
}

// =====================================================================
// Witness + projection types
// =====================================================================

/// One concrete entry on a witness prefix (absolute seat + call).
///
/// Mirrors `bridge_engine::types::AuctionEntry` structurally; we keep our
/// own type so witness enumeration stays in-crate even if AuctionEntry
/// gains fields.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WitnessCall {
    pub seat: Seat,
    pub call: Call,
}

/// A symbolic auction prefix ending at a chosen target surface.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Witness {
    /// Ordered, absolute-seat bid history before the target bid.
    pub prefix: Vec<WitnessCall>,
    /// Stable id of the chosen target surface. Phase 1 uses `meaning_id`.
    pub target_surface_id: String,
    pub target_module_id: String,
    pub user_seat: Seat,
    pub dealer: Seat,
}

/// Per-seat projected constraint produced from a witness.
#[derive(Debug, Clone)]
pub struct ProjectedConstraint {
    pub seat: Seat,
    pub constraint: SeatConstraint,
}

/// A witness plus its projected deal constraints.
#[derive(Debug, Clone)]
pub struct WitnessProjection {
    pub constraints: Vec<ProjectedConstraint>,
    pub witness: Witness,
}

// =====================================================================
// Helpers: module lookup, seat arithmetic, turn resolution
// =====================================================================

fn find_module<'a>(
    modules: &[&'a ConventionModule],
    module_id: &str,
) -> Option<&'a ConventionModule> {
    modules.iter().copied().find(|m| m.module_id == module_id)
}

fn step_seat(current: Seat, steps: usize) -> Seat {
    use bridge_engine::constants::next_seat;
    let mut s = current;
    for _ in 0..steps {
        s = next_seat(s);
    }
    s
}

/// Resolve a `TurnRole` to an absolute `Seat` given dealer + user seat.
///
/// Convention: dealer is North in the partnership-with-user layout
/// used by drills. `Opener` = dealer, `Responder` = dealer's partner,
/// `Opponent` = either defender (left, by convention).
fn seat_for_turn(turn: TurnRole, dealer: Seat) -> Seat {
    match turn {
        TurnRole::Opener => dealer,
        TurnRole::Responder => step_seat(dealer, 2),
        TurnRole::Opponent => step_seat(dealer, 1),
    }
}

fn phase_names(phase: &PhaseRef) -> Vec<&str> {
    match phase {
        PhaseRef::Single(p) => vec![p.as_str()],
        PhaseRef::Multiple(ps) => ps.iter().map(|s| s.as_str()).collect(),
    }
}

// =====================================================================
// LocalFsm BFS: shortest reifiable path from initial → target phase
// =====================================================================

/// Return the shortest reifiable path of `Call`s that takes `fsm` from its
/// initial phase to any phase in `target_phases`. Each step's actor seat is
/// derived from a "turn cursor" starting at `start_seat`.
///
/// Returns `None` if no such path exists. A path is "reifiable" iff every
/// transition's `ObsPattern` reifies to a concrete `Call`. If the path
/// to the target phase requires a non-reifiable edge (e.g. `Inquire`), we
/// skip that edge — which may leave the target unreachable → `None`.
///
/// BFS by `(phase, bids_so_far)`; we keep the first fully-reified path.
fn shortest_reifiable_path(
    fsm: &LocalFsm,
    target_phases: &HashSet<&str>,
    start_seat: Seat,
    states: Option<&[StateEntry]>,
) -> Option<Vec<WitnessCall>> {
    if target_phases.contains(fsm.initial.as_str()) {
        return Some(Vec::new());
    }
    // State: phase. Visited tracks shortest-path semantics.
    let mut visited: HashSet<String> = HashSet::new();
    visited.insert(fsm.initial.clone());
    let mut queue: VecDeque<(String, Vec<WitnessCall>)> = VecDeque::new();
    queue.push_back((fsm.initial.clone(), Vec::new()));

    while let Some((phase, path)) = queue.pop_front() {
        for t in &fsm.transitions {
            if !matches_from(&phase, &t.from) {
                continue;
            }
            // Gather surfaces of the `from` state as a reification hint.
            let hint_surfaces: &[BidMeaning] = states
                .and_then(|ss| {
                    ss.iter()
                        .find(|se| phase_names(&se.phase).contains(&phase.as_str()))
                        .map(|se| se.surfaces.as_slice())
                })
                .unwrap_or(&[]);
            let Some(call) = reify_obs_pattern_with_surface_hint(&t.on, hint_surfaces) else {
                continue;
            };
            if visited.contains(&t.to) {
                continue;
            }
            let seat = {
                // Actor: explicit actor on pattern takes precedence; otherwise
                // the cursor advances one seat per prior reified call.
                if let Some(role) = t.on.actor {
                    seat_for_turn(role, start_seat)
                } else {
                    step_seat(start_seat, path.len())
                }
            };
            let mut new_path = path.clone();
            new_path.push(WitnessCall { seat, call });

            if target_phases.contains(t.to.as_str()) {
                return Some(new_path);
            }
            visited.insert(t.to.clone());
            queue.push_back((t.to.clone(), new_path));
        }
    }
    None
}

fn matches_from(current: &str, from: &PhaseRef) -> bool {
    match from {
        PhaseRef::Single(p) => current == p,
        PhaseRef::Multiple(ps) => ps.iter().any(|p| p == current),
    }
}

// =====================================================================
// RouteExpr extraction (approach C)
// =====================================================================

/// Walk a `RouteExpr` and extract the ordered sequence of required calls
/// it strictly demands. Returns `None` when the expression contains
/// combinators we cannot reify unambiguously (`Or`, `Not`, `Contains`, `And`
/// across heterogeneous shapes, non-reifiable `ObsPattern`s).
///
/// The precise, tractable fragment:
/// - `Subseq { steps }` → reify each step; fail on first un-reifiable.
/// - `Last { pattern }` → try to reify the single pattern.
///
/// Everything else → `None`. This is honest degradation; callers treat
/// `None` as "no witness path from route alone."
pub fn extract_required_prefix_from_route(route: &RouteExpr) -> Option<Vec<Call>> {
    match route {
        RouteExpr::Subseq { steps } => {
            let mut out = Vec::with_capacity(steps.len());
            for p in steps {
                out.push(reify_obs_pattern(p)?);
            }
            Some(out)
        }
        RouteExpr::Last { pattern } => Some(vec![reify_obs_pattern(pattern)?]),
        _ => None,
    }
}

// =====================================================================
// 1c. enumerate_witnesses
// =====================================================================

/// Locate all `StateEntry`s in `module` that host a surface with the given
/// `meaning_id` (the phase-1 "surface id") and whose `turn` resolves to
/// `user_seat` under `dealer`.
fn target_state_entries<'m>(
    module: &'m ConventionModule,
    target_surface_id: &str,
    user_seat: Seat,
    dealer: Seat,
) -> Vec<&'m StateEntry> {
    let Some(states) = module.states.as_ref() else {
        return Vec::new();
    };
    states
        .iter()
        .filter(|se| {
            se.turn
                .map(|t| seat_for_turn(t, dealer) == user_seat)
                .unwrap_or(false)
        })
        .filter(|se| {
            se.surfaces
                .iter()
                .any(|s| s.meaning_id == target_surface_id)
        })
        .collect()
}

/// Find the phases hosting a target state entry (for `LocalFsm` BFS).
fn phases_of_state_entries<'a>(entries: &'a [&StateEntry]) -> HashSet<&'a str> {
    let mut set: HashSet<&str> = HashSet::new();
    for se in entries {
        for p in phase_names(&se.phase) {
            set.insert(p);
        }
    }
    set
}

/// Find the "natural responder-context" path for a base module: the shortest
/// reifiable path from its `initial` phase to any phase hosting a
/// `turn=Responder` state entry. This lets us surface "1NT opener" when the
/// target module (e.g. stayman) begins in `idle` with an empty path of its
/// own — without this, no seat ever gets opener bounds.
fn base_module_responder_context_path(
    module: &ConventionModule,
    dealer: Seat,
) -> Option<Vec<WitnessCall>> {
    let states = module.states.as_ref()?;
    let targets: HashSet<&str> = states
        .iter()
        .filter(|se| matches!(se.turn, Some(TurnRole::Responder)))
        .flat_map(|se| phase_names(&se.phase))
        .collect();
    if targets.is_empty() {
        return None;
    }
    // Treat dealer as opener for the base-module path (SAYC drill convention).
    shortest_reifiable_path(&module.local, &targets, dealer, module.states.as_deref())
}

/// Merge two witness prefixes, preferring the longer. When both are non-empty
/// and differ, we keep the longer since it reflects more authored context;
/// if lengths match, we keep the first.
fn merge_prefixes(mut a: Vec<WitnessCall>, b: Vec<WitnessCall>) -> Vec<WitnessCall> {
    if b.len() > a.len() {
        return b;
    }
    // If `a` is empty and `b` is empty too, nothing to do.
    if a.is_empty() && !b.is_empty() {
        return b;
    }
    // If they agree on shared prefix, keep `a`. Otherwise still keep `a`
    // (first-come-first-served deterministic).
    if a.is_empty() {
        a = b;
    }
    a
}

/// Enumerate witnesses for `target_surface_id` on `target_module_id`.
///
/// Hybrid strategy per work-rule:
/// 1. For each target `StateEntry` of `target_module_id` whose `turn` resolves
///    to `user_seat`:
///    a. If `StateEntry.route` is `Some`, attempt approach C
///       (`extract_required_prefix_from_route`). Success → that reified call
///       list forms the prefix; bidders are inferred by turn-cursor from
///       dealer.
///    b. Otherwise, approach E: BFS `target_module.local` for a reifiable
///       path from `initial` to any phase hosting this state entry.
/// 2. **Context augmentation:** for every base-system module in
///    `loaded_modules` that is *not* the target, find its "responder-context
///    path" and fold it in. This is how 1NT-opener context flows into a
///    stayman/Jacoby witness whose own path is empty.
/// 3. Cap output at `max_witnesses`.
///
/// Returns an empty `Vec` (never panics) if the target module/surface is
/// missing or if no reifiable path exists.
pub fn enumerate_witnesses(
    target_module_id: &str,
    target_surface_id: &str,
    loaded_modules: &[&ConventionModule],
    dealer: Seat,
    user_seat: Seat,
    max_witnesses: usize,
) -> Vec<Witness> {
    if max_witnesses == 0 {
        return Vec::new();
    }
    let Some(target_module) = find_module(loaded_modules, target_module_id) else {
        return Vec::new();
    };
    let target_states = target_state_entries(target_module, target_surface_id, user_seat, dealer);
    if target_states.is_empty() {
        return Vec::new();
    }

    // Pre-compute base-module responder-context paths once.
    let mut context_paths: Vec<Vec<WitnessCall>> = Vec::new();
    for m in loaded_modules {
        if m.module_id == target_module_id {
            continue;
        }
        if let Some(path) = base_module_responder_context_path(m, dealer) {
            if !path.is_empty() {
                context_paths.push(path);
            }
        }
    }

    let mut witnesses: Vec<Witness> = Vec::new();
    for se in &target_states {
        // Approach C first.
        let mut prefix_opt: Option<Vec<WitnessCall>> = None;
        if let Some(route) = se.route.as_ref() {
            if let Some(calls) = extract_required_prefix_from_route(route) {
                let mut prefix = Vec::with_capacity(calls.len());
                for (i, call) in calls.into_iter().enumerate() {
                    prefix.push(WitnessCall {
                        seat: step_seat(dealer, i),
                        call,
                    });
                }
                prefix_opt = Some(prefix);
            }
            // If route exists but is intractable, fall through to LocalFsm.
        }

        if prefix_opt.is_none() {
            // Approach E: FSM BFS.
            let target_phases = phases_of_state_entries(std::slice::from_ref(se));
            if let Some(path) = shortest_reifiable_path(
                &target_module.local,
                &target_phases,
                dealer,
                target_module.states.as_deref(),
            ) {
                prefix_opt = Some(path);
            }
        }

        let Some(mut prefix) = prefix_opt else {
            continue;
        };

        // Fold in the longest context path (base-module opener context).
        let best_ctx = context_paths
            .iter()
            .cloned()
            .max_by_key(|p| p.len())
            .unwrap_or_default();
        prefix = merge_prefixes(prefix, best_ctx);

        witnesses.push(Witness {
            prefix,
            target_surface_id: target_surface_id.to_string(),
            target_module_id: target_module_id.to_string(),
            user_seat,
            dealer,
        });
        if witnesses.len() >= max_witnesses {
            break;
        }
    }
    witnesses
}

// =====================================================================
// 1d. project_witness
// =====================================================================

/// Look up all base-module surfaces across `loaded_modules` that emit `call`
/// at a `turn` matching `bidder_seat` (given dealer). When multiple surfaces
/// match, we union-then-intersect conservatively by picking the TIGHTEST
/// HCP range (outer bounds of the loosest). For phase 1 we simply intersect
/// their inverted constraints — since this is pessimistic for projection we
/// document it and prefer the first match.
fn surfaces_emitting_call<'m>(
    loaded_modules: &[&'m ConventionModule],
    call: &Call,
    bidder_seat: Seat,
    dealer: Seat,
) -> Vec<&'m BidMeaning> {
    let mut out = Vec::new();
    for m in loaded_modules {
        let Some(states) = m.states.as_ref() else {
            continue;
        };
        for se in states {
            let Some(turn) = se.turn else {
                continue;
            };
            if seat_for_turn(turn, dealer) != bidder_seat {
                continue;
            }
            for surface in &se.surfaces {
                if &surface.encoding.default_call == call {
                    out.push(surface);
                }
            }
        }
    }
    out
}

/// Tighter-of pointwise intersection (AND semantics) over a slice of
/// `InvertedConstraint`s.
fn intersect_inverted(constraints: &[InvertedConstraint]) -> InvertedConstraint {
    if constraints.is_empty() {
        return InvertedConstraint::default();
    }
    let mut out = constraints[0].clone();
    for c in &constraints[1..] {
        if let Some(min) = c.min_hcp {
            out.min_hcp = Some(out.min_hcp.map_or(min, |cur| cur.max(min)));
        }
        if let Some(max) = c.max_hcp {
            out.max_hcp = Some(out.max_hcp.map_or(max, |cur| cur.min(max)));
        }
        if c.balanced.is_some() {
            out.balanced = c.balanced;
        }
        if let Some(ref ml) = c.min_length {
            let target = out.min_length.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let e = target.entry(suit).or_insert(0);
                *e = (*e).max(len);
            }
        }
        if let Some(ref ml) = c.max_length {
            let target = out.max_length.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let e = target.entry(suit).or_insert(13);
                *e = (*e).min(len);
            }
        }
        if let Some(ref mla) = c.min_length_any {
            let target = out.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in mla {
                let e = target.entry(suit).or_insert(0);
                *e = (*e).max(len);
            }
        }
    }
    out
}

/// OR / union: loosest bounds. Mirrors `union_all` in `inversion.rs`,
/// re-implemented here because that function is private. Any branch
/// missing a bound drops the bound for the union (unconstrained).
fn union_inverted(constraints: &[InvertedConstraint]) -> InvertedConstraint {
    if constraints.is_empty() {
        return InvertedConstraint::default();
    }
    if constraints.len() == 1 {
        return constraints[0].clone();
    }
    let mut out = InvertedConstraint::default();
    let mut all_have_min_hcp = true;
    let mut all_have_max_hcp = true;
    for c in constraints {
        match c.min_hcp {
            Some(min) => {
                out.min_hcp = Some(out.min_hcp.map_or(min, |cur| cur.min(min)));
            }
            None => all_have_min_hcp = false,
        }
        match c.max_hcp {
            Some(max) => {
                out.max_hcp = Some(out.max_hcp.map_or(max, |cur| cur.max(max)));
            }
            None => all_have_max_hcp = false,
        }
        if let Some(ref ml) = c.min_length {
            let target = out.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let e = target.entry(suit).or_insert(len);
                *e = (*e).min(len);
            }
        }
        if let Some(ref mla) = c.min_length_any {
            let target = out.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in mla {
                let e = target.entry(suit).or_insert(len);
                *e = (*e).min(len);
            }
        }
    }
    if !all_have_min_hcp {
        out.min_hcp = None;
    }
    if !all_have_max_hcp {
        out.max_hcp = None;
    }
    out
}

fn inverted_to_seat_constraint(seat: Seat, c: &InvertedConstraint) -> SeatConstraint {
    SeatConstraint {
        seat,
        min_hcp: c.min_hcp,
        max_hcp: c.max_hcp,
        balanced: c.balanced,
        min_length: c.min_length.clone(),
        max_length: c.max_length.clone(),
        min_length_any: c.min_length_any.clone(),
    }
}

/// Invert the *hand-only* clauses of `surface` into a single
/// `InvertedConstraint`. Context clauses are silently dropped (they're the
/// purview of phase-2+ auction/system evaluation).
fn invert_hand_only(surface: &BidMeaning) -> InvertedConstraint {
    let (hand_clauses, _ctx) = partition_clauses(&surface.clauses);
    let comp = compose_surface_clauses(&hand_clauses);
    invert_composition(&comp)
}

/// Find all surfaces on the target module matching `target_surface_id`
/// at any state entry whose turn resolves to `user_seat`. Fixtures often
/// author multiple variants of the same meaning_id (different
/// partnership reasons); we collect all of them for union-projection.
fn find_target_surfaces<'m>(
    module: &'m ConventionModule,
    target_surface_id: &str,
    user_seat: Seat,
    dealer: Seat,
) -> Vec<&'m BidMeaning> {
    let mut out = Vec::new();
    let Some(states) = module.states.as_ref() else {
        return out;
    };
    for se in states {
        let Some(turn) = se.turn else { continue };
        if seat_for_turn(turn, dealer) != user_seat {
            continue;
        }
        for surface in &se.surfaces {
            if surface.meaning_id == target_surface_id {
                out.push(surface);
            }
        }
    }
    out
}

/// Project a witness into a list of `DealConstraints` branches.
///
/// Phase 1 emits a single branch per witness (no disjunction-distribution).
/// Per-seat projection:
/// - Target surface's hand clauses contribute to `user_seat`.
/// - Each prefix call's matched base-module surfaces contribute to their
///   bidder seat; when multiple surfaces match the same call, their
///   inverted constraints are intersected (tightest bound wins).
/// - Seats not mentioned by the witness receive no constraint.
pub fn project_witness(
    witness: &Witness,
    loaded_modules: &[&ConventionModule],
) -> Vec<DealConstraints> {
    let Some(target_module) = find_module(loaded_modules, &witness.target_module_id) else {
        return Vec::new();
    };

    let mut per_seat: HashMap<Seat, Vec<InvertedConstraint>> = HashMap::new();

    // Target surface(s) → user_seat. Multiple authored variants of the same
    // meaning_id are alternative meanings → union (loosest) across variants
    // to honor the semantics that ANY variant is a valid witness hand.
    let target_surfaces = find_target_surfaces(
        target_module,
        &witness.target_surface_id,
        witness.user_seat,
        witness.dealer,
    );
    if !target_surfaces.is_empty() {
        let inverted_variants: Vec<InvertedConstraint> = target_surfaces
            .iter()
            .map(|s| invert_hand_only(s))
            .collect();
        let unioned = union_inverted(&inverted_variants);
        per_seat.entry(witness.user_seat).or_default().push(unioned);
    }

    // Prefix calls → bidder seat via base-module surface lookup.
    for entry in &witness.prefix {
        let matches =
            surfaces_emitting_call(loaded_modules, &entry.call, entry.seat, witness.dealer);
        if matches.is_empty() {
            continue;
        }
        let per_call: Vec<InvertedConstraint> =
            matches.iter().map(|s| invert_hand_only(s)).collect();
        // Multiple surfaces for the same call (e.g. two authored variants)
        // are intersected — they describe the same authored bid.
        let tightened = intersect_inverted(&per_call);
        per_seat.entry(entry.seat).or_default().push(tightened);
    }

    let mut seats: Vec<SeatConstraint> = per_seat
        .into_iter()
        .map(|(seat, cs)| {
            let merged = intersect_inverted(&cs);
            inverted_to_seat_constraint(seat, &merged)
        })
        .collect();
    seats.sort_by_key(|s| format!("{:?}", s.seat));

    vec![DealConstraints {
        seats,
        dealer: Some(witness.dealer),
        vulnerability: None,
        max_attempts: Some(50_000),
        seed: None,
    }]
}

// =====================================================================
// Tests
// =====================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::meaning::{ConstraintValue, FactOperator};

    fn clause(fact_id: &str, op: FactOperator, value: ConstraintValue) -> BidMeaningClause {
        BidMeaningClause {
            fact_id: fact_id.to_string(),
            operator: op,
            value,
            clause_id: None,
            description: None,
            rationale: None,
            is_public: None,
        }
    }

    #[test]
    fn partition_clauses_splits_correctly() {
        let clauses = vec![
            clause("hand.hcp", FactOperator::Gte, ConstraintValue::int(8)),
            clause(
                "hand.suitLength.hearts",
                FactOperator::Gte,
                ConstraintValue::int(4),
            ),
            clause(
                "bridge.hasFiveCardMajor",
                FactOperator::Boolean,
                ConstraintValue::Bool(false),
            ),
            clause(
                "system.responder.inviteValues",
                FactOperator::Boolean,
                ConstraintValue::Bool(true),
            ),
            clause(
                "module.stayman.eligible",
                FactOperator::Boolean,
                ConstraintValue::Bool(true),
            ),
        ];
        let (hand, ctx) = partition_clauses(&clauses);
        assert_eq!(hand.len(), 2);
        assert_eq!(ctx.len(), 3);
        assert!(hand.iter().any(|c| c.fact_id == "hand.hcp"));
        assert!(hand.iter().any(|c| c.fact_id == "hand.suitLength.hearts"));
        assert!(ctx.iter().any(|c| c.fact_id == "bridge.hasFiveCardMajor"));
        assert!(ctx
            .iter()
            .any(|c| c.fact_id == "system.responder.inviteValues"));
        assert!(ctx.iter().any(|c| c.fact_id == "module.stayman.eligible"));
    }

    #[test]
    fn obs_pattern_reify_open_1nt() {
        let pat = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: None,
            strain: Some(BidSuitName::Notrump),
            strength: None,
            actor: None,
            level: Some(1),
            jump: None,
        };
        let call = reify_obs_pattern(&pat).expect("should reify");
        assert_eq!(
            call,
            Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump
            }
        );
    }

    #[test]
    fn obs_pattern_reify_open_missing_level_returns_none() {
        let pat = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: None,
            strain: Some(BidSuitName::Notrump),
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert!(reify_obs_pattern(&pat).is_none());
    }

    #[test]
    fn obs_pattern_reify_inquire_returns_none() {
        use crate::types::bid_action::HandFeature;
        let pat = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Inquire),
            feature: Some(HandFeature::MajorSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert!(reify_obs_pattern(&pat).is_none());
    }

    #[test]
    fn obs_pattern_reify_pass_double() {
        let pass = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Pass),
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert_eq!(reify_obs_pattern(&pass), Some(Call::Pass));

        let dbl = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Double),
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert_eq!(reify_obs_pattern(&dbl), Some(Call::Double));
    }
}
