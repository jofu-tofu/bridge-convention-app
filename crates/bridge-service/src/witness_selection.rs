//! Phase 2 target-surface and witness selection.
//!
//! Given a bundle + session config, picks a `(target_module_id,
//! target_surface_id)` deterministically seeded by `config.seed`, enumerates
//! witnesses, and picks one. The chosen witness is then used to:
//!   1. Derive projected `DealConstraints` via `project_witness`.
//!   2. Drive the witness-verifying deal-acceptance predicate.

use bridge_conventions::fact_dsl::witness::{enumerate_witnesses, project_witness, Witness};
use bridge_conventions::registry::module_registry::get_module;
use bridge_conventions::types::system_config::{BaseSystemId, SystemConfig};
use bridge_conventions::types::{rule_types::TurnRole, ConventionModule};
use bridge_engine::constants::next_seat;
use bridge_engine::types::{Auction, AuctionEntry, Call, DealConstraints, Seat};
use rand::seq::SliceRandom;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

use bridge_session::types::PracticeRole;

/// Result of phase-2 selection: target module/surface, the chosen witness,
/// and the projected deal constraints from that witness.
pub(crate) struct WitnessSelection {
    pub target_module_id: String,
    pub target_surface_id: String,
    pub witness: Witness,
    pub projected_constraints: DealConstraints,
}

/// Reconstruct the full auction prefix that should be in place before the
/// witness target fires. Partnership witness calls are taken verbatim; any
/// skipped seats between them are filled with Pass so startup and deal gating
/// replay the same authored context even when the user has already acted once
/// earlier in the auction.
pub(crate) fn initial_auction_from_witness(witness: &Witness) -> Option<Auction> {
    let mut entries: Vec<AuctionEntry> = Vec::new();
    let mut cursor = witness.dealer;
    let mut witness_idx = 0usize;
    let mut guard = 0u32;

    while witness_idx < witness.prefix.len() && guard < 16 {
        guard += 1;
        let expected = witness
            .prefix
            .get(witness_idx)
            .expect("checked by loop condition");
        if expected.seat == cursor {
            entries.push(AuctionEntry {
                seat: cursor,
                call: expected.call.clone(),
            });
            witness_idx += 1;
        } else {
            entries.push(AuctionEntry {
                seat: cursor,
                call: Call::Pass,
            });
        }
        cursor = next_seat(cursor);
    }

    while cursor != witness.user_seat && guard < 16 {
        guard += 1;
        entries.push(AuctionEntry {
            seat: cursor,
            call: Call::Pass,
        });
        cursor = next_seat(cursor);
    }

    if cursor != witness.user_seat || witness_idx != witness.prefix.len() || entries.is_empty() {
        return None;
    }

    Some(Auction {
        entries,
        is_complete: false,
    })
}

/// Map the user's `PracticeRole` to the `TurnRole` that makes a surface
/// "drill-worthy": opener drills pick opener surfaces, responder drills pick
/// responder surfaces. `Both` falls back to responder (matches
/// `StartDrillOptions.practice_role` default).
fn role_to_turn(role: PracticeRole) -> TurnRole {
    match role {
        PracticeRole::Opener => TurnRole::Opener,
        PracticeRole::Responder | PracticeRole::Both => TurnRole::Responder,
    }
}

/// Map `PracticeRole` + dealer to the user's absolute seat for witness
/// enumeration. `Opener` = dealer; `Responder`/`Both` = dealer's partner.
fn seat_for_role(role: PracticeRole, dealer: Seat) -> Seat {
    use bridge_engine::constants::next_seat;
    match role {
        PracticeRole::Opener => dealer,
        PracticeRole::Responder | PracticeRole::Both => next_seat(next_seat(dealer)),
    }
}

/// Assemble the module list passed to witness enumeration: every bundle
/// member plus every base-system module, deduplicated by module_id.
fn loaded_modules_for(
    bundle_member_ids: &[String],
    base_module_ids: &[String],
    system: BaseSystemId,
) -> Vec<&'static ConventionModule> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for mid in bundle_member_ids.iter().chain(base_module_ids.iter()) {
        if !seen.insert(mid.clone()) {
            continue;
        }
        if let Some(m) = get_module(mid, system) {
            out.push(m);
        }
    }
    out
}

