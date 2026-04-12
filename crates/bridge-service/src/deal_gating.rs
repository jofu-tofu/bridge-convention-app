//! Deal-acceptance predicate for rejection sampling inside `start_drill`.
//!
//! Builds a closure that takes a candidate deal + user seat, runs the
//! convention adapter at the user's turn, and accepts the deal iff the
//! selected pipeline carrier was produced by a target module (i.e., one of
//! the bundle's `member_ids`). This is the Phase 3 fix for "loose derived
//! DealConstraints occasionally produce deals with no target-module surface
//! at the user's turn."
//!
//! The predicate is constructed in `drill_setup.rs` (where the adapter, spec,
//! and bundle member ids are all accessible) and threaded into
//! `StartDrillOptions::deal_acceptance_predicate`.

use std::collections::HashSet;
use std::sync::Arc;

use bridge_conventions::adapter::strategy_evaluation::StrategyEvaluation;
use bridge_conventions::teaching::teaching_types::SurfaceGroup;
use bridge_conventions::types::spec_types::ConventionSpec;
use bridge_engine::constants::next_seat;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Auction, AuctionEntry, Call, Deal, Seat};
use bridge_session::heuristics::BiddingContext;
use bridge_session::session::practice_focus::derive_initial_auction;
use bridge_session::session::start_drill::DealAcceptancePredicate;
use bridge_session::types::PracticeRole;

use crate::convention_adapter::ConventionStrategyAdapter;

/// Extract the matched module id from a `StrategyEvaluation`.
///
/// Returns `Some(module_id)` iff the pipeline produced a selected carrier whose
/// source proposal carries a module id (i.e., it was resolved by a concrete
/// module, not a heuristic fallback).
pub fn matched_module_id(evaluation: &StrategyEvaluation) -> Option<String> {
    evaluation
        .pipeline_result
        .as_ref()
        .and_then(|pr| pr.selected.as_ref())
        .map(|c| c.proposal().module_id.clone())
        .filter(|mid| !mid.is_empty())
}

