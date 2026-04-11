//! Fact evaluation orchestrator — `evaluate_facts()`.
//!
//! Combines all evaluation layers in strict order:
//! 1. Pre-seed context facts (isVulnerable)
//! 2. Primitive facts (from Hand/HandEvaluation)
//! 3. Bridge-derived standard
//! 4. System facts standard (SystemConfig thresholds)
//! 5. Module-derived (JSON compositions, topologically sorted)
//! 6. Bridge relational (override layer 3 using RelationalFactContext)
//! 7. System relational (override layer 4 using fitAgreed + trump TP)

use std::collections::HashMap;

use bridge_engine::{Hand, HandEvaluation};

use crate::types::{EvaluationWorld, FactDefinition, SystemConfig};

use super::bridge_derived::{evaluate_bridge_derived, evaluate_bridge_relational};
use super::composition::evaluate_composition;
use super::primitives::evaluate_primitives;
use super::system_facts::{evaluate_system_facts, evaluate_system_relational};
use super::topo_sort::topological_sort;
use super::types::{EvaluatedFacts, FactValue, RelationalFactContext};

/// Deferred posterior fact IDs — these require the inference engine (Phase 4).
const POSTERIOR_FACTS: &[&str] = &[
    "module.stayman.nsHaveEightCardFitLikely",
    "module.stayman.openerStillBalancedLikely",
    "module.stayman.openerHasSecondMajorLikely",
];

