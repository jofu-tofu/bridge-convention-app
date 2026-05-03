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
    is_auction_complete, is_legal_call, next_seat, partner_seat,
    types::{Auction, AuctionEntry, BidSuit, Call, DealConstraints, Seat, SeatConstraint, Suit},
};
use serde::{Deserialize, Serialize};

use crate::pipeline::evaluation::binding_resolver::resolve_clause;
use crate::pipeline::observation::committed_step::{
    initial_negotiation, ClaimRef, CommittedStep, CommittedStepStatus,
};
use crate::pipeline::observation::local_fsm::advance_local_fsm;
use crate::pipeline::observation::negotiation_extractor::apply_negotiation_actions;
use crate::pipeline::observation::negotiation_matcher::match_kernel;
use crate::pipeline::observation::normalize_intent::normalize_intent;
use crate::types::bid_action::{BidAction, BidActionType, BidSuitName};
use crate::types::meaning::BidMeaning;
use crate::types::negotiation::{Captain, NegotiationDelta, NegotiationState};
use crate::types::rule_types::{
    LocalFsm, NegotiationExpr, ObsPattern, ObsPatternAct, PhaseRef, RouteExpr, StateEntry, TurnRole,
};
use crate::types::{
    BidMeaningClause, ConstraintValue, ConventionModule, FactComposition, FactOperator,
    PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue, SystemConfig,
};

use super::inversion::{invert_composition, InvertedConstraint};
use super::system_facts::{
    SYSTEM_DONT_OVERCALL_IN_RANGE, SYSTEM_OPENER_JUMP_SHIFT_VALUES, SYSTEM_OPENER_MAXIMUM_VALUES,
    SYSTEM_OPENER_MEDIUM_VALUES, SYSTEM_OPENER_MINIMUM_VALUES, SYSTEM_OPENER_NOT_MINIMUM,
    SYSTEM_OPENER_REVERSE_VALUES, SYSTEM_OPENING_STRONG_2C_RANGE, SYSTEM_OPENING_WEAK_TWO_RANGE,
    SYSTEM_OVERCALLER_JUMP_VALUES, SYSTEM_OVERCALLER_SIMPLE_VALUES, SYSTEM_RESPONDER_GAME_VALUES,
    SYSTEM_RESPONDER_INVITE_VALUES, SYSTEM_RESPONDER_ONE_NT_RANGE, SYSTEM_RESPONDER_SLAM_VALUES,
    SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, SYSTEM_RESPONDER_WEAK_HAND, SYSTEM_TAKEOUT_DOUBLER_VALUES,
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

/// One step on a witness prefix: either a concrete call (which the predicate
/// matches by exact equality) or a pattern (which matches any call satisfying
/// the pattern). Patterns let authored fixtures express "any minor opening"
/// or "any major response" without enumerating every concrete possibility.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WitnessCallSpec {
    Concrete(Call),
    Pattern(ObsPattern),
}

impl WitnessCallSpec {
    /// Does this spec match a concrete call in the auction context?
    /// `auction_so_far` lets the matcher resolve `jump` predicates by
    /// computing the minimum legal level for the call's strain.
    pub fn matches(&self, call: &Call, auction_so_far: &[(Seat, Call)]) -> bool {
        match self {
            WitnessCallSpec::Concrete(expected) => expected == call,
            WitnessCallSpec::Pattern(pat) => pattern_matches_call(pat, call, auction_so_far),
        }
    }
}

/// Whether a witness step represents a partnership (opener/responder/our
/// partner) bid or an opponent's authored interference.
///
/// Phase 3 introduced `Opponent`: previously witnesses only encoded
/// partnership steps and the predicate replayed opponents from the live
/// strategy chain (with an implicit "must Pass" guard). Negative-doubles
/// authored prefixes contain LHO overcalls, so the witness layer now
/// carries opponent steps explicitly. Default deserializes to `Partnership`
/// so pre-Phase-3 serialized witnesses keep their meaning.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WitnessRole {
    Partnership,
    Opponent,
}

impl Default for WitnessRole {
    fn default() -> Self {
        WitnessRole::Partnership
    }
}

/// One concrete entry on a witness prefix (absolute seat + call spec).
///
/// Witnesses now carry a `WitnessCallSpec` rather than a bare `Call` so a
/// single witness can describe a class of auctions (e.g. NMF: opener bids
/// any minor at level 1). Concrete specs are the common case; patterns are
/// reserved for fixtures whose authored route uses suit-class qualifiers.
///
/// `role` distinguishes partnership steps (verified by the convention
/// adapter) from opponent steps (replayed via `ScriptedOpponentStrategy` in
/// the rejection-sampling predicate). Default `Partnership` keeps existing
/// witnesses behaving identically.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WitnessCall {
    pub seat: Seat,
    pub spec: WitnessCallSpec,
    #[serde(default)]
    pub role: WitnessRole,
}

impl WitnessCall {
    /// Convenience: the underlying `Call` when the spec is `Concrete`. Returns
    /// `None` for `Pattern` specs. Many internal helpers were written before
    /// patterns existed and only run when the witness is concrete-only; they
    /// can call this and unwrap.
    pub fn concrete_call(&self) -> Option<&Call> {
        match &self.spec {
            WitnessCallSpec::Concrete(c) => Some(c),
            WitnessCallSpec::Pattern(_) => None,
        }
    }
}

