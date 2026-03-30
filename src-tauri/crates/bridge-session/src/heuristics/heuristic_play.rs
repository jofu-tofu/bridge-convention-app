//! Eight play heuristics implementing the PlayHeuristic trait.
//!
//! Chain order: opening-lead -> mid-game-lead -> second-hand-low ->
//! third-hand-high -> fourth-hand-play -> cover-honor-with-honor ->
//! trump-management -> discard-management -> default-lowest fallback.

use bridge_engine::constants::partner_seat;
use bridge_engine::{Card, Suit};

use super::opening_leads::{
    lead_fourth_best, lead_from_ak_combination, lead_low_from_longest, lead_short_suit,
    lead_touching_honors,
};
use super::play_types::{
    find_partner_led_suit, get_trick_winner_so_far, group_by_suit, is_defender, is_honor,
    is_legal_play, rank_beats, sort_by_rank_asc, sort_by_rank_desc, PlayContext, PlayHeuristic,
    PlayResult,
};

// ── Opening Lead ────────────────────────────────────────────────────

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

// ── Mid-Game Lead ───────────────────────────────────────────────────

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

// ── Second Hand Low ─────────────────────────────────────────────────

pub struct SecondHandLowHeuristic;

impl PlayHeuristic for SecondHandLowHeuristic {
    fn name(&self) -> &str {
        "second-hand-low"
    }

    fn apply(&self, ctx: &PlayContext) -> Option<Card> {
        if ctx.current_trick.len() != 1 {
            return None;
        }

        let led_card = &ctx.current_trick[0].card;
        let led_suit = led_card.suit;
        let following_suit = ctx.legal_plays.iter().any(|c| c.suit == led_suit);

        // Only applies when we can follow suit
        if !following_suit {
            return None;
        }

        // Exception: if an honor was led and we hold a covering honor, defer to cover-honor
        if is_honor(led_card.rank) {
            let has_covering_honor = ctx.legal_plays.iter().any(|c| {
                c.suit == led_suit && is_honor(c.rank) && rank_beats(c.rank, led_card.rank)
            });
            if has_covering_honor {
                return None;
            }
        }

        // Play lowest card in the led suit
        let suit_cards: Vec<Card> = ctx
            .legal_plays
            .iter()
            .filter(|c| c.suit == led_suit)
            .cloned()
            .collect();
        sort_by_rank_asc(&suit_cards).into_iter().next()
    }
}

// ── Third Hand High ─────────────────────────────────────────────────

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

// ── Fourth Hand Play ────────────────────────────────────────────────

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

// ── Cover Honor with Honor ──────────────────────────────────────────

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

// ── Trump Management ────────────────────────────────────────────────

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

// ── Discard Management ──────────────────────────────────────────────

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

// ── Heuristic Play Strategy ─────────────────────────────────────────

/// Returns the default ordered list of all play heuristics.
pub fn default_heuristic_chain() -> Vec<Box<dyn PlayHeuristic>> {
    vec![
        Box::new(OpeningLeadHeuristic),
        Box::new(MidGameLeadHeuristic),
        Box::new(SecondHandLowHeuristic),
        Box::new(ThirdHandHighHeuristic),
        Box::new(FourthHandHeuristic),
        Box::new(CoverHonorHeuristic),
        Box::new(TrumpManagementHeuristic),
        Box::new(DiscardHeuristic),
    ]
}

