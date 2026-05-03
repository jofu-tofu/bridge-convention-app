//! Phase 2 target-surface and witness selection.
//!
//! Given a bundle + session config, picks a `(target_module_id,
//! target_surface_id)` deterministically seeded by `config.seed`, enumerates
//! witnesses, and picks one. The chosen witness is then used to:
//!   1. Derive projected `DealConstraints` via `project_witness`.
//!   2. Drive the witness-verifying deal-acceptance predicate.

use std::collections::HashMap;
use std::sync::Arc;

use bridge_conventions::fact_dsl::witness::{
    enumerate_witnesses, project_witness, Witness, WitnessCallSpec,
};
use bridge_conventions::registry::module_registry::get_module;
use bridge_conventions::types::system_config::{BaseSystemId, SystemConfig};
use bridge_conventions::types::{
    rule_types::{TargetSelector, TurnRole},
    ConventionModule,
};
use bridge_engine::constants::next_seat;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Auction, AuctionEntry, Call, Deal, DealConstraints, Seat};
use bridge_session::heuristics::{BiddingContext, BiddingStrategy};
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
/// witness target fires.
///
/// Concrete witness calls are taken verbatim; any skipped seats between them
/// are filled with Pass so startup and deal gating replay the same authored
/// context even when the user has already acted once earlier in the auction.
///
/// Pattern witness calls are materialized by invoking `seat_strategies[seat]`
/// against the deal at the point the pattern step would fire; the returned
/// call is verified to satisfy the pattern (otherwise `None` is returned —
/// in practice the predicate should reject this deal before reaching here).
pub(crate) fn initial_auction_from_witness(
    witness: &Witness,
    deal: &Deal,
    seat_strategies: &HashMap<Seat, Arc<dyn BiddingStrategy>>,
) -> Option<Auction> {
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
            let resolved_call: Call = match &expected.spec {
                WitnessCallSpec::Concrete(c) => c.clone(),
                WitnessCallSpec::Pattern(_) => {
                    // Materialize via the seat's live bidding strategy. The
                    // adapter must produce a call that satisfies the pattern;
                    // if it doesn't, this witness/deal combination is
                    // inconsistent — return None so the caller (build_drill_setup)
                    // discards this deal and tries another seed.
                    let hand = deal.hands.get(&cursor)?.clone();
                    let evaluation = evaluate_hand_hcp(&hand);
                    let auction_so_far = Auction {
                        entries: entries.clone(),
                        is_complete: false,
                    };
                    let auction_pairs: Vec<(Seat, Call)> = entries
                        .iter()
                        .map(|e| (e.seat, e.call.clone()))
                        .collect();
                    let ctx = BiddingContext {
                        hand,
                        auction: auction_so_far,
                        seat: cursor,
                        evaluation,
                        vulnerability: Some(deal.vulnerability),
                        dealer: Some(deal.dealer),
                    };
                    let strategy = seat_strategies.get(&cursor)?;
                    let suggested = strategy.suggest_bid(&ctx)?;
                    if !expected.spec.matches(&suggested.call, &auction_pairs) {
                        return None;
                    }
                    suggested.call
                }
            };
            entries.push(AuctionEntry {
                seat: cursor,
                call: resolved_call,
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

/// Helper: true iff every step in the witness has a `Concrete` spec. Used by
/// drill setup to fast-path concrete-only witnesses (no deal/strategies needed).
pub(crate) fn witness_is_concrete_only(witness: &Witness) -> bool {
    witness
        .prefix
        .iter()
        .all(|w| matches!(w.spec, WitnessCallSpec::Concrete(_)))
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

/// Resolve a target's module-ID component to the canonical bundle module ID,
/// honoring the bundle-shorthand aliases used by some test configs (e.g. the
/// drill-setup characterization test passes `"nmf"` for the new-minor-forcing
/// module). When the alias doesn't apply, returns the input unchanged.
fn canonical_module_id(raw: &str) -> &str {
    match raw {
        "nmf" => "new-minor-forcing",
        _ => raw,
    }
}

/// Some target-module aliases additionally pin a canonical entry-point surface.
/// This lets a `Module { module_id: "nmf" }` target behave as if it had been
/// authored as `Surface { module_id: "new-minor-forcing", surface_id: "..." }`
/// without the test config or UI having to know the exact surface id. Returns
/// `None` when the alias doesn't pin a specific surface.
fn alias_pinned_surface(raw: &str) -> Option<&'static str> {
    match raw {
        // NMF's canonical entry point is the responder's NMF ask after the
        // `1m – 1M – 1NT` opener-rebid. Pin to the Subseq-routed state entry
        // so witness selection lands on the authored 6-call prefix shape.
        "nmf" => Some("nmf:ask-after-1c"),
        _ => None,
    }
}

/// Enumerate candidate `(module_id, surface_id)` pairs across the bundle's
/// modules, filtered to surfaces hosted on a state entry whose `turn` matches
/// the user's role.
///
/// `target` constrains which (module, surface) pairs are eligible:
/// - `Any` — no module/surface filter.
/// - `Module { module_id }` — restrict to that module only.
/// - `Surface { module_id, surface_id }` — restrict to a single
///   `(module, surface)` pair, matched by surface `meaning_id`.
fn candidate_surfaces(
    loaded_modules: &[&ConventionModule],
    bundle_member_ids: &[String],
    role: PracticeRole,
    target: &TargetSelector,
) -> Vec<(String, String)> {
    let want_turn = role_to_turn(role);
    // Module aliases may also pin a canonical surface (e.g. `nmf` →
    // `nmf:ask-after-1c`). Treat the alias-implied surface filter the same
    // way as an explicit `Surface` selector.
    let alias_surface = target.module_id().and_then(alias_pinned_surface);
    let explicit_surface = target.surface_id();
    let mut out = Vec::new();
    for module in loaded_modules {
        // Only draw targets from bundle members (not base modules).
        if !bundle_member_ids.iter().any(|mid| mid == &module.module_id) {
            continue;
        }
        if let Some(override_id) = target.module_id() {
            if module.module_id != canonical_module_id(override_id) {
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
                if let Some(want_surface) = explicit_surface.or(alias_surface) {
                    if surface.meaning_id != want_surface {
                        continue;
                    }
                }
                out.push((module.module_id.clone(), surface.meaning_id.clone()));
            }
        }
    }
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
    target: &TargetSelector,
    seed: u64,
) -> Result<Option<WitnessSelection>, String> {
    let loaded = loaded_modules_for(bundle_member_ids, base_module_ids, system);
    if loaded.is_empty() {
        return Ok(None);
    }

    let candidates = candidate_surfaces(&loaded, bundle_member_ids, role, target);
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
    use bridge_conventions::fact_dsl::witness::{WitnessCall, WitnessCallSpec, WitnessRole};
    use bridge_engine::types::BidSuit;

    fn stayman_bundle_member_ids() -> Vec<String> {
        vec![
            "stayman".to_string(),
            "jacoby-transfers".to_string(),
            "smolen".to_string(),
        ]
    }

    fn base_module_ids() -> Vec<String> {
        bridge_conventions::registry::module_registry::BASE_MODULE_IDS
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    #[test]
    fn select_witness_with_surface_selector_returns_matching_surface_id() {
        let system = BaseSystemId::Sayc;
        let system_config = bridge_conventions::registry::system_configs::get_system_config(system);
        let target = TargetSelector::Surface {
            module_id: "stayman".to_string(),
            surface_id: "stayman:ask-major".to_string(),
        };
        let selection = select_witness(
            &stayman_bundle_member_ids(),
            &base_module_ids(),
            system,
            &system_config,
            PracticeRole::Responder,
            Seat::North,
            &target,
            42,
        )
        .expect("witness selection should not error");
        let selection = selection.expect("expected a witness selection for ask-major surface");
        assert_eq!(selection.target_module_id, "stayman");
        assert_eq!(selection.target_surface_id, "stayman:ask-major");
    }

    #[test]
    fn select_witness_with_any_selector_picks_some_bundle_member_surface() {
        let system = BaseSystemId::Sayc;
        let system_config = bridge_conventions::registry::system_configs::get_system_config(system);
        let members = stayman_bundle_member_ids();
        let selection = select_witness(
            &members,
            &base_module_ids(),
            system,
            &system_config,
            PracticeRole::Responder,
            Seat::North,
            &TargetSelector::Any,
            7,
        )
        .expect("witness selection should not error");
        let selection = selection.expect("expected a witness selection for Any");
        assert!(
            members.iter().any(|m| m == &selection.target_module_id),
            "selected target module {} should be a bundle member",
            selection.target_module_id
        );
    }

    #[test]
    fn initial_auction_from_witness_keeps_full_prefix_through_second_user_turn() {
        let witness = Witness {
            prefix: vec![
                WitnessCall {
                    seat: Seat::North,
                    spec: WitnessCallSpec::Concrete(Call::Bid {
                        level: 1,
                        strain: BidSuit::NoTrump,
                    }),
                    role: WitnessRole::Partnership,
                },
                WitnessCall {
                    seat: Seat::South,
                    spec: WitnessCallSpec::Concrete(Call::Bid {
                        level: 2,
                        strain: BidSuit::Clubs,
                    }),
                    role: WitnessRole::Partnership,
                },
                WitnessCall {
                    seat: Seat::North,
                    spec: WitnessCallSpec::Concrete(Call::Bid {
                        level: 2,
                        strain: BidSuit::Diamonds,
                    }),
                    role: WitnessRole::Partnership,
                },
            ],
            target_surface_id: "stayman:nt-game-after-denial".to_string(),
            target_module_id: "stayman".to_string(),
            target_surface_module_id: "stayman".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };

        // Concrete-only witness: pass a stub deal and empty seat_strategies map;
        // the function fast-paths through Concrete cases without consulting them.
        let stub_deal = bridge_engine::deal_generator::generate_deal(
            &bridge_engine::types::DealConstraints {
                seats: Vec::new(),
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: Some(1),
                seed: Some(0),
            },
        )
        .expect("stub deal")
        .deal;
        let strategies: HashMap<Seat, Arc<dyn BiddingStrategy>> = HashMap::new();
        let auction =
            initial_auction_from_witness(&witness, &stub_deal, &strategies).expect("auction");
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