/// Enumerate candidate `(module_id, surface_id)` pairs across the bundle's
/// modules, filtered to surfaces hosted on a state entry whose `turn` matches
/// the user's role.
///
/// If `target_module_override` is `Some`, restricts to that module only.
fn candidate_surfaces(
    loaded_modules: &[&ConventionModule],
    bundle_member_ids: &[String],
    role: PracticeRole,
    target_module_override: Option<&str>,
) -> Vec<(String, String)> {
    let want_turn = role_to_turn(role);
    let mut out = Vec::new();
    for module in loaded_modules {
        // Only draw targets from bundle members (not base modules).
        if !bundle_member_ids.iter().any(|mid| mid == &module.module_id) {
            continue;
        }
        if let Some(override_id) = target_module_override {
            if module.module_id != override_id {
                continue;
            }
        }
        let Some(states) = module.states.as_ref() else {
            continue;
        };
        for se in states {
            if se.turn != Some(want_turn) {
                continue;
            }
            for surface in &se.surfaces {
                out.push((module.module_id.clone(), surface.meaning_id.clone()));
            }
        }
    }
    // Deterministic order before the RNG pick.
    out.sort();
    out.dedup();
    out
}

/// Phase 2a + 2b: pick a `(module, surface)`, enumerate witnesses, and
/// project one into `DealConstraints`.
///
/// Returns `Ok(None)` when the bundle has no drill-worthy surfaces at all
/// (e.g., unknown bundle, no members with states) — the caller falls back
/// to legacy single-attempt behavior with empty constraints. Returns
/// `Err(...)` only when a target surface exists but no witness could be
/// enumerated; the service surfaces this as
/// `ServiceError::DealGenerationExhausted` so the UI retries with a new
/// seed.
#[allow(clippy::too_many_arguments)]
pub(crate) fn select_witness(
    bundle_member_ids: &[String],
    base_module_ids: &[String],
    system: BaseSystemId,
    system_config: &SystemConfig,
    role: PracticeRole,
    dealer: Seat,
    target_module_override: Option<&str>,
    seed: u64,
) -> Result<Option<WitnessSelection>, String> {
    let loaded = loaded_modules_for(bundle_member_ids, base_module_ids, system);
    if loaded.is_empty() {
        return Ok(None);
    }

    let candidates = candidate_surfaces(&loaded, bundle_member_ids, role, target_module_override);
    if candidates.is_empty() {
        return Ok(None);
    }

    // Derive a sub-seed specifically for witness selection so it doesn't
    // correlate with deal-gen randomness.
    let mut rng = ChaCha8Rng::seed_from_u64(seed.wrapping_add(0xC0FFEE_F00D));
    let user_seat = seat_for_role(role, dealer);

    // Shuffle candidates and iterate; skip surfaces for which no witness
    // exists (phase-1 limitation: semantic-only FSMs return no reifiable
    // path). Only error if every candidate fails.
    let mut shuffled = candidates.clone();
    shuffled.shuffle(&mut rng);

    let mut last_failed: Option<(String, String)> = None;
    for (module_id, surface_id) in shuffled {
        let witnesses =
            enumerate_witnesses(&module_id, &surface_id, &loaded, dealer, user_seat, 16);
        if witnesses.is_empty() {
            last_failed = Some((module_id, surface_id));
            continue;
        }
        let chosen = witnesses
            .choose(&mut rng)
            .cloned()
            .expect("non-empty witnesses");

        // Phase 1 guarantees ≥ 1 projected branch when at least one witness
        // is returned. Document the single-branch assumption: we take the
        // first.
        let branches = project_witness(&chosen, &loaded, Some(system_config));
        let Some(projected) = branches.into_iter().next() else {
            last_failed = Some((module_id, surface_id));
            continue;
        };

        return Ok(Some(WitnessSelection {
            target_module_id: module_id,
            target_surface_id: surface_id,
            witness: chosen,
            projected_constraints: projected,
        }));
    }

    Err(format!(
        "no witness found for any candidate surface (last tried: {:?})",
        last_failed
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::fact_dsl::witness::WitnessCall;
    use bridge_engine::types::BidSuit;

    #[test]
    fn initial_auction_from_witness_keeps_full_prefix_through_second_user_turn() {
        let witness = Witness {
            prefix: vec![
                WitnessCall {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump,
                    },
                },
                WitnessCall {
                    seat: Seat::South,
                    call: Call::Bid {
                        level: 2,
                        strain: BidSuit::Clubs,
                    },
                },
                WitnessCall {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 2,
                        strain: BidSuit::Diamonds,
                    },
                },
            ],
            target_surface_id: "stayman:nt-game-after-denial".to_string(),
            target_module_id: "stayman".to_string(),
            target_surface_module_id: "stayman".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };

        let auction = initial_auction_from_witness(&witness).expect("auction");
        assert_eq!(
            auction.entries,
            vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump,
                    },
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::South,
                    call: Call::Bid {
                        level: 2,
                        strain: BidSuit::Clubs,
                    },
                },
                AuctionEntry {
                    seat: Seat::West,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 2,
                        strain: BidSuit::Diamonds,
                    },
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: Call::Pass,
                },
            ]
        );
    }
}
