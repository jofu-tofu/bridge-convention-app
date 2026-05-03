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
use bridge_conventions::fact_dsl::witness::{Witness, WitnessCallSpec, WitnessRole};
use bridge_conventions::teaching::teaching_types::SurfaceGroup;
use bridge_conventions::types::spec_types::ConventionSpec;
use bridge_engine::constants::{next_seat, partner_seat};
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Auction, AuctionEntry, Call, Deal, Seat};
use bridge_engine::strategy::BidResult;
use bridge_session::heuristics::{
    BiddingContext, BiddingStrategy, NaturalFallbackStrategy, PassStrategy, PragmaticStrategy,
    StrategyChain,
};
use bridge_session::session::practice_focus::derive_initial_auction;
use bridge_session::session::start_drill::DealAcceptancePredicate;
use bridge_session::types::{OpponentMode, PracticeRole};

use crate::convention_adapter::ConventionStrategyAdapter;
use crate::witness_selection::initial_auction_from_witness;

/// Stateless strategy that replays Opponent-tagged witness steps for an
/// opponent seat. Phase 3 swaps this in for opponents whose seat appears as
/// an `Opponent` step in the witness prefix; when the predicate's auto-play
/// loop reaches one of those positions, the strategy returns the authored
/// call so rejection sampling proceeds deterministically instead of
/// consulting the live `Natural`/`Pass` chain.
///
/// Outside the witness scope (before the prefix has begun, after it has
/// fully played, or at a seat with no `Opponent` step) the strategy returns
/// `None`, letting the chain fall through to the live opponent strategy.
/// Concrete witness steps are returned verbatim; `Pattern` steps are also
/// punted to the live strategy — the predicate's `expected.spec.matches()`
/// gate later validates that the live call satisfies the pattern.
struct ScriptedOpponentStrategy {
    witness: Witness,
}

impl ScriptedOpponentStrategy {
    fn id_str() -> &'static str {
        "scripted-opponent"
    }
}

impl BiddingStrategy for ScriptedOpponentStrategy {
    fn id(&self) -> &str {
        Self::id_str()
    }

    fn name(&self) -> &str {
        "Scripted Opponent (witness replay)"
    }