/// Match an `ObsPattern` against a concrete `Call` outside the BidAction
/// pipeline. Used by `WitnessCallSpec::Pattern` to test whether a candidate
/// auction step matches the authored pattern.
///
/// This is a deliberately narrow matcher: only `act` (BidActionType vs Call
/// kind), `level`, `strain`, `suit_class`, and `jump` are inspected. The
/// `actor`/`feature`/`strength`/`suit` fields require deal/role context that
/// isn't available at this layer; patterns using them are rejected with
/// `false` rather than partially honored, which forces authors to keep
/// witness patterns to physical-call qualifiers.
fn pattern_matches_call(
    pattern: &ObsPattern,
    call: &Call,
    auction_so_far: &[(Seat, Call)],
) -> bool {
    // act check: map BidActionType to Call kind. Pass/Double/Redouble are
    // direct; semantic acts (Open/Show/Overcall/...) fall through to Call::Bid.
    match pattern.act {
        ObsPatternAct::Any => {}
        ObsPatternAct::Specific(act) => match (act, call) {
            (BidActionType::Pass, Call::Pass)
            | (BidActionType::Double, Call::Double)
            | (BidActionType::Redouble, Call::Redouble) => {}
            (BidActionType::Pass, _)
            | (BidActionType::Double, _)
            | (BidActionType::Redouble, _) => return false,
            // Semantic acts like Open/Show/Rebid (n.b. Rebid is not a real
            // BidActionType variant; the relevant flavor in fixtures is Show
            // or Open). All map to Call::Bid for physical matching.
            (_, Call::Bid { .. }) => {}
            (_, _) => return false,
        },
    }

    // For non-Bid calls, level/strain/suit_class/jump constraints all reject.
    let (call_level, call_strain) = match call {
        Call::Bid { level, strain } => (*level, *strain),
        _ => {
            return pattern.level.is_none()
                && pattern.strain.is_none()
                && pattern.suit_class.is_none()
                && pattern.jump.is_none();
        }
    };

    if let Some(expected_level) = pattern.level {
        if call_level != expected_level {
            return false;
        }
    }

    let strain_name = match call_strain {
        BidSuit::Clubs => BidSuitName::Clubs,
        BidSuit::Diamonds => BidSuitName::Diamonds,
        BidSuit::Hearts => BidSuitName::Hearts,
        BidSuit::Spades => BidSuitName::Spades,
        BidSuit::NoTrump => BidSuitName::Notrump,
    };
    if let Some(ref expected_strain) = pattern.strain {
        if &strain_name != expected_strain {
            return false;
        }
    } else if let Some(class) = pattern.suit_class {
        if !class.matches_strain(&strain_name) {
            return false;
        }
    }

    // Fields requiring deal/role context — reject patterns that try to use
    // them at this layer. Forces authors to keep witness patterns physical.
    if pattern.actor.is_some()
        || pattern.feature.is_some()
        || pattern.strength.is_some()
        || pattern.suit.is_some()
    {
        return false;
    }

    if let Some(expected_jump) = pattern.jump {
        let mut min_level = 1u8;
        let target_rank = bid_suit_rank(call_strain);
        for (_, prior) in auction_so_far {
            if let Call::Bid {
                level: pl,
                strain: ps,
            } = prior
            {
                let p_rank = bid_suit_rank(*ps);
                let candidate = if target_rank > p_rank { *pl } else { *pl + 1 };
                if candidate > min_level {
                    min_level = candidate;
                }
            }
        }
        let is_jump = call_level > min_level;
        if is_jump != expected_jump {
            return false;
        }
    }
    true
}

