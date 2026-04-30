//! Canary regression tests: specific (auction, hand, expected action) triples
//! derived from authoritative references and prior convention-audit notes.
//!
//! Each canary encodes a known-hard case that has either been fixed already or
//! remains intentionally blocked. Never loosen one of these without replacing
//! it with a stricter authority-backed case.

use std::collections::HashMap;

use bridge_conventions::adapter::protocol_adapter::ConventionStrategy;
use bridge_conventions::fact_dsl::evaluate_facts;
use bridge_conventions::pipeline::observation::committed_step::{
    initial_negotiation, AuctionContext, ClaimRef, CommittedStep, CommittedStepStatus,
};
use bridge_conventions::pipeline::observation::negotiation_extractor::{
    apply_negotiation_actions, compute_kernel_delta,
};
use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::registry::{
    get_base_module_ids, get_module, get_system_config, spec_from_bundle,
};
use bridge_conventions::types::meaning::{BidMeaning, ConstraintDimension};
use bridge_conventions::types::spec_types::ConventionSpec;
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::{evaluate_hand_hcp, BidSuit, Call, Card, Hand, Rank, Seat, Suit};

#[derive(Clone, Copy)]
enum Target {
    Bundle(&'static str),
    Module(&'static str),
    Modules(&'static [&'static str]),
}

struct Canary {
    module: &'static str,
    target: Target,
    auction: &'static [&'static str],
    auction_meaning_ids: &'static [&'static str],
    auction_seats: &'static [Seat],
    hand_pbn: &'static str,
    user_seat: Seat,
    expected_call: &'static str,
    authority: &'static str,
    note: &'static str,
}

fn sayc_config() -> bridge_conventions::types::system_config::SystemConfig {
    get_system_config(BaseSystemId::Sayc)
}

fn build_strategy(target: Target) -> ConventionStrategy {
    let system_config = sayc_config();
    let base_module_ids: Vec<String> = get_base_module_ids(BaseSystemId::Sayc)
        .iter()
        .map(|id| (*id).to_string())
        .collect();

    match target {
        Target::Bundle(bundle_id) => {
            let spec =
                spec_from_bundle(bundle_id, &system_config, &base_module_ids, &HashMap::new())
                    .unwrap_or_else(|| panic!("bundle '{bundle_id}' should resolve"));
            ConventionStrategy::new(spec, vec![])
        }
        Target::Module(module_id) => {
            let module = get_module(module_id, BaseSystemId::Sayc)
                .cloned()
                .unwrap_or_else(|| panic!("module '{module_id}' should resolve"));
            let spec = ConventionSpec {
                id: format!("canary-{module_id}"),
                name: format!("Canary {module_id}"),
                modules: vec![module],
                system_config: Some(system_config),
            };
            ConventionStrategy::new(spec, vec![])
        }
        Target::Modules(module_ids) => {
            let modules: Vec<_> = module_ids
                .iter()
                .map(|id| {
                    get_module(id, BaseSystemId::Sayc)
                        .cloned()
                        .unwrap_or_else(|| panic!("module '{id}' should resolve"))
                })
                .collect();
            let spec = ConventionSpec {
                id: format!("canary-multi-{}", module_ids.join("-")),
                name: format!("Canary {}", module_ids.join("+")),
                modules,
                system_config: Some(system_config),
            };
            let _ = base_module_ids;
            ConventionStrategy::new(spec, vec![])
        }
    }
}

fn evaluate_hand(
    strategy: &ConventionStrategy,
    hand: &Hand,
) -> bridge_conventions::fact_dsl::types::EvaluatedFacts {
    let definitions = strategy
        .spec
        .modules
        .iter()
        .flat_map(|module| module.facts.definitions.iter().cloned())
        .collect::<Vec<_>>();
    let evaluation = evaluate_hand_hcp(hand);
    evaluate_facts(
        hand,
        &evaluation,
        &definitions,
        Some(&sayc_config()),
        None,
        None,
    )
}

fn parse_rank(rank: char) -> Rank {
    match rank {
        'A' => Rank::Ace,
        'K' => Rank::King,
        'Q' => Rank::Queen,
        'J' => Rank::Jack,
        'T' => Rank::Ten,
        '9' => Rank::Nine,
        '8' => Rank::Eight,
        '7' => Rank::Seven,
        '6' => Rank::Six,
        '5' => Rank::Five,
        '4' => Rank::Four,
        '3' => Rank::Three,
        '2' => Rank::Two,
        other => panic!("unknown rank '{other}'"),
    }
}

