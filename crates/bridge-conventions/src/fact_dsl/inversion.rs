//! Fact composition inversion — converts FactComposition trees to constraint bounds.
//!
//! Direct port of TS `fact-inversion.ts`. Produces `InvertedConstraint` with
//! HCP and suit length bounds usable for deal generation.

use std::collections::HashMap;

use bridge_engine::types::{DealConstraints, Seat, SeatConstraint};
use bridge_engine::Suit;

use crate::registry::module_registry::{get_base_module_ids, get_module};
use crate::types::{
    BaseSystemId, BidMeaningClause, ConstraintValue, ConventionBundle, ConventionModule,
    FactComposition, FactOperator, PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue,
    TurnRole,
};

/// Inverted constraint bounds extracted from a composition tree.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct InvertedConstraint {
    pub min_hcp: Option<u32>,
    pub max_hcp: Option<u32>,
    pub balanced: Option<bool>,
    /// AND semantics: all suits must meet their bounds.
    pub min_length: Option<HashMap<Suit, u8>>,
    pub max_length: Option<HashMap<Suit, u8>>,
    /// OR semantics: at least one suit must meet its bound.
    pub min_length_any: Option<HashMap<Suit, u8>>,
}

/// Invert a composition tree into constraint bounds.
pub fn invert_composition(comp: &FactComposition) -> InvertedConstraint {
    match comp {
        FactComposition::Primitive { clause } => invert_primitive(clause),
        FactComposition::And { operands } => {
            let constraints: Vec<InvertedConstraint> =
                operands.iter().map(invert_composition).collect();
            intersect_all(&constraints)
        }
        FactComposition::Or { operands } => {
            let constraints: Vec<InvertedConstraint> =
                operands.iter().map(invert_composition).collect();
            union_all(&constraints)
        }
        FactComposition::Not { .. } => InvertedConstraint::default(),
        // Extended, Match, Compute are not invertible for deal generation
        _ => InvertedConstraint::default(),
    }
}

fn invert_primitive(clause: &PrimitiveClause) -> InvertedConstraint {
    if clause.fact_id == "hand.hcp" {
        return invert_hcp(clause);
    }
    if clause.fact_id == "hand.isBalanced" || clause.fact_id == "bridge.isBalanced" {
        return InvertedConstraint {
            balanced: Some(true),
            ..Default::default()
        };
    }
    if let Some(suit) = suit_from_fact_id(&clause.fact_id) {
        return invert_suit_length(suit, clause);
    }
    InvertedConstraint::default()
}

