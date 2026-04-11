//! Bridge-derived fact evaluators — layers 2 and 5.
//!
//! Standard (layer 2): hasFourCardMajor, hasFiveCardMajor, majorPattern, hasShortage
//! Relational (layer 5): supportForBoundSuit, fitWithBoundSuit, shortageInSuit, totalPointsForRaise

use std::collections::HashMap;

use bridge_engine::Hand;

use crate::types::{
    FactComposition, FactOperator, FactOutput, MatchCase, PrimitiveClause, PrimitiveClauseOperator,
    PrimitiveClauseValue,
};

use crate::types::system_config::PointFormula;

use super::composition::evaluate_composition;
use super::point_helpers::compute_total_points;
use super::primitives::suit_name_to_fact_id;
use super::types::{fv_bool, fv_num, get_num, FactValue, RelationalFactContext};

// --- Standard bridge-derived compositions (layer 2) ---

/// Build the composition tree for bridge.hasFourCardMajor.
fn four_card_major_composition() -> FactComposition {
    FactComposition::Or {
        operands: vec![
            suit_length_gte("hand.suitLength.spades", 4),
            suit_length_gte("hand.suitLength.hearts", 4),
        ],
    }
}

/// Build the composition tree for bridge.hasFiveCardMajor.
fn five_card_major_composition() -> FactComposition {
    FactComposition::Or {
        operands: vec![
            suit_length_gte("hand.suitLength.spades", 5),
            suit_length_gte("hand.suitLength.hearts", 5),
        ],
    }
}

/// Build the composition tree for bridge.hasShortage.
fn has_shortage_composition() -> FactComposition {
    FactComposition::Or {
        operands: vec![
            suit_length_lte("hand.suitLength.spades", 1),
            suit_length_lte("hand.suitLength.hearts", 1),
            suit_length_lte("hand.suitLength.diamonds", 1),
            suit_length_lte("hand.suitLength.clubs", 1),
        ],
    }
}

/// Build the Match composition for bridge.majorPattern (6-way classifier).
fn major_pattern_composition() -> FactComposition {
    FactComposition::Match {
        cases: vec![
            // five-five: both 5+
            MatchCase {
                when: FactComposition::And {
                    operands: vec![
                        suit_length_gte("hand.suitLength.spades", 5),
                        suit_length_gte("hand.suitLength.hearts", 5),
                    ],
                },
                then: FactOutput::Text("five-five".to_string()),
            },
            // five-four: S5+H4+ (spades longer)
            MatchCase {
                when: FactComposition::And {
                    operands: vec![
                        suit_length_gte("hand.suitLength.spades", 5),
                        suit_length_gte("hand.suitLength.hearts", 4),
                    ],
                },
                then: FactOutput::Text("five-four".to_string()),
            },
            // five-four: H5+S4+ (hearts longer)
            MatchCase {
                when: FactComposition::And {
                    operands: vec![
                        suit_length_gte("hand.suitLength.hearts", 5),
                        suit_length_gte("hand.suitLength.spades", 4),
                    ],
                },
                then: FactOutput::Text("five-four".to_string()),
            },
            // one-five: one major 5+ (but not both, since that was matched above)
            MatchCase {
                when: FactComposition::Or {
                    operands: vec![
                        suit_length_gte("hand.suitLength.spades", 5),
                        suit_length_gte("hand.suitLength.hearts", 5),
                    ],
                },
                then: FactOutput::Text("one-five".to_string()),
            },
            // both-four: both 4+
            MatchCase {
                when: FactComposition::And {
                    operands: vec![
                        suit_length_gte("hand.suitLength.spades", 4),
                        suit_length_gte("hand.suitLength.hearts", 4),
                    ],
                },
                then: FactOutput::Text("both-four".to_string()),
            },
            // one-four: one major 4+
            MatchCase {
                when: FactComposition::Or {
                    operands: vec![
                        suit_length_gte("hand.suitLength.spades", 4),
                        suit_length_gte("hand.suitLength.hearts", 4),
                    ],
                },
                then: FactOutput::Text("one-four".to_string()),
            },
        ],
        default: FactOutput::Text("none".to_string()),
    }
}

