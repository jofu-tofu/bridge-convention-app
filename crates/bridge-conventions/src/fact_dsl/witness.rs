//! Witness-path derivation for v2 deal constraints (phase 1).
//!
//! A **witness** is a concrete (or symbolically concrete) authored auction
//! prefix that terminates at a chosen target surface. Given a witness, we can
//! intersect the hand-clauses of each surface on its path *per seat*, producing
//! much tighter `DealConstraints` than v1's global union.
//!
//! Scope:
//! - `partition_clauses` — utility that splits a surface's clauses into
//!   directly-invertible "hand" clauses and "context" clauses (`module.*`,
//!   `system.*`, `bridge.hasFiveCardMajor`, etc.). Kept for external
//!   inspection use; projection itself now expands context clauses in place.
//! - `enumerate_witnesses` — derives symbolic witnesses from authored data.
//!   Uses a **hybrid** strategy: `RouteExpr` when the target `StateEntry` has
//!   one (approach C), otherwise walks the target module's `LocalFsm` (approach
//!   E). In addition, it folds in base-system modules' "reach-to-responder"
//!   paths so that e.g. "1NT opener" is surfaced even though stayman's FSM
//!   starts in `idle` with no edge to traverse.
//! - `project_witness` — intersects per-seat hand clauses across all surfaces
//!   on the witness to produce `DealConstraints`. `module.*` / `bridge.*`
//!   derived facts are substituted with their authored compositions, and
//!   `system.*` boolean facts expand to concrete `hand.hcp` bounds using the
//!   caller-supplied `SystemConfig`.

use std::collections::{HashMap, HashSet, VecDeque};

use bridge_engine::{
    is_legal_call, partner_seat,
    types::{Auction, AuctionEntry, BidSuit, Call, DealConstraints, Seat, SeatConstraint, Suit},
};

use crate::pipeline::evaluation::binding_resolver::resolve_clause;
use crate::types::bid_action::{BidActionType, BidSuitName};
use crate::types::meaning::BidMeaning;
use crate::types::rule_types::{
    LocalFsm, ObsPattern, ObsPatternAct, PhaseRef, RouteExpr, StateEntry, TurnRole,
};
use crate::types::{
    BidMeaningClause, ConstraintValue, ConventionModule, FactComposition, FactOperator,
    PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue, SystemConfig,
};