fn bid_suit_rank(s: BidSuit) -> u8 {
    match s {
        BidSuit::Clubs => 0,
        BidSuit::Diamonds => 1,
        BidSuit::Hearts => 2,
        BidSuit::Spades => 3,
        BidSuit::NoTrump => 4,
    }
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
            let role = match t.on.actor {
                Some(TurnRole::Opponent) => WitnessRole::Opponent,
                _ => WitnessRole::Partnership,
            };
            let mut new_path = path.clone();
            new_path.push(WitnessCall {
                seat,
                spec: WitnessCallSpec::Concrete(call),
                role,
            });

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

/// Reify an `ObsPattern` into a `WitnessCallSpec` when the pattern is
/// witness-tractable. Returns:
/// - `Some(Concrete(Call))` when the pattern fully reifies to a concrete call.
/// - `Some(Pattern(pat))` when the pattern carries a `suit_class` qualifier
///   (or otherwise stays in the "physical-call" subset honored by
///   `pattern_matches_call`).
/// - `None` for patterns whose semantic fields (`actor`, `feature`, `strength`,
///   `suit`) require deal/role context that the witness layer doesn't have —
///   callers fall back to FSM BFS just as they did before patterns existed.
///
/// Used by `extract_required_prefix_specs_from_route` to support pattern-routed
/// witnesses (e.g. NMF's `1m – 1M – 1NT` opener step where `1m` = any minor).
pub fn reify_obs_pattern_to_spec(pat: &ObsPattern) -> Option<WitnessCallSpec> {
    // Concrete reification first — honors the authored shape without losing
    // information. If level + strain (or pass/double/redouble) are set
    // unambiguously, we get a concrete call.
    if let Some(call) = reify_obs_pattern(pat) {
        return Some(WitnessCallSpec::Concrete(call));
    }
    // Patterns we accept as `Pattern`: physical-call qualifiers only.
    // Anything with actor/feature/strength/suit is a semantic predicate; we
    // punt so the caller can fall back to FSM BFS just as before patterns
    // existed.
    if pat.actor.is_some()
        || pat.feature.is_some()
        || pat.strength.is_some()
        || pat.suit.is_some()
    {
        return None;
    }
    // Accept patterns with suit_class, level, and/or jump set. They will
    // physically match concrete calls via `pattern_matches_call`.
    Some(WitnessCallSpec::Pattern(pat.clone()))
}

/// Borrow the ordered `ObsPattern`s of a `Subseq` route. Returns `None` for
/// any other route shape. Phase 3 needs the raw patterns (with `actor` info
/// preserved) to assign opponent vs partnership roles per witness step;
/// `extract_required_prefix_specs_from_route` strips that field.
pub fn collect_subseq_steps(route: &RouteExpr) -> Option<&[ObsPattern]> {
    match route {
        RouteExpr::Subseq { steps } => Some(steps.as_slice()),
        _ => None,
    }
}

/// Witness-friendly variant of `reify_obs_pattern_to_spec` that strips
/// `actor` (handled separately by seat assignment) and converts `suit` to
/// `strain` for action types whose `suit` field IS the bid's strain
/// (Overcall, Show, Raise, etc). Used by the route-driven witness path so
/// authored opponent overcalls can carry both `actor: Opponent` and a
/// `suit` qualifier without `pattern_matches_call` rejecting them.
fn reify_route_step_to_spec(pat: &ObsPattern) -> Option<WitnessCallSpec> {
    let mut adjusted = pat.clone();
    // Seat assignment honors `actor` upstream; the runtime spec.matches()
    // doesn't have role info, so drop it here.
    adjusted.actor = None;
    // For overcall steps the authored `suit` IS the bid strain. Promote it
    // to `strain` so the physical-call matcher can compare against the call.
    if adjusted.strain.is_none() {
        if let Some(s) = adjusted.suit.take() {
            adjusted.strain = Some(BidSuitName::from(s));
        }
    } else {
        adjusted.suit = None;
    }
    reify_obs_pattern_to_spec(&adjusted)
}

/// Pattern-aware variant of `extract_required_prefix_from_route`: every step
/// produces a `WitnessCallSpec` so authors can use suit-class qualifiers and
/// other physical-but-imprecise predicates inside `Subseq`/`Last` routes.
/// Returns `None` for combinators that cannot be linearized (`Or`, `Not`,
/// `Contains`, `And`) OR when any step contains semantic fields not honored
/// by `pattern_matches_call` — callers fall back to FSM BFS in either case.
pub fn extract_required_prefix_specs_from_route(
    route: &RouteExpr,
) -> Option<Vec<WitnessCallSpec>> {
    match route {
        RouteExpr::Subseq { steps } => {
            let mut out = Vec::with_capacity(steps.len());
            for s in steps {
                out.push(reify_obs_pattern_to_spec(s)?);
            }
            Some(out)
        }
        RouteExpr::Last { pattern } => Some(vec![reify_obs_pattern_to_spec(pattern)?]),
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

// =====================================================================
// Kernel-gated target: fit-establishing prefix synthesis (§ kernel)
// =====================================================================

/// Maximum total length of the BFS-synthesized kernel prefix (partnership
/// bids + opponent/partnership passes). Bounded to prevent combinatorial
/// explosion; 8 accommodates the longest observed path (3 authored bids + 3
/// passes) plus a safety margin for dual termination padding.
const MAX_KERNEL_PREFIX_DEPTH: usize = 8;

/// One entry in the fit-relevant-surface scan. Each authored partnership
/// surface contributes a FitStep carrying:
/// - `turn`: the authored TurnRole, used with dealer to resolve absolute seat
/// - `phase`: the `PhaseRef` of the hosting StateEntry — used as an FSM
///   phase-gate so we only consider a surface when its defining module is
///   currently in that phase.
/// - `default_call`: the concrete Call this surface would emit
/// - `actions`: the normalized Vec<BidAction> from the surface's sourceIntent
/// - `module_id`, `meaning_id`: for deterministic ordering and debugging
///
/// The BFS uses ALL entries as candidate edges — `fit_relevant` refers to
/// the scan's role (enabling fit establishment) rather than a filter on
/// individual entries; termination is driven by `match_kernel` against the
/// folded NegotiationState.
#[derive(Debug, Clone)]
struct FitStep {
    turn: TurnRole,
    phase: PhaseRef,
    default_call: Call,
    actions: Vec<BidAction>,
    module_id: String,
    #[allow(dead_code)] // kept for debugging; read via Debug only
    meaning_id: String,
    sort_key: String,
}

/// Static pre-scan of all authored partnership surfaces across `modules`.
/// Returns entries sorted by `(module_id, state.phase, meaning_id)` for
/// deterministic BFS ordering (stable iteration → stable witness choice).
/// Bundle-local: `modules` is the already-scoped `loaded_modules` the caller
/// passes in, matching the inference-model constraint that we don't consult
/// cross-system modules when establishing partnership-native context.
fn fit_relevant_surfaces(modules: &[&ConventionModule]) -> Vec<FitStep> {
    let mut out: Vec<FitStep> = Vec::new();
    for m in modules {
        let Some(states) = m.states.as_ref() else {
            continue;
        };
        for se in states {
            let Some(turn) = se.turn else { continue };
            if matches!(turn, TurnRole::Opponent) {
                continue;
            }
            let phase_label = match &se.phase {
                PhaseRef::Single(p) => p.clone(),
                PhaseRef::Multiple(ps) => ps.join("+"),
            };
            for surface in &se.surfaces {
                let actions = normalize_intent(&surface.source_intent);
                out.push(FitStep {
                    turn,
                    phase: se.phase.clone(),
                    default_call: surface.encoding.default_call.clone(),
                    actions,
                    module_id: m.module_id.clone(),
                    meaning_id: surface.meaning_id.clone(),
                    sort_key: format!("{}:{}", phase_label, surface.meaning_id),
                });
            }
        }
    }
    out.sort_by(|a, b| {
        a.module_id
            .cmp(&b.module_id)
            .then_with(|| a.sort_key.cmp(&b.sort_key))
    });
    out
}

/// Does a module's current phase match the surface's PhaseRef?
fn phase_ref_contains(phase_ref: &PhaseRef, phase: &str) -> bool {
    match phase_ref {
        PhaseRef::Single(p) => p == phase,
        PhaseRef::Multiple(ps) => ps.iter().any(|p| p == phase),
    }
}

/// Short authored-fixture call notation, e.g. "1NT", "2D", "P", "X".
/// Mirrors `bridge-session::session::learning_formatters::call_key` — kept
/// inline to avoid a crate dependency. Used for attachment-pattern matching.
pub(crate) fn call_to_short_label(call: &Call) -> String {
    match call {
        Call::Pass => "P".to_string(),
        Call::Double => "X".to_string(),
        Call::Redouble => "XX".to_string(),
        Call::Bid { level, strain } => {
            let s = match strain {
                BidSuit::Clubs => "C",
                BidSuit::Diamonds => "D",
                BidSuit::Hearts => "H",
                BidSuit::Spades => "S",
                BidSuit::NoTrump => "NT",
            };
            format!("{}{}", level, s)
        }
    }
}

/// Check whether the current authored auction prefix satisfies an
/// `AuctionPattern`. Uses bridge-notation call labels ("1NT" etc.) for
/// comparison. Passes are stripped from the matched log so
/// `sequence: ["1NT"]` reads as "the last non-pass bid is 1NT" — the
/// semantics authored fixtures actually expect (otherwise any opponent
/// Pass between the opening and the follow-up would break the match).
fn auction_pattern_matches(
    pattern: &crate::types::agreement::AuctionPattern,
    prefix: &[WitnessCall],
) -> bool {
    use crate::types::agreement::AuctionPattern;
    // Walks of `auction_pattern_matches` only fire on internal BFS-built
    // prefixes (always Concrete). Patterns are skipped defensively rather
    // than panicking — they would treat as non-Pass labels and break the
    // sequence match (correct behavior when authoring uses suit_class).
    let labels: Vec<String> = prefix
        .iter()
        .filter_map(|c| c.concrete_call())
        .filter(|c| !matches!(c, Call::Pass))
        .map(call_to_short_label)
        .collect();
    match pattern {
        AuctionPattern::Sequence { calls } => {
            if labels.len() < calls.len() {
                return false;
            }
            let start = labels.len() - calls.len();
            labels[start..]
                .iter()
                .zip(calls.iter())
                .all(|(a, b)| a == b)
        }
        AuctionPattern::Contains { call, .. } => labels.iter().any(|l| l == call),
        AuctionPattern::ByRole { last_call, .. } => {
            labels.last().map(|l| l == last_call).unwrap_or(false)
        }
    }
}

/// True if `module`'s authored bundle_metadata.attachments (or top-level
/// attachments if bundle_metadata is empty) are satisfied by the current
/// prefix. Modules with no attachments are always considered active.
fn module_attachments_active(module: &ConventionModule, prefix: &[WitnessCall]) -> bool {
    let attachments = if !module.bundle_metadata.attachments.is_empty() {
        &module.bundle_metadata.attachments
    } else {
        &module.attachments
    };
    if attachments.is_empty() {
        return true;
    }
    attachments.iter().any(|att| {
        att.when_auction
            .as_ref()
            .map(|p| auction_pattern_matches(p, prefix))
            .unwrap_or(true)
    })
}

/// Snapshot of every loaded module's FSM phase. Serializable (BTreeMap for
/// stable ordering) so it can be used in BFS dedup keys.
type ModulePhases = std::collections::BTreeMap<String, String>;

fn initial_module_phases(modules: &[&ConventionModule]) -> ModulePhases {
    let mut m = ModulePhases::new();
    for mm in modules {
        m.insert(mm.module_id.clone(), mm.local.initial.clone());
    }
    m
}

/// Build a `CommittedStep` from an actor + call + actions. Only the fields
/// read by `advance_local_fsm` (`call`, `public_actions`) are populated
/// meaningfully; the rest are placeholders.
fn synth_committed_step(actor: Seat, call: Call, actions: Vec<BidAction>) -> CommittedStep {
    CommittedStep {
        actor,
        call,
        resolved_claim: Some(ClaimRef {
            module_id: String::new(),
            meaning_id: String::new(),
            semantic_class_id: String::new(),
            source_intent: crate::types::meaning::SourceIntent {
                intent_type: String::new(),
                params: std::collections::HashMap::new(),
            },
        }),
        public_actions: actions,
        negotiation_delta: NegotiationDelta::default(),
        state_after: initial_negotiation(),
        status: CommittedStepStatus::Resolved,
    }
}

/// Advance every module's FSM phase by one step. `prior_steps` is reused
/// across modules; FSMs that don't have a matching transition keep their
/// current phase (idempotent).
fn advance_all_module_phases(
    modules: &[&ConventionModule],
    phases: &ModulePhases,
    step: &CommittedStep,
    prior_steps: &[CommittedStep],
) -> ModulePhases {
    let mut out = phases.clone();
    for m in modules {
        let current = out
            .get(&m.module_id)
            .cloned()
            .unwrap_or_else(|| m.local.initial.clone());
        let next = advance_local_fsm(&current, step, prior_steps, &m.local.transitions);
        out.insert(m.module_id.clone(), next);
    }
    out
}

/// True if a step's normalized actions include a fit-setting BidAction.
fn actions_set_fit(actions: &[BidAction]) -> bool {
    actions.iter().any(|a| {
        matches!(
            a,
            BidAction::Raise { .. }
                | BidAction::Agree { .. }
                | BidAction::Accept { suit: Some(_), .. }
                | BidAction::Transfer { .. }
        )
    })
}

/// Build an `Auction` from a prefix, computing `is_complete` correctly so
/// `is_legal_call` respects auction-closure semantics during BFS expansion.
///
/// Pattern witnesses don't reach this helper — kernel BFS builds its prefix
/// from concrete fit-relevant surfaces, so each step has a Concrete spec.
fn auction_from_prefix(prefix: &[WitnessCall]) -> Auction {
    let mut a = Auction {
        entries: prefix
            .iter()
            .map(|e| AuctionEntry {
                seat: e.seat,
                call: e
                    .concrete_call()
                    .expect("auction_from_prefix only sees concrete witness steps")
                    .clone(),
            })
            .collect(),
        is_complete: false,
    };
    a.is_complete = is_auction_complete(&a);
    a
}

/// Bounded BFS that synthesizes an auction prefix (partnership bids +
/// opponent/partnership passes) satisfying BOTH:
/// (a) `match_kernel(kernel_req, &folded_state) == true`
/// (b) `next_seat(last_seat_in_prefix) == seat_for_turn(target_turn, dealer)`
///
/// The folded state is computed by replaying each partnership surface's
/// normalized BidActions through `apply_negotiation_actions`. Opponent seats
/// contribute no actions (implicit pass). The BFS also lets partnership
/// seats choose `Pass` as a no-op padding move so the prefix can land the
/// target seat next-to-act when a fit-setting sequence would otherwise
/// finish at the wrong partnership seat.
///
/// Returns `None` when no prefix ≤ `max_depth` satisfies both termination
/// conditions; callers treat this as "kernel unreachable in this bundle".
fn find_kernel_establishing_prefix(
    kernel_req: &NegotiationExpr,
    modules: &[&ConventionModule],
    dealer: Seat,
    target_turn: TurnRole,
    max_depth: usize,
) -> Option<Vec<WitnessCall>> {
    let target_seat = seat_for_turn(target_turn, dealer);
    let steps = fit_relevant_surfaces(modules);
    let initial_state = initial_negotiation();
    let initial_phases = initial_module_phases(modules);

    // Early-out: empty prefix. Satisfies the kernel iff the initial state
    // matches AND the target seat is the dealer (otherwise padding is
    // needed to reach it).
    if match_kernel(kernel_req, &initial_state) && dealer == target_seat {
        return Some(Vec::new());
    }

    // BFS frontier: (NegotiationState, ModulePhases, prefix, committed_steps).
    // The `committed_steps` mirror `prefix` but as CommittedStep values so
    // `advance_local_fsm` can be called with a non-empty `prior_log` (needed
    // for jump/level-gated transitions).
    let mut queue: VecDeque<(
        NegotiationState,
        ModulePhases,
        Vec<WitnessCall>,
        Vec<CommittedStep>,
    )> = VecDeque::new();
    queue.push_back((initial_state, initial_phases, Vec::new(), Vec::new()));

    // Dedup on (serialized state, serialized phases, current_seat, prefix_len).
    let mut visited: HashSet<String> = HashSet::new();

    // Bound iterations to defend against unexpected fan-out from attachment
    // / phase-gate bugs. 100k is far above the expected ~few thousand for
    // today's module set.
    let mut iterations = 0u64;
    while let Some((state, phases, prefix, steps_log)) = queue.pop_front() {
        iterations += 1;
        if iterations > 100_000 {
            break;
        }
        let current_seat = match prefix.last() {
            Some(last) => next_seat(last.seat),
            None => dealer,
        };

        // Dedup key. Includes the full prefix-call label sequence so two
        // different authored paths reaching the same (state, phases) don't
        // prune each other — distinct prefixes imply distinct future
        // legal-call windows (last bid governs legal raises). This is
        // coarser than pure state+phase dedup but avoids losing branches
        // that must differ because `is_legal_call` depends on recent
        // calls.
        let state_json = serde_json::to_string(&state).unwrap_or_default();
        let phases_json = serde_json::to_string(&phases).unwrap_or_default();
        let prefix_labels: String = prefix
            .iter()
            .map(|c| {
                format!(
                    "{:?}:{}",
                    c.seat,
                    c.concrete_call()
                        .map(call_to_short_label)
                        .unwrap_or_else(|| "<pat>".to_string())
                )
            })
            .collect::<Vec<_>>()
            .join(",");
        let key = format!(
            "{}|{}|{:?}|{}",
            state_json, phases_json, current_seat, prefix_labels
        );
        if !visited.insert(key) {
            continue;
        }

        // Termination: kernel satisfied, seat aligned, auction open.
        let auction = auction_from_prefix(&prefix);
        if !prefix.is_empty()
            && match_kernel(kernel_req, &state)
            && current_seat == target_seat
            && !auction.is_complete
        {
            return Some(prefix);
        }

        if prefix.len() >= max_depth {
            continue;
        }
        if auction.is_complete {
            continue;
        }

        if is_partnership_seat(current_seat, dealer) {
            // Opening gate: before an opening, only Open-intent surfaces
            // are valid edges. Prevents the BFS from using a response
            // surface (e.g., AcceptTransfer) as the auction's first
            // partnership bid.
            let require_opening = matches!(state.captain, Captain::Undecided);

            for step in &steps {
                if seat_for_turn(step.turn, dealer) != current_seat {
                    continue;
                }
                if !is_legal_call(&auction, &step.default_call, current_seat) {
                    continue;
                }
                // FSM phase gate: the surface's defining module must be
                // in the surface's authored phase. Without this, a surface
                // like stayman's `shown-hearts:raise-game-hearts` would be
                // usable as a direct response to 1C, which is semantically
                // invalid and would be rejected by the live adapter.
                let module_phase = phases.get(&step.module_id).cloned().unwrap_or_default();
                if !phase_ref_contains(&step.phase, &module_phase) {
                    continue;
                }
                // Attachment gate: only check when the module is at its
                // INITIAL phase (i.e., about to be activated for the first
                // time). Once the module's FSM has advanced past initial,
                // it is "committed" — subsequent internal transitions
                // (e.g. jacoby accept after transfer) should proceed
                // without re-checking the activation trigger.
                if let Some(owner) = find_module(modules, &step.module_id) {
                    let is_at_initial = module_phase == owner.local.initial;
                    if is_at_initial && !module_attachments_active(owner, &prefix) {
                        continue;
                    }
                }
                if require_opening
                    && !step
                        .actions
                        .iter()
                        .any(|a| matches!(a, BidAction::Open { .. }))
                {
                    continue;
                }
                let new_state = apply_negotiation_actions(
                    &state,
                    &step.actions,
                    current_seat,
                    &step.default_call,
                );
                let committed = synth_committed_step(
                    current_seat,
                    step.default_call.clone(),
                    step.actions.clone(),
                );
                let new_phases =
                    advance_all_module_phases(modules, &phases, &committed, &steps_log);
                let mut new_prefix = prefix.clone();
                new_prefix.push(WitnessCall {
                    seat: current_seat,
                    spec: WitnessCallSpec::Concrete(step.default_call.clone()),
                    role: WitnessRole::Partnership,
                });
                let mut new_log = steps_log.clone();
                new_log.push(committed);
                queue.push_back((new_state, new_phases, new_prefix, new_log));
            }
            // Partnership pass for padding. Only allowed after an opening
            // (captain != Undecided), since a captain=Undecided all-pass
            // prefix can never establish a kernel.
            if !require_opening {
                let pass_step =
                    synth_committed_step(current_seat, Call::Pass, vec![BidAction::Pass]);
                let new_phases =
                    advance_all_module_phases(modules, &phases, &pass_step, &steps_log);
                let mut pass_prefix = prefix.clone();
                pass_prefix.push(WitnessCall {
                    seat: current_seat,
                    spec: WitnessCallSpec::Concrete(Call::Pass),
                    role: WitnessRole::Partnership,
                });
                let mut new_log = steps_log.clone();
                new_log.push(pass_step);
                queue.push_back((state.clone(), new_phases, pass_prefix, new_log));
            }
        } else {
            // Opponent seat: automatic pass.
            let pass_step = synth_committed_step(current_seat, Call::Pass, vec![BidAction::Pass]);
            let new_phases = advance_all_module_phases(modules, &phases, &pass_step, &steps_log);
            let mut new_prefix = prefix.clone();
            new_prefix.push(WitnessCall {
                seat: current_seat,
                spec: WitnessCallSpec::Concrete(Call::Pass),
                role: WitnessRole::Opponent,
            });
            let mut new_log = steps_log.clone();
            new_log.push(pass_step);
            queue.push_back((state, new_phases, new_prefix, new_log));
        }
    }

    None
}

/// Join a kernel-establishing prefix with an intra-module path. Today the
/// only fixture authoring a kernel gate places it on the target module's
/// `idle` (initial) state so `intra_prefix` is empty and the kernel prefix
/// itself reaches the target seat. When `intra_prefix` is non-empty (a
/// future-proofing case), we enforce seat-alignment: the last seat of
/// `kernel` +1 must equal `intra[0].seat`, otherwise the composition is
/// invalid and we reject.
fn splice_kernel_prefix(
    kernel: Vec<WitnessCall>,
    intra: Vec<WitnessCall>,
) -> Option<Vec<WitnessCall>> {
    if intra.is_empty() {
        return Some(kernel);
    }
    let last = kernel.last()?.seat;
    if next_seat(last) != intra[0].seat {
        return None;
    }
    let mut out = kernel;
    out.extend(intra);
    Some(out)
}

/// Replay a witness prefix through `apply_negotiation_actions` to recompute
/// the `NegotiationState` at the point the target surface is bid. For each
/// non-pass call we look up the emitting surface in `modules` via
/// `surfaces_emitting_call`; when multiple surfaces match, we prefer
/// fit-setting ones (their sourceIntent normalizes to
/// Raise/Agree/Accept/Transfer) and tie-break by `specificity_score`, then
/// by `(module_id, meaning_id)` lexicographic order.
///
/// Visibility: declared `pub` (reachable from the integration test at
/// `tests/witness_derivation.rs`) and annotated `#[doc(hidden)]` to signal
/// it is not part of the stable public API.
#[doc(hidden)]
pub fn replay_kernel_from_prefix(
    prefix: &[WitnessCall],
    modules: &[&ConventionModule],
    dealer: Seat,
) -> NegotiationState {
    let mut state = initial_negotiation();
    for entry in prefix {
        // Pattern witnesses can't be replayed without a deal; skip them. In
        // practice this function only fires for kernel-gated targets whose
        // prefixes are concrete (synthesized by find_kernel_establishing_prefix).
        let Some(entry_call) = entry.concrete_call() else {
            continue;
        };
        if matches!(entry_call, Call::Pass | Call::Double | Call::Redouble) {
            continue;
        }
        let candidates = surfaces_emitting_call(modules, entry_call, entry.seat, dealer);
        if candidates.is_empty() {
            continue;
        }
        // Among candidates, prefer fit-setting ones. Then pick the
        // most-specific by invert-score; tie-break by (module_id, meaning_id).
        let chosen = pick_replay_surface(&candidates);
        let actions = normalize_intent(&chosen.source_intent);
        state = apply_negotiation_actions(&state, &actions, entry.seat, entry_call);
    }
    state
}

fn pick_replay_surface<'m>(candidates: &[&'m BidMeaning]) -> &'m BidMeaning {
    // Partition by fit-setting vs not.
    let fit_setting: Vec<&BidMeaning> = candidates
        .iter()
        .copied()
        .filter(|s| actions_set_fit(&normalize_intent(&s.source_intent)))
        .collect();
    let pool: &[&BidMeaning] = if !fit_setting.is_empty() {
        &fit_setting[..]
    } else {
        candidates
    };
    // Pick most-specific; tie-break lexicographically on (module_id, meaning_id).
    let mut best: Option<&BidMeaning> = None;
    let mut best_score: isize = -1;
    for s in pool {
        let score = specificity_score_for_surface(s) as isize;
        let better = match best {
            None => true,
            Some(cur) => {
                if score != best_score {
                    score > best_score
                } else {
                    let cur_key = (
                        cur.module_id.as_deref().unwrap_or(""),
                        cur.meaning_id.as_str(),
                    );
                    let new_key = (s.module_id.as_deref().unwrap_or(""), s.meaning_id.as_str());
                    new_key < cur_key
                }
            }
        };
        if better {
            best = Some(s);
            best_score = score;
        }
    }
    best.unwrap_or(pool[0])
}