/// Evaluate standard bridge-derived facts (layer 2).
/// Adds 4 facts to the map using Rust-constructed composition trees.
pub fn evaluate_bridge_derived(hand: &Hand, facts: &mut HashMap<String, FactValue>) {
    let comps: &[(&str, FactComposition)] = &[
        ("bridge.hasFourCardMajor", four_card_major_composition()),
        ("bridge.hasFiveCardMajor", five_card_major_composition()),
        ("bridge.majorPattern", major_pattern_composition()),
        ("bridge.hasShortage", has_shortage_composition()),
    ];

    for (id, comp) in comps {
        let value = evaluate_composition(comp, hand, facts, None);
        facts.insert(
            id.to_string(),
            FactValue {
                fact_id: id.to_string(),
                value,
            },
        );
    }
}

// --- Relational bridge-derived evaluators (layer 5) ---

/// Evaluate relational bridge-derived facts (layer 5).
/// Overrides standard-pass values using relational context.
pub fn evaluate_bridge_relational(
    _hand: &Hand,
    facts: &mut HashMap<String, FactValue>,
    ctx: &RelationalFactContext,
) {
    let bound_suit_name = ctx
        .bindings
        .as_ref()
        .and_then(|b| b.get("suit").or_else(|| b.get("$suit")));

    // bridge.supportForBoundSuit — length in the bound suit (0 if unbound)
    let support = if let Some(suit_name) = bound_suit_name {
        if let Some(fact_id) = suit_name_to_fact_id(suit_name) {
            get_num(facts, fact_id)
        } else {
            0.0
        }
    } else {
        0.0
    };
    facts.insert(
        "bridge.supportForBoundSuit".to_string(),
        fv_num("bridge.supportForBoundSuit", support),
    );

    // bridge.fitWithBoundSuit — own length + partner's promised min >= 8
    let fit = if let Some(suit_name) = bound_suit_name {
        let own_length = support;
        let partner_min = find_partner_min_length(ctx, suit_name);
        own_length + partner_min >= 8.0
    } else {
        false
    };
    facts.insert(
        "bridge.fitWithBoundSuit".to_string(),
        fv_bool("bridge.fitWithBoundSuit", fit),
    );

    // bridge.shortageInSuit — length <= 1 in bound suit
    let shortage = if let Some(_suit_name) = bound_suit_name {
        support <= 1.0
    } else {
        false
    };
    facts.insert(
        "bridge.shortageInSuit".to_string(),
        fv_bool("bridge.shortageInSuit", shortage),
    );

    // bridge.totalPointsForRaise — HCP + shortage points excluding bound suit.
    // Intentionally hardcoded: raise evaluation always uses HCP+shortage regardless
    // of the user's PointConfig. This is a convention-level concept, not user-configurable.
    const RAISE_FORMULA: PointFormula = PointFormula {
        include_shortage: true,
        include_length: false,
    };
    let tp = if let Some(suit_name) = bound_suit_name {
        compute_total_points(facts, RAISE_FORMULA, Some(suit_name))
    } else {
        get_num(facts, "hand.hcp")
    };
    facts.insert(
        "bridge.totalPointsForRaise".to_string(),
        fv_num("bridge.totalPointsForRaise", tp),
    );
}

/// Find partner's minimum promised length for a suit from public commitments.
fn find_partner_min_length(ctx: &RelationalFactContext, suit_name: &str) -> f64 {
    let commitments = match &ctx.public_commitments {
        Some(c) => c,
        None => return 0.0,
    };

    let suit_fact_id = match suit_name_to_fact_id(suit_name) {
        Some(id) => id,
        None => return 0.0,
    };

    let mut partner_min = 0.0;
    for commitment in commitments {
        if commitment.constraint.fact_id == suit_fact_id
            && commitment.constraint.operator == FactOperator::Gte
        {
            let value = constraint_value_as_f64(&commitment.constraint.value);
            if value > partner_min {
                partner_min = value;
            }
        }
    }
    partner_min
}

/// Extract f64 from a ConstraintValue.
fn constraint_value_as_f64(value: &crate::types::ConstraintValue) -> f64 {
    match value {
        crate::types::ConstraintValue::Number(n) => n.as_f64().unwrap_or(0.0),
        _ => 0.0,
    }
}

// --- Helpers for building composition trees ---

fn suit_length_gte(fact_id: &str, min: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Gte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(min)),
        },
    }
}

fn suit_length_lte(fact_id: &str, max: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Lte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(max)),
        },
    }
}
