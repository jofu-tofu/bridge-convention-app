use std::cmp::Ordering;

use crate::constants::partner_seat;
use crate::error::EngineError;
use crate::types::{Auction, AuctionEntry, BidSuit, Call, Contract, Seat};

/// Strain rank for bid comparison: C=1, D=2, H=3, S=4, NT=5.
fn strain_rank(strain: BidSuit) -> u8 {
    match strain {
        BidSuit::Clubs => 1,
        BidSuit::Diamonds => 2,
        BidSuit::Hearts => 3,
        BidSuit::Spades => 4,
        BidSuit::NoTrump => 5,
    }
}

/// Compare two contract bids. Returns Ordering.
pub fn compare_bids(a_level: u8, a_strain: BidSuit, b_level: u8, b_strain: BidSuit) -> Ordering {
    a_level.cmp(&b_level).then_with(|| strain_rank(a_strain).cmp(&strain_rank(b_strain)))
}

fn same_side(a: Seat, b: Seat) -> bool {
    a == b || partner_seat(a) == b
}

/// Find the last non-pass entry.
fn last_non_pass(auction: &Auction) -> Option<&AuctionEntry> {
    auction.entries.iter().rev().find(|e| !matches!(e.call, Call::Pass))
}

/// Find the last contract bid entry.
fn last_bid(auction: &Auction) -> Option<&AuctionEntry> {
    auction.entries.iter().rev().find(|e| matches!(e.call, Call::Bid { .. }))
}

/// Check whether a call is legal given the current auction state and seat.
pub fn is_legal_call(auction: &Auction, call: &Call, seat: Seat) -> bool {
    if auction.is_complete {
        return false;
    }

    match call {
        Call::Pass => true,

        Call::Bid { level, strain } => {
            match last_bid(auction) {
                None => true, // first bid is always legal
                Some(entry) => {
                    let Call::Bid { level: prev_level, strain: prev_strain } = &entry.call else {
                        return false;
                    };
                    compare_bids(*level, *strain, *prev_level, *prev_strain) == Ordering::Greater
                }
            }
        }

        Call::Double => {
            match last_non_pass(auction) {
                None => false,
                Some(entry) => {
                    matches!(entry.call, Call::Bid { .. }) && !same_side(entry.seat, seat)
                }
            }
        }

        Call::Redouble => {
            match last_non_pass(auction) {
                None => false,
                Some(entry) => {
                    matches!(entry.call, Call::Double) && !same_side(entry.seat, seat)
                }
            }
        }
    }
}

/// True if the auction has ended (four passes, or three passes after a bid).
pub fn is_auction_complete(auction: &Auction) -> bool {
    let entries = &auction.entries;
    let len = entries.len();

    if len < 4 {
        return false;
    }

    // Last 3 must be passes
    let last_three_passes = matches!(entries[len - 1].call, Call::Pass)
        && matches!(entries[len - 2].call, Call::Pass)
        && matches!(entries[len - 3].call, Call::Pass);

    if !last_three_passes {
        return false;
    }

    // 4 initial passes (passout)
    if len == 4 && matches!(entries[len - 4].call, Call::Pass) {
        return true;
    }

    // 3 passes after at least one bid
    entries.iter().take(len - 3).any(|e| !matches!(e.call, Call::Pass))
}

/// Append a call to the auction, returning a new Auction with updated completion status.
pub fn add_call(auction: &Auction, entry: AuctionEntry) -> Result<Auction, EngineError> {
    if auction.is_complete {
        return Err(EngineError::AuctionComplete);
    }

    if !is_legal_call(auction, &entry.call, entry.seat) {
        return Err(EngineError::IllegalCall(format!("{:?}", entry.call)));
    }

    let mut new_entries = auction.entries.clone();
    new_entries.push(entry);

    let mut result = Auction {
        entries: new_entries,
        is_complete: false,
    };
    result.is_complete = is_auction_complete(&result);

    Ok(result)
}

