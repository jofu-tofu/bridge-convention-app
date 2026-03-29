//! Rust-constructed FactComposition trees for module-derived facts.
//!
//! For TS facts that lack `composition` fields in their FactDefinition,
//! this module provides programmatically constructed FactComposition trees.
//! These are a Rust-only superset — they use ExtendedClause variants
//! (TopHonorCount, SuitCompare, etc.) not present in the TS type system.
//!
//! As TS definitions are updated to include compositions with expanded clause types,
//! entries here become redundant and can be removed.

use std::collections::HashMap;

use bridge_engine::Suit;

use crate::types::{
    CompareOp, ExtendedClause, FactComposition, FactOutput, MatchCase,
    PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue,
};

/// Build the map of fact ID → Rust-constructed FactComposition.
/// Called once at evaluator initialization.
pub fn build_rust_compositions() -> HashMap<String, FactComposition> {
    let mut map = HashMap::new();

    // --- Stayman module ---
    add_stayman_compositions(&mut map);

    // --- Jacoby Transfers module ---
    add_transfer_compositions(&mut map);

    // --- Bergen module ---
    add_bergen_compositions(&mut map);

    // --- Blackwood module ---
    add_blackwood_compositions(&mut map);

    // --- DONT module ---
    add_dont_compositions(&mut map);

    // --- Weak Twos module ---
    add_weak_two_compositions(&mut map);

    map
}

// ============================================================
// Stayman
// ============================================================

fn add_stayman_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.stayman.eligible: hasFourCardMajor AND hcp >= inviteMin
    // Note: inviteMin is baked from SystemConfig at evaluation time.
    // We use a BooleanFact reference here since bridge.hasFourCardMajor is
    // evaluated in layer 2 before module-derived facts in layer 4.
    // The HCP threshold is parameterized — the evaluator must substitute
    // the actual threshold. We use 8 as the SAYC default.
    map.insert(
        "module.stayman.eligible".to_string(),
        FactComposition::And {
            operands: vec![
                extended_bool("bridge.hasFourCardMajor", true),
                hcp_gte(8),
            ],
        },
    );

    // module.stayman.preferred: eligible AND (no 5-card major OR has 5-4 in both majors)
    map.insert(
        "module.stayman.preferred".to_string(),
        FactComposition::And {
            operands: vec![
                extended_bool("module.stayman.eligible", true),
                FactComposition::Or {
                    operands: vec![
                        // No 5-card major
                        extended_bool("bridge.hasFiveCardMajor", false),
                        // 5-4 in both majors (either way)
                        FactComposition::And {
                            operands: vec![
                                suit_gte("hand.suitLength.spades", 4),
                                suit_gte("hand.suitLength.hearts", 4),
                                FactComposition::Or {
                                    operands: vec![
                                        suit_gte("hand.suitLength.spades", 5),
                                        suit_gte("hand.suitLength.hearts", 5),
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    );
}

// ============================================================
// Jacoby Transfers
// ============================================================

fn add_transfer_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.transfer.targetSuit: spades first (when both 5+), then hearts
    map.insert(
        "module.transfer.targetSuit".to_string(),
        FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: suit_gte("hand.suitLength.spades", 5),
                    then: FactOutput::Text("spades".to_string()),
                },
                MatchCase {
                    when: suit_gte("hand.suitLength.hearts", 5),
                    then: FactOutput::Text("hearts".to_string()),
                },
            ],
            default: FactOutput::Text("none".to_string()),
        },
    );

    // module.transfer.eligible: has a 5-card major
    map.insert(
        "module.transfer.eligible".to_string(),
        extended_bool("bridge.hasFiveCardMajor", true),
    );

    // module.transfer.preferred: same as eligible
    map.insert(
        "module.transfer.preferred".to_string(),
        extended_bool("module.transfer.eligible", true),
    );

    // module.transfer.openerHasHeartFit: 3+ hearts
    map.insert(
        "module.transfer.openerHasHeartFit".to_string(),
        suit_gte("hand.suitLength.hearts", 3),
    );

    // module.transfer.openerHasSpadesFit: 3+ spades
    map.insert(
        "module.transfer.openerHasSpadesFit".to_string(),
        suit_gte("hand.suitLength.spades", 3),
    );
}

// ============================================================
// Bergen
// ============================================================

fn add_bergen_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.bergen.hasMajorSupport: exactly 4 in at least one major
    map.insert(
        "module.bergen.hasMajorSupport".to_string(),
        FactComposition::Or {
            operands: vec![
                suit_eq("hand.suitLength.hearts", 4),
                suit_eq("hand.suitLength.spades", 4),
            ],
        },
    );
}

// ============================================================
// Blackwood
// ============================================================

fn add_blackwood_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.blackwood.slamInterest: HCP >= slamMin (default 15 for SAYC)
    map.insert(
        "module.blackwood.slamInterest".to_string(),
        hcp_gte(15),
    );

    // module.blackwood.aceCount: count of aces
    map.insert(
        "module.blackwood.aceCount".to_string(),
        FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount { min: Some(4), max: Some(4) },
                    },
                    then: FactOutput::Number(4.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount { min: Some(3), max: Some(3) },
                    },
                    then: FactOutput::Number(3.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount { min: Some(2), max: Some(2) },
                    },
                    then: FactOutput::Number(2.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount { min: Some(1), max: Some(1) },
                    },
                    then: FactOutput::Number(1.0),
                },
            ],
            default: FactOutput::Number(0.0),
        },
    );

    // module.blackwood.kingCount: count of kings
    map.insert(
        "module.blackwood.kingCount".to_string(),
        FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount { min: Some(4), max: Some(4) },
                    },
                    then: FactOutput::Number(4.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount { min: Some(3), max: Some(3) },
                    },
                    then: FactOutput::Number(3.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount { min: Some(2), max: Some(2) },
                    },
                    then: FactOutput::Number(2.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount { min: Some(1), max: Some(1) },
                    },
                    then: FactOutput::Number(1.0),
                },
            ],
            default: FactOutput::Number(0.0),
        },
    );
}

