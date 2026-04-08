//! Cover honor with honor heuristic — play a higher honor when an honor is led.

use bridge_engine::Card;

use crate::heuristics::play_types::{
    is_honor, rank_beats, sort_by_rank_asc, PlayContext, PlayHeuristic,
};

pub struct CoverHonorHeuristic;

impl PlayHeuristic for CoverHonorHeuristic {
    fn name(&self) -> &str {
        "cover-honor-with-honor"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        if ctx.current_trick.is_empty() {
            return None;
        }

        let led_card = &ctx.current_trick[0].card;
        if !is_honor(led_card.rank) {
            return None;
        }

        // Find legal plays in the led suit that are higher honors
        let higher_honors: Vec<Card> = ctx
            .legal_plays
            .iter()
            .filter(|c| {
                c.suit == led_card.suit && is_honor(c.rank) && rank_beats(c.rank, led_card.rank)
            })
            .cloned()
            .collect();

        if higher_honors.is_empty() {
            return None;
        }

        // Play the lowest honor that covers
        sort_by_rank_asc(&higher_honors).into_iter().next()
    }
}