fn parse_hand_pbn(hand_pbn: &str) -> Hand {
    let suits = [
        (Suit::Spades, hand_pbn.split('.').nth(0).unwrap_or("")),
        (Suit::Hearts, hand_pbn.split('.').nth(1).unwrap_or("")),
        (Suit::Diamonds, hand_pbn.split('.').nth(2).unwrap_or("")),
        (Suit::Clubs, hand_pbn.split('.').nth(3).unwrap_or("")),
    ];

    let mut cards = Vec::new();
    for (suit, ranks) in suits {
        if ranks == "-" {
            continue;
        }
        for rank in ranks.chars() {
            cards.push(Card {
                suit,
                rank: parse_rank(rank),
            });
        }
    }

    assert_eq!(
        cards.len(),
        13,
        "hand '{hand_pbn}' should decode to 13 cards, got {}",
        cards.len()
    );
    Hand { cards }
}

fn format_call(call: &Call) -> String {
    match call {
        Call::Pass => "P".to_string(),
        Call::Double => "X".to_string(),
        Call::Redouble => "XX".to_string(),
        Call::Bid { level, strain } => {
            let strain = match strain {
                BidSuit::Clubs => "C",
                BidSuit::Diamonds => "D",
                BidSuit::Hearts => "H",
                BidSuit::Spades => "S",
                BidSuit::NoTrump => "NT",
            };
            format!("{level}{strain}")
        }
    }
}

fn find_surface<'a>(spec: &'a ConventionSpec, meaning_id: &str) -> (&'a str, &'a BidMeaning) {
    spec.modules
        .iter()
        .find_map(|module| {
            module.states.as_ref().and_then(|states| {
                states.iter().find_map(|state| {
                    state
                        .surfaces
                        .iter()
                        .find(|surface| surface.meaning_id == meaning_id)
                        .map(|surface| (module.module_id.as_str(), surface))
                })
            })
        })
        .unwrap_or_else(|| panic!("meaning '{meaning_id}' should exist in spec"))
}

fn build_context(strategy: &ConventionStrategy, canary: &Canary) -> AuctionContext {
    assert_eq!(
        canary.auction.len(),
        canary.auction_meaning_ids.len(),
        "auction call and meaning lists should align"
    );
    assert_eq!(
        canary.auction.len(),
        canary.auction_seats.len(),
        "auction call and seat lists should align"
    );

    let mut log = Vec::new();
    let mut state = initial_negotiation();

    for ((expected_call, meaning_id), actor) in canary
        .auction
        .iter()
        .zip(canary.auction_meaning_ids.iter())
        .zip(canary.auction_seats.iter())
    {
        let (module_id, surface) = find_surface(&strategy.spec, meaning_id);
        let call = surface.encoding.default_call.clone();
        assert_eq!(
            format_call(&call),
            *expected_call,
            "meaning '{meaning_id}' should encode to {}",
            expected_call
        );

        let public_actions = normalize_intent(&surface.source_intent);
        let next_state = apply_negotiation_actions(&state, &public_actions, *actor, &call);
        let negotiation_delta = compute_kernel_delta(&state, &next_state);
        state = next_state.clone();

        log.push(CommittedStep {
            actor: *actor,
            call,
            resolved_claim: Some(ClaimRef {
                module_id: module_id.to_string(),
                meaning_id: surface.meaning_id.clone(),
                semantic_class_id: surface.semantic_class_id.clone(),
                source_intent: surface.source_intent.clone(),
            }),
            public_actions,
            negotiation_delta,
            state_after: next_state,
            status: CommittedStepStatus::Resolved,
        });
    }

    AuctionContext { log }
}

fn run_canary(canary: &Canary) {
    use bridge_conventions::pipeline::observation::rule_interpreter::{
        collect_matching_claims, flatten_surfaces,
    };
    let strategy = build_strategy(canary.target);
    let hand = parse_hand_pbn(canary.hand_pbn);
    let facts = evaluate_hand(&strategy, &hand);
    let context = build_context(&strategy, canary);
    let inherited_dimensions: HashMap<String, Vec<ConstraintDimension>> = HashMap::new();

    let surface_results =
        collect_matching_claims(&strategy.spec.modules, &context, Some(canary.user_seat));
    let surfaces = flatten_surfaces(&surface_results);

    let (bid, evaluation) = strategy.suggest_from_surfaces(
        &surfaces,
        &surface_results,
        &context,
        &facts,
        &|_| true,
        &inherited_dimensions,
        Some(&hand),
        Some(&sayc_config()),
    );

    let actual = bid
        .as_ref()
        .map(|result| format_call(&result.call))
        .unwrap_or_else(|| "None".to_string());

    assert_eq!(
        actual,
        canary.expected_call,
        "\nmodule: {}\nauthority: {}\nnote: {}\nauction: {:?}\nhand: {}\nselected: {}\npipeline_selected: {:?}\n",
        canary.module,
        canary.authority,
        canary.note,
        canary.auction,
        canary.hand_pbn,
        actual,
        evaluation
            .pipeline_result
            .as_ref()
            .and_then(|result| result.selected.as_ref().map(|carrier| carrier.proposal().meaning_id.clone())),
    );
}

