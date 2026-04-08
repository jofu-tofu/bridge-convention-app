//! Discard management heuristic — choose the best discard when void in led suit.

use bridge_engine::constants::partner_seat;
use bridge_engine::{Card, Suit};

use crate::heuristics::play_types::{is_honor, sort_by_rank_asc, PlayContext, PlayHeuristic};

/// Minimum posterior confidence to use inference in heuristics.
const INFERENCE_CONFIDENCE_GATE: f64 = 0.3;

pub struct DiscardHeuristic;

impl PlayHeuristic for DiscardHeuristic {
    fn name(&self) -> &str {
        "discard-management"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        if ctx.current_trick.is_empty() {
            return None;
        }

        let led_suit = ctx.current_trick[0].card.suit;
        let has_led_suit = ctx.legal_plays.iter().any(|c| c.suit == led_suit);

        // Only applies when void in led suit (and can't/shouldn't trump)
        if has_led_suit {
            return None;
        }

        // Collect non-trump suits available for discard
        let mut suit_groups: Vec<(Suit, Vec<Card>)> = Vec::new();
        for c in &ctx.legal_plays {
            if Some(c.suit) == ctx.trump_suit {
                continue; // Don't discard trump
            }
            if let Some(entry) = suit_groups.iter_mut().find(|(s, _)| *s == c.suit) {
                entry.1.push(c.clone());
            } else {
                suit_groups.push((c.suit, vec![c.clone()]));
            }
        }

        if suit_groups.is_empty() {
            return None;
        }

        // Check for inference-based partner suit lengths
        let partner_short_suits = get_partner_short_suits(ctx);

        // Score each suit: prefer discarding from suits without honors,
        // avoid baring an honor (e.g. Kx -> lone K), then prefer shorter suits
        struct SuitScore {
            cards: Vec<Card>,
            honor_count: usize,
            would_bare_honor: bool,
            length: usize,
            partner_is_short: bool,
        }

        let mut scored: Vec<SuitScore> = suit_groups
            .into_iter()
            .map(|(suit, cards)| {
                let honor_count = cards.iter().filter(|c| is_honor(c.rank)).count();
                let would_bare_honor = cards.len() == 2 && honor_count > 0;
                let length = cards.len();
                let partner_is_short = partner_short_suits
                    .as_ref()
                    .map_or(false, |shorts| shorts.contains(&suit));
                SuitScore {
                    cards,
                    honor_count,
                    would_bare_honor,
                    length,
                    partner_is_short,
                }
            })
            .collect();

        scored.sort_by(|a, b| {
            // Never bare an honor if alternatives exist
            match (a.would_bare_honor, b.would_bare_honor) {
                (true, false) => return std::cmp::Ordering::Greater,
                (false, true) => return std::cmp::Ordering::Less,
                _ => {}
            }
            // Prefer suits without honors
            match (a.honor_count == 0, b.honor_count == 0) {
                (true, false) => return std::cmp::Ordering::Less,
                (false, true) => return std::cmp::Ordering::Greater,
                _ => {}
            }
            // Inference tiebreaker: among equal honor_count, prefer discarding
            // from suits where partner is short (partner can't help there)
            if a.honor_count == b.honor_count {
                match (a.partner_is_short, b.partner_is_short) {
                    (true, false) => return std::cmp::Ordering::Less,
                    (false, true) => return std::cmp::Ordering::Greater,
                    _ => {}
                }
            }
            // Then shortest
            a.length.cmp(&b.length)
        });

        let best = scored.into_iter().next()?;

        // Discard lowest from chosen suit
        sort_by_rank_asc(&best.cards).into_iter().next()
    }
}

/// Identify suits where partner is expected to be short (≤2 cards) from posterior.
fn get_partner_short_suits(ctx: &PlayContext) -> Option<Vec<Suit>> {
    let beliefs = ctx.beliefs.as_ref()?;
    if beliefs.posterior_confidence <= INFERENCE_CONFIDENCE_GATE {
        return None;
    }
    let suit_lengths = beliefs.posterior_suit_lengths.as_ref()?;
    let partner = partner_seat(ctx.seat);
    let partner_lengths = suit_lengths.get(&partner)?;

    let short: Vec<Suit> = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs]
        .iter()
        .filter(|&&suit| partner_lengths.get(&suit).map_or(false, |&len| len <= 2.0))
        .copied()
        .collect();

    Some(short)
}
