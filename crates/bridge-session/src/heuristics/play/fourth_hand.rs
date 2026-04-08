//! Fourth hand play heuristic — win cheaply or duck when partner is winning.

use bridge_engine::constants::partner_seat;
use bridge_engine::Card;

use crate::heuristics::play_types::{
    get_trick_winner_so_far, rank_beats, sort_by_rank_asc, PlayContext, PlayHeuristic,
};

pub struct FourthHandHeuristic;

impl PlayHeuristic for FourthHandHeuristic {
    fn name(&self) -> &str {
        "fourth-hand-play"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        if ctx.current_trick.len() != 3 {
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

        // Partner is winning -- play low
        if let Some(w) = winner_so_far {
            if w.seat == partner {
                return sort_by_rank_asc(&following_suit).into_iter().next();
            }

            let winner_is_trump = ctx.trump_suit == Some(w.card.suit);

            if !winner_is_trump {
                // Win as cheaply as possible
                let sorted = sort_by_rank_asc(&following_suit);
                for c in &sorted {
                    if rank_beats(c.rank, w.card.rank) {
                        return Some(c.clone());
                    }
                }
            }
            // Can't beat -- play lowest
            return sort_by_rank_asc(&following_suit).into_iter().next();
        }

        // No winner (shouldn't happen), play lowest
        sort_by_rank_asc(&following_suit).into_iter().next()
    }
}