use super::inversion::{invert_composition, InvertedConstraint};
use super::system_facts::{
    SYSTEM_DONT_OVERCALL_IN_RANGE, SYSTEM_OPENER_NOT_MINIMUM, SYSTEM_OPENING_STRONG_2C_RANGE,
    SYSTEM_OPENING_WEAK_TWO_RANGE, SYSTEM_RESPONDER_GAME_VALUES, SYSTEM_RESPONDER_INVITE_VALUES,
    SYSTEM_RESPONDER_ONE_NT_RANGE, SYSTEM_RESPONDER_SLAM_VALUES,
    SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, SYSTEM_RESPONDER_WEAK_HAND,
};

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
    /// The `moduleId` field authored on the target surface itself. Extension
    /// modules (e.g. `stayman-garbage`) may author surfaces with a different
    /// `moduleId` (e.g. `"stayman"`) than the containing module, so the
    /// acceptance predicate needs both to match correctly.
    pub target_surface_module_id: String,
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
///   a. If `StateEntry.route` is `Some`, attempt approach C
///      (`extract_required_prefix_from_route`). Success → that reified call
///      list forms the prefix; bidders are inferred by turn-cursor from dealer.
///   b. Otherwise, approach E: BFS `target_module.local` for a reifiable
///      path from `initial` to any phase hosting this state entry.
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

        // The surface's authored `module_id` may differ from the containing
        // module's `module_id` for extension modules (e.g. stayman-garbage's
        // surfaces declare moduleId: "stayman"). Grab it for the predicate.
        let surface_module_id = se
            .surfaces
            .iter()
            .find(|s| s.meaning_id == target_surface_id)
            .and_then(|s| s.module_id.clone())
            .unwrap_or_else(|| target_module_id.to_string());

        witnesses.push(Witness {
            prefix,
            target_surface_id: target_surface_id.to_string(),
            target_module_id: target_module_id.to_string(),
            target_surface_module_id: surface_module_id,
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

/// Score how constrained an `InvertedConstraint` is. Higher = more
/// populated fields = more specific. Used to pick the variant most likely
/// to generate compatible deals when multiple meaning_id-sharing surfaces
/// exist for the same target.
fn specificity_score(c: &InvertedConstraint) -> usize {
    let mut score = 0;
    if c.min_hcp.is_some() {
        score += 1;
    }
    if c.max_hcp.is_some() {
        score += 1;
    }
    if c.balanced.is_some() {
        score += 1;
    }
    if let Some(ref ml) = c.min_length {
        score += ml.len();
    }
    if let Some(ref ml) = c.max_length {
        score += ml.len();
    }
    if let Some(ref ml) = c.min_length_any {
        score += ml.len();
    }
    score
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

/// Convert a boolean surface clause on a `system.*` fact into a concrete
/// `FactComposition` on `hand.hcp` using `SystemConfig` thresholds. Returns
/// `None` when:
/// - the fact is not a recognized system fact
/// - the clause asks for the `false` side of a range-based threshold (the
///   negation is disjunctive and not cleanly expressible as a single bound;
///   we drop it rather than over-constrain)
/// - `SystemConfig` is unavailable
///
/// Supported facts: `weakHand`, `inviteValues`, `gameValues`, `slamValues`,
/// `openerNotMinimum`, `responderTwoLevelNewSuit`, `responderOneNtRange`,
/// `dontOvercallInRange`, `openingWeakTwoRange`, `openingStrong2cRange`.
fn expand_system_fact_to_hand_composition(
    fact_id: &str,
    boolean_value: bool,
    system: &SystemConfig,
) -> Option<FactComposition> {
    let hcp_min = |min: u32| -> FactComposition {
        FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(min)),
            },
        }
    };
    let hcp_max = |max: u32| -> FactComposition {
        FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Lte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(max)),
            },
        }
    };
    let hcp_range = |min: u32, max: u32| -> FactComposition {
        FactComposition::And {
            operands: vec![hcp_min(min), hcp_max(max)],
        }
    };

    // Only the `true` side is cleanly invertible for range-valued thresholds.
    // Negations of an interior range map to a disjunction; we drop them.
    match fact_id {
        id if id == SYSTEM_RESPONDER_WEAK_HAND => {
            if boolean_value {
                // hcp < invite_min → hcp <= invite_min - 1
                let cap = system.responder_thresholds.invite_min.saturating_sub(1);
                Some(hcp_max(cap))
            } else {
                Some(hcp_min(system.responder_thresholds.invite_min))
            }
        }
        id if id == SYSTEM_RESPONDER_INVITE_VALUES && boolean_value => Some(hcp_range(
            system.responder_thresholds.invite_min,
            system.responder_thresholds.invite_max,
        )),
        id if id == SYSTEM_RESPONDER_GAME_VALUES => {
            if boolean_value {
                Some(hcp_min(system.responder_thresholds.game_min))
            } else {
                let cap = system.responder_thresholds.game_min.saturating_sub(1);
                Some(hcp_max(cap))
            }
        }
        id if id == SYSTEM_RESPONDER_SLAM_VALUES => {
            if boolean_value {
                Some(hcp_min(system.responder_thresholds.slam_min))
            } else {
                let cap = system.responder_thresholds.slam_min.saturating_sub(1);
                Some(hcp_max(cap))
            }
        }
        id if id == SYSTEM_OPENER_NOT_MINIMUM => {
            if boolean_value {
                Some(hcp_min(system.opener_rebid.not_minimum))
            } else {
                let cap = system.opener_rebid.not_minimum.saturating_sub(1);
                Some(hcp_max(cap))
            }
        }
        id if id == SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT => {
            if boolean_value {
                Some(hcp_min(system.suit_response.two_level_min))
            } else {
                let cap = system.suit_response.two_level_min.saturating_sub(1);
                Some(hcp_max(cap))
            }
        }
        id if id == SYSTEM_RESPONDER_ONE_NT_RANGE && boolean_value => Some(hcp_range(
            system.one_nt_response_after_major.min_hcp,
            system.one_nt_response_after_major.max_hcp,
        )),
        id if id == SYSTEM_DONT_OVERCALL_IN_RANGE && boolean_value => Some(hcp_range(
            system.dont_overcall.min_hcp,
            system.dont_overcall.max_hcp,
        )),
        id if id == SYSTEM_OPENING_WEAK_TWO_RANGE && boolean_value => Some(hcp_range(
            system.opening.weak_two.min_hcp,
            system.opening.weak_two.max_hcp,
        )),
        id if id == SYSTEM_OPENING_STRONG_2C_RANGE => {
            if boolean_value {
                Some(hcp_min(system.opening.strong_2c_min))
            } else {
                let cap = system.opening.strong_2c_min.saturating_sub(1);
                Some(hcp_max(cap))
            }
        }
        _ => None,
    }
}

