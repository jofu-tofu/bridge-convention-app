//! Integration tests for witness-path derivation (phase 1 of v2
//! deal-constraint derivation). See `fact_dsl/witness.rs`.

use bridge_engine::types::{BidSuit, Call, Seat, Suit};

use bridge_conventions::fact_dsl::witness::{
    enumerate_witnesses, project_witness, Witness, WitnessCall,
};
use bridge_conventions::registry::{get_base_module_ids, get_module};
use bridge_conventions::types::BaseSystemId;

fn loaded_modules() -> Vec<&'static bridge_conventions::types::ConventionModule> {
    get_base_module_ids(BaseSystemId::Sayc)
        .iter()
        .filter_map(|&id| get_module(id, BaseSystemId::Sayc))
        .collect()
}

#[test]
fn enumerate_witnesses_nt_stayman_finds_1nt_path() {
    let modules = loaded_modules();
    let witnesses = enumerate_witnesses(
        "stayman",
        "stayman:ask-major",
        &modules,
        Seat::North,
        Seat::South,
        64,
    );
    assert!(
        !witnesses.is_empty(),
        "expected at least one witness for stayman ask"
    );
    let has_1nt_by_north = witnesses.iter().any(|w: &Witness| {
        w.prefix.iter().any(|entry: &WitnessCall| {
            entry.seat == Seat::North
                && matches!(
                    entry.call,
                    Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump
                    }
                )
        })
    });
    assert!(
        has_1nt_by_north,
        "expected a witness containing (N, 1NT), got {:?}",
        witnesses
    );

    // Confirm no witness contains a 1C opener — v1's misleading context.
    let has_1c = witnesses.iter().any(|w| {
        w.prefix.iter().any(|entry| {
            matches!(
                entry.call,
                Call::Bid {
                    level: 1,
                    strain: BidSuit::Clubs
                }
            )
        })
    });
    assert!(
        !has_1c,
        "witness should not include 1C opener for stayman ask"
    );
}

#[test]
fn enumerate_witnesses_jacoby_transfers_finds_1nt_path() {
    let modules = loaded_modules();
    // jacoby-transfers authors a meaning id like "transfer:to-hearts".
    // Peek available surfaces via the module to find a valid target.
    let target = get_module("jacoby-transfers", BaseSystemId::Sayc)
        .and_then(|m| m.states.as_ref())
        .and_then(|states| {
            for se in states {
                if matches!(
                    se.turn,
                    Some(bridge_conventions::types::rule_types::TurnRole::Responder)
                ) {
                    for s in &se.surfaces {
                        if s.meaning_id.contains("transfer") {
                            return Some(s.meaning_id.clone());
                        }
                    }
                }
            }
            None
        })
        .expect("jacoby-transfers should expose a responder transfer meaning");

    let witnesses = enumerate_witnesses(
        "jacoby-transfers",
        &target,
        &modules,
        Seat::North,
        Seat::South,
        64,
    );
    assert!(
        !witnesses.is_empty(),
        "jacoby-transfers should yield witnesses"
    );
    let has_1nt_by_north = witnesses.iter().any(|w| {
        w.prefix.iter().any(|entry| {
            entry.seat == Seat::North
                && matches!(
                    entry.call,
                    Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump
                    }
                )
        })
    });
    assert!(
        has_1nt_by_north,
        "expected jacoby-transfers witness with (N,1NT); got {:?}",
        witnesses
    );
}

