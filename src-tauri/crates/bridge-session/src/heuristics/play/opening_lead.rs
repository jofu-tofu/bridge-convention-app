//! Opening lead heuristic — applies on the very first lead by a defender.

use bridge_engine::{Card, Suit};

use crate::heuristics::opening_leads::{
    lead_fourth_best, lead_from_ak_combination, lead_low_from_longest, lead_short_suit,
    lead_touching_honors,
};
use crate::heuristics::play_types::{group_by_suit, is_defender, PlayContext, PlayHeuristic};

pub struct OpeningLeadHeuristic;

impl PlayHeuristic for OpeningLeadHeuristic {
    fn name(&self) -> &str {
        "opening-lead"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        // Only applies on the very first lead by a defender
        if !ctx.current_trick.is_empty() || !ctx.previous_tricks.is_empty() {
            return None;
        }
        if !is_defender(ctx.seat, ctx.contract.declarer) {
            return None;
        }

        let is_nt = ctx.trump_suit.is_none();
        let suit_groups = group_by_suit(&ctx.hand.cards);

        // Suit contracts: lead ace from AK combination in a side suit
        if let Some(trump) = ctx.trump_suit {
            let ak = lead_from_ak_combination(&ctx.hand.cards, trump, &ctx.legal_plays);
            if ak.is_some() {
                return ak;
            }
        }

        // Try top of touching honors from any suit
        let touching = lead_touching_honors(&suit_groups, &ctx.legal_plays);
        if touching.is_some() {
            return touching;
        }

        // VS NT: 4th best from longest suit
        if is_nt {
            let fourth = lead_fourth_best(&suit_groups, &ctx.legal_plays);
            if fourth.is_some() {
                return fourth;
            }
        }

        // Suit contracts: singleton lead
        if let Some(trump) = ctx.trump_suit {
            let singleton = lead_short_suit(&ctx.hand.cards, trump, &ctx.legal_plays);
            if singleton.is_some() {
                return singleton;
            }
        }

        // Suit contracts: 4th best from longest non-trump suit
        if let Some(trump) = ctx.trump_suit {
            let non_trump_groups: Vec<(Suit, Vec<Card>)> = suit_groups
                .iter()
                .filter(|(s, _)| *s != trump)
                .cloned()
                .collect();
            let fourth = lead_fourth_best(&non_trump_groups, &ctx.legal_plays);
            if fourth.is_some() {
                return fourth;
            }
        }

        // General fallback: lead low from longest suit (excluding trump in suit contracts)
        lead_low_from_longest(&ctx.hand.cards, ctx.trump_suit, &ctx.legal_plays)
    }
}