/// Look up a `module.*` or `bridge.*` derived fact's `composition` in the
/// loaded modules. Returns `None` when the fact is unknown or has no
/// composition (evaluator-backed). Cycle protection is the caller's job.
fn find_fact_composition<'m>(
    fact_id: &str,
    loaded_modules: &[&'m ConventionModule],
) -> Option<&'m FactComposition> {
    for module in loaded_modules {
        for def in &module.facts.definitions {
            if def.id == fact_id {
                return def.composition.as_ref();
            }
        }
    }
    None
}

/// Maximum recursion depth for expanding `module.*` / `bridge.*` fact
/// definitions whose compositions reference other derived facts. Guards
/// against pathological cycles in authored fixtures without a full visited
/// set (authoring cycles are invariant-violations, caught elsewhere).
const MAX_EXPANSION_DEPTH: u8 = 8;

/// Recursively expand any `module.*` / `bridge.*` fact references inside a
/// `FactComposition` to the underlying hand primitives by substituting their
/// authored `composition`. System facts are expanded via `system_config` when
/// provided. References without a composition or at max depth are replaced
/// with an empty `And` (unconstrained), matching phase-1 drop semantics.
fn expand_composition(
    comp: &FactComposition,
    loaded_modules: &[&ConventionModule],
    system_config: Option<&SystemConfig>,
    depth: u8,
) -> FactComposition {
    if depth > MAX_EXPANSION_DEPTH {
        return FactComposition::And { operands: vec![] };
    }
    match comp {
        FactComposition::Primitive { clause } => {
            if is_hand_fact_id(&clause.fact_id)
                || clause.fact_id == "hand.isBalanced"
                || clause.fact_id == "bridge.isBalanced"
            {
                return comp.clone();
            }
            // System fact expansion: only well-formed boolean clauses are
            // invertible. Encoded form after `clause_to_primitive` is Eq with
            // 0/1. Upstream surface clauses reach here as raw PrimitiveClause,
            // so accept either `Boolean`-equivalent Eq(0)/Eq(1).
            if clause.fact_id.starts_with("system.") {
                if let Some(sys) = system_config {
                    if let Some(b) = primitive_clause_as_boolean(clause) {
                        if let Some(expanded) =
                            expand_system_fact_to_hand_composition(&clause.fact_id, b, sys)
                        {
                            return expanded;
                        }
                    }
                }
                return FactComposition::And { operands: vec![] };
            }
            // module.* or bridge.*: expand via authored composition.
            if clause.fact_id.starts_with("module.") || clause.fact_id.starts_with("bridge.") {
                if let Some(inner) = find_fact_composition(&clause.fact_id, loaded_modules) {
                    let expanded = expand_composition(inner, loaded_modules, system_config, depth + 1);
                    // Boolean Eq(0) on the fact = the negation of the composition.
                    match primitive_clause_as_boolean(clause) {
                        Some(true) => return expanded,
                        Some(false) => {
                            return FactComposition::Not {
                                operand: Box::new(expanded),
                            };
                        }
                        // Non-boolean references (numeric module facts) carry
                        // a comparison against the fact's numeric value and
                        // aren't expressible via pure composition rewriting.
                        None => return FactComposition::And { operands: vec![] },
                    }
                }
                return FactComposition::And { operands: vec![] };
            }
            // Unknown namespace: drop.
            FactComposition::And { operands: vec![] }
        }
        FactComposition::And { operands } => FactComposition::And {
            operands: operands
                .iter()
                .map(|o| expand_composition(o, loaded_modules, system_config, depth + 1))
                .collect(),
        },
        FactComposition::Or { operands } => FactComposition::Or {
            operands: operands
                .iter()
                .map(|o| expand_composition(o, loaded_modules, system_config, depth + 1))
                .collect(),
        },
        FactComposition::Not { operand } => FactComposition::Not {
            operand: Box::new(expand_composition(
                operand,
                loaded_modules,
                system_config,
                depth + 1,
            )),
        },
        // Extended / Match / Compute: not invertible; drop to empty so the
        // outer `And` becomes unconstrained on this branch.
        _ => FactComposition::And { operands: vec![] },
    }
}

