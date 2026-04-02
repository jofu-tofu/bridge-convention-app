//! Second hand low heuristic — play lowest card when second to play.

use bridge_engine::Card;

use crate::heuristics::play_types::{
    is_honor, rank_beats, sort_by_rank_asc, PlayContext, PlayHeuristic,
};

pub struct SecondHandLowHeuristic;

impl PlayHeuristic for SecondHandLowHeuristic {
    fn name(&self) -> &str {
        "second-hand-low"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        if ctx.current_trick.len() != 1 {
            return None;
        }

        let led_card = &ctx.current_trick[0].card;
        let led_suit = led_card.suit;
        let following_suit = ctx.legal_plays.iter().any(|c| c.suit == led_suit);

        // Only applies when we can follow suit
        if !following_suit {
            return None;
        }

        // Exception: if an honor was led and we hold a covering honor, defer to cover-honor
        if is_honor(led_card.rank) {
            let has_covering_honor = ctx.legal_plays.iter().any(|c| {
                c.suit == led_suit && is_honor(c.rank) && rank_beats(c.rank, led_card.rank)
            });
            if has_covering_honor {
                return None;
            }
        }

        // Play lowest card in the led suit
        let suit_cards: Vec<Card> = ctx
            .legal_plays
            .iter()
            .filter(|c| c.suit == led_suit)
            .cloned()
            .collect();
        sort_by_rank_asc(&suit_cards).into_iter().next()
    }
}
