use crate::types::{BidSuit, Contract, Seat, Vulnerability};

pub fn is_vulnerable(declarer: Seat, vulnerability: Vulnerability) -> bool {
    match vulnerability {
        Vulnerability::None => false,
        Vulnerability::Both => true,
        Vulnerability::NorthSouth => declarer == Seat::North || declarer == Seat::South,
        Vulnerability::EastWest => declarer == Seat::East || declarer == Seat::West,
    }
}

/// Trick points for the contract (before bonuses).
pub fn calculate_trick_points(contract: &Contract) -> i32 {
    let base = match contract.strain {
        BidSuit::Clubs | BidSuit::Diamonds => 20 * contract.level as i32,
        BidSuit::Hearts | BidSuit::Spades => 30 * contract.level as i32,
        BidSuit::NoTrump => 40 + 30 * (contract.level as i32 - 1),
    };

    if contract.redoubled {
        base * 4
    } else if contract.doubled {
        base * 2
    } else {
        base
    }
}

pub fn is_game(contract: &Contract) -> bool {
    calculate_trick_points(contract) >= 100
}

fn trick_value(strain: BidSuit) -> i32 {
    match strain {
        BidSuit::Clubs | BidSuit::Diamonds => 20,
        BidSuit::Hearts | BidSuit::Spades => 30,
        BidSuit::NoTrump => 30, // overtricks are 30 each (only first contracted trick is 40)
    }
}

fn calculate_making_score(contract: &Contract, overtricks: i32, vulnerable: bool) -> i32 {
    let trick_points = calculate_trick_points(contract);

    // Game / partscore bonus
    let mut bonus = if trick_points >= 100 {
        if vulnerable { 500 } else { 300 }
    } else {
        50
    };

    // Slam bonuses
    if contract.level == 6 {
        bonus += if vulnerable { 750 } else { 500 };
    } else if contract.level == 7 {
        bonus += if vulnerable { 1500 } else { 1000 };
    }

    // Insult bonus
    if contract.redoubled {
        bonus += 100;
    } else if contract.doubled {
        bonus += 50;
    }

    // Overtrick points
    let overtrick_points = if contract.redoubled {
        overtricks * if vulnerable { 400 } else { 200 }
    } else if contract.doubled {
        overtricks * if vulnerable { 200 } else { 100 }
    } else {
        overtricks * trick_value(contract.strain)
    };

    trick_points + bonus + overtrick_points
}

fn calculate_doubled_penalty(undertricks: i32, vulnerable: bool) -> i32 {
    let mut total = 0;
    for i in 1..=undertricks {
        if vulnerable {
            total += if i == 1 { 200 } else { 300 };
        } else {
            total += if i == 1 { 100 } else if i <= 3 { 200 } else { 300 };
        }
    }
    total
}

fn calculate_penalty(contract: &Contract, undertricks: i32, vulnerable: bool) -> i32 {
    if contract.redoubled {
        calculate_doubled_penalty(undertricks, vulnerable) * 2
    } else if contract.doubled {
        calculate_doubled_penalty(undertricks, vulnerable)
    } else {
        undertricks * if vulnerable { 100 } else { 50 }
    }
}