/// Decode a PrimitiveClause's boolean-encoded value (post-`clause_to_primitive`
/// form: `Eq(0)` / `Eq(1)`). Returns `None` for non-boolean-encoded clauses.
fn primitive_clause_as_boolean(clause: &PrimitiveClause) -> Option<bool> {
    if !matches!(clause.operator, PrimitiveClauseOperator::Eq) {
        return None;
    }
    match &clause.value {
        PrimitiveClauseValue::Single(n) => match n.as_u64() {
            Some(0) => Some(false),
            Some(1) => Some(true),
            _ => None,
        },
        _ => None,
    }
}

/// Promote a raw surface clause to a `FactComposition` tree. Mirrors
/// `compose_surface_clauses` but produces a single node per clause so we can
/// feed each through `expand_composition` before re-composing the outer And.
fn clause_to_composition(clause: &BidMeaningClause) -> Option<FactComposition> {
    let primitive = raw_clause_to_primitive(clause)?;
    Some(FactComposition::Primitive { clause: primitive })
}

/// Local port of `clause_to_primitive` (private in inversion.rs). Kept in
/// lockstep with that function; if you widen the accepted operator/value
/// shapes there, do the same here.
fn raw_clause_to_primitive(clause: &BidMeaningClause) -> Option<PrimitiveClause> {
    let (op, value) = match (&clause.operator, &clause.value) {
        (FactOperator::Gte, ConstraintValue::Number(n)) => (
            PrimitiveClauseOperator::Gte,
            PrimitiveClauseValue::Single(n.clone()),
        ),
        (FactOperator::Lte, ConstraintValue::Number(n)) => (
            PrimitiveClauseOperator::Lte,
            PrimitiveClauseValue::Single(n.clone()),
        ),
        (FactOperator::Eq, ConstraintValue::Number(n)) => (
            PrimitiveClauseOperator::Eq,
            PrimitiveClauseValue::Single(n.clone()),
        ),
        (FactOperator::Range, ConstraintValue::Range { min, max }) => (
            PrimitiveClauseOperator::Range,
            PrimitiveClauseValue::Range {
                min: min.clone(),
                max: max.clone(),
            },
        ),
        (FactOperator::Boolean, ConstraintValue::Bool(b)) => (
            PrimitiveClauseOperator::Eq,
            PrimitiveClauseValue::Single(serde_json::Number::from(if *b { 1 } else { 0 })),
        ),
        _ => return None,
    };
    Some(PrimitiveClause {
        fact_id: clause.fact_id.clone(),
        operator: op,
        value,
    })
}