macro_rules! define_canary_test {
    ($fn_name:ident, $case:expr) => {
        #[test]
        fn $fn_name() {
            run_canary(&$case);
        }
    };
    (ignore $reason:literal, $fn_name:ident, $case:expr) => {
        #[test]
        #[ignore = $reason]
        fn $fn_name() {
            run_canary(&$case);
        }
    };
}

const STAYMAN_SHOW_HEARTS_ON_FOUR_FOUR: Canary = Canary {
    module: "stayman",
    target: Target::Bundle("stayman-bundle"),
    auction: &["1NT", "2C"],
    auction_meaning_ids: &["bridge:1nt-opening", "stayman:ask-major"],
    auction_seats: &[Seat::North, Seat::South],
    hand_pbn: "AQJ4.KQ72.A32.54",
    user_seat: Seat::North,
    expected_call: "2H",
    authority: "BridgeBum Stayman denial/show-major rules",
    note: "verify-stayman.md:27",
};

const STAYMAN_GF_HEARTS_AFTER_DENIAL: Canary = Canary {
    module: "stayman",
    target: Target::Bundle("stayman-bundle"),
    auction: &["1NT", "2C", "2D"],
    auction_meaning_ids: &[
        "bridge:1nt-opening",
        "stayman:ask-major",
        "stayman:deny-major",
    ],
    auction_seats: &[Seat::North, Seat::South, Seat::North],
    hand_pbn: "KQ97.AJ863.K4.72",
    user_seat: Seat::South,
    expected_call: "3H",
    authority: "BridgeBum Stayman continuation table: 3H/3S = 5-4 majors, game-forcing",
    note: "verify-stayman.md:19",
};

const WEAK_TWO_OPEN_HEARTS_WITH_GOOD_SUIT: Canary = Canary {
    module: "weak-twos",
    target: Target::Bundle("weak-twos-bundle"),
    auction: &[],
    auction_meaning_ids: &[],
    auction_seats: &[],
    hand_pbn: "983.AKJ984.Q3.42",
    user_seat: Seat::South,
    expected_call: "2H",
    authority: "Weak-two authority requires a good 6-card suit and weak opening range",
    note: "verify-weak-twos.md:14",
};

const WEAK_TWO_OGUST_WITHOUT_FIT: Canary = Canary {
    module: "weak-twos",
    target: Target::Bundle("weak-twos-bundle"),
    auction: &["2S"],
    auction_meaning_ids: &["weak-two:open-2s"],
    auction_seats: &[Seat::North],
    hand_pbn: "AQ.KQ92.KJ83.K42",
    user_seat: Seat::South,
    expected_call: "2NT",
    authority: "Weak-two/Ogust authority: 2NT asks strength and suit quality without requiring fit",
    note: "verify-weak-twos.md:23",
};

const JACOBY_SUPER_ACCEPT_HEARTS: Canary = Canary {
    module: "jacoby-transfers",
    target: Target::Bundle("jacoby-transfers-bundle"),
    auction: &["1NT", "2D"],
    auction_meaning_ids: &["bridge:1nt-opening", "transfer:to-hearts"],
    auction_seats: &[Seat::North, Seat::South],
    hand_pbn: "AQ.KQJ7.K83.Q742",
    user_seat: Seat::North,
    expected_call: "3H",
    authority: "Jacoby transfer super-accept: max 1NT with 4-card support jumps to 3M",
    note: "verify-jacoby-transfers.md:13",
};

