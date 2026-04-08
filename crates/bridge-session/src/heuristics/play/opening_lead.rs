//! Opening lead heuristic — applies on the very first lead by a defender.

use bridge_engine::constants::partner_seat;
use bridge_engine::{Card, Suit};

use crate::heuristics::opening_leads::{
    lead_fourth_best, lead_from_ak_combination, lead_low_from_longest, lead_short_suit,
    lead_touching_honors,
};
use crate::heuristics::play_types::{
    group_by_suit, is_defender, sort_by_rank_asc, PlayContext, PlayHeuristic,
};

/// Minimum posterior confidence to use inference in heuristics.
const INFERENCE_CONFIDENCE_GATE: f64 = 0.3;

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

        // ── Inference-guided suit preference ───────────────────────
        if let Some(ref beliefs) = ctx.beliefs {
            if beliefs.posterior_confidence > INFERENCE_CONFIDENCE_GATE {
                if let Some(card) = inference_guided_lead(ctx, beliefs) {
                    return Some(card);
                }
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

/// Use posterior suit-length expectations to pick the best lead suit.
fn inference_guided_lead(
    ctx: &PlayContext,
    beliefs: &crate::heuristics::play_types::PlayBeliefs,
) -> Option<Card> {
    let declarer = ctx.contract.declarer;
    let dummy = partner_seat(declarer);
    let is_nt = ctx.trump_suit.is_none();

    let suit_lengths = beliefs.posterior_suit_lengths.as_ref()?;

    // Candidate suits: those where we have 4+ cards (worth leading)
    let suit_groups = group_by_suit(&ctx.hand.cards);
    let candidates: Vec<(Suit, Vec<Card>)> = suit_groups
        .into_iter()
        .filter(|(s, cards)| cards.len() >= 4 && Some(*s) != ctx.trump_suit)
        .collect();

    if candidates.is_empty() {
        return None;
    }

    // Score each candidate suit
    let best = if is_nt {
        // NT: prefer suit where declarer has shortest expected length (attack weakness)
        candidates.iter().min_by(|(suit_a, _), (suit_b, _)| {
            let decl_len_a = suit_lengths
                .get(&declarer)
                .and_then(|m| m.get(suit_a))
                .copied()
                .unwrap_or(3.25);
            let decl_len_b = suit_lengths
                .get(&declarer)
                .and_then(|m| m.get(suit_b))
                .copied()
                .unwrap_or(3.25);
            decl_len_a
                .partial_cmp(&decl_len_b)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    } else {
        // Suit contracts: prefer suits where dummy has length (through-strength),
        // avoid suits where declarer is short (they'll ruff)
        candidates.iter().max_by(|(suit_a, _), (suit_b, _)| {
            let dummy_len_a = suit_lengths
                .get(&dummy)
                .and_then(|m| m.get(suit_a))
                .copied()
                .unwrap_or(3.25);
            let dummy_len_b = suit_lengths
                .get(&dummy)
                .and_then(|m| m.get(suit_b))
                .copied()
                .unwrap_or(3.25);
            let decl_len_a = suit_lengths
                .get(&declarer)
                .and_then(|m| m.get(suit_a))
                .copied()
                .unwrap_or(3.25);
            let decl_len_b = suit_lengths
                .get(&declarer)
                .and_then(|m| m.get(suit_b))
                .copied()
                .unwrap_or(3.25);
            // Score: dummy length (prefer high) minus declarer shortness penalty
            let score_a = dummy_len_a - (3.25 - decl_len_a).max(0.0);
            let score_b = dummy_len_b - (3.25 - decl_len_b).max(0.0);
            score_a
                .partial_cmp(&score_b)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    };

    let (_, ref cards) = best?;
    // Lead low from chosen suit
    sort_by_rank_asc(cards).into_iter().next()
}