/// Find the declarer: first player on the winning side to bid the final strain.
pub fn get_declarer(auction: &Auction) -> Result<Seat, EngineError> {
    let last = last_bid(auction).ok_or(EngineError::NoBidsInAuction)?;

    let Call::Bid { strain: final_strain, .. } = &last.call else {
        return Err(EngineError::NoBidsInAuction);
    };
    let final_strain = *final_strain;
    let declaring_side = last.seat;

    // Find the FIRST player on the declaring side to bid this strain
    for entry in &auction.entries {
        if let Call::Bid { strain, .. } = &entry.call {
            if *strain == final_strain && same_side(entry.seat, declaring_side) {
                return Ok(entry.seat);
            }
        }
    }

    Ok(declaring_side)
}

/// Extract the final contract from a completed auction (None if passed out).
pub fn get_contract(auction: &Auction) -> Result<Option<Contract>, EngineError> {
    let last = match last_bid(auction) {
        None => return Ok(None),
        Some(entry) => entry,
    };

    let Call::Bid { level, strain } = &last.call else {
        return Ok(None);
    };
    let (level, strain) = (*level, *strain);

    let last_non_pass_entry = last_non_pass(auction);
    let mut doubled = false;
    let mut redoubled = false;

    if let Some(entry) = last_non_pass_entry {
        match &entry.call {
            Call::Double => doubled = true,
            Call::Redouble => redoubled = true,
            _ => {}
        }
    }

    let declarer = get_declarer(auction)?;

    Ok(Some(Contract {
        level,
        strain,
        doubled,
        redoubled,
        declarer,
    }))
}

