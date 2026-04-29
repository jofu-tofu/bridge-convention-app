use std::sync::LazyLock;

use crate::types::{
    ExtendedClause, FactComposition, FactId, PrimitiveClause, PrimitiveClauseOperator,
    PrimitiveClauseValue,
};
use bridge_engine::Suit;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FactKind {
    Threshold,
    Partition,
    Predicate,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PartitionDiscriminant {
    pub id: &'static str,
    pub display_name: &'static str,
    pub rationale: &'static str,
    pub predicate: FactComposition,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PartitionSpec {
    pub discriminants: Vec<PartitionDiscriminant>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FactCatalogEntry {
    pub id: FactId,
    pub kind: FactKind,
    pub partition: Option<PartitionSpec>,
    pub display_name: &'static str,
    pub rationale: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FactValue {
    Threshold,
    Partition(String),
}

static FACT_CATALOG: LazyLock<Vec<FactCatalogEntry>> = LazyLock::new(|| {
    vec![
        FactCatalogEntry {
            id: FactId::new_unchecked("system.responder.weakHand"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Weak hand",
            rationale: "System responder threshold below invitational values.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.responder.inviteValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Invitational values",
            rationale: "System responder threshold for invitational notrump continuations.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.responder.gameValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Game values",
            rationale: "System responder threshold for forcing to game opposite 1NT.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.responder.slamValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Slam values",
            rationale: "System responder threshold for slam-forcing hands.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.opening.weakTwoRange"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Weak two opening range",
            rationale: "System-dependent HCP range for weak-two openings.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.opening.strong2cRange"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Strong 2C opening range",
            rationale: "System-dependent HCP threshold for a strong artificial 2C opening.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.opener.minimumValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Minimum opener values",
            rationale: "System opener rebid band for minimum one-level openings.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.opener.mediumValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Medium opener values",
            rationale: "System opener rebid band for medium-strength continuations.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.opener.maximumValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Maximum opener values",
            rationale: "System opener rebid band for very strong non-2C one-level openings.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.opener.reverseValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Reverse strength",
            rationale: "System opener threshold high enough to reverse in a new suit.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.opener.jumpShiftValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Jump-shift strength",
            rationale: "System opener threshold high enough for a jump-shift rebid.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.overcaller.simpleValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Simple overcall values",
            rationale: "System HCP range for simple suit overcalls.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.overcaller.jumpValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Jump overcall values",
            rationale: "System weak preemptive strength for jump overcalls.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.overcaller.ntValues"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "1NT overcall values",
            rationale: "System HCP range for a direct-seat 1NT overcall (balanced, with a stopper).",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("system.takeoutDoubler.values"),
            kind: FactKind::Threshold,
            partition: None,
            display_name: "Takeout-double values",
            rationale: "System minimum strength for a takeout double over a partscore opening.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("responder.majorShape"),
            kind: FactKind::Partition,
            partition: Some(PartitionSpec {
                discriminants: vec![
                    PartitionDiscriminant {
                        id: "noFourCardMajor",
                        display_name: "No four-card major",
                        rationale: "Responder has no major of length four or greater.",
                        predicate: and(vec![
                            suit_length_lte("hand.suitLength.hearts", 3),
                            suit_length_lte("hand.suitLength.spades", 3),
                        ]),
                    },
                    PartitionDiscriminant {
                        id: "oneFourCardMajor",
                        display_name: "One four-card major",
                        rationale: "Responder has exactly one major of length four or greater, is not 5-4 in the majors, and is not flat with a four-card major.",
                        predicate: and(vec![
                            or(vec![
                                and(vec![
                                    suit_length_gte("hand.suitLength.hearts", 4),
                                    suit_length_lte("hand.suitLength.spades", 3),
                                ]),
                                and(vec![
                                    suit_length_gte("hand.suitLength.spades", 4),
                                    suit_length_lte("hand.suitLength.hearts", 3),
                                ]),
                            ]),
                            not(flat_four_card_major()),
                        ]),
                    },
                    PartitionDiscriminant {
                        id: "fiveFourMajors",
                        display_name: "Five-four in the majors",
                        rationale: "Responder is at least 5-4 across the majors.",
                        predicate: and(vec![
                            suit_length_gte("hand.suitLength.hearts", 4),
                            suit_length_gte("hand.suitLength.spades", 4),
                            or(vec![
                                suit_length_gte("hand.suitLength.hearts", 5),
                                suit_length_gte("hand.suitLength.spades", 5),
                            ]),
                        ]),
                    },
                    PartitionDiscriminant {
                        id: "flatFourCardMajor",
                        display_name: "Flat hand with a four-card major",
                        rationale: "Responder is 4-3-3-3 with exactly one four-card major.",
                        predicate: flat_four_card_major(),
                    },
                ],
            }),
            display_name: "Responder major-suit shape",
            rationale: "Stayman quick-reference column partition grounded in the audited reference corpus.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("responder.classicAceCount"),
            kind: FactKind::Partition,
            partition: Some(count_partition(
                "ace",
                "Classic Blackwood response bucket by ace count.",
                ace_count_eq,
            )),
            display_name: "Responder ace count",
            rationale: "Classic Blackwood response partition by total aces held.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("responder.kingCount"),
            kind: FactKind::Partition,
            partition: Some(count_partition(
                "king",
                "5NT king-ask response bucket by king count.",
                king_count_eq,
            )),
            display_name: "Responder king count",
            rationale: "Grand-slam invitation follow-up partition by total kings held.",
        },
        FactCatalogEntry {
            id: FactId::new_unchecked("transfer.targetSuit"),
            kind: FactKind::Partition,
            partition: Some(PartitionSpec {
                discriminants: vec![
                    PartitionDiscriminant {
                        id: "hearts",
                        display_name: "Hearts",
                        rationale: "Transfer to hearts when hearts are the only transfer target major.",
                        predicate: and(vec![
                            suit_length_gte("hand.suitLength.hearts", 5),
                            suit_length_lte("hand.suitLength.spades", 4),
                        ]),
                    },
                    PartitionDiscriminant {
                        id: "spades",
                        display_name: "Spades",
                        rationale: "Transfer to spades whenever spades are a transfer target; 5-5 majors route here in the current fixtures.",
                        predicate: suit_length_gte("hand.suitLength.spades", 5),
                    },
                ],
            }),
            display_name: "Transfer target suit",
            rationale: "Jacoby transfer target derived from the responder major pattern used in the current transfer fixtures.",
        },
    ]
});

pub fn fact_catalog_entries() -> &'static [FactCatalogEntry] {
    FACT_CATALOG.as_slice()
}

pub fn get_fact_catalog_entry(id: &str) -> Option<&'static FactCatalogEntry> {
    FACT_CATALOG.iter().find(|entry| entry.id.as_str() == id)
}

pub fn partition_discriminants(fact: &FactId) -> Option<&'static [PartitionDiscriminant]> {
    let entry = get_fact_catalog_entry(fact.as_str())?;
    let partition = entry.partition.as_ref()?;
    Some(partition.discriminants.as_slice())
}

pub fn is_known_fact_id(id: &str) -> bool {
    get_fact_catalog_entry(id).is_some()
}

pub fn suggest_fact_ids(raw: &str) -> Vec<&'static str> {
    let mut ranked: Vec<(&'static str, usize)> = fact_catalog_entries()
        .iter()
        .map(|entry| (entry.id.as_str(), levenshtein(raw, entry.id.as_str())))
        .collect();
    ranked.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.0.cmp(b.0)));
    ranked.into_iter().take(3).map(|(id, _)| id).collect()
}