/// Invert a surface's hand-influencing clauses into a single
/// `InvertedConstraint`. `module.*` / `bridge.*` derived-fact references are
/// recursively expanded via authored compositions, and `system.*` clauses
/// are expanded via `system_config` (`None` → drop, matching phase-1 legacy).
fn invert_hand_only(
    surface: &BidMeaning,
    loaded_modules: &[&ConventionModule],
    system_config: Option<&SystemConfig>,
) -> InvertedConstraint {
    let resolved_clauses: Vec<BidMeaningClause> =
        if let Some(bindings) = surface.surface_bindings.as_ref() {
            surface
                .clauses
                .iter()
                .map(|clause| resolve_clause(clause, bindings))
                .collect()
        } else {
            surface.clauses.clone()
        };
    let operands: Vec<FactComposition> = resolved_clauses
        .iter()
        .filter_map(clause_to_composition)
        .map(|c| expand_composition(&c, loaded_modules, system_config, 0))
        .collect();
    let comp = FactComposition::And { operands };
    invert_composition(&comp)
}

fn is_partnership_seat(seat: Seat, dealer: Seat) -> bool {
    seat == dealer || seat == partner_seat(dealer)
}

fn is_opponent_seat(seat: Seat, dealer: Seat) -> bool {
    !is_partnership_seat(seat, dealer)
}

fn auction_from_position(position: &[WitnessCall]) -> Auction {
    Auction {
        entries: position
            .iter()
            .map(|entry| AuctionEntry {
                seat: entry.seat,
                call: entry.call.clone(),
            })
            .collect(),
        is_complete: false,
    }
}

fn candidate_interference_surfaces<'m>(
    seat: Seat,
    position: &[WitnessCall],
    loaded_modules: &[&'m ConventionModule],
) -> Vec<&'m BidMeaning> {
    let auction = auction_from_position(position);
    let mut out = Vec::new();

    for module in loaded_modules {
        let Some(states) = module.states.as_ref() else {
            continue;
        };
        for state in states {
            if state.turn != Some(TurnRole::Opponent) {
                continue;
            }
            for surface in &state.surfaces {
                if matches!(surface.encoding.default_call, Call::Pass) {
                    continue;
                }
                if is_legal_call(&auction, &surface.encoding.default_call, seat) {
                    out.push(surface);
                }
            }
        }
    }

    out
}