const JACOBY_GAME_HEARTS_WITH_FIVE_CARD_MAJOR: Canary = Canary {
    module: "jacoby-transfers",
    target: Target::Bundle("jacoby-transfers-bundle"),
    auction: &["1NT", "2D", "2H"],
    auction_meaning_ids: &["bridge:1nt-opening", "transfer:to-hearts", "transfer:accept"],
    auction_seats: &[Seat::North, Seat::South, Seat::North],
    hand_pbn: "Q43.KQJ94.K74.32",
    user_seat: Seat::South,
    expected_call: "3NT",
    authority: "VERDICT 2026-04-15: Jacoby transfer 4M game-jump requires 6+ card major; 5-card major with 1NT-opposite game values routes to 3NT via nt-game-*.",
    note: "VERDICT 2026-04-15 tightened transfer:game-hearts / transfer:game-spades length from gte:5 to gte:6, moving balanced 5-card-major game hands to 3NT.",
};

const JACOBY_ACCEPT_INVITE_RAISE_SPADES: Canary = Canary {
    module: "jacoby-transfers",
    target: Target::Bundle("jacoby-transfers-bundle"),
    auction: &["1NT", "2H", "2S", "3S"],
    auction_meaning_ids: &[
        "bridge:1nt-opening",
        "transfer:to-spades",
        "transfer:accept-spades",
        "transfer:invite-raise-spades",
    ],
    auction_seats: &[Seat::North, Seat::South, Seat::North, Seat::South],
    hand_pbn: "AQ4.AKQ.K83.Q742",
    user_seat: Seat::North,
    expected_call: "4S",
    authority: "Jacoby transfer invite-raise continuations: opener accepts with a non-minimum hand",
    note: "verify-jacoby-transfers.md:14",
};

const DONT_FORCING_INQUIRY_AFTER_2C: Canary = Canary {
    module: "dont",
    target: Target::Bundle("dont-bundle"),
    auction: &["1NT", "2C"],
    auction_meaning_ids: &["dont:opponent-1nt", "dont:clubs-higher-2c"],
    auction_seats: &[Seat::East, Seat::South],
    hand_pbn: "AQ43.K72.QJ84.K4",
    user_seat: Seat::West,
    expected_call: "2NT",
    authority: "BridgeBum DONT: 2NT is the forcing artificial inquiry over 2C",
    note: "verify-dont.md:19",
};

const DONT_FORCING_INQUIRY_AFTER_2D: Canary = Canary {
    module: "dont",
    target: Target::Bundle("dont-bundle"),
    auction: &["1NT", "2D"],
    auction_meaning_ids: &["dont:opponent-1nt", "dont:diamonds-major-2d"],
    auction_seats: &[Seat::East, Seat::South],
    hand_pbn: "AQ4.K72.Q8.KJ432",
    user_seat: Seat::West,
    expected_call: "2NT",
    authority: "BridgeBum DONT: 2NT is the forcing artificial inquiry over 2D",
    note: "verify-dont.md:19",
};

const MICHAELS_PREEMPT_HEARTS: Canary = Canary {
    module: "michaels-unusual",
    target: Target::Bundle("michaels-unusual-bundle"),
    auction: &["1C", "2C"],
    auction_meaning_ids: &["michaels:opponent-1c", "michaels:cue-bid-1c-2c"],
    auction_seats: &[Seat::West, Seat::North],
    hand_pbn: "Q4.J9864.742.983",
    user_seat: Seat::South,
    expected_call: "3H",
    authority: "Michaels major-cue advance: direct 3M jump is preemptive, not invitational",
    note: "verify-michaels-unusual.md:25",
};

const NEGATIVE_DOUBLE_AFTER_1C_2D: Canary = Canary {
    module: "negative-doubles",
    target: Target::Bundle("negative-doubles-bundle"),
    auction: &["1C", "2D"],
    auction_meaning_ids: &["bridge:1c-opening", "negdbl:opp-overcall-2d-after-1c"],
    auction_seats: &[Seat::West, Seat::North],
    hand_pbn: "AQ84.K742.43.872",
    user_seat: Seat::East,
    expected_call: "X",
    authority:
        "Larry Cohen / BridgeBum negative doubles through 2S: 1C-(2D)-X shows the unbid majors",
    note: "verify-negative-doubles.md:24",
};

const NEGATIVE_DOUBLE_AFTER_1H_2S: Canary = Canary {
    module: "negative-doubles",
    target: Target::Bundle("negative-doubles-bundle"),
    auction: &["1H", "2S"],
    auction_meaning_ids: &["bridge:1h-opening", "negdbl:opp-overcall-2s-after-1h"],
    auction_seats: &[Seat::West, Seat::North],
    hand_pbn: "A42.K3.QJ82.Q742",
    user_seat: Seat::East,
    expected_call: "X",
    authority: "Larry Cohen / BridgeBum negative doubles through 2S: 1H-(2S)-X shows values without heart support",
    note: "verify-negative-doubles.md:29",
};