fn invert_hcp(clause: &PrimitiveClause) -> InvertedConstraint {
    match &clause.operator {
        PrimitiveClauseOperator::Range => {
            if let PrimitiveClauseValue::Range { min, max } = &clause.value {
                InvertedConstraint {
                    min_hcp: min.as_u64().map(|v| v as u32),
                    max_hcp: max.as_u64().map(|v| v as u32),
                    ..Default::default()
                }
            } else {
                InvertedConstraint::default()
            }
        }
        _ => {
            let v = clause_value_as_u32(&clause.value);
            match clause.operator {
                PrimitiveClauseOperator::Gte => InvertedConstraint {
                    min_hcp: Some(v),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Lte => InvertedConstraint {
                    max_hcp: Some(v),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Eq => InvertedConstraint {
                    min_hcp: Some(v),
                    max_hcp: Some(v),
                    ..Default::default()
                },
                _ => InvertedConstraint::default(),
            }
        }
    }
}

fn invert_suit_length(suit: Suit, clause: &PrimitiveClause) -> InvertedConstraint {
    match &clause.operator {
        PrimitiveClauseOperator::Range => {
            if let PrimitiveClauseValue::Range { min, max } = &clause.value {
                let mut constraint = InvertedConstraint::default();
                if let Some(min_v) = min.as_u64() {
                    constraint.min_length = Some(HashMap::from([(suit, min_v as u8)]));
                }
                if let Some(max_v) = max.as_u64() {
                    constraint.max_length = Some(HashMap::from([(suit, max_v as u8)]));
                }
                constraint
            } else {
                InvertedConstraint::default()
            }
        }
        _ => {
            let v = clause_value_as_u8(&clause.value);
            match clause.operator {
                PrimitiveClauseOperator::Gte => InvertedConstraint {
                    min_length: Some(HashMap::from([(suit, v)])),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Lte => InvertedConstraint {
                    max_length: Some(HashMap::from([(suit, v)])),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Eq => InvertedConstraint {
                    min_length: Some(HashMap::from([(suit, v)])),
                    max_length: Some(HashMap::from([(suit, v)])),
                    ..Default::default()
                },
                _ => InvertedConstraint::default(),
            }
        }
    }
}

/// AND: take tightest bounds.
fn intersect_all(constraints: &[InvertedConstraint]) -> InvertedConstraint {
    if constraints.is_empty() {
        return InvertedConstraint::default();
    }
    if constraints.len() == 1 {
        return constraints[0].clone();
    }

    let mut result = InvertedConstraint::default();

    for c in constraints {
        // HCP: max of mins, min of maxes
        if let Some(min) = c.min_hcp {
            result.min_hcp = Some(result.min_hcp.map_or(min, |cur| cur.max(min)));
        }
        if let Some(max) = c.max_hcp {
            result.max_hcp = Some(result.max_hcp.map_or(max, |cur| cur.min(max)));
        }
        // Balanced: last wins
        if c.balanced.is_some() {
            result.balanced = c.balanced;
        }
        // MinLength AND: max per suit
        if let Some(ref ml) = c.min_length {
            let target = result.min_length.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let entry = target.entry(suit).or_insert(0);
                *entry = (*entry).max(len);
            }
        }
        // MaxLength AND: min per suit
        if let Some(ref ml) = c.max_length {
            let target = result.max_length.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let entry = target.entry(suit).or_insert(13);
                *entry = (*entry).min(len);
            }
        }
        // MinLengthAny: merge by max per suit
        if let Some(ref mla) = c.min_length_any {
            let target = result.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in mla {
                let entry = target.entry(suit).or_insert(0);
                *entry = (*entry).max(len);
            }
        }
    }

    result
}

/// OR: take loosest bounds.
fn union_all(constraints: &[InvertedConstraint]) -> InvertedConstraint {
    if constraints.is_empty() {
        return InvertedConstraint::default();
    }
    if constraints.len() == 1 {
        return constraints[0].clone();
    }

    let mut result = InvertedConstraint::default();
    let mut has_min_hcp = true;
    let mut has_max_hcp = true;

    for c in constraints {
        // HCP: min of mins (loosest), max of maxes
        match c.min_hcp {
            Some(min) => {
                result.min_hcp = Some(result.min_hcp.map_or(min, |cur| cur.min(min)));
            }
            None => has_min_hcp = false,
        }
        match c.max_hcp {
            Some(max) => {
                result.max_hcp = Some(result.max_hcp.map_or(max, |cur| cur.max(max)));
            }
            None => has_max_hcp = false,
        }

        // MinLength → MinLengthAny: merge by min per suit (loosest)
        if let Some(ref ml) = c.min_length {
            let target = result.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let entry = target.entry(suit).or_insert(len);
                *entry = (*entry).min(len);
            }
        }
        if let Some(ref mla) = c.min_length_any {
            let target = result.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in mla {
                let entry = target.entry(suit).or_insert(len);
                *entry = (*entry).min(len);
            }
        }
    }

    // If any branch lacks a bound, remove it (loosest = unconstrained)
    if !has_min_hcp {
        result.min_hcp = None;
    }
    if !has_max_hcp {
        result.max_hcp = None;
    }

    result
}

// --- Helpers ---

fn suit_from_fact_id(fact_id: &str) -> Option<Suit> {
    match fact_id {
        "hand.suitLength.spades" => Some(Suit::Spades),
        "hand.suitLength.hearts" => Some(Suit::Hearts),
        "hand.suitLength.diamonds" => Some(Suit::Diamonds),
        "hand.suitLength.clubs" => Some(Suit::Clubs),
        _ => None,
    }
}

fn clause_value_as_u32(value: &PrimitiveClauseValue) -> u32 {
    match value {
        PrimitiveClauseValue::Single(n) => n.as_u64().unwrap_or(0) as u32,
        PrimitiveClauseValue::Range { min, .. } => min.as_u64().unwrap_or(0) as u32,
    }
}

fn clause_value_as_u8(value: &PrimitiveClauseValue) -> u8 {
    clause_value_as_u32(value) as u8
}

// --- Surface clause → composition ---

/// Map a `BidMeaningClause` (which uses the richer `FactOperator`/`ConstraintValue`
/// from the surface vocabulary) into a `PrimitiveClause` suitable for inversion.
/// Returns `None` when the operator/value does not fit the primitive shape
/// (e.g. `In`, string/list values); the caller is expected to drop these.
fn clause_to_primitive(clause: &BidMeaningClause) -> Option<PrimitiveClause> {
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
        // Boolean: encode as Eq with 1/0 so the downstream inverter still sees a
        // numeric clause. `invert_primitive` dispatches by fact_id, so unknown
        // boolean facts (e.g. `bridge.hasFiveCardMajor`) are silently dropped.
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

/// Build an `And`-composition from a list of surface clauses. Non-primitive
/// clauses (unmappable operators/values) are skipped. Empty input yields an
/// empty `And`, which `invert_composition` handles as an unconstrained result.
pub fn compose_surface_clauses(clauses: &[BidMeaningClause]) -> FactComposition {
    let operands: Vec<FactComposition> = clauses
        .iter()
        .filter_map(|c| clause_to_primitive(c).map(|p| FactComposition::Primitive { clause: p }))
        .collect();
    FactComposition::And { operands }
}

// --- Seat-level deal constraint derivation ---

fn seat_from_turn(turn: TurnRole) -> Option<Seat> {
    match turn {
        TurnRole::Opener => Some(Seat::North),
        TurnRole::Responder => Some(Seat::South),
        TurnRole::Opponent => None,
    }
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

/// Derive deal-generation constraints by inverting every surface clause across
/// the bundle's modules plus the system's base modules.
///
/// Lives in `bridge-conventions` (not `bridge-service`) because the module
/// registry is in-crate; callers pass a `BaseSystemId` and we resolve base
/// modules via `get_module`. The plan's `SystemConfig` signature was relaxed
/// to `BaseSystemId` since `SystemConfig` carries no `base_module_ids`.
pub fn derive_deal_constraints(bundle: &ConventionBundle, system: BaseSystemId) -> DealConstraints {
    // Collect candidate modules: bundle.modules + base modules resolved via registry.
    let mut candidates: Vec<&ConventionModule> = bundle.modules.iter().collect();
    for base_id in get_base_module_ids(system) {
        if let Some(m) = get_module(base_id, system) {
            // Avoid double-counting if a base module is also in bundle.modules.
            if !candidates.iter().any(|c| c.module_id == m.module_id) {
                candidates.push(m);
            }
        }
    }

    // Bucket inverted constraints per partnership seat, then union (OR) across
    // alternative surfaces within the same seat (different surfaces are
    // alternative meanings, not conjunctions).
    let mut per_seat: HashMap<Seat, Vec<InvertedConstraint>> = HashMap::new();

    for module in candidates {
        let Some(states) = module.states.as_ref() else {
            continue;
        };
        for state_entry in states {
            let Some(turn) = state_entry.turn else {
                continue;
            };
            let Some(seat) = seat_from_turn(turn) else {
                continue;
            };
            for surface in &state_entry.surfaces {
                let comp = compose_surface_clauses(&surface.clauses);
                let inverted = invert_composition(&comp);
                per_seat.entry(seat).or_default().push(inverted);
            }
        }
    }

    let mut seats: Vec<SeatConstraint> = per_seat
        .into_iter()
        .map(|(seat, constraints)| {
            let merged = union_all(&constraints);
            inverted_to_seat_constraint(seat, &merged)
        })
        .collect();
    // Deterministic order.
    seats.sort_by_key(|s| format!("{:?}", s.seat));

    DealConstraints {
        seats,
        dealer: Some(Seat::North),
        vulnerability: None,
        max_attempts: Some(50_000),
        seed: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invert_hcp_gte() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(12)),
            },
        };
        let result = invert_composition(&comp);
        assert_eq!(result.min_hcp, Some(12));
        assert_eq!(result.max_hcp, None);
    }

    #[test]
    fn invert_suit_length_range() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.suitLength.spades".to_string(),
                operator: PrimitiveClauseOperator::Range,
                value: PrimitiveClauseValue::Range {
                    min: serde_json::Number::from(4),
                    max: serde_json::Number::from(6),
                },
            },
        };
        let result = invert_composition(&comp);
        assert_eq!(
            result.min_length.as_ref().unwrap().get(&Suit::Spades),
            Some(&4)
        );
        assert_eq!(
            result.max_length.as_ref().unwrap().get(&Suit::Spades),
            Some(&6)
        );
    }

    #[test]
    fn invert_and_tightens() {
        let comp = FactComposition::And {
            operands: vec![
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.hcp".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(8)),
                    },
                },
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.hcp".to_string(),
                        operator: PrimitiveClauseOperator::Lte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(12)),
                    },
                },
            ],
        };
        let result = invert_composition(&comp);
        assert_eq!(result.min_hcp, Some(8));
        assert_eq!(result.max_hcp, Some(12));
    }

    #[test]
    fn invert_or_loosens() {
        let comp = FactComposition::Or {
            operands: vec![
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.suitLength.spades".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                    },
                },
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.suitLength.hearts".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(4)),
                    },
                },
            ],
        };
        let result = invert_composition(&comp);
        // OR moves min_length → min_length_any
        assert!(result.min_length.is_none());
        let any = result.min_length_any.unwrap();
        assert_eq!(any.get(&Suit::Spades), Some(&5));
        assert_eq!(any.get(&Suit::Hearts), Some(&4));
    }

    #[test]
    fn invert_balanced() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.isBalanced".to_string(),
                operator: PrimitiveClauseOperator::Eq,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(1)),
            },
        };
        let result = invert_composition(&comp);
        assert_eq!(result.balanced, Some(true));
    }

    // --- compose_surface_clauses ---

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
    fn compose_surface_clauses_simple() {
        let clauses = vec![
            clause("hand.hcp", FactOperator::Gte, ConstraintValue::int(8)),
            clause(
                "hand.suitLength.hearts",
                FactOperator::Gte,
                ConstraintValue::int(4),
            ),
        ];
        let comp = compose_surface_clauses(&clauses);
        match comp {
            FactComposition::And { operands } => {
                assert_eq!(operands.len(), 2);
                match &operands[0] {
                    FactComposition::Primitive { clause } => {
                        assert_eq!(clause.fact_id, "hand.hcp");
                        assert_eq!(clause.operator, PrimitiveClauseOperator::Gte);
                        assert_eq!(
                            clause.value,
                            PrimitiveClauseValue::Single(serde_json::Number::from(8))
                        );
                    }
                    _ => panic!("expected Primitive"),
                }
                match &operands[1] {
                    FactComposition::Primitive { clause } => {
                        assert_eq!(clause.fact_id, "hand.suitLength.hearts");
                        assert_eq!(clause.operator, PrimitiveClauseOperator::Gte);
                    }
                    _ => panic!("expected Primitive"),
                }
            }
            _ => panic!("expected And"),
        }
    }

    #[test]
    fn compose_surface_clauses_empty() {
        let comp = compose_surface_clauses(&[]);
        match comp {
            FactComposition::And { operands } => assert!(operands.is_empty()),
            _ => panic!("expected And"),
        }
    }

    #[test]
    fn invert_stayman_eligible_clauses() {
        // Stayman's `module.stayman.eligible` activation-like clauses:
        // hcp >= 8, hearts >= 4 OR spades >= 4 (we encode as two min-length entries
        // flowing through OR-style inversion), plus a hasFiveCardMajor:false that
        // must be silently dropped.
        //
        // Per plan: wrapping all in And is fine — the point is confirming that
        // `bridge.hasFiveCardMajor` doesn't leak into the result.
        let clauses = vec![
            clause("hand.hcp", FactOperator::Gte, ConstraintValue::int(8)),
            clause(
                "hand.suitLength.hearts",
                FactOperator::Gte,
                ConstraintValue::int(4),
            ),
            clause(
                "hand.suitLength.spades",
                FactOperator::Gte,
                ConstraintValue::int(4),
            ),
            clause(
                "bridge.hasFiveCardMajor",
                FactOperator::Boolean,
                ConstraintValue::Bool(false),
            ),
        ];
        // To mirror "4+ hearts OR 4+ spades" semantics for eligibility, invert
        // the AND here — this test is about the primitive mapping, not the
        // logical shape. We just need to confirm inversion runs cleanly and
        // the Boolean clause for hasFiveCardMajor was silently dropped.
        let comp = compose_surface_clauses(&clauses);
        let inv = invert_composition(&comp);

        // HCP lower bound survived.
        assert_eq!(inv.min_hcp, Some(8));
        // Heart and spade min lengths survived (under AND semantics: both min 4).
        let mls = inv.min_length.as_ref().expect("min_length populated");
        assert_eq!(mls.get(&Suit::Hearts), Some(&4));
        assert_eq!(mls.get(&Suit::Spades), Some(&4));
        // No field corresponds to hasFiveCardMajor — balanced stays None because
        // the Boolean clause mapped to Eq(0) on an unrecognized fact_id and was
        // dropped by `invert_primitive`.
        assert_eq!(inv.balanced, None);
    }

    #[test]
    fn derive_deal_constraints_nt_stayman() {
        use crate::registry::resolve_bundle;

        let bundle = resolve_bundle("nt-stayman", BaseSystemId::Sayc)
            .expect("nt-stayman bundle should resolve");
        let constraints = derive_deal_constraints(bundle, BaseSystemId::Sayc);

        // Dealer + max_attempts are fixed at the function level.
        assert_eq!(constraints.dealer, Some(Seat::North));
        assert_eq!(constraints.max_attempts, Some(50_000));

        // Both opener (N) and responder (S) seats populated.
        let seats: std::collections::HashMap<Seat, &SeatConstraint> =
            constraints.seats.iter().map(|s| (s.seat, s)).collect();
        assert!(seats.contains_key(&Seat::North), "N seat should be present");
        let south = seats.get(&Seat::South).expect("S seat should be present");

        // Responder's Stayman eligibility surface promises 4+ hearts OR 4+ spades,
        // so the unioned responder constraint should expose at least one of those
        // through `min_length_any` with value >= 4. Base-module responder surfaces
        // with looser length bounds may also contribute, so accept either entry.
        let any = south
            .min_length_any
            .as_ref()
            .expect("S min_length_any should be populated from Stayman surfaces");
        let hearts_ok = any.get(&Suit::Hearts).copied().unwrap_or(0) >= 4;
        let spades_ok = any.get(&Suit::Spades).copied().unwrap_or(0) >= 4;
        assert!(
            hearts_ok || spades_ok,
            "expected H or S min_length_any >= 4, got {:?}",
            any
        );
    }
}