/// Unified score calculation. Positive = made, negative = down.
pub fn calculate_score(contract: &Contract, tricks_won: u8, vulnerability: Vulnerability) -> i32 {
    let required = contract.level as i32 + 6;
    let tricks = tricks_won as i32;
    let vulnerable = is_vulnerable(contract.declarer, vulnerability);

    if tricks >= required {
        calculate_making_score(contract, tricks - required, vulnerable)
    } else {
        -calculate_penalty(contract, required - tricks, vulnerable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_contract(level: u8, strain: BidSuit, doubled: bool, redoubled: bool) -> Contract {
        Contract {
            level,
            strain,
            doubled,
            redoubled,
            declarer: Seat::South,
        }
    }

    // --- Making scores ---

    #[test]
    fn partscore_1c_making_7() {
        let c = make_contract(1, BidSuit::Clubs, false, false);
        let score = calculate_score(&c, 7, Vulnerability::None);
        // 20 trick points + 50 partscore = 70
        assert_eq!(score, 70);
    }

    #[test]
    fn game_3nt_making_9() {
        let c = make_contract(3, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 9, Vulnerability::None);
        // 40+30+30 = 100 trick points, game bonus 300 = 400
        assert_eq!(score, 400);
    }

    #[test]
    fn game_4h_making_10() {
        let c = make_contract(4, BidSuit::Hearts, false, false);
        let score = calculate_score(&c, 10, Vulnerability::None);
        // 120 trick points + 300 game bonus = 420
        assert_eq!(score, 420);
    }

    #[test]
    fn game_4h_making_10_vul() {
        let c = make_contract(4, BidSuit::Hearts, false, false);
        let score = calculate_score(&c, 10, Vulnerability::Both);
        // 120 trick points + 500 game bonus = 620
        assert_eq!(score, 620);
    }

    #[test]
    fn small_slam_6nt_nvul_making_12() {
        let c = make_contract(6, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 12, Vulnerability::None);
        // 40+30*5 = 190 trick points + 300 game + 500 slam = 990
        assert_eq!(score, 990);
    }

    #[test]
    fn small_slam_6nt_vul_making_12() {
        let c = make_contract(6, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 12, Vulnerability::Both);
        // 190 + 500 game + 750 slam = 1440
        assert_eq!(score, 1440);
    }

    #[test]
    fn grand_slam_7nt_nvul_making_13() {
        let c = make_contract(7, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 13, Vulnerability::None);
        // 40+30*6 = 220 trick points + 300 game + 1000 grand slam = 1520
        assert_eq!(score, 1520);
    }

    #[test]
    fn grand_slam_7nt_vul_making_13() {
        let c = make_contract(7, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 13, Vulnerability::Both);
        // 220 + 500 game + 1500 grand slam = 2220
        assert_eq!(score, 2220);
    }

    #[test]
    fn overtricks_undoubled() {
        let c = make_contract(3, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 11, Vulnerability::None);
        // 100 trick + 300 game + 2*30 overtricks = 460
        assert_eq!(score, 460);
    }

    #[test]
    fn overtricks_doubled_nvul() {
        let c = make_contract(2, BidSuit::Hearts, true, false);
        let score = calculate_score(&c, 10, Vulnerability::None);
        // 120 doubled trick + 300 game + 50 insult + 2*100 overtricks = 670
        assert_eq!(score, 670);
    }

    #[test]
    fn overtricks_redoubled_vul() {
        let c = make_contract(2, BidSuit::Hearts, false, true);
        let score = calculate_score(&c, 10, Vulnerability::Both);
        // 240 redoubled trick + 500 game + 100 insult + 2*400 overtricks = 1640
        assert_eq!(score, 1640);
    }

    // --- Undertrick penalties ---

    #[test]
    fn down_1_undoubled_nvul() {
        let c = make_contract(3, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 8, Vulnerability::None);
        assert_eq!(score, -50);
    }

    #[test]
    fn down_1_undoubled_vul() {
        let c = make_contract(3, BidSuit::NoTrump, false, false);
        let score = calculate_score(&c, 8, Vulnerability::Both);
        assert_eq!(score, -100);
    }

    #[test]
    fn down_3_doubled_nvul() {
        let c = make_contract(3, BidSuit::NoTrump, true, false);
        let score = calculate_score(&c, 6, Vulnerability::None);
        // NV doubled: 100 + 200 + 200 = -500
        assert_eq!(score, -500);
    }

    #[test]
    fn down_3_doubled_vul() {
        let c = make_contract(3, BidSuit::NoTrump, true, false);
        let score = calculate_score(&c, 6, Vulnerability::Both);
        // Vul doubled: 200 + 300 + 300 = -800
        assert_eq!(score, -800);
    }

    #[test]
    fn down_5_doubled_nvul() {
        let c = make_contract(3, BidSuit::NoTrump, true, false);
        let score = calculate_score(&c, 4, Vulnerability::None);
        // NV doubled: 100 + 200 + 200 + 300 + 300 = -1100
        assert_eq!(score, -1100);
    }

    #[test]
    fn down_1_redoubled_nvul() {
        let c = make_contract(3, BidSuit::NoTrump, false, true);
        let score = calculate_score(&c, 8, Vulnerability::None);
        // NV redoubled: (100) * 2 = -200
        assert_eq!(score, -200);
    }

    #[test]
    fn down_2_redoubled_vul() {
        let c = make_contract(3, BidSuit::NoTrump, false, true);
        let score = calculate_score(&c, 7, Vulnerability::Both);
        // Vul redoubled: (200 + 300) * 2 = -1000
        assert_eq!(score, -1000);
    }

    // --- Vulnerability ---

    #[test]
    fn ns_vulnerable_south_declarer() {
        assert!(is_vulnerable(Seat::South, Vulnerability::NorthSouth));
        assert!(is_vulnerable(Seat::North, Vulnerability::NorthSouth));
        assert!(!is_vulnerable(Seat::East, Vulnerability::NorthSouth));
    }

    #[test]
    fn ew_vulnerable_east_declarer() {
        assert!(is_vulnerable(Seat::East, Vulnerability::EastWest));
        assert!(!is_vulnerable(Seat::South, Vulnerability::EastWest));
    }

    // --- Edge cases ---

    #[test]
    fn minor_game_5c_making() {
        let c = make_contract(5, BidSuit::Clubs, false, false);
        let score = calculate_score(&c, 11, Vulnerability::None);
        // 100 trick + 300 game = 400
        assert_eq!(score, 400);
    }

    #[test]
    fn doubled_partscore_makes_game() {
        // 2H doubled = 120 trick points = game
        let c = make_contract(2, BidSuit::Hearts, true, false);
        let score = calculate_score(&c, 8, Vulnerability::None);
        // 120 trick + 300 game + 50 insult = 470
        assert_eq!(score, 470);
    }
}
