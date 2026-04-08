//! DONT module compositions.

use std::collections::HashMap;

use bridge_engine::Suit;

use crate::types::{CompareOp, ExtendedClause, FactComposition};

use super::helpers::{extended_bool, suit_gte, suit_lte};

pub(super) fn add_dont_compositions(map: &mut HashMap<String, FactComposition>) {
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
                    clause: ExtendedClause::LongestSuitIs {
                        suit: Suit::Diamonds,
                    },
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

    // module.dont.clubsHigherDiamonds: D >= 4 AND D > H AND D > S
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
