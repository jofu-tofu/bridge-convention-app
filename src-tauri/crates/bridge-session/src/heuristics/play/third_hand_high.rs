//! Third hand high heuristic — play high when third to play.

use bridge_engine::constants::partner_seat;
use bridge_engine::Card;

use crate::heuristics::play_types::{
    get_trick_winner_so_far, rank_beats, sort_by_rank_asc, sort_by_rank_desc, PlayContext,
    PlayHeuristic,
};

pub struct ThirdHandHighHeuristic;

impl PlayHeuristic for ThirdHandHighHeuristic {
    fn name(&self) -> &str {
        "third-hand-high"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        if ctx.current_trick.len() != 2 {
            return None;
        }

        let led_suit = ctx.current_trick[0].card.suit;
        let following_suit: Vec<Card> = ctx
            .legal_plays
            .iter()
            .filter(|c| c.suit == led_suit)
            .cloned()
            .collect();

        // Void in led suit -- defer to trump/discard heuristics
        if following_suit.is_empty() {
            return None;
        }

        let partner = partner_seat(ctx.seat);
        let winner_so_far = get_trick_winner_so_far(&ctx.current_trick, ctx.trump_suit);

        // If partner is already winning, play low
        if let Some(w) = winner_so_far {
            if w.seat == partner {
                return sort_by_rank_asc(&following_suit).into_iter().next();
            }

            let winner_is_trump = ctx.trump_suit == Some(w.card.suit);

            if !winner_is_trump {
                // Play just high enough to beat current winner
                let sorted = sort_by_rank_asc(&following_suit);
                for c in &sorted {
                    if rank_beats(c.rank, w.card.rank) {
                        return Some(c.clone());
                    }
                }
            }
            // Can't beat it, play lowest in suit
            return sort_by_rank_asc(&following_suit).into_iter().next();
        }

        // No winner determined (shouldn't happen with 2 cards), play highest in suit
        sort_by_rank_desc(&following_suit).into_iter().next()
    }
}
