//! Trump management heuristic — ruff, overruff, or defer when void in led suit.

use bridge_engine::constants::partner_seat;
use bridge_engine::Card;

use crate::heuristics::play_types::{
    get_trick_winner_so_far, rank_beats, sort_by_rank_asc, PlayContext, PlayHeuristic,
};

pub struct TrumpManagementHeuristic;

impl PlayHeuristic for TrumpManagementHeuristic {
    fn name(&self) -> &str {
        "trump-management"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        let trump_suit = ctx.trump_suit?;
        if ctx.current_trick.is_empty() {
            return None;
        }

        let led_suit = ctx.current_trick[0].card.suit;
        let has_led_suit = ctx.legal_plays.iter().any(|c| c.suit == led_suit);

        // Only applies when void in led suit
        if has_led_suit {
            return None;
        }

        let trump_cards: Vec<Card> = ctx
            .legal_plays
            .iter()
            .filter(|c| c.suit == trump_suit)
            .cloned()
            .collect();
        if trump_cards.is_empty() {
            return None;
        }

        let partner = partner_seat(ctx.seat);
        let winner_so_far = get_trick_winner_so_far(&ctx.current_trick, ctx.trump_suit);

        if let Some(w) = winner_so_far {
            let winner_is_trump = w.card.suit == trump_suit;

            // Partner winning -- don't ruff partner's trick
            if w.seat == partner {
                return None; // Let discard heuristic handle it
            }

            // Opponent winning with trump -- overruff if possible
            if winner_is_trump {
                let sorted = sort_by_rank_asc(&trump_cards);
                for c in &sorted {
                    if rank_beats(c.rank, w.card.rank) {
                        return Some(c.clone());
                    }
                }
                // Can't overruff -- don't waste trump, discard instead
                return None;
            }
        }

        // Opponent winning with non-trump (or no specific winner) -- ruff with lowest trump
        sort_by_rank_asc(&trump_cards).into_iter().next()
    }
}