pub fn synthesize_no_interference_constraint(
    seat: Seat,
    position: &[WitnessCall],
    loaded_modules: &[&ConventionModule],
    system_config: Option<&SystemConfig>,
) -> InvertedConstraint {
    let candidates = candidate_interference_surfaces(seat, position, loaded_modules);
    if candidates.is_empty() {
        return InvertedConstraint {
            max_hcp: Some(10),
            ..Default::default()
        };
    }

    let inverted: Vec<InvertedConstraint> = candidates
        .iter()
        .map(|s| invert_hand_only(s, loaded_modules, system_config))
        .collect();
    let mut synthesized = InvertedConstraint {
        max_hcp: Some(
            inverted
                .iter()
                .filter_map(|constraint| constraint.min_hcp)
                .min()
                .map_or(10, |min| min.saturating_sub(1)),
        ),
        ..Default::default()
    };

    let mut max_length = HashMap::new();
    for suit in [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
        let every_candidate_requires_five_plus = inverted.iter().all(|constraint| {
            constraint
                .min_length
                .as_ref()
                .and_then(|mins| mins.get(&suit))
                .is_some_and(|&len| len >= 5)
        });
        if every_candidate_requires_five_plus {
            max_length.insert(suit, 4);
        }
    }
    if !max_length.is_empty() {
        synthesized.max_length = Some(max_length);
    }

    synthesized
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
/// - Target surface's hand clauses contribute to `user_seat`. When multiple
///   surfaces share the target `meaning_id`, we UNION (loosest) across
///   variants since any variant is a valid witness hand. System/module fact
///   expansion (`expand_composition`) ensures each variant contributes
///   concrete HCP bounds rather than empty constraints — the old bug where
///   a system-gated variant contributed no hand constraints (dropping the
///   union's HCP bound entirely) is resolved by the expansion layer.
/// - Each prefix call's matched base-module surfaces contribute to their
///   bidder seat; when multiple surfaces match the same call, their
///   inverted constraints are intersected (tightest bound wins).
/// - Opponent pass slots implied between witness calls synthesize a
///   "no-interference" constraint so drill generation avoids hands where the
///   live heuristic opponents would overcall before the user's turn.
///
/// `system_config` is threaded through so `system.*` clauses on target and
/// prefix surfaces expand to concrete `hand.hcp` bounds. Passing `None`
/// reproduces the legacy behavior of silently dropping system clauses.
pub fn project_witness(
    witness: &Witness,
    loaded_modules: &[&ConventionModule],
    system_config: Option<&SystemConfig>,
) -> Vec<DealConstraints> {
    let Some(target_module) = find_module(loaded_modules, &witness.target_module_id) else {
        return Vec::new();
    };

    let mut per_seat: HashMap<Seat, Vec<InvertedConstraint>> = HashMap::new();

    // Target surface(s) → user_seat. Multiple authored variants of the same
    // meaning_id are alternative meanings. We pick the single MOST
    // CONSTRAINING variant (highest specificity score). The deal-acceptance
    // predicate will reject deals where the pipeline picks a different
    // variant anyway, so generating hands that match the tightest variant
    // maximizes acceptance-predicate hit rate. A union across variants with
    // disjoint HCP ranges (e.g., garbage Stayman 0-7 vs invite Stayman 8-9)
    // would produce a constraint window that spans both, but ~50% of
    // generated hands would be rejected at the pipeline level because the
    // "wrong" variant was selected.
    let target_surfaces = find_target_surfaces(
        target_module,
        &witness.target_surface_id,
        witness.user_seat,
        witness.dealer,
    );
    if !target_surfaces.is_empty() {
        let best = target_surfaces
            .iter()
            .map(|s| invert_hand_only(s, loaded_modules, system_config))
            .max_by_key(specificity_score)
            .unwrap_or_default();
        per_seat
            .entry(witness.user_seat)
            .or_default()
            .push(best);
    }

    // Prefix calls → bidder seat via base-module surface lookup.
    // Any skipped opponent seat before the next authored bid is an implied
    // pass, so synthesize a no-interference cap from the current position.
    let mut position: Vec<WitnessCall> = Vec::new();
    let mut cursor = witness.dealer;
    for entry in &witness.prefix {
        while cursor != entry.seat {
            if is_opponent_seat(cursor, witness.dealer) {
                let synthesized = synthesize_no_interference_constraint(
                    cursor,
                    &position,
                    loaded_modules,
                    system_config,
                );
                per_seat.entry(cursor).or_default().push(synthesized);
            }
            position.push(WitnessCall {
                seat: cursor,
                call: Call::Pass,
            });
            cursor = step_seat(cursor, 1);
        }

        if entry.call == Call::Pass && is_opponent_seat(entry.seat, witness.dealer) {
            let synthesized = synthesize_no_interference_constraint(
                entry.seat,
                &position,
                loaded_modules,
                system_config,
            );
            per_seat.entry(entry.seat).or_default().push(synthesized);
            position.push(entry.clone());
            cursor = step_seat(entry.seat, 1);
            continue;
        }

        let matches =
            surfaces_emitting_call(loaded_modules, &entry.call, entry.seat, witness.dealer);
        if matches.is_empty() {
            position.push(entry.clone());
            cursor = step_seat(entry.seat, 1);
            continue;
        }
        let per_call: Vec<InvertedConstraint> = matches
            .iter()
            .map(|s| invert_hand_only(s, loaded_modules, system_config))
            .collect();
        // Multiple surfaces for the same call (e.g. two authored variants)
        // are intersected — they describe the same authored bid.
        let tightened = intersect_inverted(&per_call);
        per_seat.entry(entry.seat).or_default().push(tightened);
        position.push(entry.clone());
        cursor = step_seat(entry.seat, 1);
    }

    while cursor != witness.user_seat {
        if is_opponent_seat(cursor, witness.dealer) {
            let synthesized = synthesize_no_interference_constraint(
                cursor,
                &position,
                loaded_modules,
                system_config,
            );
            per_seat.entry(cursor).or_default().push(synthesized);
        }
        position.push(WitnessCall {
            seat: cursor,
            call: Call::Pass,
        });
        cursor = step_seat(cursor, 1);
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