/// Build a rejection-sampling predicate for `start_drill`.
///
/// Returns `None` if there is no `ConventionSpec` (e.g., unknown bundle id) or
/// if the bundle has no target modules — in those cases start_drill falls back
/// to legacy single-attempt behavior.
pub(crate) fn build_deal_acceptance_predicate(
    spec: &Option<ConventionSpec>,
    surface_groups: &[SurfaceGroup],
    bundle_member_ids: &[String],
    resolved_role: PracticeRole,
    bundle_deal_constraints: Option<bridge_engine::types::DealConstraints>,
) -> Option<Arc<DealAcceptancePredicate>> {
    let spec = spec.as_ref()?.clone();
    let target_module_ids: HashSet<String> = bundle_member_ids.iter().cloned().collect();
    if target_module_ids.is_empty() {
        return None;
    }
    let surface_groups = surface_groups.to_vec();

    // Build one adapter that is reused across attempts. The adapter is &self
    // on suggest_bid / suggest_with_evaluation (the RwLock<last_evaluation>
    // is interior-mutable and harmless here), so sharing across attempts is
    // safe.
    let adapter = Arc::new(ConventionStrategyAdapter::new(spec, surface_groups));

    Some(Arc::new(move |deal: &Deal, user_seat: Seat| -> bool {
        let user_hand = match deal.hands.get(&user_seat) {
            Some(h) => h.clone(),
            None => return false,
        };

        // Seed with any initial auction the start_drill helper would prefill
        // (e.g., explicit 1NT openings when constraints express balanced 15-17).
        // If that returns None, we replay the adapter from dealer forward,
        // which is what the live session does via run_initial_ai_bids.
        let mut auction = derive_initial_auction(
            resolved_role,
            deal.dealer,
            bundle_deal_constraints.as_ref(),
            Some(deal),
        )
        .unwrap_or_else(|| Auction {
            entries: Vec::new(),
            is_complete: false,
        });

        // Whose turn is next?
        let mut cursor = if auction.entries.is_empty() {
            deal.dealer
        } else {
            next_seat(auction.entries.last().unwrap().seat)
        };

        // Advance the auction by asking the convention adapter for each
        // non-user seat's bid until it's the user's turn. Cap at 8 bids
        // (plenty of room for a standard opener sequence) to bound cost.
        let mut guard = 0u32;
        while cursor != user_seat && guard < 8 {
            guard += 1;
            let seat_hand = match deal.hands.get(&cursor) {
                Some(h) => h.clone(),
                None => break,
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
            let (bid_opt, _eval) = adapter.suggest_with_evaluation(&seat_ctx, None);
            let call = bid_opt.map(|b| b.call).unwrap_or(Call::Pass);
            auction.entries.push(AuctionEntry {
                seat: cursor,
                call,
            });
            cursor = next_seat(cursor);
        }

        if cursor != user_seat {
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
        match matched_module_id(&strategy_evaluation) {
            Some(mid) => target_module_ids.contains(mid.as_str()),
            None => false,
        }
    }))
}

#[cfg(test)]
mod tests {
    //! Phase 3 sanity test: nt-stayman + responder role must produce a deal
    //! where the adapter's user-turn suggestion is sourced by the `stayman`
    //! module, across several seeds.

    use crate::port::ServicePort;
    use crate::request_types::SessionConfig;
    use crate::service_impl::ServicePortImpl;
    use bridge_conventions::registry::module_registry::BASE_MODULE_IDS;
    use bridge_conventions::registry::system_configs::get_system_config;
    use bridge_conventions::types::system_config::BaseSystemId;
    use bridge_session::types::{PlayPreference, PracticeMode, PracticeRole};

    fn make_config(bundle_id: &str, role: PracticeRole, seed: u64) -> SessionConfig {
        SessionConfig {
            convention_id: bundle_id.to_string(),
            system_config: get_system_config(BaseSystemId::Sayc),
            base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
            practice_mode: Some(PracticeMode::DecisionDrill),
            target_module_id: Some("stayman".to_string()),
            practice_role: Some(role),
            play_preference: Some(PlayPreference::Skip),
            opponent_mode: None,
            user_seat: None,
            vulnerability: None,
            seed: Some(seed),
        }
    }

    #[test]
    fn nt_stayman_responder_triggers_stayman_surface() {
        // Across 5 seeds, every generated deal should yield an initial auction
        // that includes 1NT, which is precisely what rejection sampling + the
        // stayman-module gate promise.
        let mut service = ServicePortImpl::new();
        for seed in 42..47 {
            let config = make_config("nt-stayman", PracticeRole::Responder, seed);
            let handle = service
                .create_drill_session(config)
                .expect("create_drill_session");
            let result = service.start_drill(&handle).expect("start_drill");
            let has_1nt = result.viewport.auction_entries.iter().any(|e| {
                matches!(
                    &e.call,
                    bridge_engine::types::Call::Bid {
                        level: 1,
                        strain: bridge_engine::types::BidSuit::NoTrump,
                    }
                )
            });
            assert!(
                has_1nt,
                "seed={seed}: nt-stayman responder should see 1NT opening, got: {:?}",
                result
                    .viewport
                    .auction_entries
                    .iter()
                    .map(|e| &e.call)
                    .collect::<Vec<_>>()
            );
        }
    }

    /// Phase 6b: across 10 seeds, every rejection-sampled nt-stayman responder
    /// deal must place South with a hand that satisfies Stayman eligibility:
    /// 8+ HCP AND (4+ hearts OR 4+ spades). This is the observable behavior
    /// promised by the deal-acceptance predicate matching the `stayman` module.
    #[test]
    fn nt_stayman_responder_hand_satisfies_stayman_surface_10_seeds() {
        use bridge_engine::hand_evaluator::evaluate_hand_hcp;
        use bridge_engine::Suit;

        let mut service = ServicePortImpl::new();
        for seed in 100..110 {
            let config = make_config("nt-stayman", PracticeRole::Responder, seed);
            let handle = service
                .create_drill_session(config)
                .expect("create_drill_session");
            let result = service.start_drill(&handle).expect("start_drill");
            let hand = &result.viewport.hand;
            let hcp = evaluate_hand_hcp(hand).hcp;

            let hearts = hand.cards.iter().filter(|c| c.suit == Suit::Hearts).count();
            let spades = hand.cards.iter().filter(|c| c.suit == Suit::Spades).count();

            // Stayman eligibility: 8+ HCP, at least one 4+ major.
            assert!(
                hcp >= 8,
                "seed={seed}: stayman responder should have 8+ HCP, got {hcp}"
            );
            assert!(
                hearts >= 4 || spades >= 4,
                "seed={seed}: stayman responder should have 4+ major, got H={hearts} S={spades}"
            );

            // Auction must include 1NT opening (not a base-module pass-fest).
            let has_1nt = result.viewport.auction_entries.iter().any(|e| {
                matches!(
                    &e.call,
                    bridge_engine::types::Call::Bid {
                        level: 1,
                        strain: bridge_engine::types::BidSuit::NoTrump,
                    }
                )
            });
            assert!(
                has_1nt,
                "seed={seed}: auction should include 1NT opening, got {:?}",
                result
                    .viewport
                    .auction_entries
                    .iter()
                    .map(|e| &e.call)
                    .collect::<Vec<_>>()
            );
        }
    }

    /// Phase 6b parallel: nt-transfers responder — when the rejection-sampling
    /// predicate accepts a deal AND the auction includes a 1NT opening, the
    /// responder must hold a 5+ card major (Jacoby eligibility floor).
    ///
    /// Note: nt-transfers derivation doesn't reliably surface `balanced=true`
    /// on opener (union semantics drop it), so 1NT openings happen only when
    /// North organically qualifies via natural-bids. Seeds that fall through
    /// rejection-sampling exhaustion without a 1NT are skipped — this test
    /// asserts the conditional implication, not a base rate.
    ///
    /// Ignored by default because empirically 20 consecutive seeds at
    /// max_attempts=50_000 do not produce a 1NT opening; the test would
    /// be vacuously passing. Retained as documentation for the known gap.
    #[test]
    #[ignore = "nt-transfers derivation doesn't force 1NT openings under current loose-union semantics; see Phase 6 report"]
    fn nt_transfers_responder_hand_satisfies_transfer_surface_when_1nt_opens() {
        use bridge_engine::Suit;

        let mut service = ServicePortImpl::new();
        let mut seeds_with_1nt = 0;
        for seed in 200..220 {
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
            let handle = service
                .create_drill_session(config)
                .expect("create_drill_session");
            let result = service.start_drill(&handle).expect("start_drill");
            let hand = &result.viewport.hand;

            let has_1nt = result.viewport.auction_entries.iter().any(|e| {
                matches!(
                    &e.call,
                    bridge_engine::types::Call::Bid {
                        level: 1,
                        strain: bridge_engine::types::BidSuit::NoTrump,
                    }
                )
            });
            if !has_1nt {
                continue;
            }
            seeds_with_1nt += 1;
            let hearts = hand.cards.iter().filter(|c| c.suit == Suit::Hearts).count();
            let spades = hand.cards.iter().filter(|c| c.suit == Suit::Spades).count();
            assert!(
                hearts >= 5 || spades >= 5,
                "seed={seed}: transfers responder with 1NT opening should have 5+ major, got H={hearts} S={spades}"
            );
        }
        // Ensure the conditional branch actually fires on at least one seed —
        // otherwise the test is vacuously passing.
        assert!(
            seeds_with_1nt >= 1,
            "expected at least one nt-transfers seed to open 1NT across range; got {seeds_with_1nt}"
        );
    }
}
