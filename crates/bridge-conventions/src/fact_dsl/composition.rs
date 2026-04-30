//! FactComposition tree interpreter.
//!
//! Evaluates a `FactComposition` tree against a hand and previously evaluated facts,
//! returning a `FactData` (boolean, number, or string).

use std::collections::HashMap;

use bridge_engine::{Hand, Rank, Suit};

use crate::types::{
    CompareOp, ComputeExpr, ExtendedClause, FactComposition, FactOperator, FactOutput,
    PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue,
};

use super::primitives::{suit_name_to_index, SUIT_LENGTH_FACT_IDS};
use super::types::{get_bool, get_num, FactData, FactValue, RelationalFactContext};

/// Compare an `Eq`-encoded boolean clause (value is 1 for true, 0 for false)
/// against a boolean fact value.
fn boolean_eq_clause_matches(clause: &PrimitiveClause, fv: &FactValue) -> bool {
    let expected = clause_value_as_f64(&clause.value);
    if fv.value.as_bool() {
        expected == 1.0
    } else {
        expected == 0.0
    }
}

/// Evaluate a composition tree, returning the computed value.
///
/// Boolean nodes (Primitive/Extended/And/Or/Not) return `FactData::Boolean`.
/// Match nodes return the `then` value of the first matching case, or `default`.
/// Compute nodes return `FactData::Number`.
pub fn evaluate_composition(
    comp: &FactComposition,
    hand: &Hand,
    facts: &HashMap<String, FactValue>,
    ctx: Option<&RelationalFactContext>,
) -> FactData {
    match comp {
        FactComposition::Primitive { clause } => {
            FactData::Boolean(evaluate_primitive_clause(clause, facts))
        }
        FactComposition::Extended { clause } => {
            FactData::Boolean(evaluate_extended_clause(clause, hand, facts, ctx))
        }
        FactComposition::And { operands } => {
            let result = operands
                .iter()
                .all(|op| evaluate_composition(op, hand, facts, ctx).as_bool());
            FactData::Boolean(result)
        }
        FactComposition::Or { operands } => {
            let result = operands
                .iter()
                .any(|op| evaluate_composition(op, hand, facts, ctx).as_bool());
            FactData::Boolean(result)
        }
        FactComposition::Not { operand } => {
            let inner = evaluate_composition(operand, hand, facts, ctx).as_bool();
            FactData::Boolean(!inner)
        }
        FactComposition::Match { cases, default } => {
            for case in cases {
                if evaluate_composition(&case.when, hand, facts, ctx).as_bool() {
                    return fact_output_to_data(&case.then);
                }
            }
            fact_output_to_data(default)
        }
        FactComposition::Compute { expr } => {
            let bindings = ctx.and_then(|c| c.bindings.as_ref());
            FactData::Number(evaluate_compute_expr(expr, facts, bindings))
        }
    }
}

/// Evaluate a JSON-serializable primitive clause against the fact map.
fn evaluate_primitive_clause(clause: &PrimitiveClause, facts: &HashMap<String, FactValue>) -> bool {
    let Some(fv) = facts.get(&clause.fact_id) else {
        return false;
    };

    // Boolean fact: `clause_to_primitive` encodes Boolean clauses as `Eq` with
    // value 1 (true) or 0 (false). Comparing `as_number()` (which returns 0.0
    // for booleans) against the encoded value would mis-match, so dispatch on
    // the fact's value type up front.
    if matches!(fv.value, FactData::Boolean(_)) {
        return match &clause.operator {
            PrimitiveClauseOperator::Eq => boolean_eq_clause_matches(clause, fv),
            _ => fv.value.as_bool(),
        };
    }

    let fact_value = fv.value.as_number();
    match &clause.operator {
        PrimitiveClauseOperator::Gte => fact_value >= clause_value_as_f64(&clause.value),
        PrimitiveClauseOperator::Lte => fact_value <= clause_value_as_f64(&clause.value),
        PrimitiveClauseOperator::Eq => {
            (fact_value - clause_value_as_f64(&clause.value)).abs() < f64::EPSILON
        }
        PrimitiveClauseOperator::Range => {
            if let PrimitiveClauseValue::Range { min, max } = &clause.value {
                let min_f = number_to_f64(min);
                let max_f = number_to_f64(max);
                fact_value >= min_f && fact_value <= max_f
            } else {
                false
            }
        }
    }
}

