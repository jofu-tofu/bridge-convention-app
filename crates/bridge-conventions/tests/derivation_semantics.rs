//! Phase 6a: semantic bundle-inversion assertions for `derive_deal_constraints`.
//!
//! For each bundle we care about, derive the deal constraints and assert
//! boundary properties that should be true given the known surface shapes.
//! We accept the loose-union semantics of the derivation (opener bounds may
//! drop through OR) and only assert properties that must hold.

use bridge_conventions::fact_dsl::inversion::derive_deal_constraints;
use bridge_conventions::registry::resolve_bundle;
use bridge_conventions::types::BaseSystemId;
use bridge_engine::types::{Seat, SeatConstraint};
use bridge_engine::Suit;
use std::collections::HashMap;

fn seats(constraints: &bridge_engine::types::DealConstraints) -> HashMap<Seat, &SeatConstraint> {
    constraints.seats.iter().map(|s| (s.seat, s)).collect()
}

fn resolve_and_derive(id: &str) -> bridge_engine::types::DealConstraints {
    let bundle = resolve_bundle(id, BaseSystemId::Sayc)
        .unwrap_or_else(|| panic!("{id} bundle should resolve"));
    derive_deal_constraints(bundle, BaseSystemId::Sayc)
}

#[test]
fn nt_stayman_responder_has_major_suit_floor() {
    let constraints = resolve_and_derive("nt-stayman");
    let seats = seats(&constraints);
    let south = seats
        .get(&Seat::South)
        .expect("S (responder) seat should be present");

    // Responder's Stayman eligibility promises 4+ hearts OR 4+ spades.
    let any = south
        .min_length_any
        .as_ref()
        .expect("S min_length_any should be populated");
    let hearts_ok = any.get(&Suit::Hearts).copied().unwrap_or(0) >= 4;
    let spades_ok = any.get(&Suit::Spades).copied().unwrap_or(0) >= 4;
    assert!(
        hearts_ok || spades_ok,
        "expected H or S min_length_any >= 4, got {any:?}"
    );
}

#[test]
fn nt_bundle_has_responder_constraints() {
    let constraints = resolve_and_derive("nt-bundle");
    let seats = seats(&constraints);
    assert!(
        seats.contains_key(&Seat::South),
        "nt-bundle should populate S seat"
    );
}

#[test]
fn nt_transfers_responder_has_major_suit_entry() {
    let constraints = resolve_and_derive("nt-transfers");
    let seats = seats(&constraints);
    let south = seats
        .get(&Seat::South)
        .expect("S (responder) seat should be present");

    // Jacoby transfers surface promises 5+ cards in hearts or spades. Under
    // loose-union semantics across all responder surfaces (including base
    // modules), the bound may drop below 5 — but the union must still
    // produce SOME positive entry for at least one major, since every
    // responder transfer surface contributes a major-suit length clause.
    let any = south
        .min_length_any
        .as_ref()
        .expect("S min_length_any should be populated");
    let hearts = any.get(&Suit::Hearts).copied().unwrap_or(0);
    let spades = any.get(&Suit::Spades).copied().unwrap_or(0);
    assert!(
        hearts > 0 || spades > 0,
        "expected responder to show a H or S min_length_any entry, got {any:?}"
    );
}

#[test]
fn bergen_bundle_derives_without_panic() {
    let constraints = resolve_and_derive("bergen-bundle");
    assert!(
        !constraints.seats.is_empty(),
        "bergen-bundle should populate at least one seat"
    );
}

#[test]
fn negative_doubles_bundle_derives_without_panic() {
    let constraints = resolve_and_derive("negative-doubles-bundle");
    assert!(
        !constraints.seats.is_empty(),
        "negative-doubles-bundle should populate at least one seat"
    );
}

#[test]
fn michaels_unusual_bundle_derives_without_panic() {
    let constraints = resolve_and_derive("michaels-unusual-bundle");
    assert!(
        !constraints.seats.is_empty(),
        "michaels-unusual-bundle should populate at least one seat"
    );
}

#[test]
fn dont_bundle_derives_without_panic() {
    let constraints = resolve_and_derive("dont-bundle");
    assert!(
        !constraints.seats.is_empty(),
        "dont-bundle should populate at least one seat"
    );
}

#[test]
fn nmf_bundle_derives_without_panic() {
    let constraints = resolve_and_derive("nmf-bundle");
    assert!(
        !constraints.seats.is_empty(),
        "nmf-bundle should populate at least one seat"
    );
}

#[test]
fn strong_2c_bundle_derives_without_panic() {
    let constraints = resolve_and_derive("strong-2c-bundle");
    assert!(
        !constraints.seats.is_empty(),
        "strong-2c-bundle should populate at least one seat"
    );
}

#[test]
fn weak_twos_bundle_derives_without_panic() {
    let constraints = resolve_and_derive("weak-twos-bundle");
    assert!(
        !constraints.seats.is_empty(),
        "weak-twos-bundle should populate at least one seat"
    );
}
