//! Discard management heuristic — choose the best discard when void in led suit.

use bridge_engine::{Card, Suit};

use crate::heuristics::play_types::{is_honor, sort_by_rank_asc, PlayContext, PlayHeuristic};

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

        // Score each suit: prefer discarding from suits without honors,
        // avoid baring an honor (e.g. Kx -> lone K), then prefer shorter suits
        struct SuitScore {
            #[allow(dead_code)]
            suit: Suit,
            cards: Vec<Card>,
            honor_count: usize,
            would_bare_honor: bool,
            length: usize,
        }

        let mut scored: Vec<SuitScore> = suit_groups
            .into_iter()
            .map(|(suit, cards)| {
                let honor_count = cards.iter().filter(|c| is_honor(c.rank)).count();
                let would_bare_honor = cards.len() == 2 && honor_count > 0;
                let length = cards.len();
                SuitScore {
                    suit,
                    cards,
                    honor_count,
                    would_bare_honor,
                    length,
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
            // Then shortest
            a.length.cmp(&b.length)
        });

        let best = scored.into_iter().next()?;

        // Discard lowest from chosen suit
        sort_by_rank_asc(&best.cards).into_iter().next()
    }
}