/// Generate all legal calls for a seat in the current auction state.
pub fn get_legal_calls(auction: &Auction, seat: Seat) -> Vec<Call> {
    if auction.is_complete {
        return vec![];
    }

    let mut legal = Vec::new();

    // Pass
    if is_legal_call(auction, &Call::Pass, seat) {
        legal.push(Call::Pass);
    }

    // All 35 bids
    let strains = [BidSuit::Clubs, BidSuit::Diamonds, BidSuit::Hearts, BidSuit::Spades, BidSuit::NoTrump];
    for level in 1..=7u8 {
        for &strain in &strains {
            let bid = Call::Bid { level, strain };
            if is_legal_call(auction, &bid, seat) {
                legal.push(bid);
            }
        }
    }

    // Double
    if is_legal_call(auction, &Call::Double, seat) {
        legal.push(Call::Double);
    }

    // Redouble
    if is_legal_call(auction, &Call::Redouble, seat) {
        legal.push(Call::Redouble);
    }

    legal
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_auction() -> Auction {
        Auction { entries: vec![], is_complete: false }
    }

    fn entry(seat: Seat, call: Call) -> AuctionEntry {
        AuctionEntry { seat, call }
    }

    #[test]
    fn compare_bids_level_first() {
        assert_eq!(
            compare_bids(1, BidSuit::NoTrump, 2, BidSuit::Clubs),
            Ordering::Less
        );
        assert_eq!(
            compare_bids(2, BidSuit::Clubs, 1, BidSuit::NoTrump),
            Ordering::Greater
        );
    }

    #[test]
    fn compare_bids_strain_rank() {
        assert_eq!(
            compare_bids(1, BidSuit::Clubs, 1, BidSuit::Diamonds),
            Ordering::Less
        );
        assert_eq!(
            compare_bids(1, BidSuit::Spades, 1, BidSuit::NoTrump),
            Ordering::Less
        );
        assert_eq!(
            compare_bids(1, BidSuit::NoTrump, 1, BidSuit::NoTrump),
            Ordering::Equal
        );
    }

    #[test]
    fn pass_always_legal() {
        let auction = empty_auction();
        assert!(is_legal_call(&auction, &Call::Pass, Seat::North));
    }

    #[test]
    fn first_bid_always_legal() {
        let auction = empty_auction();
        assert!(is_legal_call(&auction, &Call::Bid { level: 1, strain: BidSuit::Clubs }, Seat::North));
    }

    #[test]
    fn bid_must_be_higher() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Hearts }));

        // 1S > 1H = legal
        assert!(is_legal_call(&auction, &Call::Bid { level: 1, strain: BidSuit::Spades }, Seat::East));
        // 1C < 1H = illegal
        assert!(!is_legal_call(&auction, &Call::Bid { level: 1, strain: BidSuit::Clubs }, Seat::East));
        // 1H = 1H = illegal
        assert!(!is_legal_call(&auction, &Call::Bid { level: 1, strain: BidSuit::Hearts }, Seat::East));
        // 2C > 1H = legal
        assert!(is_legal_call(&auction, &Call::Bid { level: 2, strain: BidSuit::Clubs }, Seat::East));
    }

    #[test]
    fn double_requires_opponent_bid() {
        let mut auction = empty_auction();
        // Can't double with no bids
        assert!(!is_legal_call(&auction, &Call::Double, Seat::North));

        // N bids 1C
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs }));
        // E can double (opponent's bid)
        assert!(is_legal_call(&auction, &Call::Double, Seat::East));
        // S can't double (partner's bid)
        assert!(!is_legal_call(&auction, &Call::Double, Seat::South));
    }

    #[test]
    fn redouble_requires_opponent_double() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs }));
        auction.entries.push(entry(Seat::East, Call::Double));

        // S can redouble (opponent's double of partner's bid)
        assert!(is_legal_call(&auction, &Call::Redouble, Seat::South));
        // W can't redouble (partner's double)
        assert!(!is_legal_call(&auction, &Call::Redouble, Seat::West));
        // N can redouble (opponent doubled their bid)
        assert!(is_legal_call(&auction, &Call::Redouble, Seat::North));
    }

    #[test]
    fn passout_four_passes() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Pass));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Pass));
        auction.entries.push(entry(Seat::West, Call::Pass));
        assert!(is_auction_complete(&auction));
    }

    #[test]
    fn three_passes_after_bid() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs }));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Pass));
        assert!(!is_auction_complete(&auction)); // only 2 passes after bid

        auction.entries.push(entry(Seat::West, Call::Pass));
        assert!(is_auction_complete(&auction)); // 3 passes after bid
    }

    #[test]
    fn auction_not_complete_with_bids() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs }));
        auction.entries.push(entry(Seat::East, Call::Bid { level: 1, strain: BidSuit::Diamonds }));
        auction.entries.push(entry(Seat::South, Call::Pass));
        auction.entries.push(entry(Seat::West, Call::Pass));
        assert!(!is_auction_complete(&auction));
    }

    #[test]
    fn add_call_validates() {
        let auction = empty_auction();
        let result = add_call(&auction, entry(Seat::North, Call::Double));
        assert!(result.is_err());
    }

    #[test]
    fn add_call_updates_complete() {
        let mut auction = empty_auction();
        auction = add_call(&auction, entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs })).unwrap();
        assert!(!auction.is_complete);

        auction = add_call(&auction, entry(Seat::East, Call::Pass)).unwrap();
        auction = add_call(&auction, entry(Seat::South, Call::Pass)).unwrap();
        auction = add_call(&auction, entry(Seat::West, Call::Pass)).unwrap();
        assert!(auction.is_complete);
    }

    #[test]
    fn cannot_add_to_complete_auction() {
        let mut auction = empty_auction();
        auction = add_call(&auction, entry(Seat::North, Call::Pass)).unwrap();
        auction = add_call(&auction, entry(Seat::East, Call::Pass)).unwrap();
        auction = add_call(&auction, entry(Seat::South, Call::Pass)).unwrap();
        auction = add_call(&auction, entry(Seat::West, Call::Pass)).unwrap();

        let result = add_call(&auction, entry(Seat::North, Call::Pass));
        assert!(result.is_err());
    }

    #[test]
    fn declarer_first_to_name_strain() {
        // N opens 1S, S raises to 2S — declarer is N (first to name spades)
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Spades }));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Bid { level: 2, strain: BidSuit::Spades }));
        auction.entries.push(entry(Seat::West, Call::Pass));
        auction.entries.push(entry(Seat::North, Call::Pass));
        auction.entries.push(entry(Seat::East, Call::Pass));

        let declarer = get_declarer(&auction).unwrap();
        assert_eq!(declarer, Seat::North);
    }

    #[test]
    fn declarer_ew_partnership() {
        // E opens 1H, W raises to 4H — declarer is E
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Pass));
        auction.entries.push(entry(Seat::East, Call::Bid { level: 1, strain: BidSuit::Hearts }));
        auction.entries.push(entry(Seat::South, Call::Pass));
        auction.entries.push(entry(Seat::West, Call::Bid { level: 4, strain: BidSuit::Hearts }));
        auction.entries.push(entry(Seat::North, Call::Pass));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Pass));

        let declarer = get_declarer(&auction).unwrap();
        assert_eq!(declarer, Seat::East);
    }

    #[test]
    fn passout_returns_none_contract() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Pass));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Pass));
        auction.entries.push(entry(Seat::West, Call::Pass));

        let contract = get_contract(&auction).unwrap();
        assert!(contract.is_none());
    }

    #[test]
    fn contract_extraction() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 3, strain: BidSuit::NoTrump }));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Pass));
        auction.entries.push(entry(Seat::West, Call::Pass));

        let contract = get_contract(&auction).unwrap().unwrap();
        assert_eq!(contract.level, 3);
        assert_eq!(contract.strain, BidSuit::NoTrump);
        assert!(!contract.doubled);
        assert!(!contract.redoubled);
        assert_eq!(contract.declarer, Seat::North);
    }

    #[test]
    fn doubled_contract() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs }));
        auction.entries.push(entry(Seat::East, Call::Double));
        auction.entries.push(entry(Seat::South, Call::Pass));
        auction.entries.push(entry(Seat::West, Call::Pass));
        auction.entries.push(entry(Seat::North, Call::Pass));

        let contract = get_contract(&auction).unwrap().unwrap();
        assert!(contract.doubled);
        assert!(!contract.redoubled);
    }

    #[test]
    fn redoubled_contract() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs }));
        auction.entries.push(entry(Seat::East, Call::Double));
        auction.entries.push(entry(Seat::South, Call::Redouble));
        auction.entries.push(entry(Seat::West, Call::Pass));
        auction.entries.push(entry(Seat::North, Call::Pass));
        auction.entries.push(entry(Seat::East, Call::Pass));

        let contract = get_contract(&auction).unwrap().unwrap();
        assert!(!contract.doubled);
        assert!(contract.redoubled);
    }

    #[test]
    fn get_legal_calls_opening() {
        let auction = empty_auction();
        let calls = get_legal_calls(&auction, Seat::North);
        // Pass + 35 bids = 36 (no double or redouble possible)
        assert_eq!(calls.len(), 36);
        assert!(calls.contains(&Call::Pass));
        assert!(calls.contains(&Call::Bid { level: 1, strain: BidSuit::Clubs }));
        assert!(calls.contains(&Call::Bid { level: 7, strain: BidSuit::NoTrump }));
        assert!(!calls.contains(&Call::Double));
    }

    #[test]
    fn get_legal_calls_after_bid() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Hearts }));

        let calls = get_legal_calls(&auction, Seat::East);
        // Pass + higher bids + double
        assert!(calls.contains(&Call::Pass));
        assert!(calls.contains(&Call::Double));
        assert!(!calls.contains(&Call::Redouble));
        // 1H and below should not be present
        assert!(!calls.contains(&Call::Bid { level: 1, strain: BidSuit::Clubs }));
        assert!(!calls.contains(&Call::Bid { level: 1, strain: BidSuit::Hearts }));
        // 1S and above should be present
        assert!(calls.contains(&Call::Bid { level: 1, strain: BidSuit::Spades }));
    }

    #[test]
    fn complete_auction_returns_no_legal_calls() {
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Pass));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Pass));
        auction.entries.push(entry(Seat::West, Call::Pass));
        auction.is_complete = true;

        let calls = get_legal_calls(&auction, Seat::North);
        assert!(calls.is_empty());
    }

    #[test]
    fn double_with_intervening_passes() {
        // N: 1C, E: Pass, S: Pass — W can double (last non-pass is N's bid, opponent)
        let mut auction = empty_auction();
        auction.entries.push(entry(Seat::North, Call::Bid { level: 1, strain: BidSuit::Clubs }));
        auction.entries.push(entry(Seat::East, Call::Pass));
        auction.entries.push(entry(Seat::South, Call::Pass));

        assert!(is_legal_call(&auction, &Call::Double, Seat::West));
    }
}
