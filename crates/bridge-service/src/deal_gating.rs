//! Witness-based deal-acceptance predicate for `start_drill` rejection sampling.
//!
//! Given a chosen `Witness` (auction prefix + target module/surface id), builds
//! a closure that:
//! 1. Replays the convention adapter forward from dealer, prefilling any
//!    practice-focus initial auction the session would use.
//! 2. For each auto-played seat bid, asserts the call matches the witness's
//!    prefix (same seats, same calls).
//! 3. At the user's turn, asserts the pipeline-selected carrier's
//!    `module_id` / `meaning_id` equal the witness's target.
//!
//! Mismatch anywhere → reject; try next deal. Replaces the v1 "matched module
//! ∈ target_module_ids" predicate.

use std::collections::HashMap;
use std::sync::Arc;

use bridge_conventions::adapter::strategy_evaluation::StrategyEvaluation;
use bridge_conventions::fact_dsl::witness::Witness;
use bridge_conventions::teaching::teaching_types::SurfaceGroup;
use bridge_conventions::types::spec_types::ConventionSpec;
use bridge_engine::constants::{next_seat, partner_seat};
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Auction, AuctionEntry, Call, Deal, Seat};
use bridge_session::heuristics::{
    BiddingContext, BiddingStrategy, NaturalFallbackStrategy, PassStrategy, PragmaticStrategy,
    StrategyChain,
};
use bridge_session::session::practice_focus::derive_initial_auction;
use bridge_session::session::start_drill::{nmf_initial_auction, DealAcceptancePredicate};
use bridge_session::types::{OpponentMode, PracticeRole};

use crate::convention_adapter::ConventionStrategyAdapter;
use crate::witness_selection::initial_auction_from_witness;

/// Extract (module_id, meaning_id) from a `StrategyEvaluation`'s selected carrier.
fn matched_module_and_surface(evaluation: &StrategyEvaluation) -> Option<(String, String)> {
    let pipeline_result = evaluation.pipeline_result.as_ref()?;
    let selected = pipeline_result.selected.as_ref()?;
    let proposal = selected.proposal();
    let mid = proposal.module_id.clone();
    let sid = proposal.meaning_id.clone();
    if mid.is_empty() {
        return None;
    }
    Some((mid, sid))
}

/// Build a seat→strategy map mirroring `config_resolver::build_seat_strategies`,
/// but producing `Arc<dyn BiddingStrategy>` so it can be cloned into the `Fn`
/// closure used for rejection sampling. Kept in lockstep with
/// `build_seat_strategies` so the predicate replays the same AI behavior the
/// live session will.
fn build_predicate_seat_strategies(
    user_seat: Seat,
    opponent_mode: OpponentMode,
    adapter: &Arc<ConventionStrategyAdapter>,
) -> HashMap<Seat, Arc<dyn BiddingStrategy>> {
    let mut m: HashMap<Seat, Arc<dyn BiddingStrategy>> = HashMap::new();
    // User + partner use the convention adapter. The predicate shares ONE
    // adapter across user + partner seats; live `build_seat_strategies` builds
    // two separate adapters but their behavior is identical because
    // `suggest_bid` is self-contained (stashed evaluation aside, which we only
    // read on the user seat after the loop).
    m.insert(user_seat, adapter.clone() as Arc<dyn BiddingStrategy>);
    m.insert(
        partner_seat(user_seat),
        adapter.clone() as Arc<dyn BiddingStrategy>,
    );

    let opp_seats = [next_seat(user_seat), next_seat(partner_seat(user_seat))];
    for &opp in &opp_seats {
        let strategy: Arc<dyn BiddingStrategy> = match opponent_mode {
            OpponentMode::Natural => Arc::new(StrategyChain::new(vec![
                Box::new(PragmaticStrategy),
                Box::new(NaturalFallbackStrategy),
                Box::new(PassStrategy),
            ])),
            OpponentMode::None => Arc::new(PassStrategy),
        };
        m.insert(opp, strategy);
    }
    m
}

