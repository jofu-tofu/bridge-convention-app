//! Mid-game lead heuristic — applies when on lead but not the opening lead.

use bridge_engine::{Card, Suit};

use crate::heuristics::opening_leads::lead_touching_honors;
use crate::heuristics::play_types::{
    find_partner_led_suit, group_by_suit, is_defender, sort_by_rank_asc, sort_by_rank_desc,
    PlayContext, PlayHeuristic,
};

pub struct MidGameLeadHeuristic;

impl PlayHeuristic for MidGameLeadHeuristic {
    fn name(&self) -> &str {
        "mid-game-lead"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        // Only when on lead, but not the opening lead
        if !ctx.current_trick.is_empty() || ctx.previous_tricks.is_empty() {
            return None;
        }

        let suit_groups = group_by_suit(&ctx.legal_plays);

        // Defenders: return partner's suit
        if is_defender(ctx.seat, ctx.contract.declarer) {
            let partner_suit =
                find_partner_led_suit(&ctx.previous_tricks, ctx.seat, ctx.trump_suit);
            if let Some(ps) = partner_suit {
                if let Some((_, cards)) = suit_groups.iter().find(|(s, _)| *s == ps) {
                    if cards.len() <= 2 {
                        // Remaining doubleton or less: lead top (high-low to show count)
                        return sort_by_rank_desc(cards).into_iter().next();
                    }
                    // Otherwise lead low
                    return sort_by_rank_asc(cards).into_iter().next();
                }
            }
        }

        // Try touching honors from any non-trump suit
        let non_trump_groups: Vec<(Suit, Vec<Card>)> = suit_groups
            .iter()
            .filter(|(s, _)| Some(*s) != ctx.trump_suit)
            .cloned()
            .collect();
        let touching = lead_touching_honors(&non_trump_groups, &ctx.legal_plays);
        if touching.is_some() {
            return touching;
        }

        // Lead from longest non-trump suit
        let mut best_suit: Option<&(Suit, Vec<Card>)> = None;
        let mut best_len = 0;
        for entry in &suit_groups {
            if Some(entry.0) == ctx.trump_suit {
                continue;
            }
            if entry.1.len() > best_len {
                best_len = entry.1.len();
                best_suit = Some(entry);
            }
        }
        if let Some((_, cards)) = best_suit {
            return sort_by_rank_asc(cards).into_iter().next();
        }

        // Only trump left: lead lowest
        sort_by_rank_asc(&ctx.legal_plays).into_iter().next()
    }
}