// ============================================================
// DONT
// ============================================================

fn add_dont_compositions(map: &mut HashMap<String, FactComposition>) {
    // Simple suit-length facts (those already have TS compositions, but we provide Rust-side too)

    // module.dont.singleSuited: one suit 6+, no other 4+, longest is not spades
    map.insert(
        "module.dont.singleSuited".to_string(),
        FactComposition::Or {
            operands: vec![
                // Clubs 6+ and longest (not spades)
                FactComposition::And {
                    operands: vec![
                        suit_gte("hand.suitLength.clubs", 6),
                        suit_lte("hand.suitLength.diamonds", 3),
                        suit_lte("hand.suitLength.hearts", 3),
                        suit_lte("hand.suitLength.spades", 3),
                    ],
                },
                // Diamonds 6+ and longest
                FactComposition::And {
                    operands: vec![
                        suit_gte("hand.suitLength.diamonds", 6),
                        suit_lte("hand.suitLength.clubs", 3),
                        suit_lte("hand.suitLength.hearts", 3),
                        suit_lte("hand.suitLength.spades", 3),
                    ],
                },
                // Hearts 6+ and longest
                FactComposition::And {
                    operands: vec![
                        suit_gte("hand.suitLength.hearts", 6),
                        suit_lte("hand.suitLength.clubs", 3),
                        suit_lte("hand.suitLength.diamonds", 3),
                        suit_lte("hand.suitLength.spades", 3),
                    ],
                },
            ],
        },
    );

    // module.dont.singleSuitClubs / Diamonds / Hearts
    map.insert(
        "module.dont.singleSuitClubs".to_string(),
        FactComposition::And {
            operands: vec![
                extended_bool("module.dont.singleSuited", true),
                FactComposition::Extended {
                    clause: ExtendedClause::LongestSuitIs { suit: Suit::Clubs },
                },
                suit_gte("hand.suitLength.clubs", 6),
            ],
        },
    );
    map.insert(
        "module.dont.singleSuitDiamonds".to_string(),
        FactComposition::And {
            operands: vec![
                extended_bool("module.dont.singleSuited", true),
                FactComposition::Extended {
                    clause: ExtendedClause::LongestSuitIs { suit: Suit::Diamonds },
                },
                suit_gte("hand.suitLength.diamonds", 6),
            ],
        },
    );
    map.insert(
        "module.dont.singleSuitHearts".to_string(),
        FactComposition::And {
            operands: vec![
                extended_bool("module.dont.singleSuited", true),
                FactComposition::Extended {
                    clause: ExtendedClause::LongestSuitIs { suit: Suit::Hearts },
                },
                suit_gte("hand.suitLength.hearts", 6),
            ],
        },
    );

    // module.dont.clubsHigherDiamonds: with clubs anchor, higher suit is diamonds
    // D >= 4 AND D > H AND D > S
    map.insert(
        "module.dont.clubsHigherDiamonds".to_string(),
        FactComposition::And {
            operands: vec![
                suit_gte("hand.suitLength.diamonds", 4),
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Diamonds,
                        op: CompareOp::Gt,
                        b: Suit::Hearts,
                    },
                },
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Diamonds,
                        op: CompareOp::Gt,
                        b: Suit::Spades,
                    },
                },
            ],
        },
    );

    // module.dont.clubsHigherHearts: H >= 4 AND H >= D AND H > S
    map.insert(
        "module.dont.clubsHigherHearts".to_string(),
        FactComposition::And {
            operands: vec![
                suit_gte("hand.suitLength.hearts", 4),
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Hearts,
                        op: CompareOp::Gte,
                        b: Suit::Diamonds,
                    },
                },
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Hearts,
                        op: CompareOp::Gt,
                        b: Suit::Spades,
                    },
                },
            ],
        },
    );

    // module.dont.clubsHigherSpades: S >= 4 AND S >= H AND S >= D
    map.insert(
        "module.dont.clubsHigherSpades".to_string(),
        FactComposition::And {
            operands: vec![
                suit_gte("hand.suitLength.spades", 4),
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Spades,
                        op: CompareOp::Gte,
                        b: Suit::Hearts,
                    },
                },
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Spades,
                        op: CompareOp::Gte,
                        b: Suit::Diamonds,
                    },
                },
            ],
        },
    );

    // module.dont.diamondsMajorHearts: H >= 4 AND H > S
    map.insert(
        "module.dont.diamondsMajorHearts".to_string(),
        FactComposition::And {
            operands: vec![
                suit_gte("hand.suitLength.hearts", 4),
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Hearts,
                        op: CompareOp::Gt,
                        b: Suit::Spades,
                    },
                },
            ],
        },
    );

    // module.dont.diamondsMajorSpades: S >= 4 AND S >= H
    map.insert(
        "module.dont.diamondsMajorSpades".to_string(),
        FactComposition::And {
            operands: vec![
                suit_gte("hand.suitLength.spades", 4),
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Spades,
                        op: CompareOp::Gte,
                        b: Suit::Hearts,
                    },
                },
            ],
        },
    );

    // module.dont.hasHeartSupport: 3+ hearts OR (2+ hearts AND hearts >= spades)
    map.insert(
        "module.dont.hasHeartSupport".to_string(),
        FactComposition::Or {
            operands: vec![
                suit_gte("hand.suitLength.hearts", 3),
                FactComposition::And {
                    operands: vec![
                        suit_gte("hand.suitLength.hearts", 2),
                        FactComposition::Extended {
                            clause: ExtendedClause::SuitCompare {
                                a: Suit::Hearts,
                                op: CompareOp::Gte,
                                b: Suit::Spades,
                            },
                        },
                    ],
                },
            ],
        },
    );

    // module.dont.hasLongMinor: 6+ clubs or 6+ diamonds
    map.insert(
        "module.dont.hasLongMinor".to_string(),
        FactComposition::Or {
            operands: vec![
                suit_gte("hand.suitLength.clubs", 6),
                suit_gte("hand.suitLength.diamonds", 6),
            ],
        },
    );

    // module.dont.longMinorIsClubs: clubs >= 6 AND clubs >= diamonds
    map.insert(
        "module.dont.longMinorIsClubs".to_string(),
        FactComposition::And {
            operands: vec![
                suit_gte("hand.suitLength.clubs", 6),
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Clubs,
                        op: CompareOp::Gte,
                        b: Suit::Diamonds,
                    },
                },
            ],
        },
    );

    // module.dont.longMinorIsDiamonds: diamonds >= 6 AND diamonds > clubs
    map.insert(
        "module.dont.longMinorIsDiamonds".to_string(),
        FactComposition::And {
            operands: vec![
                suit_gte("hand.suitLength.diamonds", 6),
                FactComposition::Extended {
                    clause: ExtendedClause::SuitCompare {
                        a: Suit::Diamonds,
                        op: CompareOp::Gt,
                        b: Suit::Clubs,
                    },
                },
            ],
        },
    );
}