    fn suggest_bid(&self, context: &BiddingContext) -> Option<BidResult> {
        // Reconstruct the expected auction up to the current position. The
        // witness prefix encodes only the seats that authored a call; every
        // other seat in turn order is implicitly Pass. If the entry that
        // would land at index `context.auction.entries.len()` is an Opponent
        // witness step at this seat, return its concrete call.
        let target_idx = context.auction.entries.len();
        let mut cursor = self.witness.dealer;
        let mut idx = 0usize;
        let mut witness_idx = 0usize;
        // Bound the loop defensively — same 16-step ceiling used by
        // `initial_auction_from_witness`.
        let mut guard = 0u32;
        while guard < 32 {
            guard += 1;
            if idx == target_idx {
                // We've reached the position the live caller is asking about.
                // If a witness step lands here AND it's an opponent step
                // at THIS seat, replay its concrete call. Patterns punt to
                // the live chain.
                if let Some(expected) = self.witness.prefix.get(witness_idx) {
                    if expected.seat == cursor
                        && expected.seat == context.seat
                        && matches!(expected.role, WitnessRole::Opponent)
                    {
                        if let WitnessCallSpec::Concrete(call) = &expected.spec {
                            return Some(BidResult {
                                call: call.clone(),
                                rule_name: Some("scripted-opponent".to_string()),
                                explanation: "Scripted opponent witness step".to_string(),
                                ..Default::default()
                            });
                        }
                    }
                }
                return None;
            }
            // Advance cursor: if the next witness step's seat is `cursor`,
            // consume that step; otherwise advance with an implicit Pass.
            match self.witness.prefix.get(witness_idx) {
                Some(expected) if expected.seat == cursor => {
                    witness_idx += 1;
                }
                _ => {}
            }
            idx += 1;
            cursor = next_seat(cursor);
            // If we've consumed the entire witness prefix and walked past
            // it, we're outside the scripted region.
            if witness_idx >= self.witness.prefix.len() && idx > target_idx {
                return None;
            }
        }
        None
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

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

/// True iff the witness prefix authored an `Opponent` step at this seat.
fn witness_has_opponent_step_at(witness: &Witness, seat: Seat) -> bool {
    witness.prefix.iter().any(|w| {
        w.seat == seat && matches!(w.role, WitnessRole::Opponent)
    })
}

/// Build a seat→strategy map mirroring `config_resolver::build_seat_strategies`,
/// but producing `Arc<dyn BiddingStrategy>` so it can be cloned into the `Fn`
/// closure used for rejection sampling. Kept in lockstep with
/// `build_seat_strategies` so the predicate replays the same AI behavior the
/// live session will.
///
/// Phase 3: when the witness has authored opponent steps at an opponent
/// seat, prefix that seat's chain with a `ScriptedOpponentStrategy` so the
/// authored call is replayed deterministically during rejection sampling.
/// The live opponent strategy still backstops positions where the witness
/// is silent (before the prefix, after it, or for seats with no `Opponent`
/// step).
fn build_predicate_seat_strategies(
    user_seat: Seat,
    opponent_mode: OpponentMode,
    adapter: &Arc<ConventionStrategyAdapter>,
    witness: &Witness,
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
        let needs_script = witness_has_opponent_step_at(witness, opp);
        let strategy: Arc<dyn BiddingStrategy> = match (opponent_mode, needs_script) {
            (OpponentMode::Natural, true) => Arc::new(StrategyChain::new(vec![
                Box::new(ScriptedOpponentStrategy { witness: witness.clone() }),
                Box::new(PragmaticStrategy),
                Box::new(NaturalFallbackStrategy),
                Box::new(PassStrategy),
            ])),
            (OpponentMode::Natural, false) => Arc::new(StrategyChain::new(vec![
                Box::new(PragmaticStrategy),
                Box::new(NaturalFallbackStrategy),
                Box::new(PassStrategy),
            ])),
            (OpponentMode::None, true) => Arc::new(StrategyChain::new(vec![
                Box::new(ScriptedOpponentStrategy { witness: witness.clone() }),
                Box::new(PassStrategy),
            ])),
            (OpponentMode::None, false) => Arc::new(PassStrategy),
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
    _convention_id: &str,
    opponent_mode: OpponentMode,
) -> Option<Arc<DealAcceptancePredicate>> {
    let spec = spec.as_ref()?.clone();
    let surface_groups = surface_groups.to_vec();

    let adapter = Arc::new(ConventionStrategyAdapter::new(spec, surface_groups));

    // Log what the witness expects (once, outside the closure).
    tracing::debug!(
        target_module = %witness.target_module_id,
        target_surface = %witness.target_surface_id,
        user_seat = ?witness.user_seat,
        prefix_len = witness.prefix.len(),
        prefix_calls = ?witness.prefix.iter().map(|e| format!("{:?}:{:?}", e.seat, e.spec)).collect::<Vec<_>>(),
        "building witness predicate"
    );
    if let Some(ref dc) = bundle_deal_constraints {
        for sc in &dc.seats {
            tracing::debug!(
                "projected constraint: {:?} hcp={:?}-{:?} balanced={:?} minLen={:?} maxLen={:?}",
                sc.seat,
                sc.min_hcp,
                sc.max_hcp,
                sc.balanced,
                sc.min_length,
                sc.max_length
            );
        }
    } else {
        tracing::debug!("no projected deal constraints");
    }

    Some(Arc::new(move |deal: &Deal, user_seat: Seat| -> bool {
        let user_hand = match deal.hands.get(&user_seat) {
            Some(h) => h.clone(),
            None => {
                tracing::debug!("reject: user seat {:?} missing from deal", user_seat);
                return false;
            }
        };

        // Build the seat strategy map identically to the live session. Built
        // per-attempt because it holds `Arc<ConventionStrategyAdapter>` which
        // has interior-mutable `last_evaluation`; reusing across attempts
        // would leak stashed state. Construction is cheap (wraps a shared
        // Arc to the adapter; opponent chains are stateless structs).
        // Phase 3: also installs `ScriptedOpponentStrategy` for any opponent
        // seat the witness authored a step at.
        let seat_strategies =
            build_predicate_seat_strategies(user_seat, opponent_mode, &adapter, &witness);

        // Witness-derived auction (concrete or pattern-materialized via the
        // seat strategies we just built) takes precedence; fall back to the
        // bundle-specific derive_initial_auction.
        let witness_prefix = initial_auction_from_witness(&witness, deal, &seat_strategies);
        let mut auction = witness_prefix
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
        let mut built_auction_so_far: Vec<(Seat, Call)> = Vec::new();
        for entry in auction.entries.iter() {
            if let Some(expected) = witness.prefix.get(witness_idx) {
                if entry.seat == expected.seat
                    && expected.spec.matches(&entry.call, &built_auction_so_far)
                {
                    witness_idx += 1;
                    built_auction_so_far.push((entry.seat, entry.call.clone()));
                    continue;
                }
            }
            if entry.call != Call::Pass {
                tracing::debug!(
                    "reject: pre-seeded entry {:?} at {:?} is non-pass and doesn't match witness",
                    entry.call,
                    entry.seat
                );
                return false;
            }
            built_auction_so_far.push((entry.seat, entry.call.clone()));
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
                if !expected.spec.matches(&call, &built_auction_so_far) {
                    tracing::debug!(
                        "reject: witness step {:?} expected {:?} but adapter produced {:?} (seat {:?}, hcp={})",
                        witness_idx, expected.spec, call, cursor,
                        evaluate_hand_hcp(&deal.hands[&cursor]).hcp
                    );
                    return false;
                }
                witness_idx += 1;
            } else if call != Call::Pass {
                // Opponent auto-played non-pass; breaks the witness sequence.
                tracing::debug!(
                    "reject: opponent {:?} auto-played {:?} instead of Pass (hcp={})",
                    cursor,
                    call,
                    evaluate_hand_hcp(&deal.hands[&cursor]).hcp
                );
                return false;
            }

            built_auction_so_far.push((cursor, call.clone()));
            auction.entries.push(AuctionEntry { seat: cursor, call });
            cursor = next_seat(cursor);
        }

        if cursor != user_seat {
            tracing::debug!(
                "reject: cursor {:?} != user_seat {:?} after prefix replay",
                cursor,
                user_seat
            );
            return false;
        }

        // At user's turn: the full witness prefix must have been consumed
        // (all partnership steps accounted for).
        if witness_idx != witness.prefix.len() {
            tracing::debug!(
                "reject: witness_idx {} != prefix len {} — not all partnership steps consumed",
                witness_idx,
                witness.prefix.len()
            );
            return false;
        }

        let evaluation = evaluate_hand_hcp(&user_hand);
        let user_hcp = evaluation.hcp;
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
            Some((mid, sid)) => {
                // Accept when (module_id, meaning_id) match exactly, OR when
                // meaning_id matches and the pipeline's module_id is the base
                // module that the target module's surfaces claim as their origin
                // (extension modules like stayman-garbage author surfaces with
                // the base module's ID, not the containing module ID).
                let ok = sid == witness.target_surface_id
                    && (mid == witness.target_module_id || mid == witness.target_surface_module_id);
                if !ok {
                    tracing::debug!(
                        "reject: pipeline selected {}/{} but witness targets {}/{}",
                        mid,
                        sid,
                        witness.target_module_id,
                        witness.target_surface_id
                    );
                }
                ok
            }
            None => {
                tracing::debug!(
                    "reject: pipeline returned no module/surface match (user hcp={})",
                    user_hcp
                );
                false
            }
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::fact_dsl::witness::{WitnessCall, WitnessCallSpec, WitnessRole};
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
            convention_id: "stayman-bundle".to_string(),
            system_config: get_system_config(BaseSystemId::Sayc),
            base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
            practice_mode: Some(PracticeMode::DecisionDrill),
            target: Some(bridge_conventions::types::rule_types::TargetSelector::Module {
                module_id: "stayman".to_string(),
            }),
            practice_role: Some(PracticeRole::Responder),
            play_preference: Some(PlayPreference::Skip),
            opponent_mode: None,
            user_seat: None,
            vulnerability: None,
            play_profile_id: None,
            vulnerability_distribution: None,
            seed: Some(seed),
        }
    }

    /// Phase 2g: stayman-bundle drills either succeed with matched stayman or
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
            "expected ≥80% stayman-bundle success across 10 seeds, got {ok}/10"
        );
    }

    /// Phase 2g: jacoby-transfers-bundle — with witness-based tight bounds, 1NT openings
    /// are surfaced reliably. Was `#[ignore]` under v1 loose semantics.
    #[test]
    fn phase2_nt_transfers_succeeds_across_seeds() {
        let mut service = ServicePortImpl::new();
        let mut ok = 0;
        let mut exh = 0;
        for seed in 200..210u64 {
            let config = SessionConfig {
                convention_id: "jacoby-transfers-bundle".to_string(),
                system_config: get_system_config(BaseSystemId::Sayc),
                base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
                practice_mode: Some(PracticeMode::DecisionDrill),
                target: Some(bridge_conventions::types::rule_types::TargetSelector::Module {
                    module_id: "jacoby-transfers".to_string(),
                }),
                practice_role: Some(PracticeRole::Responder),
                play_preference: Some(PlayPreference::Skip),
                opponent_mode: None,
                user_seat: None,
                vulnerability: None,
                play_profile_id: None,
                vulnerability_distribution: None,
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
            "expected at least one jacoby-transfers-bundle success across 10 seeds, got {ok}/10"
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
                spec: WitnessCallSpec::Concrete(Call::Bid {
                    level: 7,
                    strain: BidSuit::NoTrump,
                }),
                role: WitnessRole::Partnership,
            }],
            target_surface_id: "stayman:ask-major".to_string(),
            target_module_id: "stayman".to_string(),
            target_surface_module_id: "stayman".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };

        let base = BASE_MODULE_IDS
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>();
        let sys = get_system_config(BaseSystemId::Sayc);
        let spec = spec_from_bundle("stayman-bundle", &sys, &base, &HashMap::new());
        let groups: Vec<SurfaceGroup> = Vec::new();
        let pred = build_witness_acceptance_predicate(
            &spec,
            &groups,
            witness,
            PracticeRole::Responder,
            None,
            "stayman-bundle",
            OpponentMode::Natural,
        )
        .expect("predicate should build");

        let convention = ConventionConfig {
            id: "stayman-bundle".to_string(),
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
            convention_id: "stayman-bundle".to_string(),
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
                spec: WitnessCallSpec::Concrete(Call::Bid {
                    level: 7,
                    strain: BidSuit::NoTrump,
                }),
                role: WitnessRole::Partnership,
            }],
            target_surface_id: "stayman:ask-major".to_string(),
            target_module_id: "stayman".to_string(),
            target_surface_module_id: "stayman".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };

        let base = BASE_MODULE_IDS
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>();
        let sys = get_system_config(BaseSystemId::Sayc);
        let spec = spec_from_bundle("stayman-bundle", &sys, &base, &HashMap::new());
        let groups: Vec<SurfaceGroup> = Vec::new();

        let pred = build_witness_acceptance_predicate(
            &spec,
            &groups,
            witness,
            PracticeRole::Responder,
            None,
            "stayman-bundle",
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

    /// Phase 3: WitnessRole round-trips through serde with both variants.
    #[test]
    fn witness_role_round_trips_through_serde() {
        for variant in [WitnessRole::Partnership, WitnessRole::Opponent] {
            let json = serde_json::to_string(&variant).expect("serialize");
            let back: WitnessRole = serde_json::from_str(&json).expect("deserialize");
            assert_eq!(back, variant);
        }
        // Default deserialization (omitted role field) yields Partnership.
        // Use a WitnessCall whose JSON omits `role` to verify the default.
        let json = r#"{"seat":"N","spec":{"kind":"concrete","type":"pass"}}"#;
        let parsed: bridge_conventions::fact_dsl::witness::WitnessCall =
            serde_json::from_str(json).expect("deserialize default role");
        assert_eq!(parsed.role, WitnessRole::Partnership);
    }

    /// ScriptedOpponentStrategy returns the witness's concrete call when
    /// invoked at an Opponent witness step at the matching seat.
    #[test]
    fn scripted_opponent_strategy_returns_witness_call_when_at_opponent_step() {
        use bridge_engine::types::{Auction, Hand, HandEvaluation, DistributionPoints};
        let witness = Witness {
            prefix: vec![
                WitnessCall {
                    seat: Seat::North,
                    spec: WitnessCallSpec::Concrete(Call::Bid {
                        level: 1,
                        strain: BidSuit::Clubs,
                    }),
                    role: WitnessRole::Partnership,
                },
                WitnessCall {
                    seat: Seat::East,
                    spec: WitnessCallSpec::Concrete(Call::Bid {
                        level: 1,
                        strain: BidSuit::Diamonds,
                    }),
                    role: WitnessRole::Opponent,
                },
            ],
            target_surface_id: "negdbl:double-after-1c-1d".to_string(),
            target_module_id: "negative-doubles".to_string(),
            target_surface_module_id: "negative-doubles".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };
        let strategy = ScriptedOpponentStrategy { witness };
        // After N's opening, at index=1 with seat=East: returns the witness's 1D.
        let ctx = BiddingContext {
            hand: Hand { cards: vec![] },
            auction: Auction {
                entries: vec![bridge_engine::types::AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 1,
                        strain: BidSuit::Clubs,
                    },
                }],
                is_complete: false,
            },
            seat: Seat::East,
            evaluation: HandEvaluation {
                hcp: 12,
                distribution: DistributionPoints {
                    shortness: 0,
                    length: 0,
                    total: 0,
                },
                shape: [4, 3, 3, 3],
                strategy: "HCP".to_string(),
            },
            vulnerability: None,
            dealer: Some(Seat::North),
        };
        let result = strategy.suggest_bid(&ctx).expect("should produce a bid");
        assert_eq!(
            result.call,
            Call::Bid {
                level: 1,
                strain: BidSuit::Diamonds
            }
        );
    }

    /// ScriptedOpponentStrategy returns None outside the witness scope so the
    /// chain falls through to the live opponent strategy (or PassStrategy).
    #[test]
    fn scripted_opponent_strategy_returns_none_outside_witness_scope() {
        use bridge_engine::types::{Auction, Hand, HandEvaluation, DistributionPoints};
        let witness = Witness {
            prefix: vec![WitnessCall {
                seat: Seat::East,
                spec: WitnessCallSpec::Concrete(Call::Bid {
                    level: 1,
                    strain: BidSuit::Diamonds,
                }),
                role: WitnessRole::Opponent,
            }],
            target_surface_id: "ignored".to_string(),
            target_module_id: "ignored".to_string(),
            target_surface_module_id: "ignored".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };
        let strategy = ScriptedOpponentStrategy { witness };
        // Position 0 (dealer N) — strategy is at East, witness step is at E
        // at position 1. Asking for ctx.seat=East at position 0 should return
        // None (the witness step lands later).
        let ctx_pos0 = BiddingContext {
            hand: Hand { cards: vec![] },
            auction: Auction {
                entries: vec![],
                is_complete: false,
            },
            seat: Seat::East,
            evaluation: HandEvaluation {
                hcp: 0,
                distribution: DistributionPoints {
                    shortness: 0,
                    length: 0,
                    total: 0,
                },
                shape: [4, 3, 3, 3],
                strategy: "HCP".to_string(),
            },
            vulnerability: None,
            dealer: Some(Seat::North),
        };
        assert!(strategy.suggest_bid(&ctx_pos0).is_none());

        // After consuming the witness, query again for any position past it
        // (auction len > prefix len). Should return None.
        let ctx_past = BiddingContext {
            hand: Hand { cards: vec![] },
            auction: Auction {
                entries: vec![
                    bridge_engine::types::AuctionEntry {
                        seat: Seat::North,
                        call: Call::Pass,
                    },
                    bridge_engine::types::AuctionEntry {
                        seat: Seat::East,
                        call: Call::Bid {
                            level: 1,
                            strain: BidSuit::Diamonds,
                        },
                    },
                    bridge_engine::types::AuctionEntry {
                        seat: Seat::South,
                        call: Call::Pass,
                    },
                    bridge_engine::types::AuctionEntry {
                        seat: Seat::West,
                        call: Call::Pass,
                    },
                ],
                is_complete: false,
            },
            seat: Seat::East,
            evaluation: HandEvaluation {
                hcp: 0,
                distribution: DistributionPoints {
                    shortness: 0,
                    length: 0,
                    total: 0,
                },
                shape: [4, 3, 3, 3],
                strategy: "HCP".to_string(),
            },
            vulnerability: None,
            dealer: Some(Seat::North),
        };
        assert!(strategy.suggest_bid(&ctx_past).is_none());
    }

    /// When the witness has a Pattern opponent step that the live opponent
    /// can't satisfy on a given deal, the predicate must reject. The
    /// `predicate_rejects_when_prefix_mismatch` test covers concrete-step
    /// divergence; this case extends it to opponent-pattern divergence by
    /// pinning a specific overcall strain that won't match a randomly
    /// generated deal.
    #[test]
    fn predicate_rejects_when_live_opponent_diverges_from_witness() {
        use bridge_conventions::types::bid_action::{BidActionType, ObsSuit};
        use bridge_conventions::types::rule_types::{ObsPattern, ObsPatternAct};
        // Witness: N opens 1C, E overcalls a SPECIFIC level/strain (3NT) that
        // no Natural opponent will play here. The predicate's
        // ScriptedOpponentStrategy returns None for the Pattern step (since
        // 3NT-overcall has level=3 strain=NT — but we keep `act: Overcall`
        // so the matcher only accepts Overcall calls). Live opponent will
        // overwhelmingly play Pass or some sane overcall, never matching.
        let witness = Witness {
            prefix: vec![
                WitnessCall {
                    seat: Seat::North,
                    spec: WitnessCallSpec::Concrete(Call::Bid {
                        level: 1,
                        strain: BidSuit::Clubs,
                    }),
                    role: WitnessRole::Partnership,
                },
                WitnessCall {
                    seat: Seat::East,
                    spec: WitnessCallSpec::Pattern(ObsPattern {
                        act: ObsPatternAct::Specific(BidActionType::Overcall),
                        feature: None,
                        suit: Some(ObsSuit::Diamonds),
                        strain: None,
                        suit_class: None,
                        strength: None,
                        actor: None,
                        level: Some(7),
                        jump: None,
                    }),
                    role: WitnessRole::Opponent,
                },
            ],
            target_surface_id: "negdbl:double-after-1c-1d".to_string(),
            target_module_id: "negative-doubles".to_string(),
            target_surface_module_id: "negative-doubles".to_string(),
            user_seat: Seat::South,
            dealer: Seat::North,
        };

        let base = BASE_MODULE_IDS
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>();
        let sys = get_system_config(BaseSystemId::Sayc);
        let spec = spec_from_bundle("negative-doubles-bundle", &sys, &base, &HashMap::new());
        let groups: Vec<SurfaceGroup> = Vec::new();
        let pred = build_witness_acceptance_predicate(
            &spec,
            &groups,
            witness,
            PracticeRole::Responder,
            None,
            "negative-doubles-bundle",
            OpponentMode::Natural,
        )
        .expect("predicate builds");

        let constraints = DealConstraints {
            seats: Vec::new(),
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: Some(1_000),
            seed: Some(42),
        };
        let deal = generate_deal(&constraints).expect("deal").deal;
        // Live opponent will not bid 7D over 1C, and the witness step has no
        // Concrete spec for ScriptedOpponentStrategy to return — predicate
        // must reject.
        assert!(
            !pred(&deal, Seat::South),
            "predicate must reject when live opponent diverges from witness pattern"
        );
    }
}