/// Evaluate a Rust-only extended clause.
fn evaluate_extended_clause(
    clause: &ExtendedClause,
    hand: &Hand,
    facts: &HashMap<String, FactValue>,
    ctx: Option<&RelationalFactContext>,
) -> bool {
    match clause {
        ExtendedClause::TopHonorCount {
            suit,
            min,
            max,
            top_n,
        } => {
            let n = top_n.unwrap_or(3);
            let count = count_top_n_honors(hand, *suit, n);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::AceCount { min, max } => {
            let count = count_rank(hand, Rank::Ace);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::KingCount { min, max } => {
            let count = count_rank(hand, Rank::King);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::SuitCompare { a, op, b } => {
            let len_a = get_suit_length_from_facts(facts, *a);
            let len_b = get_suit_length_from_facts(facts, *b);
            match op {
                CompareOp::Gt => len_a > len_b,
                CompareOp::Gte => len_a >= len_b,
                CompareOp::Eq => len_a == len_b,
            }
        }
        ExtendedClause::LongestSuitIs { suit } => {
            let target = *suit;
            let suits = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];
            let mut longest_suit = Suit::Spades;
            let mut longest_len = 0.0_f64;
            for &s in &suits {
                let len = get_suit_length_from_facts(facts, s);
                if len > longest_len {
                    longest_len = len;
                    longest_suit = s;
                }
                // Tie-break by priority: S > H > D > C (first encountered wins
                // since we iterate in that order)
            }
            longest_suit == target
        }
        ExtendedClause::VulnerabilityIs { vulnerable } => {
            let is_vul = get_bool(facts, "bridge.isVulnerable");
            is_vul == *vulnerable
        }
        ExtendedClause::BooleanFact { fact_id, expected } => get_bool(facts, fact_id) == *expected,
        ExtendedClause::NumericFact { fact_id, min, max } => {
            let val = get_num(facts, fact_id);
            let above_min = min.map_or(true, |m| val >= m);
            let below_max = max.map_or(true, |m| val <= m);
            above_min && below_max
        }
        ExtendedClause::CombinedAceCount { min, max } => {
            let own = count_rank(hand, Rank::Ace);
            let partner = partner_count_from_ctx(ctx, "module.partner.aceCount");
            let count = own.saturating_add(partner);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::CombinedKingCount { min, max } => {
            let own = count_rank(hand, Rank::King);
            let partner = partner_count_from_ctx(ctx, "module.partner.kingCount");
            let count = own.saturating_add(partner);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::PlayingTricks { min, max } => {
            let count = count_playing_tricks(hand);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
    }
}

/// Extract partner's disclosed count (eq-constraint) for the given fact_id from
/// the RelationalFactContext.public_commitments. Returns 0 when missing.
fn partner_count_from_ctx(ctx: Option<&RelationalFactContext>, fact_id: &str) -> u8 {
    let commitments = match ctx.and_then(|c| c.public_commitments.as_ref()) {
        Some(c) => c,
        None => return 0,
    };
    for commitment in commitments {
        if commitment.subject != "partner" {
            continue;
        }
        if commitment.constraint.fact_id != fact_id {
            continue;
        }
        if commitment.constraint.operator != FactOperator::Eq {
            continue;
        }
        if let crate::types::ConstraintValue::Number(n) = &commitment.constraint.value {
            if let Some(v) = n.as_u64() {
                return v.min(u8::MAX as u64) as u8;
            }
            if let Some(f) = n.as_f64() {
                return f.max(0.0).round() as u8;
            }
        }
    }
    0
}

/// Count honor tricks + length tricks for a hand, summed across suits.
///
/// Honor tricks: A=1, AK=2, AKQ=3; K or Q alone contribute 0 honor tricks and
/// KQ or KQx etc. also contribute 0 (no A/K promotion is attempted, matching
/// classic strong-2C authority).
///
/// Length tricks: max(length - 3, 0), but only if the suit contains A or K
/// (Q alone does not gate length).
fn count_playing_tricks(hand: &Hand) -> u8 {
    let suits = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];
    let mut total: u32 = 0;
    for suit in suits {
        let cards: Vec<&bridge_engine::Card> =
            hand.cards.iter().filter(|c| c.suit == suit).collect();
        let has_ace = cards.iter().any(|c| c.rank == Rank::Ace);
        let has_king = cards.iter().any(|c| c.rank == Rank::King);
        let has_queen = cards.iter().any(|c| c.rank == Rank::Queen);

        let honor_tricks: u32 = if has_ace && has_king && has_queen {
            3
        } else if has_ace && has_king {
            2
        } else if has_ace {
            1
        } else {
            0
        };

        let length = cards.len() as u32;
        let length_tricks: u32 = if (has_ace || has_king) && length > 3 {
            length - 3
        } else {
            0
        };

        total += honor_tricks + length_tricks;
    }
    total.min(u8::MAX as u32) as u8
}

/// Count the top-N honors (A, K, Q, J, T ordered highest-first) in a specific
/// suit. N is clamped to [0, 5]. N=3 counts A/K/Q, N=5 counts A/K/Q/J/T.
fn count_top_n_honors(hand: &Hand, suit: Suit, top_n: u8) -> u8 {
    let ranks: &[Rank] = match top_n {
        0 => &[],
        1 => &[Rank::Ace],
        2 => &[Rank::Ace, Rank::King],
        3 => &[Rank::Ace, Rank::King, Rank::Queen],
        4 => &[Rank::Ace, Rank::King, Rank::Queen, Rank::Jack],
        _ => &[Rank::Ace, Rank::King, Rank::Queen, Rank::Jack, Rank::Ten],
    };
    hand.cards
        .iter()
        .filter(|c| c.suit == suit && ranks.contains(&c.rank))
        .count() as u8
}

/// Count cards of a specific rank across all suits.
fn count_rank(hand: &Hand, rank: Rank) -> u8 {
    hand.cards.iter().filter(|c| c.rank == rank).count() as u8
}

/// Get suit length from the fact map via suit enum.
fn get_suit_length_from_facts(facts: &HashMap<String, FactValue>, suit: Suit) -> f64 {
    let idx = match suit {
        Suit::Spades => 0,
        Suit::Hearts => 1,
        Suit::Diamonds => 2,
        Suit::Clubs => 3,
    };
    get_num(facts, SUIT_LENGTH_FACT_IDS[idx])
}

/// Evaluate a ComputeExpr to a numeric value.
fn evaluate_compute_expr(
    expr: &ComputeExpr,
    facts: &HashMap<String, FactValue>,
    bindings: Option<&HashMap<String, String>>,
) -> f64 {
    match expr {
        ComputeExpr::Literal { value } => *value,
        ComputeExpr::FactRef { fact_id } => get_num(facts, fact_id),
        ComputeExpr::Add { operands } => operands
            .iter()
            .map(|op| evaluate_compute_expr(op, facts, bindings))
            .sum(),
        ComputeExpr::ShortagePoints { trump_suit_binding } => {
            let trump_suit_name = bindings
                .and_then(|b| b.get(trump_suit_binding.as_str()))
                .or_else(|| {
                    bindings.and_then(|b| {
                        b.get(&trump_suit_binding.trim_start_matches('$').to_string())
                    })
                })
                .map(|s| s.as_str());

            let trump_idx = trump_suit_name.and_then(suit_name_to_index);

            let mut shortage_points = 0.0;
            for i in 0..4 {
                if Some(i) == trump_idx {
                    continue;
                }
                let length = get_num(facts, SUIT_LENGTH_FACT_IDS[i]);
                if length == 0.0 {
                    shortage_points += 3.0;
                } else if length == 1.0 {
                    shortage_points += 2.0;
                } else if length == 2.0 {
                    shortage_points += 1.0;
                }
            }
            shortage_points
        }
    }
}

/// Convert a FactOutput to FactData.
fn fact_output_to_data(output: &FactOutput) -> FactData {
    match output {
        FactOutput::Text(s) => FactData::Text(s.clone()),
        FactOutput::Number(n) => FactData::Number(*n),
        FactOutput::Boolean(b) => FactData::Boolean(*b),
    }
}

/// Extract f64 from a PrimitiveClauseValue (Single variant).
fn clause_value_as_f64(value: &PrimitiveClauseValue) -> f64 {
    match value {
        PrimitiveClauseValue::Single(n) => number_to_f64(n),
        PrimitiveClauseValue::Range { min, .. } => number_to_f64(min),
    }
}

/// Convert serde_json::Number to f64.
fn number_to_f64(n: &serde_json::Number) -> f64 {
    n.as_f64().unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{MatchCase, PrimitiveClauseOperator, PrimitiveClauseValue};
    use bridge_engine::{Card, Hand, Rank, Suit};

    fn empty_hand() -> Hand {
        Hand { cards: vec![] }
    }

    fn make_facts(pairs: &[(&str, f64)]) -> HashMap<String, FactValue> {
        pairs
            .iter()
            .map(|(id, val)| {
                (
                    id.to_string(),
                    FactValue {
                        fact_id: id.to_string(),
                        value: FactData::Number(*val),
                    },
                )
            })
            .collect()
    }

    #[test]
    fn primitive_gte_true() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(10)),
            },
        };
        let facts = make_facts(&[("hand.hcp", 12.0)]);
        let result = evaluate_composition(&comp, &empty_hand(), &facts, None);
        assert_eq!(result, FactData::Boolean(true));
    }

    #[test]
    fn primitive_gte_false() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(15)),
            },
        };
        let facts = make_facts(&[("hand.hcp", 12.0)]);
        let result = evaluate_composition(&comp, &empty_hand(), &facts, None);
        assert_eq!(result, FactData::Boolean(false));
    }

    #[test]
    fn and_composition() {
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
                        fact_id: "hand.suitLength.spades".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(4)),
                    },
                },
            ],
        };
        let facts = make_facts(&[("hand.hcp", 10.0), ("hand.suitLength.spades", 5.0)]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Boolean(true)
        );
    }

    #[test]
    fn match_composition_first_case_wins() {
        let comp = FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: FactComposition::Primitive {
                        clause: PrimitiveClause {
                            fact_id: "hand.suitLength.spades".to_string(),
                            operator: PrimitiveClauseOperator::Gte,
                            value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                        },
                    },
                    then: FactOutput::Text("spades".to_string()),
                },
                MatchCase {
                    when: FactComposition::Primitive {
                        clause: PrimitiveClause {
                            fact_id: "hand.suitLength.hearts".to_string(),
                            operator: PrimitiveClauseOperator::Gte,
                            value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                        },
                    },
                    then: FactOutput::Text("hearts".to_string()),
                },
            ],
            default: FactOutput::Text("none".to_string()),
        };
        let facts = make_facts(&[
            ("hand.suitLength.spades", 5.0),
            ("hand.suitLength.hearts", 6.0),
        ]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Text("spades".to_string())
        );
    }

    #[test]
    fn match_composition_default() {
        let comp = FactComposition::Match {
            cases: vec![MatchCase {
                when: FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.suitLength.spades".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                    },
                },
                then: FactOutput::Text("spades".to_string()),
            }],
            default: FactOutput::Text("none".to_string()),
        };
        let facts = make_facts(&[("hand.suitLength.spades", 3.0)]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Text("none".to_string())
        );
    }

    #[test]
    fn compute_add() {
        let comp = FactComposition::Compute {
            expr: ComputeExpr::Add {
                operands: vec![
                    ComputeExpr::FactRef {
                        fact_id: "hand.hcp".to_string(),
                    },
                    ComputeExpr::Literal { value: 3.0 },
                ],
            },
        };
        let facts = make_facts(&[("hand.hcp", 10.0)]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Number(13.0)
        );
    }

    #[test]
    fn top_honor_count() {
        let hand = Hand {
            cards: vec![
                Card {
                    suit: Suit::Spades,
                    rank: Rank::Ace,
                },
                Card {
                    suit: Suit::Spades,
                    rank: Rank::King,
                },
                Card {
                    suit: Suit::Spades,
                    rank: Rank::Five,
                },
                Card {
                    suit: Suit::Hearts,
                    rank: Rank::Queen,
                },
            ],
        };
        let facts = HashMap::new();
        let clause = ExtendedClause::TopHonorCount {
            suit: Suit::Spades,
            min: Some(2),
            max: None,
            top_n: None,
        };
        assert!(evaluate_extended_clause(&clause, &hand, &facts, None));

        let clause2 = ExtendedClause::TopHonorCount {
            suit: Suit::Spades,
            min: Some(3),
            max: None,
            top_n: None,
        };
        assert!(!evaluate_extended_clause(&clause2, &hand, &facts, None));
    }

    #[test]
    fn suit_compare() {
        let facts = make_facts(&[
            ("hand.suitLength.spades", 5.0),
            ("hand.suitLength.hearts", 4.0),
        ]);
        let clause = ExtendedClause::SuitCompare {
            a: Suit::Spades,
            op: CompareOp::Gt,
            b: Suit::Hearts,
        };
        assert!(evaluate_extended_clause(
            &clause,
            &empty_hand(),
            &facts,
            None
        ));
    }

    #[test]
    fn shortage_points_compute() {
        let comp = FactComposition::Compute {
            expr: ComputeExpr::Add {
                operands: vec![
                    ComputeExpr::FactRef {
                        fact_id: "hand.hcp".to_string(),
                    },
                    ComputeExpr::ShortagePoints {
                        trump_suit_binding: "suit".to_string(),
                    },
                ],
            },
        };
        let facts = make_facts(&[
            ("hand.hcp", 10.0),
            ("hand.suitLength.spades", 5.0),
            ("hand.suitLength.hearts", 4.0),
            ("hand.suitLength.diamonds", 3.0),
            ("hand.suitLength.clubs", 1.0), // singleton = 2 pts
        ]);
        let mut bindings = HashMap::new();
        bindings.insert("suit".to_string(), "hearts".to_string());
        let ctx = RelationalFactContext {
            bindings: Some(bindings),
            public_commitments: None,
            fit_agreed: None,
        };
        let result = evaluate_composition(&comp, &empty_hand(), &facts, Some(&ctx));
        // HCP 10 + shortage: clubs singleton = 2
        assert_eq!(result, FactData::Number(12.0));
    }

    // --- Playing-tricks anchor tests ---

    /// Build a hand from a PBN-style string "SPADES.HEARTS.DIAMONDS.CLUBS"
    /// where each field is concatenated rank chars (or "-" for void).
    fn pbn(spec: &str) -> Hand {
        let suits = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];
        let parts: Vec<&str> = spec.split('.').collect();
        assert_eq!(parts.len(), 4, "pbn string must have 4 suits: {spec}");
        let mut cards = Vec::new();
        for (suit, ranks) in suits.iter().zip(parts.iter()) {
            if *ranks == "-" {
                continue;
            }
            for ch in ranks.chars() {
                let rank = match ch {
                    'A' => Rank::Ace,
                    'K' => Rank::King,
                    'Q' => Rank::Queen,
                    'J' => Rank::Jack,
                    'T' => Rank::Ten,
                    '9' => Rank::Nine,
                    '8' => Rank::Eight,
                    '7' => Rank::Seven,
                    '6' => Rank::Six,
                    '5' => Rank::Five,
                    '4' => Rank::Four,
                    '3' => Rank::Three,
                    '2' => Rank::Two,
                    'x' => Rank::Two, // treat "small" placeholder as a spot card
                    other => panic!("bad rank {other}"),
                };
                cards.push(Card { suit: *suit, rank });
            }
        }
        Hand { cards }
    }

    fn playing_tricks_for(hand: &Hand) -> u8 {
        super::count_playing_tricks(hand)
    }

    #[test]
    fn playing_tricks_anchor_king_only_long() {
        // ♠Kxxxxxx ♥xxx ♦xx ♣x -> 4
        // K alone: 0 honor tricks, length tricks = 7-3 = 4 (K gates).
        let hand = pbn("K765432.543.32.2");
        assert_eq!(playing_tricks_for(&hand), 4);
    }

    #[test]
    fn playing_tricks_anchor_kq_only_long() {
        // ♠KQxxxxx ♥xxx ♦xx ♣x -> 4
        // KQ alone: no A so honor_tricks = 0, but K gates length → 7-3=4.
        let hand = pbn("KQ54327.543.32.2");
        // 13 cards total: 7+3+2+1 = 13 ✓
        assert_eq!(playing_tricks_for(&hand), 4);
    }

    #[test]
    fn playing_tricks_anchor_ak_long() {
        // ♠AKxxxxx ♥xxx ♦xx ♣x -> 6 (AK=2 + length 4)
        let hand = pbn("AK65432.543.32.2");
        assert_eq!(playing_tricks_for(&hand), 6);
    }

    #[test]
    fn playing_tricks_anchor_qj_no_ak() {
        // ♠QJxxxxx ♥xxx ♦xx ♣x -> 0 (no A or K anywhere)
        let hand = pbn("QJ65432.543.32.2");
        assert_eq!(playing_tricks_for(&hand), 0);
    }

    #[test]
    fn playing_tricks_anchor_akqxxxxx_ax() {
        // ♠AKQxxxxx ♥Axx ♦- ♣xx -> 9 (AKQ=3, length 8-3=5 → 8 spades; hearts A=1 → total 9)
        let hand = pbn("AKQ54328.A32.-.32");
        assert_eq!(playing_tricks_for(&hand), 9);
    }

    #[test]
    fn playing_tricks_anchor_akqjxx_akq() {
        // ♠AKQJxx ♥AKQ ♦xx ♣xx -> 9 (spades AKQ=3 + length 6-3=3; hearts AKQ=3, no length since 3<=3) = 9
        let hand = pbn("AKQJ65.AKQ.32.32");
        assert_eq!(playing_tricks_for(&hand), 9);
    }

    #[test]
    fn playing_tricks_anchor_akqxxxx_akx() {
        // ♠AKQxxxx ♥AKx ♦x ♣xx -> 9 (spades AKQ=3 + length 7-3=4; hearts AK=2; diamonds/clubs 0) = 9
        let hand = pbn("AKQ7654.AK3.2.32");
        assert_eq!(playing_tricks_for(&hand), 9);
    }

    // --- Combined ace count tests ---

    #[test]
    fn combined_ace_count_uses_partner_ctx() {
        // Own 2 aces + partner disclosed 2 → combined 4.
        let hand = pbn("A32.A32.432.432");
        use super::super::types::{PublicConstraint, PublicFactConstraint};
        use crate::types::{ConstraintValue, FactOperator};
        let ctx = RelationalFactContext {
            bindings: None,
            public_commitments: Some(vec![PublicConstraint {
                subject: "partner".to_string(),
                constraint: PublicFactConstraint {
                    fact_id: "module.partner.aceCount".to_string(),
                    operator: FactOperator::Eq,
                    value: ConstraintValue::Number(serde_json::Number::from(2)),
                },
            }]),
            fit_agreed: None,
        };
        let clause_eq_4 = ExtendedClause::CombinedAceCount {
            min: Some(4),
            max: Some(4),
        };
        assert!(evaluate_extended_clause(
            &clause_eq_4,
            &hand,
            &HashMap::new(),
            Some(&ctx)
        ));

        let clause_gte_5 = ExtendedClause::CombinedAceCount {
            min: Some(5),
            max: None,
        };
        assert!(!evaluate_extended_clause(
            &clause_gte_5,
            &hand,
            &HashMap::new(),
            Some(&ctx)
        ));
    }

    #[test]
    fn combined_ace_count_defaults_zero_without_ctx() {
        // Own 1 ace, no partner ctx → combined 1, not 1+something.
        let hand = pbn("A32.432.432.4322");
        let clause = ExtendedClause::CombinedAceCount {
            min: Some(1),
            max: Some(1),
        };
        assert!(evaluate_extended_clause(
            &clause,
            &hand,
            &HashMap::new(),
            None
        ));
    }

    #[test]
    fn top_honor_count_top_n_5_includes_jack_ten() {
        // KQJT2: top-3 = KQ = 2, top-5 = KQJT = 4.
        let hand = pbn("KQJT2.432.32.2345");
        let facts = HashMap::new();
        let top3_gte_3 = ExtendedClause::TopHonorCount {
            suit: Suit::Spades,
            min: Some(3),
            max: None,
            top_n: Some(3),
        };
        assert!(!evaluate_extended_clause(&top3_gte_3, &hand, &facts, None));
        let top5_gte_3 = ExtendedClause::TopHonorCount {
            suit: Suit::Spades,
            min: Some(3),
            max: None,
            top_n: Some(5),
        };
        assert!(evaluate_extended_clause(&top5_gte_3, &hand, &facts, None));
    }

    #[test]
    fn or_composition_either_branch_true() {
        // "2 of top 3 OR 3 of top 5" suit quality: fails top-3 (only KQ=2? min 2 would pass;
        // use QJT2 where top-3=Q=1 fails, top-5=QJT=3 passes).
        let hand = pbn("QJT32.432.32.234");
        let facts = HashMap::new();
        let comp = FactComposition::Or {
            operands: vec![
                FactComposition::Extended {
                    clause: ExtendedClause::TopHonorCount {
                        suit: Suit::Spades,
                        min: Some(2),
                        max: None,
                        top_n: Some(3),
                    },
                },
                FactComposition::Extended {
                    clause: ExtendedClause::TopHonorCount {
                        suit: Suit::Spades,
                        min: Some(3),
                        max: None,
                        top_n: Some(5),
                    },
                },
            ],
        };
        assert_eq!(
            evaluate_composition(&comp, &hand, &facts, None),
            FactData::Boolean(true)
        );
    }

    #[test]
    fn top_honor_count_backcompat_no_top_n() {
        // Omitting top_n defaults to 3 (matches pre-existing fixture behavior).
        let json = r#"{"clauseKind":"topHonorCount","suit":"S","min":2}"#;
        let clause: ExtendedClause = serde_json::from_str(json).unwrap();
        let hand = pbn("AKQ32.432.32.234");
        assert!(evaluate_extended_clause(
            &clause,
            &hand,
            &HashMap::new(),
            None
        ));
    }

    /// Boolean facts encoded as `Eq 1`/`Eq 0` (per `clause_to_primitive`)
    /// must dispatch to the boolean branch instead of being coerced through
    /// `as_number()` (which returns 0.0 for booleans, mismatching `Eq 1`).
    #[test]
    fn primitive_eq_handles_boolean_fact_value() {
        let mut facts: HashMap<String, FactValue> = HashMap::new();
        facts.insert(
            "system.suitResponseIsGameForcing".to_string(),
            FactValue {
                fact_id: "system.suitResponseIsGameForcing".to_string(),
                value: FactData::Boolean(true),
            },
        );

        let clause_true = PrimitiveClause {
            fact_id: "system.suitResponseIsGameForcing".to_string(),
            operator: PrimitiveClauseOperator::Eq,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(1)),
        };
        assert!(evaluate_primitive_clause(&clause_true, &facts));

        let clause_false = PrimitiveClause {
            fact_id: "system.suitResponseIsGameForcing".to_string(),
            operator: PrimitiveClauseOperator::Eq,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(0)),
        };
        assert!(!evaluate_primitive_clause(&clause_false, &facts));
    }
}