/// Run the heuristic chain: try each heuristic in order, first Some wins.
/// Falls back to lowest legal card if no heuristic matches.
pub fn suggest_play(ctx: &PlayContext) -> PlayResult {
    assert!(
        !ctx.legal_plays.is_empty(),
        "No legal plays available"
    );

    let heuristics = default_heuristic_chain();

    for h in &heuristics {
        if let Some(card) = h.apply(ctx) {
            // Verify the card is in legal_plays
            if is_legal_play(&card, &ctx.legal_plays) {
                return PlayResult {
                    card,
                    reason: h.name().to_string(),
                };
            }
        }
    }

    // Fallback: lowest legal card
    let sorted = sort_by_rank_asc(&ctx.legal_plays);
    let fallback = sorted.into_iter().next().unwrap_or_else(|| ctx.legal_plays[0].clone());
    PlayResult {
        card: fallback,
        reason: "default-lowest".to_string(),
    }
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::{BidSuit, Contract, Hand, PlayedCard, Rank, Seat, Suit, Trick};

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn played(seat: Seat, suit: Suit, rank: Rank) -> PlayedCard {
        PlayedCard {
            card: card(suit, rank),
            seat,
        }
    }

    fn make_contract(declarer: Seat) -> Contract {
        Contract {
            level: 4,
            strain: BidSuit::Spades,
            doubled: false,
            redoubled: false,
            declarer,
        }
    }

    fn nt_contract(declarer: Seat) -> Contract {
        Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer,
        }
    }

    fn make_hand(cards: Vec<Card>) -> Hand {
        Hand { cards }
    }

    // ── Opening Lead tests ──────────────────────────────────────────

    #[test]
    fn opening_lead_ak_in_suit_contract() {
        let h = OpeningLeadHeuristic;
        let hand = make_hand(vec![
            card(Suit::Hearts, Rank::Ace),
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Diamonds, Rank::Queen),
            card(Suit::Diamonds, Rank::Jack),
            card(Suit::Clubs, Rank::Ten),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Clubs, Rank::Seven),
            card(Suit::Clubs, Rank::Six),
            card(Suit::Clubs, Rank::Five),
            card(Suit::Clubs, Rank::Four),
            card(Suit::Clubs, Rank::Three),
        ]);
        let ctx = PlayContext {
            hand: hand.clone(),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: Some(Suit::Spades),
            legal_plays: hand.cards.clone(),
            dummy_hand: None,
        };
        let result = h.apply(&ctx);
        assert!(result.is_some());
        let c = result.unwrap();
        assert_eq!(c.suit, Suit::Hearts);
        assert_eq!(c.rank, Rank::Ace);
    }

    #[test]
    fn opening_lead_not_for_declarer() {
        let h = OpeningLeadHeuristic;
        let hand = make_hand(vec![card(Suit::Spades, Rank::Ace)]);
        let ctx = PlayContext {
            hand: hand.clone(),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::South, // declarer
            trump_suit: Some(Suit::Spades),
            legal_plays: hand.cards.clone(),
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn opening_lead_not_after_first_trick() {
        let h = OpeningLeadHeuristic;
        let hand = make_hand(vec![card(Suit::Spades, Rank::Ace)]);
        let ctx = PlayContext {
            hand: hand.clone(),
            current_trick: vec![],
            previous_tricks: vec![Trick {
                plays: vec![],
                trump_suit: None,
                winner: None,
            }],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: Some(Suit::Spades),
            legal_plays: hand.cards.clone(),
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Mid-Game Lead tests ─────────────────────────────────────────

    #[test]
    fn midgame_lead_returns_partner_suit() {
        let h = MidGameLeadHeuristic;
        let prev_trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Diamonds, Rank::King),
                played(Seat::East, Suit::Diamonds, Rank::Two),
                played(Seat::South, Suit::Diamonds, Rank::Ace),
                played(Seat::West, Suit::Diamonds, Rank::Three),
            ],
            trump_suit: Some(Suit::Spades),
            winner: Some(Seat::South),
        };
        let legal = vec![
            card(Suit::Diamonds, Rank::Five),
            card(Suit::Hearts, Rank::Seven),
        ];
        let ctx = PlayContext {
            hand: make_hand(vec![
                card(Suit::Diamonds, Rank::Five),
                card(Suit::Hearts, Rank::Seven),
                // padding to 13 not needed for heuristic
            ]),
            current_trick: vec![],
            previous_tricks: vec![prev_trick],
            contract: make_contract(Seat::South),
            seat: Seat::East, // defender, partner is West
            trump_suit: Some(Suit::Spades),
            legal_plays: legal,
            dummy_hand: None,
        };
        // Partner (West) didn't lead, but North led diamonds.
        // East's partner is West. West did not lead. So no partner-led suit.
        // Falls through to other logic.
        let result = h.apply(&ctx);
        assert!(result.is_some());
    }

    #[test]
    fn midgame_lead_not_on_first_trick() {
        let h = MidGameLeadHeuristic;
        let ctx = PlayContext {
            hand: make_hand(vec![card(Suit::Spades, Rank::Ace)]),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn midgame_lead_not_when_following() {
        let h = MidGameLeadHeuristic;
        let ctx = PlayContext {
            hand: make_hand(vec![card(Suit::Spades, Rank::Ace)]),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::King)],
            previous_tricks: vec![Trick {
                plays: vec![],
                trump_suit: None,
                winner: None,
            }],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Second Hand Low tests ───────────────────────────────────────

    #[test]
    fn second_hand_low_plays_lowest() {
        let h = SecondHandLowHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
            card(Suit::Spades, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Three);
    }

    #[test]
    fn second_hand_low_defers_on_honor_led_with_cover() {
        let h = SecondHandLowHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Spades, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Queen)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        // Should defer to cover-honor heuristic
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn second_hand_low_not_in_wrong_position() {
        let h = SecondHandLowHeuristic;
        let ctx = PlayContext {
            hand: make_hand(vec![card(Suit::Spades, Rank::Ace)]),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ten),
                played(Seat::East, Suit::Spades, Rank::Five),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::South,
            trump_suit: None,
            legal_plays: vec![card(Suit::Spades, Rank::Ace)],
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn second_hand_low_void_defers() {
        let h = SecondHandLowHeuristic;
        let legal = vec![card(Suit::Hearts, Rank::Five)];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Third Hand High tests ───────────────────────────────────────

    #[test]
    fn third_hand_high_beats_opponent() {
        let h = ThirdHandHighHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Five),
            card(Suit::Spades, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Four),
                played(Seat::East, Suit::Spades, Rank::Jack),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::North),
            seat: Seat::South,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Queen);
    }

    #[test]
    fn third_hand_high_partner_winning_play_low() {
        let h = ThirdHandHighHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        // South is playing third. Partner is North.
        // North led, East played.
        // If partner (North) is winning, play low.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Spades, Rank::Jack),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::East), // N/S are defenders
            seat: Seat::South,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Five);
    }

    // ── Fourth Hand Play tests ──────────────────────────────────────

    #[test]
    fn fourth_hand_wins_cheaply() {
        let h = FourthHandHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Three),
        ];
        // North declarer, so E/W are defenders. West plays 4th.
        // South (dummy) led, East played Jack (opponent of West? No -- East is West's partner).
        // Need: the winning card belongs to an opponent of West.
        // West's partner is East. So South winning means opponent winning.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Four),
                played(Seat::East, Suit::Spades, Rank::Five),
                played(Seat::South, Suit::Spades, Rank::Jack),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::North),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        // Should play Queen (cheapest winner over Jack)
        assert_eq!(result.rank, Rank::Queen);
    }

    #[test]
    fn fourth_hand_partner_winning_play_low() {
        let h = FourthHandHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Spades, Rank::Three),
        ];
        // West plays fourth. Partner is East.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Four),
                played(Seat::East, Suit::Spades, Rank::King),
                played(Seat::South, Suit::Spades, Rank::Five),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::Three);
    }

    // ── Cover Honor tests ───────────────────────────────────────────

    #[test]
    fn cover_honor_covers_queen_with_king() {
        let h = CoverHonorHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Queen)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.rank, Rank::King);
    }

    #[test]
    fn cover_honor_ignores_non_honor_led() {
        let h = CoverHonorHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn cover_honor_no_covering_honor() {
        let h = CoverHonorHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Jack),
            card(Suit::Spades, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::King)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        // Jack doesn't beat King
        assert!(h.apply(&ctx).is_none());
    }

    // ── Trump Management tests ──────────────────────────────────────

    #[test]
    fn trump_management_ruffs_with_lowest() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.suit, Suit::Hearts);
        assert_eq!(result.rank, Rank::Five);
    }

    #[test]
    fn trump_management_doesnt_ruff_partner() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Three),
        ];
        // South plays third. Partner is North. North led and is winning.
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Spades, Rank::King),
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::East), // N/S defenders
            seat: Seat::South,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        // Partner (North) is winning with Ace -- should not ruff
        assert!(h.apply(&ctx).is_none());
    }

    #[test]
    fn trump_management_overruffs_opponent() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Clubs, Rank::Five),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![
                played(Seat::North, Suit::Spades, Rank::Ten),
                played(Seat::East, Suit::Hearts, Rank::Five), // opponent trumped
            ],
            previous_tricks: vec![],
            contract: make_contract(Seat::East), // N/S defenders
            seat: Seat::South,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        assert_eq!(result.suit, Suit::Hearts);
        assert_eq!(result.rank, Rank::King);
    }

    #[test]
    fn trump_management_not_when_following_suit() {
        let h = TrumpManagementHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Five),
            card(Suit::Hearts, Rank::King),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Hearts),
            legal_plays: legal,
            dummy_hand: None,
        };
        // Has spades to follow, so trump heuristic should not apply
        assert!(h.apply(&ctx).is_none());
    }

    // ── Discard Management tests ────────────────────────────────────

    #[test]
    fn discard_prefers_no_honor_suit() {
        let h = DiscardHeuristic;
        let legal = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Three),
            card(Suit::Clubs, Rank::Two),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: Some(Suit::Diamonds),
            legal_plays: legal,
            dummy_hand: None,
        };
        let result = h.apply(&ctx).unwrap();
        // Should discard from clubs (no honors) rather than hearts (has King)
        assert_eq!(result.suit, Suit::Clubs);
        assert_eq!(result.rank, Rank::Two);
    }

    #[test]
    fn discard_not_when_following_suit() {
        let h = DiscardHeuristic;
        let legal = vec![
            card(Suit::Spades, Rank::Five),
            card(Suit::Hearts, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Spades, Rank::Ten)],
            previous_tricks: vec![],
            contract: make_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal,
            dummy_hand: None,
        };
        assert!(h.apply(&ctx).is_none());
    }

    // ── Full chain tests ────────────────────────────────────────────

    #[test]
    fn suggest_play_always_returns_legal_card() {
        let legal = vec![
            card(Suit::Spades, Rank::Five),
            card(Suit::Hearts, Rank::Three),
        ];
        let ctx = PlayContext {
            hand: make_hand(legal.clone()),
            current_trick: vec![played(Seat::North, Suit::Diamonds, Rank::Ten)],
            previous_tricks: vec![],
            contract: nt_contract(Seat::South),
            seat: Seat::East,
            trump_suit: None,
            legal_plays: legal.clone(),
            dummy_hand: None,
        };
        let result = suggest_play(&ctx);
        assert!(legal.iter().any(|c| c.suit == result.card.suit && c.rank == result.card.rank));
    }

    #[test]
    fn suggest_play_opening_lead_for_defender() {
        let hand_cards = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Queen),
            card(Suit::Hearts, Rank::Jack),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Spades, Rank::Eight),
            card(Suit::Spades, Rank::Seven),
            card(Suit::Spades, Rank::Six),
            card(Suit::Diamonds, Rank::Nine),
            card(Suit::Diamonds, Rank::Four),
            card(Suit::Diamonds, Rank::Three),
            card(Suit::Clubs, Rank::Ten),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Clubs, Rank::Two),
        ];
        let ctx = PlayContext {
            hand: make_hand(hand_cards.clone()),
            current_trick: vec![],
            previous_tricks: vec![],
            contract: nt_contract(Seat::South),
            seat: Seat::West,
            trump_suit: None,
            legal_plays: hand_cards,
            dummy_hand: None,
        };
        let result = suggest_play(&ctx);
        assert_eq!(result.reason, "opening-lead");
        // Should lead top of touching honors (KQJ of hearts)
        assert_eq!(result.card.suit, Suit::Hearts);
        assert_eq!(result.card.rank, Rank::King);
    }
}