const STRONG_2C_PASS_OVER_2NT_REBID: Canary = Canary {
    module: "strong-2c",
    target: Target::Bundle("strong-2c-bundle"),
    auction: &["2C", "2D", "2NT"],
    auction_meaning_ids: &[
        "strong-2c:open-2c",
        "strong-2c:waiting-2d",
        "strong-2c:rebid-2nt",
    ],
    auction_seats: &[Seat::North, Seat::South, Seat::North],
    hand_pbn: "J42.743.9652.874",
    user_seat: Seat::South,
    expected_call: "P",
    authority: "Strong 2C over 2NT rebid: pass is only for the truly bust 0-2 HCP hand",
    note: "correctness-fixes-summary.md:46",
};

const STRONG_2C_SECOND_NEGATIVE_3C: Canary = Canary {
    module: "strong-2c",
    target: Target::Bundle("strong-2c-bundle"),
    auction: &["2C", "2D", "2H"],
    auction_meaning_ids: &[
        "strong-2c:open-2c",
        "strong-2c:waiting-2d",
        "strong-2c:rebid-2h",
    ],
    auction_seats: &[Seat::North, Seat::South, Seat::North],
    hand_pbn: "742.653.9842.873",
    user_seat: Seat::South,
    expected_call: "3C",
    authority: "Strong 2C after suit rebid: second negative should use the cheapest minor",
    note: "verify-strong-2c.md:17",
};

const STRONG_2C_STAYMAN_OVER_2NT: Canary = Canary {
    module: "strong-2c",
    target: Target::Bundle("strong-2c-bundle"),
    auction: &["2C", "2D", "2NT"],
    auction_meaning_ids: &[
        "strong-2c:open-2c",
        "strong-2c:waiting-2d",
        "strong-2c:rebid-2nt",
    ],
    auction_seats: &[Seat::North, Seat::South, Seat::North],
    hand_pbn: "AQ42.K872.43.872",
    user_seat: Seat::South,
    expected_call: "3C",
    authority: "Strong 2C over 2NT rebid: standard NT machinery means Stayman is on",
    note: "verify-strong-2c.md:18",
};

const NMF_RESPONDER_2C_OVER_1H_BRANCH: Canary = Canary {
    module: "new-minor-forcing",
    target: Target::Bundle("nmf-bundle"),
    auction: &["1H", "1S", "1NT"],
    auction_meaning_ids: &[
        "nmf:partner-opens-1h",
        "nmf:responder-1s-over-1h",
        "nmf:opener-1nt-rebid-after-1h-1s",
    ],
    auction_seats: &[Seat::West, Seat::East, Seat::West],
    hand_pbn: "AQJ97.K72.Q43.72",
    user_seat: Seat::East,
    expected_call: "2C",
    authority: "BridgeBum NMF: 1H-1S-1NT is a primary NMF branch and responder asks with 2C",
    note: "author-missing-surfaces-round2.md:31",
};

const SMOLEN_DIRECT_FOUR_SPADES: Canary = Canary {
    module: "smolen",
    target: Target::Bundle("nt-bundle"),
    auction: &["1NT", "2C", "2D", "3H"],
    auction_meaning_ids: &[
        "bridge:1nt-opening",
        "stayman:ask-major",
        "stayman:deny-major",
        "smolen:bid-short-hearts",
    ],
    auction_seats: &[Seat::West, Seat::East, Seat::West, Seat::East],
    hand_pbn: "AQ3.KQ7.A32.Q742",
    user_seat: Seat::West,
    expected_call: "4S",
    authority:
        "Smolen: opener with 3-card support places the contract directly in responder's long major",
    note: "verify-smolen.md:11",
};

const BERGEN_SPLINTER_RELAY_HEARTS: Canary = Canary {
    module: "bergen",
    target: Target::Bundle("bergen-bundle"),
    auction: &["1H", "3S"],
    auction_meaning_ids: &["bridge:1h-opening", "bergen:splinter-hearts"],
    auction_seats: &[Seat::West, Seat::East],
    hand_pbn: "AQ4.AKJ72.K3.742",
    user_seat: Seat::West,
    expected_call: "3NT",
    authority: "BridgeBum Bergen ambiguous splinter: opener relays with 3NT over 3S",
    note: "verify-bergen.md:29",
};

