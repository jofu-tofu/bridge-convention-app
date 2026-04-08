//! Mid-game lead heuristic — applies when on lead but not the opening lead.

use bridge_engine::{Card, Suit};

use crate::heuristics::opening_leads::lead_touching_honors;
use crate::heuristics::play_types::{
    find_partner_led_suit, group_by_suit, is_defender, sort_by_rank_asc, sort_by_rank_desc,
    PlayContext, PlayHeuristic,
};

/// Minimum posterior confidence to use inference in heuristics.
const INFERENCE_CONFIDENCE_GATE: f64 = 0.3;

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

        // ── Inference-guided mid-game lead ─────────────────────────
        if let Some(ref beliefs) = ctx.beliefs {
            if beliefs.posterior_confidence > INFERENCE_CONFIDENCE_GATE {
                if let Some(card) = inference_guided_midgame(ctx, beliefs, &suit_groups) {
                    return Some(card);
                }
            }
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

/// Use posterior to prefer leading suits where opponents are shortest.
fn inference_guided_midgame(
    ctx: &PlayContext,
    beliefs: &crate::heuristics::play_types::PlayBeliefs,
    suit_groups: &[(Suit, Vec<Card>)],
) -> Option<Card> {
    let suit_lengths = beliefs.posterior_suit_lengths.as_ref()?;

    let declarer = ctx.contract.declarer;
    let dummy = bridge_engine::constants::partner_seat(declarer);

    // Candidate non-trump suits
    let candidates: Vec<&(Suit, Vec<Card>)> = suit_groups
        .iter()
        .filter(|(s, _)| Some(*s) != ctx.trump_suit)
        .collect();

    if candidates.is_empty() {
        return None;
    }

    // Prefer suit where opponent pair's combined posterior length is shortest
    let best = candidates.iter().min_by(|(suit_a, _), (suit_b, _)| {
        let combined_a = opponent_combined_length(suit_lengths, declarer, dummy, *suit_a);
        let combined_b = opponent_combined_length(suit_lengths, declarer, dummy, *suit_b);
        combined_a
            .partial_cmp(&combined_b)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let (_, cards) = *best?;
    sort_by_rank_asc(cards).into_iter().next()
}

/// Sum of declarer + dummy expected suit length.
fn opponent_combined_length(
    suit_lengths: &std::collections::HashMap<
        bridge_engine::Seat,
        std::collections::HashMap<Suit, f64>,
    >,
    declarer: bridge_engine::Seat,
    dummy: bridge_engine::Seat,
    suit: Suit,
) -> f64 {
    let decl = suit_lengths
        .get(&declarer)
        .and_then(|m| m.get(&suit))
        .copied()
        .unwrap_or(3.25);
    let dum = suit_lengths
        .get(&dummy)
        .and_then(|m| m.get(&suit))
        .copied()
        .unwrap_or(3.25);
    decl + dum
}