fn specificity_score_for_surface(surface: &BidMeaning) -> usize {
    // Cheap specificity: count hand-relevant clauses. Higher = more specific.
    surface
        .clauses
        .iter()
        .filter(|c| is_hand_fact_id(&c.fact_id))
        .count()
}

// =====================================================================
// Prefix merge (used by the non-kernel enumerate_witnesses path)
// =====================================================================

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
        // Approach C first. Pattern-aware: route steps may carry suit-class
        // qualifiers (e.g. NMF's "1m" = any minor opening) and yield
        // `WitnessCallSpec::Pattern` rather than concrete calls.
        //
        // Seat assignment: route Subseq steps describe a *partnership-only*
        // sequence — opener, responder, opener, ... — with opponent passes
        // implied between them. Use `step_seat(dealer, 2*i)` so step i goes
        // to the i-th partnership turn (N, S, N, S, ... when dealer=N).
        // Per-step `actor` overrides this default.
        let mut prefix_opt: Option<Vec<WitnessCall>> = None;
        if let Some(route) = se.route.as_ref() {
            // Inspect the route's Subseq steps directly so we can carry each
            // step's authored `actor` through to seat + role assignment.
            // `extract_required_prefix_specs_from_route` discards that info
            // by reducing each step to a `WitnessCallSpec`.
            if let Some(steps) = collect_subseq_steps(route) {
                let mut tractable = true;
                let mut prefix: Vec<WitnessCall> = Vec::with_capacity(steps.len());
                // Partnership-step counter — backstops steps that omit
                // `actor`. With Phase 3, routes for negdbl + similar
                // bundles intersperse opponent steps, so the legacy
                // `step_seat(dealer, 2*i)` formula no longer aligns.
                // When `actor` is set we trust it; otherwise we assume
                // partnership and advance the partnership turn counter.
                let mut partnership_idx = 0usize;
                for pat in steps {
                    let Some(spec) = reify_route_step_to_spec(pat) else {
                        tractable = false;
                        break;
                    };
                    let role = match pat.actor {
                        Some(TurnRole::Opponent) => WitnessRole::Opponent,
                        _ => WitnessRole::Partnership,
                    };
                    let seat = match pat.actor {
                        Some(actor) => seat_for_turn(actor, dealer),
                        None => {
                            let s = step_seat(dealer, 2 * partnership_idx);
                            partnership_idx += 1;
                            s
                        }
                    };
                    prefix.push(WitnessCall { seat, spec, role });
                }
                if tractable {
                    prefix_opt = Some(prefix);
                }
            } else if let Some(specs) = extract_required_prefix_specs_from_route(route) {
                // Non-Subseq tractable route (e.g. Last). Fall back to the
                // legacy partnership-cursor path.
                let mut prefix = Vec::with_capacity(specs.len());
                for (i, spec) in specs.into_iter().enumerate() {
                    let (seat, role) = match &spec {
                        WitnessCallSpec::Pattern(pat) => {
                            let role = match pat.actor {
                                Some(TurnRole::Opponent) => WitnessRole::Opponent,
                                _ => WitnessRole::Partnership,
                            };
                            let seat = match pat.actor {
                                Some(actor) => seat_for_turn(actor, dealer),
                                None => step_seat(dealer, 2 * i),
                            };
                            (seat, role)
                        }
                        WitnessCallSpec::Concrete(_) => {
                            (step_seat(dealer, 2 * i), WitnessRole::Partnership)
                        }
                    };
                    prefix.push(WitnessCall { seat, spec, role });
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

        let Some(intra_prefix) = prefix_opt else {
            continue;
        };

        // Kernel-gated target: splice in a fit-establishing prefix and
        // SUPPRESS the base-module responder-context fold. The kernel prefix
        // already contains an opening call (e.g., 1NT from natural-bids),
        // so folding the base-module 1NT context on top would double-open
        // the auction. See crates/CLAUDE.md + docs/guides/gotchas.md for
        // the invariant.
        let prefix = if let Some(kernel_expr) = se.kernel.as_ref() {
            let target_turn = match se.turn {
                Some(t) => t,
                None => continue,
            };
            let Some(kernel_prefix) = find_kernel_establishing_prefix(
                kernel_expr,
                loaded_modules,
                dealer,
                target_turn,
                MAX_KERNEL_PREFIX_DEPTH,
            ) else {
                // Kernel unreachable in this bundle — drop this state entry.
                continue;
            };
            match splice_kernel_prefix(kernel_prefix, intra_prefix) {
                Some(p) => p,
                None => continue,
            }
        } else {
            // No kernel: fold in the longest context path (base-module
            // opener context).
            let best_ctx = context_paths
                .iter()
                .cloned()
                .max_by_key(|p| p.len())
                .unwrap_or_default();
            merge_prefixes(intra_prefix, best_ctx)
        };

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

/// FSM-phase-aware variant of `surfaces_emitting_call`. Filters to surfaces
/// whose hosting state phase matches the module's current FSM phase — the
/// phase the module would be in after replaying `prior_prefix` through its
/// `local.transitions`. Prevents e.g. `stayman:show-hearts` (at `asked`
/// phase) from matching `N:2H` in a Jacoby-accept context where stayman's
/// FSM is still at `idle`.
fn surfaces_emitting_call_with_phase_gate<'m>(
    loaded_modules: &[&'m ConventionModule],
    call: &Call,
    bidder_seat: Seat,
    dealer: Seat,
    prior_prefix: &[WitnessCall],
) -> Vec<&'m BidMeaning> {
    // Compute per-module FSM phases after replaying prior_prefix.
    let mut phases = initial_module_phases(loaded_modules);
    let mut steps_log: Vec<CommittedStep> = Vec::new();
    for entry in prior_prefix {
        // Pattern witnesses are skipped here: project_witness only operates on
        // materialized concrete prefixes (live deal-gating already replays the
        // adapter to produce concrete calls before this is called).
        let Some(entry_call) = entry.concrete_call() else {
            continue;
        };
        let actions = if matches!(entry_call, Call::Pass) {
            vec![BidAction::Pass]
        } else {
            // Look up candidate surfaces for this historical call (loose
            // match; used only as a hint for FSM advance). Prefer
            // fit-setting surfaces to match BFS pick-logic.
            let candidates =
                surfaces_emitting_call(loaded_modules, entry_call, entry.seat, dealer);
            if candidates.is_empty() {
                Vec::new()
            } else {
                // Pick the most-specific fit-setting surface (matches BFS's
                // `pick_replay_surface` policy).
                let chosen = pick_replay_surface(&candidates);
                normalize_intent(&chosen.source_intent)
            }
        };
        let step = synth_committed_step(entry.seat, entry_call.clone(), actions);
        phases = advance_all_module_phases(loaded_modules, &phases, &step, &steps_log);
        steps_log.push(step);
    }

    let mut out = Vec::new();
    for m in loaded_modules {
        let Some(states) = m.states.as_ref() else {
            continue;
        };
        let module_phase = phases
            .get(&m.module_id)
            .cloned()
            .unwrap_or_else(|| m.local.initial.clone());
        for se in states {
            let Some(turn) = se.turn else {
                continue;
            };
            if seat_for_turn(turn, dealer) != bidder_seat {
                continue;
            }
            if !phase_ref_contains(&se.phase, &module_phase) {
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
/// Supported facts: responder strength thresholds, opener rebid thresholds,
/// responder/overcall range thresholds, competitive thresholds, and opening
/// weak-two / strong-2C thresholds.
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
        id if id == SYSTEM_OPENER_MINIMUM_VALUES && boolean_value => Some(hcp_range(
            system.opener_rebid.minimum_min_hcp,
            system.opener_rebid.minimum_max_hcp,
        )),
        id if id == SYSTEM_OPENER_MEDIUM_VALUES && boolean_value => Some(hcp_range(
            system.opener_rebid.medium_min_hcp,
            system.opener_rebid.medium_max_hcp,
        )),
        id if id == SYSTEM_OPENER_MAXIMUM_VALUES && boolean_value => Some(hcp_range(
            system.opener_rebid.maximum_min_hcp,
            system.opener_rebid.maximum_max_hcp,
        )),
        id if id == SYSTEM_OPENER_REVERSE_VALUES => {
            if boolean_value {
                Some(hcp_min(system.opener_rebid.reverse_min_hcp))
            } else {
                let cap = system.opener_rebid.reverse_min_hcp.saturating_sub(1);
                Some(hcp_max(cap))
            }
        }
        id if id == SYSTEM_OPENER_JUMP_SHIFT_VALUES => {
            if boolean_value {
                Some(hcp_min(system.opener_rebid.jump_shift_min_hcp))
            } else {
                let cap = system.opener_rebid.jump_shift_min_hcp.saturating_sub(1);
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
        id if id == SYSTEM_OVERCALLER_SIMPLE_VALUES && boolean_value => Some(hcp_range(
            system.competitive.simple_overcall_min_hcp,
            system.competitive.simple_overcall_max_hcp,
        )),
        id if id == SYSTEM_OVERCALLER_JUMP_VALUES && boolean_value => Some(hcp_range(
            system.opening.weak_two.min_hcp,
            system.competitive.jump_overcall_max_hcp,
        )),
        id if id == SYSTEM_TAKEOUT_DOUBLER_VALUES => {
            if boolean_value {
                Some(hcp_min(system.competitive.takeout_double_min_hcp))
            } else {
                let cap = system.competitive.takeout_double_min_hcp.saturating_sub(1);
                Some(hcp_max(cap))
            }
        }
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
                    let expanded =
                        expand_composition(inner, loaded_modules, system_config, depth + 1);
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
    // Used by no-interference projection. Pattern witnesses don't reach this
    // path (project_witness fast-paths concrete-only); skip Pattern entries
    // defensively rather than panic.
    Auction {
        entries: position
            .iter()
            .filter_map(|entry| {
                entry.concrete_call().map(|c| AuctionEntry {
                    seat: entry.seat,
                    call: c.clone(),
                })
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
/// Return the authored `kernel` NegotiationExpr for the state entry that
/// hosts `witness.target_surface_id` at the user's turn, or `None` if the
/// target state entry has no kernel gate. Used by `project_witness` to
/// decide whether to run the replay guard.
fn target_kernel_for_witness(
    target_module: &ConventionModule,
    witness: &Witness,
) -> Option<NegotiationExpr> {
    let states = target_module.states.as_ref()?;
    for se in states {
        let Some(turn) = se.turn else { continue };
        if seat_for_turn(turn, witness.dealer) != witness.user_seat {
            continue;
        }
        if se
            .surfaces
            .iter()
            .any(|s| s.meaning_id == witness.target_surface_id)
        {
            return se.kernel.clone();
        }
    }
    None
}

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

    // Kernel-replay guard: when the target StateEntry authors a kernel gate,
    // verify the witness prefix actually establishes that kernel by replaying
    // its BidActions. This confines behavior change to kernel-gated states —
    // stayman / jacoby / smolen / bergen targets have no kernel field and
    // skip this branch entirely.
    if let Some(kernel_req) = target_kernel_for_witness(target_module, witness) {
        let state = replay_kernel_from_prefix(&witness.prefix, loaded_modules, witness.dealer);
        if !match_kernel(&kernel_req, &state) {
            return Vec::new();
        }
    }

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
        per_seat.entry(witness.user_seat).or_default().push(best);
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
                spec: WitnessCallSpec::Concrete(Call::Pass),
                role: WitnessRole::Opponent,
            });
            cursor = step_seat(cursor, 1);
        }

        // Pattern witness step: we cannot project per-seat clauses without
        // knowing the concrete call. Skip the per-call surface lookup; the
        // resulting projection will be looser, which is acceptable because
        // pattern witnesses are routed through deal-gating before they ever
        // serve as a deal-generation constraint.
        let entry_call = match entry.concrete_call() {
            Some(c) => c,
            None => {
                position.push(entry.clone());
                cursor = step_seat(entry.seat, 1);
                continue;
            }
        };

        if entry_call == &Call::Pass && is_opponent_seat(entry.seat, witness.dealer) {
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

        let matches = surfaces_emitting_call_with_phase_gate(
            loaded_modules,
            entry_call,
            entry.seat,
            witness.dealer,
            &position,
        );
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
            spec: WitnessCallSpec::Concrete(Call::Pass),
            role: WitnessRole::Opponent,
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
            suit_class: None,
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
            suit_class: None,
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
            suit_class: None,
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
            suit_class: None,
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
            suit_class: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert_eq!(reify_obs_pattern(&dbl), Some(Call::Double));
    }

    #[test]
    fn pattern_matches_call_minor_open_at_level_1() {
        use crate::types::rule_types::SuitClass;
        let pat = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: None,
            strain: None,
            suit_class: Some(SuitClass::Minor),
            strength: None,
            actor: None,
            level: Some(1),
            jump: None,
        };
        assert!(pattern_matches_call(
            &pat,
            &Call::Bid {
                level: 1,
                strain: BidSuit::Clubs
            },
            &[]
        ));
        assert!(pattern_matches_call(
            &pat,
            &Call::Bid {
                level: 1,
                strain: BidSuit::Diamonds
            },
            &[]
        ));
        assert!(!pattern_matches_call(
            &pat,
            &Call::Bid {
                level: 1,
                strain: BidSuit::Hearts
            },
            &[]
        ));
        assert!(!pattern_matches_call(
            &pat,
            &Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump
            },
            &[]
        ));
        // Level 2 minor doesn't match level: 1.
        assert!(!pattern_matches_call(
            &pat,
            &Call::Bid {
                level: 2,
                strain: BidSuit::Clubs
            },
            &[]
        ));
    }

    #[test]
    fn witness_call_spec_concrete_serde_roundtrip() {
        let spec = WitnessCallSpec::Concrete(Call::Bid {
            level: 1,
            strain: BidSuit::NoTrump,
        });
        let json = serde_json::to_string(&spec).unwrap();
        let back: WitnessCallSpec = serde_json::from_str(&json).unwrap();
        assert_eq!(back, spec);
    }

    #[test]
    fn witness_call_spec_pattern_serde_roundtrip() {
        use crate::types::rule_types::SuitClass;
        let spec = WitnessCallSpec::Pattern(ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: None,
            strain: None,
            suit_class: Some(SuitClass::Minor),
            strength: None,
            actor: None,
            level: Some(1),
            jump: None,
        });
        let json = serde_json::to_string(&spec).unwrap();
        let back: WitnessCallSpec = serde_json::from_str(&json).unwrap();
        assert_eq!(back, spec);
    }

    #[test]
    fn witness_call_spec_matches_dispatches_concrete_and_pattern() {
        use crate::types::rule_types::SuitClass;
        let concrete = WitnessCallSpec::Concrete(Call::Bid {
            level: 1,
            strain: BidSuit::Clubs,
        });
        assert!(concrete.matches(
            &Call::Bid {
                level: 1,
                strain: BidSuit::Clubs
            },
            &[]
        ));
        assert!(!concrete.matches(
            &Call::Bid {
                level: 1,
                strain: BidSuit::Diamonds
            },
            &[]
        ));

        let pattern = WitnessCallSpec::Pattern(ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: None,
            strain: None,
            suit_class: Some(SuitClass::Minor),
            strength: None,
            actor: None,
            level: Some(1),
            jump: None,
        });
        assert!(pattern.matches(
            &Call::Bid {
                level: 1,
                strain: BidSuit::Clubs
            },
            &[]
        ));
        assert!(pattern.matches(
            &Call::Bid {
                level: 1,
                strain: BidSuit::Diamonds
            },
            &[]
        ));
    }
}