fn flat_four_card_major() -> FactComposition {
    or(vec![
        exact_shape_with_major(Suit::Hearts),
        exact_shape_with_major(Suit::Spades),
    ])
}

fn exact_shape_with_major(major: Suit) -> FactComposition {
    match major {
        Suit::Hearts => and(vec![
            suit_length_eq("hand.suitLength.hearts", 4),
            suit_length_eq("hand.suitLength.spades", 3),
            suit_length_eq("hand.suitLength.diamonds", 3),
            suit_length_eq("hand.suitLength.clubs", 3),
        ]),
        Suit::Spades => and(vec![
            suit_length_eq("hand.suitLength.spades", 4),
            suit_length_eq("hand.suitLength.hearts", 3),
            suit_length_eq("hand.suitLength.diamonds", 3),
            suit_length_eq("hand.suitLength.clubs", 3),
        ]),
        Suit::Diamonds | Suit::Clubs => unreachable!("major suit expected"),
    }
}

fn and(operands: Vec<FactComposition>) -> FactComposition {
    FactComposition::And { operands }
}

fn or(operands: Vec<FactComposition>) -> FactComposition {
    FactComposition::Or { operands }
}

fn not(operand: FactComposition) -> FactComposition {
    FactComposition::Not {
        operand: Box::new(operand),
    }
}

fn suit_length_gte(fact_id: &str, min: u64) -> FactComposition {
    primitive_number_clause(fact_id, PrimitiveClauseOperator::Gte, min)
}

fn suit_length_lte(fact_id: &str, max: u64) -> FactComposition {
    primitive_number_clause(fact_id, PrimitiveClauseOperator::Lte, max)
}

fn suit_length_eq(fact_id: &str, value: u64) -> FactComposition {
    primitive_number_clause(fact_id, PrimitiveClauseOperator::Eq, value)
}