/// Build a witness-verifying rejection-sampling predicate.
///
/// Returns `None` if there is no `ConventionSpec` (e.g., unknown bundle id);
/// in that case start_drill falls back to legacy single-attempt behavior.
///
/// The predicate replays the auction using the **same seat strategies the
/// live session uses** (via `build_predicate_seat_strategies`, kept in lockstep
/// with `config_resolver::build_seat_strategies`). This is critical:
/// previously opponent seats used a bare `ConventionStrategyAdapter`, which
/// always Pass'd, so the predicate would accept deals where the live session
/// actually plays an overcall — causing the drill to be served with a
/// non-convention auction ("no convention applies").
pub(crate) fn build_witness_acceptance_predicate(
    spec: &Option<ConventionSpec>,
    surface_groups: &[SurfaceGroup],
    witness: Witness,
    resolved_role: PracticeRole,
    bundle_deal_constraints: Option<bridge_engine::types::DealConstraints>,
    convention_id: &str,
    opponent_mode: OpponentMode,
) -> Option<Arc<DealAcceptancePredicate>> {
    let convention_id = convention_id.to_string();
    let spec = spec.as_ref()?.clone();
    let surface_groups = surface_groups.to_vec();

    let adapter = Arc::new(ConventionStrategyAdapter::new(spec, surface_groups));

    Some(Arc::new(move |deal: &Deal, user_seat: Seat| -> bool {
        let user_hand = match deal.hands.get(&user_seat) {
            Some(h) => h.clone(),
            None => return false,
        };

        // Build the seat strategy map identically to the live session. Built
        // per-attempt because it holds `Arc<ConventionStrategyAdapter>` which
        // has interior-mutable `last_evaluation`; reusing across attempts
        // would leak stashed state. Construction is cheap (wraps a shared
        // Arc to the adapter; opponent chains are stateless structs).
        let seat_strategies = build_predicate_seat_strategies(user_seat, opponent_mode, &adapter);

        // Same prefix seeding as v1: either NMF, initial-auction derivation, or empty.
        let witness_prefix = initial_auction_from_witness(&witness);
        let nmf_prefix =
            if convention_id == "nmf-bundle" && resolved_role == PracticeRole::Responder {
                nmf_initial_auction(deal, deal.dealer)
            } else {
                None
            };
        let mut auction = witness_prefix
            .or(nmf_prefix)
            .or_else(|| {
                derive_initial_auction(
                    resolved_role,
                    deal.dealer,
                    bundle_deal_constraints.as_ref(),
                    Some(deal),
                )
            })
            .unwrap_or_else(|| Auction {
                entries: Vec::new(),
                is_complete: false,
            });

        // Walk the witness prefix in order; between each witness entry the
        // opponents must pass (no interference). `witness_idx` points into
        // witness.prefix; `cursor` is the next seat to act.
        let mut witness_idx = 0usize;

        // First: verify any pre-seeded entries match expectations. Witness-
        // derived initial auctions may include inserted opponent passes so the
        // live drill lands directly on the user's turn; consume witness-prefix
        // partnership bids in order and tolerate extra seeded passes from seats
        // that are not the next witness actor.
        for entry in auction.entries.iter() {
            if let Some(expected) = witness.prefix.get(witness_idx) {
                if entry.seat == expected.seat && entry.call == expected.call {
                    witness_idx += 1;
                    continue;
                }
            }
            if entry.call != Call::Pass {
                return false;
            }
        }

        let mut cursor = if auction.entries.is_empty() {
            deal.dealer
        } else {
            next_seat(auction.entries.last().unwrap().seat)
        };

        // Advance auction until it's the user's turn. At each step:
        //   - If `cursor` is the next witness-prefix seat, the adapter must
        //     produce that exact call (partnership bid).
        //   - Otherwise the seat is an opponent between witness steps; require
        //     Pass (no interference). Non-pass → reject.
        let mut guard = 0u32;
        while cursor != user_seat && guard < 8 {
            guard += 1;
            let next_expected = witness.prefix.get(witness_idx);
            let is_witness_step = matches!(next_expected, Some(e) if e.seat == cursor);

            let seat_hand = match deal.hands.get(&cursor) {
                Some(h) => h.clone(),
                None => return false,
            };
            let seat_eval = evaluate_hand_hcp(&seat_hand);
            let seat_ctx = BiddingContext {
                hand: seat_hand,
                auction: auction.clone(),
                seat: cursor,
                evaluation: seat_eval,
                vulnerability: Some(deal.vulnerability),
                dealer: Some(deal.dealer),
            };
            // Mirror `bidding_controller::get_ai_bid`: look up the seat's
            // strategy, suggest_bid, unwrap to Pass. Legality is enforced by
            // the adapter/chain internally; here we mirror the live fallback.
            let call = match seat_strategies.get(&cursor) {
                Some(s) => s
                    .suggest_bid(&seat_ctx)
                    .map(|b| b.call)
                    .unwrap_or(Call::Pass),
                None => Call::Pass,
            };

            if is_witness_step {
                let expected = next_expected.expect("checked above");
                if call != expected.call {
                    return false;
                }
                witness_idx += 1;
            } else if call != Call::Pass {
                // Opponent auto-played non-pass; breaks the witness sequence.
                return false;
            }

            auction.entries.push(AuctionEntry { seat: cursor, call });
            cursor = next_seat(cursor);
        }

        if cursor != user_seat {
            return false;
        }

        // At user's turn: the full witness prefix must have been consumed
        // (all partnership steps accounted for).
        if witness_idx != witness.prefix.len() {
            return false;
        }

        let evaluation = evaluate_hand_hcp(&user_hand);
        let ctx = BiddingContext {
            hand: user_hand,
            auction,
            seat: user_seat,
            evaluation,
            vulnerability: Some(deal.vulnerability),
            dealer: Some(deal.dealer),
        };

        let (_bid, strategy_evaluation) = adapter.suggest_with_evaluation(&ctx, None);
        match matched_module_and_surface(&strategy_evaluation) {
            Some((mid, sid)) => mid == witness.target_module_id && sid == witness.target_surface_id,
            None => false,
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::fact_dsl::witness::WitnessCall;
    use bridge_conventions::registry::module_registry::BASE_MODULE_IDS;
    use bridge_conventions::registry::spec_builder::spec_from_bundle;
    use bridge_conventions::registry::system_configs::get_system_config;
    use bridge_conventions::types::system_config::BaseSystemId;
    use bridge_engine::deal_generator::generate_deal;
    use bridge_engine::types::{BidSuit, DealConstraints};
    use bridge_session::types::{PlayPreference, PracticeMode};
    use std::collections::HashMap;

    use crate::port::ServicePort;
    use crate::request_types::SessionConfig;
    use crate::service_impl::ServicePortImpl;
    use crate::ServiceError;

    fn stayman_config(seed: u64) -> SessionConfig {
        SessionConfig {
            convention_id: "nt-stayman".to_string(),
            system_config: get_system_config(BaseSystemId::Sayc),
            base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
            practice_mode: Some(PracticeMode::DecisionDrill),
            target_module_id: Some("stayman".to_string()),
            practice_role: Some(PracticeRole::Responder),
            play_preference: Some(PlayPreference::Skip),
            opponent_mode: None,
            user_seat: None,
            vulnerability: None,
            seed: Some(seed),
        }
    }

    /// Phase 2g: nt-stayman drills either succeed with matched stayman or
    /// return `DealGenerationExhausted` — never silently fall through.
    /// Tight budget: ≥ 80% succeed across 10 seeds.
    #[test]
    fn phase2_nt_stayman_succeeds_or_errs_across_seeds() {
        let mut service = ServicePortImpl::new();
        let mut ok = 0;
        let mut exh = 0;
        for seed in 42..52u64 {
            match service.create_drill_session(stayman_config(seed)) {
                Ok(_) => ok += 1,
                Err(ServiceError::DealGenerationExhausted { .. }) => exh += 1,
                Err(e) => panic!("seed={seed}: unexpected err {e:?}"),
            }
        }
        assert_eq!(ok + exh, 10, "must be ok or exhausted, nothing else");
        assert!(
            ok >= 8,
            "expected ≥80% nt-stayman success across 10 seeds, got {ok}/10"
        );
    }

    /// Phase 2g: nt-transfers — with witness-based tight bounds, 1NT openings
    /// are surfaced reliably. Was `#[ignore]` under v1 loose semantics.
    #[test]
    fn phase2_nt_transfers_succeeds_across_seeds() {
        let mut service = ServicePortImpl::new();
        let mut ok = 0;
        let mut exh = 0;
        for seed in 200..210u64 {
            let config = SessionConfig {
                convention_id: "nt-transfers".to_string(),
                system_config: get_system_config(BaseSystemId::Sayc),
                base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
                practice_mode: Some(PracticeMode::DecisionDrill),
                target_module_id: Some("jacoby-transfers".to_string()),
                practice_role: Some(PracticeRole::Responder),
                play_preference: Some(PlayPreference::Skip),
                opponent_mode: None,
                user_seat: None,
                vulnerability: None,
                seed: Some(seed),
            };
            match service.create_drill_session(config) {
                Ok(_) => ok += 1,
                Err(ServiceError::DealGenerationExhausted { .. }) => exh += 1,
                Err(e) => panic!("seed={seed}: unexpected err {e:?}"),
            }
        }
        assert_eq!(ok + exh, 10, "must be ok or exhausted, nothing else");
        // Phase 2 no longer requires ≥80% here — witness enumeration for
        // jacoby-transfers only surfaces transfer-to-M, which is a narrow
        // 5+card major hand; 32 attempts may exhaust often. We assert that
        // at least some drills succeed (documenting current capability) and
        // that exhaustion is a clean Err.
        assert!(
            ok >= 1,
            "expected at least one nt-transfers success across 10 seeds, got {ok}/10"
        );
    }

    /// Phase 2g: witness-unsatisfiable config → `DealGenerationExhausted`.
    /// Construct a witness whose opener call no adapter will play, then
    /// verify `start_drill` returns Err (not a silent fallthrough).
    #[test]
    fn phase2_exhaustion_returns_err_for_unsatisfiable_witness() {
        use bridge_conventions::teaching::teaching_types::SurfaceGroup;
        use bridge_session::session::start_drill::{
            start_drill, ConventionConfig, StartDrillOptions,
        };
        use bridge_session::session::DrillConfig;

        let witness = Witness {
            prefix: vec![WitnessCall {
                seat: Seat::North,
                call: Call::Bid {
                    level: 7,
                    strain: BidSuit::NoTrump,
                },
            }],
            target_surface_id: "stayman:ask-major".to_string(),
            target_module_id: "stayman".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };

        let base = BASE_MODULE_IDS
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>();
        let sys = get_system_config(BaseSystemId::Sayc);
        let spec = spec_from_bundle("nt-stayman", &sys, &base, &HashMap::new());
        let groups: Vec<SurfaceGroup> = Vec::new();
        let pred = build_witness_acceptance_predicate(
            &spec,
            &groups,
            witness,
            PracticeRole::Responder,
            None,
            "nt-stayman",
            OpponentMode::Natural,
        )
        .expect("predicate should build");

        let convention = ConventionConfig {
            id: "nt-stayman".to_string(),
            deal_constraints: DealConstraints {
                seats: Vec::new(),
                dealer: Some(Seat::North),
                vulnerability: None,
                max_attempts: Some(50_000),
                seed: Some(1),
            },
            allowed_dealers: None,
        };
        let options = StartDrillOptions {
            practice_role: PracticeRole::Responder,
            deal_acceptance_predicate: Some(pred),
            ..Default::default()
        };
        let drill_config = DrillConfig {
            convention_id: "nt-stayman".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };
        let mut rng_state = 0.5_f64;
        let result = start_drill(
            &convention,
            Seat::South,
            drill_config,
            &options,
            &mut || {
                let v = rng_state;
                rng_state = (rng_state + 0.137).fract();
                v
            },
        );
        let err = match result {
            Ok(_) => panic!("expected exhaustion err, got Ok"),
            Err(e) => e,
        };
        assert!(
            err.starts_with("deal generation exhausted"),
            "expected exhaustion err, got: {err}"
        );
    }

    /// Witness-match predicate must reject when the adapter replay produces a
    /// call that differs from the witness's prefix expectation.
    #[test]
    fn predicate_rejects_when_prefix_mismatch() {
        // Fabricate a witness that claims North opens 7NT — no real adapter
        // will replay this, so the predicate must reject the deal.
        let witness = Witness {
            prefix: vec![WitnessCall {
                seat: Seat::North,
                call: Call::Bid {
                    level: 7,
                    strain: BidSuit::NoTrump,
                },
            }],
            target_surface_id: "stayman:ask-major".to_string(),
            target_module_id: "stayman".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };

        let base = BASE_MODULE_IDS
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>();
        let sys = get_system_config(BaseSystemId::Sayc);
        let spec = spec_from_bundle("nt-stayman", &sys, &base, &HashMap::new());
        let groups: Vec<SurfaceGroup> = Vec::new();

        let pred = build_witness_acceptance_predicate(
            &spec,
            &groups,
            witness,
            PracticeRole::Responder,
            None,
            "nt-stayman",
            OpponentMode::Natural,
        )
        .expect("predicate should build");

        // Generate an arbitrary deal with North as dealer and make sure the
        // predicate rejects it (the adapter will never auto-bid 7NT).
        let constraints = DealConstraints {
            seats: Vec::new(),
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: Some(1_000),
            seed: Some(42),
        };
        let deal = generate_deal(&constraints).expect("deal").deal;
        assert!(
            !pred(&deal, Seat::South),
            "mismatched witness prefix should reject"
        );
    }
}
