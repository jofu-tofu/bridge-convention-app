//! Weak Twos module compositions.

use std::collections::HashMap;

use bridge_engine::Suit;

use crate::types::{ExtendedClause, FactComposition, FactOutput, MatchCase};

use super::helpers::{hcp_range, suit_gte};

pub(super) fn add_weak_two_compositions(map: &mut HashMap<String, FactComposition>) {
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
    map.insert("module.weakTwo.isMaximum".to_string(), hcp_range(8, 11));

    // module.weakTwo.isMinimum: vulnerability-dependent (NV: 5-7, Vul: 6-7)
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