const STRONG_2C_UNBALANCED_PLAYING_TRICKS: Canary = Canary {
    module: "strong-2c",
    target: Target::Bundle("strong-2c-bundle"),
    auction: &[],
    auction_meaning_ids: &[],
    auction_seats: &[],
    hand_pbn: "AKQJ876.AK3.4.32",
    user_seat: Seat::South,
    expected_call: "2C",
    authority: "Classic Goren / Wikipedia strong-2C: an unbalanced 17-HCP hand with 9 playing tricks qualifies even though HCP are below 22",
    note: "Phase plan: Strong 2C playing-tricks qualifier",
};

const BLACKWOOD_ASK_KINGS_AFTER_FOUR_ACES: Canary = Canary {
    module: "blackwood",
    target: Target::Modules(&["natural-bids", "blackwood"]),
    auction: &["1NT", "4NT", "5C"],
    auction_meaning_ids: &[
        "bridge:1nt-opening",
        "blackwood:ask-aces",
        "blackwood:response-0-aces",
    ],
    auction_seats: &[Seat::South, Seat::North, Seat::South],
    hand_pbn: "AKQ.AKQ.AKQJ.AK2",
    user_seat: Seat::North,
    expected_call: "5NT",
    authority: "BridgeBum / SAYC Blackwood: ask for kings only after all aces are accounted for",
    note: "verify-blackwood.md:25",
};

define_canary_test!(
    stayman_show_hearts_on_four_four,
    STAYMAN_SHOW_HEARTS_ON_FOUR_FOUR
);
define_canary_test!(
    stayman_gf_hearts_after_denial,
    STAYMAN_GF_HEARTS_AFTER_DENIAL
);
define_canary_test!(
    weak_two_open_hearts_with_good_suit,
    WEAK_TWO_OPEN_HEARTS_WITH_GOOD_SUIT
);
define_canary_test!(weak_two_ogust_without_fit, WEAK_TWO_OGUST_WITHOUT_FIT);
define_canary_test!(jacoby_super_accept_hearts, JACOBY_SUPER_ACCEPT_HEARTS);
define_canary_test!(
    jacoby_game_hearts_with_five_card_major,
    JACOBY_GAME_HEARTS_WITH_FIVE_CARD_MAJOR
);
define_canary_test!(
    jacoby_accept_invite_raise_spades,
    JACOBY_ACCEPT_INVITE_RAISE_SPADES
);
define_canary_test!(dont_forcing_inquiry_after_2c, DONT_FORCING_INQUIRY_AFTER_2C);
define_canary_test!(dont_forcing_inquiry_after_2d, DONT_FORCING_INQUIRY_AFTER_2D);
define_canary_test!(
    ignore "post-2026-04-17 michaels/Unusual 2NT scope fix: advancer 2H preferred-suit surface outranks 3H preempt; preemptive 3M jump encoding needs re-author",
    michaels_preempt_hearts,
    MICHAELS_PREEMPT_HEARTS
);
define_canary_test!(negative_double_after_1c_2d, NEGATIVE_DOUBLE_AFTER_1C_2D);
define_canary_test!(negative_double_after_1h_2s, NEGATIVE_DOUBLE_AFTER_1H_2S);
define_canary_test!(strong_2c_pass_over_2nt_rebid, STRONG_2C_PASS_OVER_2NT_REBID);
define_canary_test!(strong_2c_second_negative_3c, STRONG_2C_SECOND_NEGATIVE_3C);
define_canary_test!(
    ignore "post-2026-04-17 strong-2c scope fix: Stayman continuations moved out of strong-2c and delegate_to stayman; cross-module delegate resolution on single-module bundle is not yet wired",
    strong_2c_stayman_over_2nt,
    STRONG_2C_STAYMAN_OVER_2NT
);
define_canary_test!(
    nmf_responder_2c_over_1h_branch,
    NMF_RESPONDER_2C_OVER_1H_BRANCH
);
define_canary_test!(smolen_direct_four_spades, SMOLEN_DIRECT_FOUR_SPADES);
define_canary_test!(bergen_splinter_relay_hearts, BERGEN_SPLINTER_RELAY_HEARTS);
define_canary_test!(
    blackwood_ask_kings_after_four_aces,
    BLACKWOOD_ASK_KINGS_AFTER_FOUR_ACES
);
define_canary_test!(
    strong_2c_unbalanced_playing_tricks,
    STRONG_2C_UNBALANCED_PLAYING_TRICKS
);