// ============================================================
// Weak Twos
// ============================================================

fn add_weak_two_compositions(map: &mut HashMap<String, FactComposition>) {
    // Top honor counts for each weak-two suit (hearts, spades, diamonds)
    for (suit, suit_enum) in [
        ("hearts", Suit::Hearts),
        ("spades", Suit::Spades),
        ("diamonds", Suit::Diamonds),
    ] {
        // module.weakTwo.topHonorCount.{suit}: count of A/K/Q (as number via Match)
        let id = format!("module.weakTwo.topHonorCount.{}", suit);
        map.insert(
            id.clone(),
            FactComposition::Match {
                cases: vec![
                    MatchCase {
                        when: FactComposition::Extended {
                            clause: ExtendedClause::TopHonorCount {
                                suit: suit_enum,
                                min: Some(3),
                                max: Some(3),
                            },
                        },
                        then: FactOutput::Number(3.0),
                    },
                    MatchCase {
                        when: FactComposition::Extended {
                            clause: ExtendedClause::TopHonorCount {
                                suit: suit_enum,
                                min: Some(2),
                                max: Some(2),
                            },
                        },
                        then: FactOutput::Number(2.0),
                    },
                    MatchCase {
                        when: FactComposition::Extended {
                            clause: ExtendedClause::TopHonorCount {
                                suit: suit_enum,
                                min: Some(1),
                                max: Some(1),
                            },
                        },
                        then: FactOutput::Number(1.0),
                    },
                ],
                default: FactOutput::Number(0.0),
            },
        );

        // module.weakTwo.isSolid.{suit}: all 3 top honors
        let solid_id = format!("module.weakTwo.isSolid.{}", suit);
        map.insert(
            solid_id.clone(),
            FactComposition::Extended {
                clause: ExtendedClause::TopHonorCount {
                    suit: suit_enum,
                    min: Some(3),
                    max: Some(3),
                },
            },
        );
    }

    // module.weakTwo.isMaximum: 8-11 HCP
    map.insert(
        "module.weakTwo.isMaximum".to_string(),
        hcp_range(8, 11),
    );

    // module.weakTwo.isMinimum: vulnerability-dependent (NV: 5-7, Vul: 6-7)
    // Uses VulnerabilityIs to branch
    map.insert(
        "module.weakTwo.isMinimum".to_string(),
        FactComposition::Or {
            operands: vec![
                // Not vulnerable: 5-7
                FactComposition::And {
                    operands: vec![
                        FactComposition::Extended {
                            clause: ExtendedClause::VulnerabilityIs { vulnerable: false },
                        },
                        hcp_range(5, 7),
                    ],
                },
                // Vulnerable: 6-7
                FactComposition::And {
                    operands: vec![
                        FactComposition::Extended {
                            clause: ExtendedClause::VulnerabilityIs { vulnerable: true },
                        },
                        hcp_range(6, 7),
                    ],
                },
            ],
        },
    );

    // module.weakTwo.inOpeningHcpRange: vulnerability-dependent (NV: 5-11, Vul: 6-11)
    map.insert(
        "module.weakTwo.inOpeningHcpRange".to_string(),
        FactComposition::Or {
            operands: vec![
                FactComposition::And {
                    operands: vec![
                        FactComposition::Extended {
                            clause: ExtendedClause::VulnerabilityIs { vulnerable: false },
                        },
                        hcp_range(5, 11),
                    ],
                },
                FactComposition::And {
                    operands: vec![
                        FactComposition::Extended {
                            clause: ExtendedClause::VulnerabilityIs { vulnerable: true },
                        },
                        hcp_range(6, 11),
                    ],
                },
            ],
        },
    );

    // module.weakTwo.hasNewSuit.{suit}: 5+ in any OTHER suit
    for (suit, others) in [
        ("hearts", &["spades", "diamonds", "clubs"][..]),
        ("spades", &["hearts", "diamonds", "clubs"][..]),
        ("diamonds", &["hearts", "spades", "clubs"][..]),
    ] {
        let id = format!("module.weakTwo.hasNewSuit.{}", suit);
        map.insert(
            id,
            FactComposition::Or {
                operands: others
                    .iter()
                    .map(|s| suit_gte(&format!("hand.suitLength.{}", s), 5))
                    .collect(),
            },
        );
    }

    // module.weakTwo.hasNsfSupport.{suit}: 3+ in any OTHER suit
    for (suit, others) in [
        ("hearts", &["spades", "diamonds", "clubs"][..]),
        ("spades", &["hearts", "diamonds", "clubs"][..]),
        ("diamonds", &["hearts", "spades", "clubs"][..]),
    ] {
        let id = format!("module.weakTwo.hasNsfSupport.{}", suit);
        map.insert(
            id,
            FactComposition::Or {
                operands: others
                    .iter()
                    .map(|s| suit_gte(&format!("hand.suitLength.{}", s), 3))
                    .collect(),
            },
        );
    }
}

// ============================================================
// Helpers for building composition trees
// ============================================================

fn suit_gte(fact_id: &str, min: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Gte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(min)),
        },
    }
}

fn suit_lte(fact_id: &str, max: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Lte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(max)),
        },
    }
}

fn suit_eq(fact_id: &str, val: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Eq,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(val)),
        },
    }
}

fn hcp_gte(min: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: "hand.hcp".to_string(),
            operator: PrimitiveClauseOperator::Gte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(min)),
        },
    }
}

fn hcp_range(min: u64, max: u64) -> FactComposition {
    FactComposition::And {
        operands: vec![hcp_gte(min), hcp_lte(max)],
    }
}

fn hcp_lte(max: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: "hand.hcp".to_string(),
            operator: PrimitiveClauseOperator::Lte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(max)),
        },
    }
}

fn extended_bool(fact_id: &str, expected: bool) -> FactComposition {
    FactComposition::Extended {
        clause: ExtendedClause::BooleanFact {
            fact_id: fact_id.to_string(),
            expected,
        },
    }
}