fn primitive_number_clause(
    fact_id: &str,
    operator: PrimitiveClauseOperator,
    value: u64,
) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(value)),
        },
    }
}

fn ace_count_eq(value: u8) -> FactComposition {
    FactComposition::Extended {
        clause: ExtendedClause::AceCount {
            min: Some(value),
            max: Some(value),
        },
    }
}

fn king_count_eq(value: u8) -> FactComposition {
    FactComposition::Extended {
        clause: ExtendedClause::KingCount {
            min: Some(value),
            max: Some(value),
        },
    }
}

fn count_partition(
    noun: &str,
    rationale: &'static str,
    predicate_for: fn(u8) -> FactComposition,
) -> PartitionSpec {
    PartitionSpec {
        discriminants: vec![
            PartitionDiscriminant {
                id: "zero",
                display_name: Box::leak(format!("0 {noun}s").into_boxed_str()),
                rationale,
                predicate: predicate_for(0),
            },
            PartitionDiscriminant {
                id: "one",
                display_name: Box::leak(format!("1 {noun}").into_boxed_str()),
                rationale,
                predicate: predicate_for(1),
            },
            PartitionDiscriminant {
                id: "two",
                display_name: Box::leak(format!("2 {noun}s").into_boxed_str()),
                rationale,
                predicate: predicate_for(2),
            },
            PartitionDiscriminant {
                id: "three",
                display_name: Box::leak(format!("3 {noun}s").into_boxed_str()),
                rationale,
                predicate: predicate_for(3),
            },
            PartitionDiscriminant {
                id: "four",
                display_name: Box::leak(format!("4 {noun}s").into_boxed_str()),
                rationale,
                predicate: predicate_for(4),
            },
        ],
    }
}

fn levenshtein(lhs: &str, rhs: &str) -> usize {
    let lhs_chars: Vec<char> = lhs.chars().collect();
    let rhs_chars: Vec<char> = rhs.chars().collect();
    let mut prev: Vec<usize> = (0..=rhs_chars.len()).collect();
    let mut curr = vec![0; rhs_chars.len() + 1];

    for (i, lhs_char) in lhs_chars.iter().enumerate() {
        curr[0] = i + 1;
        for (j, rhs_char) in rhs_chars.iter().enumerate() {
            let cost = usize::from(lhs_char != rhs_char);
            curr[j + 1] = (prev[j + 1] + 1).min(curr[j] + 1).min(prev[j] + cost);
        }
        prev.clone_from(&curr);
    }

    prev[rhs_chars.len()]
}

#[cfg(test)]
mod tests {
    use super::{get_fact_catalog_entry, partition_discriminants, FactKind};
    use crate::FactId;

    #[test]
    fn responder_major_shape_has_four_discriminants() {
        let fact = FactId::parse("responder.majorShape").unwrap();
        let discriminants = partition_discriminants(&fact).unwrap();
        assert_eq!(discriminants.len(), 4);
        assert_eq!(discriminants[0].display_name, "No four-card major");
    }

    #[test]
    fn invite_values_is_threshold_fact() {
        let entry = get_fact_catalog_entry("system.responder.inviteValues").unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn classic_ace_count_has_five_discriminants() {
        let fact = FactId::parse("responder.classicAceCount").unwrap();
        let discriminants = partition_discriminants(&fact).unwrap();
        assert_eq!(discriminants.len(), 5);
        assert_eq!(discriminants[4].display_name, "4 aces");
    }

    #[test]
    fn opener_minimum_values_is_threshold_fact() {
        let fact = FactId::parse("system.opener.minimumValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn opener_medium_values_is_threshold_fact() {
        let fact = FactId::parse("system.opener.mediumValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn opener_maximum_values_is_threshold_fact() {
        let fact = FactId::parse("system.opener.maximumValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn opener_reverse_values_is_threshold_fact() {
        let fact = FactId::parse("system.opener.reverseValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn opener_jump_shift_values_is_threshold_fact() {
        let fact = FactId::parse("system.opener.jumpShiftValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn overcaller_simple_values_is_threshold_fact() {
        let fact = FactId::parse("system.overcaller.simpleValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn overcaller_jump_values_is_threshold_fact() {
        let fact = FactId::parse("system.overcaller.jumpValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn overcaller_nt_values_is_threshold_fact() {
        let fact = FactId::parse("system.overcaller.ntValues").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }

    #[test]
    fn takeout_doubler_values_is_threshold_fact() {
        let fact = FactId::parse("system.takeoutDoubler.values").unwrap();
        let entry = get_fact_catalog_entry(fact.as_str()).unwrap();
        assert_eq!(entry.kind, FactKind::Threshold);
        assert!(entry.partition.is_none());
    }
}