#[test]
fn project_witness_nt_stayman_gives_tight_opener_bounds() {
    let modules = loaded_modules();
    let witnesses = enumerate_witnesses(
        "stayman",
        "stayman:ask-major",
        &modules,
        Seat::North,
        Seat::South,
        64,
    );
    let w = witnesses.first().expect("need at least one witness");
    let projections = project_witness(w, &modules);
    let dc = projections
        .first()
        .expect("should produce at least one branch");

    let by_seat: std::collections::HashMap<Seat, &bridge_engine::types::SeatConstraint> =
        dc.seats.iter().map(|s| (s.seat, s)).collect();

    let north = by_seat
        .get(&Seat::North)
        .expect("N seat (1NT opener) should be projected");
    assert_eq!(north.min_hcp, Some(15), "N min_hcp should be 15");
    assert_eq!(north.max_hcp, Some(17), "N max_hcp should be 17");
    assert_eq!(north.balanced, Some(true), "N should be balanced");

    let south = by_seat
        .get(&Seat::South)
        .expect("S (responder/user) seat should be projected");

    // Stayman authors two variants of `stayman:ask-major` at the responder's
    // `idle` state:
    //   v1: hcp>=8, hasFourCardMajor, !hasFiveCardMajor
    //   v2: system.inviteValues, hearts>=4, spades>=4, hasFiveCardMajor
    // Under OR (union) across variants, the HCP bound from v1 disappears
    // (v2 has no explicit hcp clause — its hcp constraint is system-fact
    // gated, which phase-1 honestly drops). The shared length floor survives
    // in `min_length_any`. So we assert the length bound (the v1 win) and
    // allow hcp to be None.
    let has_h_or_s_bound = south
        .min_length
        .as_ref()
        .map(|ml| {
            ml.get(&Suit::Hearts).copied().unwrap_or(0) >= 4
                || ml.get(&Suit::Spades).copied().unwrap_or(0) >= 4
        })
        .unwrap_or(false)
        || south
            .min_length_any
            .as_ref()
            .map(|ml| {
                ml.get(&Suit::Hearts).copied().unwrap_or(0) >= 4
                    || ml.get(&Suit::Spades).copied().unwrap_or(0) >= 4
            })
            .unwrap_or(false);
    assert!(
        has_h_or_s_bound,
        "S should carry a 4+ H or 4+ S length bound after union across variants; got {:?}",
        south
    );
}

#[test]
fn enumerate_witnesses_missing_target_returns_empty() {
    let modules = loaded_modules();
    let witnesses = enumerate_witnesses(
        "stayman",
        "does-not-exist",
        &modules,
        Seat::North,
        Seat::South,
        64,
    );
    assert!(witnesses.is_empty());

    let witnesses_missing_module = enumerate_witnesses(
        "nonexistent-module",
        "whatever",
        &modules,
        Seat::North,
        Seat::South,
        64,
    );
    assert!(witnesses_missing_module.is_empty());
}

#[test]
fn enumerate_witnesses_negative_doubles_via_route_expr_does_not_panic() {
    // Negative doubles uses RouteExpr with non-reifiable patterns
    // (overcall without level). We verify the function doesn't panic
    // and either returns empty witnesses or witnesses that still have a
    // reified prefix from augmentation.
    let neg = match get_module("negative-doubles", BaseSystemId::Sayc) {
        Some(m) => m,
        // The module may not be in BASE_MODULE_IDS; if so, skip.
        None => return,
    };
    // Pick any responder-turn meaning_id authored in this module.
    let target = neg.states.as_ref().and_then(|states| {
        for se in states {
            if matches!(
                se.turn,
                Some(bridge_conventions::types::rule_types::TurnRole::Responder)
            ) {
                for s in &se.surfaces {
                    return Some(s.meaning_id.clone());
                }
            }
        }
        None
    });
    let Some(target) = target else {
        return;
    };

    let mut modules = loaded_modules();
    modules.push(neg);
    let witnesses = enumerate_witnesses(
        "negative-doubles",
        &target,
        &modules,
        Seat::North,
        Seat::South,
        64,
    );
    // Smoke: either empty (honest degradation on intractable route) or
    // non-panicking. Do NOT assert content — the fixture's RouteExprs
    // carry overcalls without level and are correctly non-reifiable.
    let _ = witnesses;
}