/// Evaluate all facts for a hand.
///
/// # Parameters
/// - `hand` / `evaluation`: The hand and its pre-computed evaluation (HCP, shape).
/// - `definitions`: All FactDefinitions from the active fact catalog.
/// - `system_config`: Active bidding system's SystemConfig. Pass `None` if no system facts needed.
/// - `relational_context`: Pipeline-provided context for relational evaluation. Pass `None` for standard-only.
/// - `context_facts`: Pre-seeded facts (e.g., `bridge.isVulnerable`). Pass `None` if not relevant.
pub fn evaluate_facts(
    hand: &Hand,
    evaluation: &HandEvaluation,
    definitions: &[FactDefinition],
    system_config: Option<&SystemConfig>,
    relational_context: Option<&RelationalFactContext>,
    context_facts: Option<&HashMap<String, FactValue>>,
) -> EvaluatedFacts {
    let mut facts: HashMap<String, FactValue> = HashMap::new();

    // Layer 0: Pre-seed context facts
    if let Some(ctx_facts) = context_facts {
        for (id, fv) in ctx_facts {
            facts.insert(id.clone(), fv.clone());
        }
    }

    // Layer 1: Primitive facts (hardcoded from Hand/HandEvaluation)
    evaluate_primitives(hand, evaluation, &mut facts);

    // Layer 2: Bridge-derived standard (Rust-constructed compositions)
    evaluate_bridge_derived(hand, &mut facts);

    // Layer 3: System facts standard (from SystemConfig)
    if let Some(sys) = system_config {
        evaluate_system_facts(sys, &mut facts);
    }

    // Layer 4: Module-derived facts (topologically sorted)
    let acting_hand_defs: Vec<&FactDefinition> = definitions
        .iter()
        .filter(|d| d.world == EvaluationWorld::ActingHand)
        .collect();

    let composable_defs: Vec<FactDefinition> = acting_hand_defs
        .iter()
        .filter(|d| d.composition.is_some())
        .filter(|d| !POSTERIOR_FACTS.contains(&d.id.as_str()))
        .map(|d| (*d).clone())
        .collect();

    let sorted = topological_sort(&composable_defs);
    let bindings = relational_context.and_then(|ctx| ctx.bindings.as_ref());

    for def in sorted {
        // Skip if already evaluated (primitives, bridge-derived, system)
        if facts.contains_key(&def.id) {
            continue;
        }

        if let Some(composition) = def.composition.as_ref() {
            let value = evaluate_composition(composition, hand, &facts, bindings);
            facts.insert(
                def.id.clone(),
                FactValue {
                    fact_id: def.id.clone(),
                    value,
                },
            );
        }
        // If no composition at all, skip silently (gap logged in golden-master tests)
    }

    // Layer 5: Bridge relational overrides
    if let Some(ctx) = relational_context {
        evaluate_bridge_relational(hand, &mut facts, ctx);
    }

    // Layer 6: System relational overrides
    if let (Some(sys), Some(ctx)) = (system_config, relational_context) {
        evaluate_system_relational(sys, &mut facts, ctx);
    }

    EvaluatedFacts {
        world: EvaluationWorld::ActingHand,
        facts,
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::fv_bool;
    use super::*;
    use bridge_engine::{evaluate_hand_hcp, Card, Hand, Rank, Suit};

    fn make_hand(specs: &[(&str, &str)]) -> Hand {
        let cards: Vec<Card> = specs
            .iter()
            .map(|(s, r)| Card {
                suit: match *s {
                    "S" => Suit::Spades,
                    "H" => Suit::Hearts,
                    "D" => Suit::Diamonds,
                    "C" => Suit::Clubs,
                    _ => panic!("bad suit"),
                },
                rank: match *r {
                    "2" => Rank::Two,
                    "3" => Rank::Three,
                    "4" => Rank::Four,
                    "5" => Rank::Five,
                    "6" => Rank::Six,
                    "7" => Rank::Seven,
                    "8" => Rank::Eight,
                    "9" => Rank::Nine,
                    "T" => Rank::Ten,
                    "J" => Rank::Jack,
                    "Q" => Rank::Queen,
                    "K" => Rank::King,
                    "A" => Rank::Ace,
                    _ => panic!("bad rank"),
                },
            })
            .collect();
        Hand { cards }
    }

    #[test]
    fn evaluate_primitives_only() {
        // S: AK32  H: QJ3  D: A52  C: K73
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "3"),
            ("S", "2"),
            ("H", "Q"),
            ("H", "J"),
            ("H", "3"),
            ("D", "A"),
            ("D", "5"),
            ("D", "2"),
            ("C", "K"),
            ("C", "7"),
            ("C", "3"),
        ]);
        let eval = evaluate_hand_hcp(&hand);
        let result = evaluate_facts(&hand, &eval, &[], None, None, None);

        assert_eq!(result.world, EvaluationWorld::ActingHand);
        // HCP = 4+3+2+1+4+3 = 17
        assert_eq!(result.facts["hand.hcp"].value.as_number(), 17.0);
        assert_eq!(
            result.facts["hand.suitLength.spades"].value.as_number(),
            4.0
        );
        assert_eq!(
            result.facts["hand.suitLength.hearts"].value.as_number(),
            3.0
        );
        assert_eq!(
            result.facts["hand.suitLength.diamonds"].value.as_number(),
            3.0
        );
        assert_eq!(result.facts["hand.suitLength.clubs"].value.as_number(), 3.0);
        assert_eq!(result.facts["hand.isBalanced"].value.as_bool(), true);
    }

    #[test]
    fn evaluate_bridge_derived_facts() {
        // S: AK532  H: QJ32  D: A5  C: K7
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "5"),
            ("S", "3"),
            ("S", "2"),
            ("H", "Q"),
            ("H", "J"),
            ("H", "3"),
            ("H", "2"),
            ("D", "A"),
            ("D", "5"),
            ("C", "K"),
            ("C", "7"),
        ]);
        let eval = evaluate_hand_hcp(&hand);
        let result = evaluate_facts(&hand, &eval, &[], None, None, None);

        assert_eq!(
            result.facts["bridge.hasFourCardMajor"].value.as_bool(),
            true
        );
        assert_eq!(
            result.facts["bridge.hasFiveCardMajor"].value.as_bool(),
            true
        );
        assert_eq!(
            result.facts["bridge.majorPattern"].value.as_text(),
            "five-four"
        );
        assert_eq!(result.facts["bridge.hasShortage"].value.as_bool(), false);
    }

    #[test]
    fn evaluate_with_vulnerability() {
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "Q"),
            ("S", "J"),
            ("H", "A"),
            ("H", "K"),
            ("H", "Q"),
            ("D", "A"),
            ("D", "K"),
            ("D", "Q"),
            ("C", "A"),
            ("C", "K"),
            ("C", "Q"),
        ]);
        let eval = evaluate_hand_hcp(&hand);

        let mut ctx_facts = HashMap::new();
        ctx_facts.insert(
            "bridge.isVulnerable".to_string(),
            fv_bool("bridge.isVulnerable", true),
        );
        let result = evaluate_facts(&hand, &eval, &[], None, None, Some(&ctx_facts));
        assert_eq!(result.facts["bridge.isVulnerable"].value.as_bool(), true);
    }

    #[test]
    fn evaluate_major_pattern_five_four() {
        // S: AK532  H: QJ32  D: A5  C: K7  → five-four (S5+H4+)
        // Wait, above has S=5, H=4: that's five-four
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "5"),
            ("S", "3"),
            ("S", "2"),
            ("H", "Q"),
            ("H", "J"),
            ("H", "3"),
            ("H", "2"),
            ("D", "A"),
            ("D", "5"),
            ("C", "K"),
            ("C", "7"),
        ]);
        let eval = evaluate_hand_hcp(&hand);
        let result = evaluate_facts(&hand, &eval, &[], None, None, None);
        // S=5, H=4: matches five-four case
        assert_eq!(
            result.facts["bridge.majorPattern"].value.as_text(),
            "five-four"
        );
    }

    #[test]
    fn evaluate_major_pattern_both_four() {
        // S=4, H=4, D=3, C=2
        let hand = make_hand(&[
            ("S", "A"),
            ("S", "K"),
            ("S", "5"),
            ("S", "3"),
            ("H", "Q"),
            ("H", "J"),
            ("H", "3"),
            ("H", "2"),
            ("D", "A"),
            ("D", "5"),
            ("D", "4"),
            ("C", "K"),
            ("C", "7"),
        ]);
        let eval = evaluate_hand_hcp(&hand);
        let result = evaluate_facts(&hand, &eval, &[], None, None, None);
        assert_eq!(
            result.facts["bridge.majorPattern"].value.as_text(),
            "both-four"
        );
    }

    #[test]
    fn evaluate_yarborough() {
        // 0 HCP, 4333 shape
        let hand = make_hand(&[
            ("S", "2"),
            ("S", "3"),
            ("S", "4"),
            ("S", "5"),
            ("H", "2"),
            ("H", "3"),
            ("H", "4"),
            ("D", "2"),
            ("D", "3"),
            ("D", "4"),
            ("C", "2"),
            ("C", "3"),
            ("C", "4"),
        ]);
        let eval = evaluate_hand_hcp(&hand);
        let result = evaluate_facts(&hand, &eval, &[], None, None, None);

        assert_eq!(result.facts["hand.hcp"].value.as_number(), 0.0);
        assert_eq!(result.facts["hand.isBalanced"].value.as_bool(), true);
        assert_eq!(
            result.facts["bridge.hasFourCardMajor"].value.as_bool(),
            true
        );
        assert_eq!(
            result.facts["bridge.hasFiveCardMajor"].value.as_bool(),
            false
        );
        assert_eq!(
            result.facts["bridge.majorPattern"].value.as_text(),
            "one-four"
        );
        assert_eq!(result.facts["bridge.hasShortage"].value.as_bool(), false);
    }

    #[test]
    fn evaluate_13_card_suit() {
        // 13 spades
        let hand = Hand {
            cards: [
                Rank::Two,
                Rank::Three,
                Rank::Four,
                Rank::Five,
                Rank::Six,
                Rank::Seven,
                Rank::Eight,
                Rank::Nine,
                Rank::Ten,
                Rank::Jack,
                Rank::Queen,
                Rank::King,
                Rank::Ace,
            ]
            .iter()
            .map(|&rank| Card {
                suit: Suit::Spades,
                rank,
            })
            .collect(),
        };
        let eval = evaluate_hand_hcp(&hand);
        let result = evaluate_facts(&hand, &eval, &[], None, None, None);

        assert_eq!(
            result.facts["hand.suitLength.spades"].value.as_number(),
            13.0
        );
        assert_eq!(
            result.facts["hand.suitLength.hearts"].value.as_number(),
            0.0
        );
        assert_eq!(result.facts["hand.isBalanced"].value.as_bool(), false);
        assert_eq!(result.facts["bridge.hasShortage"].value.as_bool(), true);
    }
}
