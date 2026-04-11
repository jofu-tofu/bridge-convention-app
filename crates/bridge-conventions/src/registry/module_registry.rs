//! Module registry — lookup individual convention modules by ID.
//!
//! Modules are pre-baked as JSON and embedded via `include_str!()`.
//! Currently SAYC-only; multi-system support will add per-system variants.

use std::collections::HashMap;
use std::sync::OnceLock;

use bridge_engine::types::{BidSuit, Call};

use crate::types::authored_text::{BidName, BidSummary, TeachingLabel};
use crate::types::bid_action::{BidActionType, BidSuitName, ObsSuit};
use crate::types::meaning::{
    AuthoredRankingMetadata, BidEncoding, BidMeaning, BidMeaningClause, ConstraintValue,
    Disclosure, FactOperator, RecommendationBand, SourceIntent,
};
use crate::types::module_types::ConventionModule;
use crate::types::rule_types::{
    ObsPattern, ObsPatternAct, PhaseRef, RouteExpr, StateEntry, TurnRole,
};
use crate::types::system_config::BaseSystemId;

/// All registered module IDs in definition order.
const MODULE_IDS: &[&str] = &[
    "natural-bids",
    "stayman",
    "stayman-garbage",
    "jacoby-transfers",
    "jacoby-4way",
    "smolen",
    "bergen",
    "dont",
    "weak-twos",
    "blackwood",
    "michaels-unusual",
    "strong-2c",
    "negative-doubles",
    "new-minor-forcing",
];

/// Base module IDs merged into every spec (strategy layer).
/// Mirrors TS `DEFAULT_BASE_MODULE_IDS` in system-registry.ts.
pub const BASE_MODULE_IDS: &[&str] = &["natural-bids", "stayman", "jacoby-transfers", "blackwood"];

// Embedded module JSON fixtures (SAYC)
const NATURAL_BIDS_JSON: &str = include_str!("../../fixtures/modules/natural-bids.json");
const STAYMAN_JSON: &str = include_str!("../../fixtures/modules/stayman.json");
const JACOBY_TRANSFERS_JSON: &str = include_str!("../../fixtures/modules/jacoby-transfers.json");
const SMOLEN_JSON: &str = include_str!("../../fixtures/modules/smolen.json");
const BERGEN_JSON: &str = include_str!("../../fixtures/modules/bergen.json");
const DONT_JSON: &str = include_str!("../../fixtures/modules/dont.json");
const WEAK_TWOS_JSON: &str = include_str!("../../fixtures/modules/weak-twos.json");
const BLACKWOOD_JSON: &str = include_str!("../../fixtures/modules/blackwood.json");
const MICHAELS_UNUSUAL_JSON: &str = include_str!("../../fixtures/modules/michaels-unusual.json");
const STAYMAN_GARBAGE_JSON: &str = include_str!("../../fixtures/modules/stayman-garbage.json");
const JACOBY_4WAY_JSON: &str = include_str!("../../fixtures/modules/jacoby-4way.json");
const STRONG_2C_JSON: &str = include_str!("../../fixtures/modules/strong-2c.json");
const NEGATIVE_DOUBLES_JSON: &str = include_str!("../../fixtures/modules/negative-doubles.json");
const NEW_MINOR_FORCING_JSON: &str = include_str!("../../fixtures/modules/new-minor-forcing.json");

fn json_for_module(id: &str) -> Option<&'static str> {
    match id {
        "natural-bids" => Some(NATURAL_BIDS_JSON),
        "stayman" => Some(STAYMAN_JSON),
        "stayman-garbage" => Some(STAYMAN_GARBAGE_JSON),
        "jacoby-transfers" => Some(JACOBY_TRANSFERS_JSON),
        "jacoby-4way" => Some(JACOBY_4WAY_JSON),
        "smolen" => Some(SMOLEN_JSON),
        "bergen" => Some(BERGEN_JSON),
        "dont" => Some(DONT_JSON),
        "weak-twos" => Some(WEAK_TWOS_JSON),
        "blackwood" => Some(BLACKWOOD_JSON),
        "michaels-unusual" => Some(MICHAELS_UNUSUAL_JSON),
        "strong-2c" => Some(STRONG_2C_JSON),
        "negative-doubles" => Some(NEGATIVE_DOUBLES_JSON),
        "new-minor-forcing" => Some(NEW_MINOR_FORCING_JSON),
        _ => None,
    }
}

#[derive(Clone)]
struct NegDblShownRoute {
    suit: &'static str,
    simple: Call,
    jump: Call,
    game: Call,
}

#[derive(Clone)]
struct NegDblOpenerRoute {
    open: &'static str,
    overcall: &'static str,
    shown: Vec<NegDblShownRoute>,
    own_simple: Call,
    own_jump: Call,
    nt_min: Call,
    nt_med: Call,
    nt_max: Call,
    cue: Call,
}

fn call_bid(level: u8, strain: BidSuit) -> Call {
    Call::Bid { level, strain }
}

fn suit_code(suit: &str) -> &'static str {
    match suit {
        "clubs" => "C",
        "diamonds" => "D",
        "hearts" => "H",
        "spades" => "S",
        _ => panic!("unknown suit '{}'", suit),
    }
}

fn title_case(suit: &str) -> &'static str {
    match suit {
        "clubs" => "Clubs",
        "diamonds" => "Diamonds",
        "hearts" => "Hearts",
        "spades" => "Spades",
        _ => panic!("unknown suit '{}'", suit),
    }
}

fn obs_suit(suit: &str) -> ObsSuit {
    match suit {
        "clubs" => ObsSuit::Clubs,
        "diamonds" => ObsSuit::Diamonds,
        "hearts" => ObsSuit::Hearts,
        "spades" => ObsSuit::Spades,
        _ => panic!("unknown suit '{}'", suit),
    }
}

fn bid_suit_name(suit: &str) -> BidSuitName {
    match suit {
        "clubs" => BidSuitName::Clubs,
        "diamonds" => BidSuitName::Diamonds,
        "hearts" => BidSuitName::Hearts,
        "spades" => BidSuitName::Spades,
        _ => panic!("unknown suit '{}'", suit),
    }
}

fn params_with_suit(suit: &str) -> HashMap<String, serde_json::Value> {
    HashMap::from([(
        "suit".to_string(),
        serde_json::Value::String(suit.to_string()),
    )])
}

fn clause(
    fact_id: impl Into<String>,
    operator: FactOperator,
    value: ConstraintValue,
    clause_id: impl Into<String>,
    description: impl Into<String>,
) -> BidMeaningClause {
    BidMeaningClause {
        fact_id: fact_id.into(),
        operator,
        value,
        clause_id: Some(clause_id.into()),
        description: Some(description.into()),
        rationale: None,
        is_public: Some(true),
    }
}

fn hcp_min(min: i64) -> BidMeaningClause {
    clause(
        "hand.hcp",
        FactOperator::Gte,
        ConstraintValue::int(min),
        format!("hand.hcp:gte:{min}"),
        format!("{min}+ HCP"),
    )
}

fn hcp_max(max: i64) -> BidMeaningClause {
    clause(
        "hand.hcp",
        FactOperator::Lte,
        ConstraintValue::int(max),
        format!("hand.hcp:lte:{max}"),
        format!("At most {max} HCP"),
    )
}

fn suit_length_min(suit: &str, min: i64) -> BidMeaningClause {
    clause(
        format!("hand.suitLength.{suit}"),
        FactOperator::Gte,
        ConstraintValue::int(min),
        format!("hand.suitLength.{suit}:gte:{min}"),
        format!("{min}+ {suit}"),
    )
}

fn ranking(
    recommendation_band: RecommendationBand,
    declaration_order: i32,
) -> AuthoredRankingMetadata {
    AuthoredRankingMetadata {
        recommendation_band,
        module_precedence: Some(0),
        declaration_order,
    }
}

fn teaching_label(name: impl Into<String>, summary: impl Into<String>) -> TeachingLabel {
    TeachingLabel {
        name: BidName::new(name),
        summary: BidSummary::new(summary),
    }
}

fn meaning(
    meaning_id: String,
    semantic_class_id: &str,
    call: Call,
    clauses: Vec<BidMeaningClause>,
    ranking: AuthoredRankingMetadata,
    intent_type: &str,
    params: HashMap<String, serde_json::Value>,
    label: TeachingLabel,
) -> BidMeaning {
    BidMeaning {
        meaning_id,
        semantic_class_id: semantic_class_id.to_string(),
        module_id: Some("negative-doubles".to_string()),
        encoding: BidEncoding {
            default_call: call,
            alternate_encodings: None,
        },
        clauses,
        ranking,
        source_intent: SourceIntent {
            intent_type: intent_type.to_string(),
            params,
        },
        disclosure: Disclosure::Natural,
        teaching_label: label,
        surface_bindings: None,
    }
}

fn negdbl_route_expr(open: &str, overcall: &str) -> RouteExpr {
    RouteExpr::Subseq {
        steps: vec![
            ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Open),
                feature: None,
                suit: None,
                strain: Some(bid_suit_name(open)),
                strength: None,
                actor: None,
            },
            ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Overcall),
                feature: None,
                suit: Some(obs_suit(overcall)),
                strain: None,
                strength: None,
                actor: None,
            },
            ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Double),
                feature: None,
                suit: None,
                strain: None,
                strength: None,
                actor: None,
            },
        ],
    }
}

fn negative_doubles_opener_routes() -> Vec<NegDblOpenerRoute> {
    vec![
        NegDblOpenerRoute {
            open: "clubs",
            overcall: "diamonds",
            shown: vec![
                NegDblShownRoute {
                    suit: "hearts",
                    simple: call_bid(1, BidSuit::Hearts),
                    jump: call_bid(2, BidSuit::Hearts),
                    game: call_bid(4, BidSuit::Hearts),
                },
                NegDblShownRoute {
                    suit: "spades",
                    simple: call_bid(1, BidSuit::Spades),
                    jump: call_bid(2, BidSuit::Spades),
                    game: call_bid(4, BidSuit::Spades),
                },
            ],
            own_simple: call_bid(2, BidSuit::Clubs),
            own_jump: call_bid(3, BidSuit::Clubs),
            nt_min: call_bid(1, BidSuit::NoTrump),
            nt_med: call_bid(2, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(2, BidSuit::Diamonds),
        },
        NegDblOpenerRoute {
            open: "clubs",
            overcall: "hearts",
            shown: vec![NegDblShownRoute {
                suit: "spades",
                simple: call_bid(1, BidSuit::Spades),
                jump: call_bid(2, BidSuit::Spades),
                game: call_bid(4, BidSuit::Spades),
            }],
            own_simple: call_bid(2, BidSuit::Clubs),
            own_jump: call_bid(3, BidSuit::Clubs),
            nt_min: call_bid(1, BidSuit::NoTrump),
            nt_med: call_bid(2, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(2, BidSuit::Hearts),
        },
        NegDblOpenerRoute {
            open: "clubs",
            overcall: "spades",
            shown: vec![NegDblShownRoute {
                suit: "hearts",
                simple: call_bid(2, BidSuit::Hearts),
                jump: call_bid(3, BidSuit::Hearts),
                game: call_bid(4, BidSuit::Hearts),
            }],
            own_simple: call_bid(2, BidSuit::Clubs),
            own_jump: call_bid(3, BidSuit::Clubs),
            nt_min: call_bid(1, BidSuit::NoTrump),
            nt_med: call_bid(2, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(2, BidSuit::Spades),
        },
        NegDblOpenerRoute {
            open: "diamonds",
            overcall: "hearts",
            shown: vec![NegDblShownRoute {
                suit: "spades",
                simple: call_bid(1, BidSuit::Spades),
                jump: call_bid(2, BidSuit::Spades),
                game: call_bid(4, BidSuit::Spades),
            }],
            own_simple: call_bid(2, BidSuit::Diamonds),
            own_jump: call_bid(3, BidSuit::Diamonds),
            nt_min: call_bid(1, BidSuit::NoTrump),
            nt_med: call_bid(2, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(2, BidSuit::Hearts),
        },
        NegDblOpenerRoute {
            open: "diamonds",
            overcall: "spades",
            shown: vec![NegDblShownRoute {
                suit: "hearts",
                simple: call_bid(2, BidSuit::Hearts),
                jump: call_bid(3, BidSuit::Hearts),
                game: call_bid(4, BidSuit::Hearts),
            }],
            own_simple: call_bid(2, BidSuit::Diamonds),
            own_jump: call_bid(3, BidSuit::Diamonds),
            nt_min: call_bid(1, BidSuit::NoTrump),
            nt_med: call_bid(2, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(2, BidSuit::Spades),
        },
        // 1D-(2C)-X: 2-level overcall after minor opening (unambiguous route)
        NegDblOpenerRoute {
            open: "diamonds",
            overcall: "clubs",
            shown: vec![
                NegDblShownRoute {
                    suit: "hearts",
                    simple: call_bid(2, BidSuit::Hearts),
                    jump: call_bid(3, BidSuit::Hearts),
                    game: call_bid(4, BidSuit::Hearts),
                },
                NegDblShownRoute {
                    suit: "spades",
                    simple: call_bid(2, BidSuit::Spades),
                    jump: call_bid(3, BidSuit::Spades),
                    game: call_bid(4, BidSuit::Spades),
                },
            ],
            own_simple: call_bid(2, BidSuit::Diamonds),
            own_jump: call_bid(3, BidSuit::Diamonds),
            nt_min: call_bid(2, BidSuit::NoTrump),
            nt_med: call_bid(3, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(3, BidSuit::Clubs),
        },
        NegDblOpenerRoute {
            open: "hearts",
            overcall: "spades",
            shown: vec![
                NegDblShownRoute {
                    suit: "clubs",
                    simple: call_bid(2, BidSuit::Clubs),
                    jump: call_bid(3, BidSuit::Clubs),
                    game: call_bid(5, BidSuit::Clubs),
                },
                NegDblShownRoute {
                    suit: "diamonds",
                    simple: call_bid(2, BidSuit::Diamonds),
                    jump: call_bid(3, BidSuit::Diamonds),
                    game: call_bid(5, BidSuit::Diamonds),
                },
            ],
            own_simple: call_bid(2, BidSuit::Hearts),
            own_jump: call_bid(3, BidSuit::Hearts),
            nt_min: call_bid(1, BidSuit::NoTrump),
            nt_med: call_bid(2, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(2, BidSuit::Spades),
        },
        NegDblOpenerRoute {
            open: "hearts",
            overcall: "clubs",
            shown: vec![
                NegDblShownRoute {
                    suit: "spades",
                    simple: call_bid(2, BidSuit::Spades),
                    jump: call_bid(3, BidSuit::Spades),
                    game: call_bid(4, BidSuit::Spades),
                },
                NegDblShownRoute {
                    suit: "diamonds",
                    simple: call_bid(2, BidSuit::Diamonds),
                    jump: call_bid(3, BidSuit::Diamonds),
                    game: call_bid(5, BidSuit::Diamonds),
                },
            ],
            own_simple: call_bid(2, BidSuit::Hearts),
            own_jump: call_bid(3, BidSuit::Hearts),
            nt_min: call_bid(2, BidSuit::NoTrump),
            nt_med: call_bid(3, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(3, BidSuit::Clubs),
        },
        NegDblOpenerRoute {
            open: "hearts",
            overcall: "diamonds",
            shown: vec![NegDblShownRoute {
                suit: "spades",
                simple: call_bid(2, BidSuit::Spades),
                jump: call_bid(3, BidSuit::Spades),
                game: call_bid(4, BidSuit::Spades),
            }],
            own_simple: call_bid(2, BidSuit::Hearts),
            own_jump: call_bid(3, BidSuit::Hearts),
            nt_min: call_bid(2, BidSuit::NoTrump),
            nt_med: call_bid(3, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(3, BidSuit::Diamonds),
        },
        NegDblOpenerRoute {
            open: "spades",
            overcall: "clubs",
            shown: vec![
                NegDblShownRoute {
                    suit: "hearts",
                    simple: call_bid(2, BidSuit::Hearts),
                    jump: call_bid(3, BidSuit::Hearts),
                    game: call_bid(4, BidSuit::Hearts),
                },
                NegDblShownRoute {
                    suit: "diamonds",
                    simple: call_bid(2, BidSuit::Diamonds),
                    jump: call_bid(3, BidSuit::Diamonds),
                    game: call_bid(5, BidSuit::Diamonds),
                },
            ],
            own_simple: call_bid(2, BidSuit::Spades),
            own_jump: call_bid(3, BidSuit::Spades),
            nt_min: call_bid(2, BidSuit::NoTrump),
            nt_med: call_bid(3, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(3, BidSuit::Clubs),
        },
        NegDblOpenerRoute {
            open: "spades",
            overcall: "diamonds",
            shown: vec![NegDblShownRoute {
                suit: "hearts",
                simple: call_bid(2, BidSuit::Hearts),
                jump: call_bid(3, BidSuit::Hearts),
                game: call_bid(4, BidSuit::Hearts),
            }],
            own_simple: call_bid(2, BidSuit::Spades),
            own_jump: call_bid(3, BidSuit::Spades),
            nt_min: call_bid(2, BidSuit::NoTrump),
            nt_med: call_bid(3, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(3, BidSuit::Diamonds),
        },
        NegDblOpenerRoute {
            open: "spades",
            overcall: "hearts",
            shown: vec![
                NegDblShownRoute {
                    suit: "clubs",
                    simple: call_bid(3, BidSuit::Clubs),
                    jump: call_bid(4, BidSuit::Clubs),
                    game: call_bid(5, BidSuit::Clubs),
                },
                NegDblShownRoute {
                    suit: "diamonds",
                    simple: call_bid(3, BidSuit::Diamonds),
                    jump: call_bid(4, BidSuit::Diamonds),
                    game: call_bid(5, BidSuit::Diamonds),
                },
            ],
            own_simple: call_bid(2, BidSuit::Spades),
            own_jump: call_bid(3, BidSuit::Spades),
            nt_min: call_bid(2, BidSuit::NoTrump),
            nt_med: call_bid(3, BidSuit::NoTrump),
            nt_max: call_bid(3, BidSuit::NoTrump),
            cue: call_bid(3, BidSuit::Hearts),
        },
    ]
}

fn build_negative_doubles_after_negdbl_states() -> Vec<StateEntry> {
    negative_doubles_opener_routes()
        .into_iter()
        .map(|route| {
            let mut surfaces = Vec::new();
            let open_code = suit_code(route.open);
            let overcall_code = suit_code(route.overcall);
            let open_title = title_case(route.open);

            for shown in &route.shown {
                let shown_title = title_case(shown.suit);

                surfaces.push(meaning(
                    format!(
                        "negdbl:opener-simple-{}-after-1{}-1{}",
                        shown.suit, open_code, overcall_code
                    ),
                    "negdbl:opener-raise",
                    shown.simple.clone(),
                    vec![suit_length_min(shown.suit, 3), hcp_min(12), hcp_max(15)],
                    ranking(RecommendationBand::Should, surfaces.len() as i32),
                    "NegDblOpenerRaise",
                    params_with_suit(shown.suit),
                    teaching_label(
                        format!("Support {shown_title}"),
                        format!(
                            "Show a 3+ card fit for responder's implied {} suit",
                            shown.suit
                        ),
                    ),
                ));
                surfaces.push(meaning(
                    format!(
                        "negdbl:opener-jump-{}-after-1{}-1{}",
                        shown.suit, open_code, overcall_code
                    ),
                    "negdbl:opener-raise",
                    shown.jump.clone(),
                    vec![suit_length_min(shown.suit, 4), hcp_min(16), hcp_max(18)],
                    ranking(RecommendationBand::Should, surfaces.len() as i32),
                    "NegDblOpenerJumpRaise",
                    params_with_suit(shown.suit),
                    teaching_label(
                        format!("Jump support {shown_title}"),
                        format!(
                            "Jump with extra values and a 3+ card fit for responder's implied {} suit",
                            shown.suit
                        ),
                    ),
                ));
                surfaces.push(meaning(
                    format!(
                        "negdbl:opener-game-{}-after-1{}-1{}",
                        shown.suit, open_code, overcall_code
                    ),
                    "negdbl:opener-raise",
                    shown.game.clone(),
                    vec![suit_length_min(shown.suit, 3), hcp_min(19)],
                    ranking(RecommendationBand::Should, surfaces.len() as i32),
                    "NegDblOpenerJumpRaise",
                    params_with_suit(shown.suit),
                    teaching_label(
                        format!("Bid game in {shown_title}"),
                        format!(
                            "Bid game with maximum values and a 3+ card fit for responder's implied {} suit",
                            shown.suit
                        ),
                    ),
                ));
            }

            surfaces.push(meaning(
                format!(
                    "negdbl:opener-simple-rebid-{}-after-1{}-1{}",
                    route.open, open_code, overcall_code
                ),
                "negdbl:opener-rebid",
                route.own_simple.clone(),
                vec![suit_length_min(route.open, 6), hcp_min(12), hcp_max(15)],
                ranking(RecommendationBand::Should, surfaces.len() as i32),
                "NegDblOpenerRebid",
                params_with_suit(route.open),
                teaching_label(
                    format!("Rebid {open_title}"),
                    format!("Rebid opener's 6+ card {} suit with minimum values", route.open),
                ),
            ));
            surfaces.push(meaning(
                format!(
                    "negdbl:opener-jump-rebid-{}-after-1{}-1{}",
                    route.open, open_code, overcall_code
                ),
                "negdbl:opener-rebid",
                route.own_jump.clone(),
                vec![suit_length_min(route.open, 6), hcp_min(16), hcp_max(18)],
                ranking(RecommendationBand::Should, surfaces.len() as i32),
                "NegDblOpenerRebid",
                params_with_suit(route.open),
                teaching_label(
                    format!("Jump rebid {open_title}"),
                    format!("Jump rebid opener's 6+ card {} suit with extra values", route.open),
                ),
            ));
            surfaces.push(meaning(
                format!("negdbl:opener-minimum-nt-after-1{}-1{}", open_code, overcall_code),
                "negdbl:opener-nt",
                route.nt_min.clone(),
                vec![hcp_min(12), hcp_max(15)],
                ranking(RecommendationBand::May, surfaces.len() as i32),
                "NegDblOpenerNT",
                HashMap::new(),
                teaching_label(
                    format!(
                        "{}NT rebid",
                        match &route.nt_min {
                            Call::Bid { level, .. } => *level,
                            _ => 1,
                        }
                    ),
                    "Balanced hand with no clear suit fit",
                ),
            ));
            surfaces.push(meaning(
                format!("negdbl:opener-medium-nt-after-1{}-1{}", open_code, overcall_code),
                "negdbl:opener-nt",
                route.nt_med.clone(),
                vec![hcp_min(16), hcp_max(18)],
                ranking(RecommendationBand::May, surfaces.len() as i32),
                "NegDblOpenerNT",
                HashMap::new(),
                teaching_label(
                    format!(
                        "{}NT rebid",
                        match &route.nt_med {
                            Call::Bid { level, .. } => *level,
                            _ => 1,
                        }
                    ),
                    "Balanced hand with no clear suit fit",
                ),
            ));
            surfaces.push(meaning(
                format!("negdbl:opener-maximum-nt-after-1{}-1{}", open_code, overcall_code),
                "negdbl:opener-nt",
                route.nt_max.clone(),
                vec![hcp_min(19)],
                ranking(RecommendationBand::May, surfaces.len() as i32),
                "NegDblOpenerNT",
                HashMap::new(),
                teaching_label(
                    format!(
                        "{}NT rebid",
                        match &route.nt_max {
                            Call::Bid { level, .. } => *level,
                            _ => 1,
                        }
                    ),
                    "Balanced maximum with no clear suit fit",
                ),
            ));
            surfaces.push(meaning(
                format!(
                    "negdbl:opener-cue-{}-after-1{}-1{}",
                    route.overcall, open_code, overcall_code
                ),
                "negdbl:opener-cue",
                route.cue.clone(),
                vec![hcp_min(19)],
                ranking(RecommendationBand::May, surfaces.len() as i32),
                "NegDblOpenerNewSuit",
                params_with_suit(route.overcall),
                teaching_label(
                    format!("Cue bid {}", title_case(route.overcall)),
                    "Show maximum strength with a forcing cue bid when no direct placement is clear",
                ),
            ));
            surfaces.push(meaning(
                format!("negdbl:opener-pass-after-1{}-1{}", open_code, overcall_code),
                "negdbl:opener-pass",
                Call::Pass,
                vec![hcp_max(15)],
                ranking(RecommendationBand::May, surfaces.len() as i32),
                "NegDblOpenerPass",
                HashMap::new(),
                teaching_label("Pass", "Minimum hand with no clear fit or descriptive rebid"),
            ));

            StateEntry {
                phase: PhaseRef::Single("after-neg-dbl".to_string()),
                turn: Some(TurnRole::Opener),
                kernel: None,
                route: Some(negdbl_route_expr(route.open, route.overcall)),
                negotiation_delta: None,
                surfaces,
            }
        })
        .collect()
}

fn patch_negative_doubles_module(module: &mut ConventionModule) {
    let Some(states) = module.states.as_mut() else {
        return;
    };

    states.retain(|state| {
        !matches!(
            (&state.phase, state.turn),
            (PhaseRef::Single(phase), Some(TurnRole::Opener)) if phase == "after-neg-dbl"
        )
    });
    states.extend(build_negative_doubles_after_negdbl_states());
}

/// Lazily deserialized module cache keyed by module ID.
/// Currently SAYC-only; when multi-system is added, key becomes (id, system).
static MODULE_CACHE: OnceLock<HashMap<String, ConventionModule>> = OnceLock::new();

fn module_cache() -> &'static HashMap<String, ConventionModule> {
    MODULE_CACHE.get_or_init(|| {
        let mut map = HashMap::new();
        for &id in MODULE_IDS {
            if let Some(json) = json_for_module(id) {
                match serde_json::from_str::<ConventionModule>(json) {
                    Ok(mut module) => {
                        if id == "negative-doubles" {
                            patch_negative_doubles_module(&mut module);
                        }
                        map.insert(id.to_string(), module);
                    }
                    Err(e) => {
                        panic!("Failed to deserialize module '{}': {}", id, e);
                    }
                }
            }
        }
        map
    })
}

/// Look up a module by ID for a given system.
/// Currently returns SAYC modules for all systems (multi-system deferred).
pub fn get_module(module_id: &str, _system: BaseSystemId) -> Option<&'static ConventionModule> {
    module_cache().get(module_id)
}

/// Get all registered modules for a given system.
/// Returns modules in definition order.
pub fn get_all_modules(_system: BaseSystemId) -> Vec<&'static ConventionModule> {
    let cache = module_cache();
    MODULE_IDS.iter().filter_map(|&id| cache.get(id)).collect()
}

/// Get modules by a list of IDs. Returns None if any ID is not found.
pub fn get_modules(
    module_ids: &[&str],
    system: BaseSystemId,
) -> Option<Vec<&'static ConventionModule>> {
    module_ids
        .iter()
        .map(|&id| get_module(id, system))
        .collect()
}

/// Get base module IDs for a system.
/// Currently all systems share the same base modules.
pub fn get_base_module_ids(_system: BaseSystemId) -> &'static [&'static str] {
    BASE_MODULE_IDS
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pipeline::observation::normalize_intent::normalize_intent;
    use crate::types::bid_action::BidActionType;
    use crate::types::rule_types::PhaseRef;

    #[test]
    fn get_module_stayman() {
        let module = get_module("stayman", BaseSystemId::Sayc);
        assert!(module.is_some());
        let m = module.unwrap();
        assert_eq!(m.module_id, "stayman");
    }

    #[test]
    fn get_module_unknown_returns_none() {
        assert!(get_module("nonexistent", BaseSystemId::Sayc).is_none());
    }

    #[test]
    fn get_all_modules_returns_14() {
        let modules = get_all_modules(BaseSystemId::Sayc);
        assert_eq!(modules.len(), 14);
    }

    #[test]
    fn get_all_modules_correct_order() {
        let modules = get_all_modules(BaseSystemId::Sayc);
        let ids: Vec<&str> = modules.iter().map(|m| m.module_id.as_str()).collect();
        assert_eq!(ids, MODULE_IDS);
    }

    #[test]
    fn get_modules_by_ids() {
        let ids = &["stayman", "blackwood"];
        let modules = get_modules(ids, BaseSystemId::Sayc);
        assert!(modules.is_some());
        let ms = modules.unwrap();
        assert_eq!(ms.len(), 2);
        assert_eq!(ms[0].module_id, "stayman");
        assert_eq!(ms[1].module_id, "blackwood");
    }

    #[test]
    fn get_modules_fails_on_unknown() {
        let ids = &["stayman", "nonexistent"];
        assert!(get_modules(ids, BaseSystemId::Sayc).is_none());
    }

    #[test]
    fn base_module_ids() {
        let ids = get_base_module_ids(BaseSystemId::Sayc);
        assert_eq!(ids.len(), 4);
        assert!(ids.contains(&"natural-bids"));
        assert!(ids.contains(&"stayman"));
        assert!(ids.contains(&"jacoby-transfers"));
        assert!(ids.contains(&"blackwood"));
    }

    #[test]
    fn no_module_has_broken_description_prefixes() {
        let bad_prefixes = ["Has a ", "No has "];
        for module in get_all_modules(BaseSystemId::Sayc) {
            if let Some(states) = &module.states {
                for state in states {
                    for surface in &state.surfaces {
                        for clause in &surface.clauses {
                            if let Some(desc) = &clause.description {
                                for prefix in &bad_prefixes {
                                    assert!(
                                        !desc.starts_with(prefix),
                                        "Module '{}' has bad description prefix '{}': '{}'",
                                        module.module_id,
                                        prefix,
                                        desc
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn all_modules_have_states() {
        let modules = get_all_modules(BaseSystemId::Sayc);
        for m in &modules {
            assert!(
                m.states.is_some(),
                "Module '{}' should have states",
                m.module_id
            );
        }
    }

    #[test]
    fn michaels_idle_openings_normalize_to_open_actions() {
        let module = get_module("michaels-unusual", BaseSystemId::Sayc)
            .expect("michaels-unusual module should exist");
        let idle_state = module
            .states
            .as_ref()
            .and_then(|states| {
                states.iter().find(
                    |state| matches!(&state.phase, PhaseRef::Single(phase) if phase == "idle"),
                )
            })
            .expect("michaels-unusual should define an idle state");

        assert_eq!(
            idle_state.surfaces.len(),
            4,
            "idle state should cover all four suit openings"
        );

        for surface in &idle_state.surfaces {
            assert_eq!(
                surface.source_intent.intent_type, "SuitOpen",
                "idle surface '{}' should use the canonical suit opening intent",
                surface.meaning_id
            );

            let actions = normalize_intent(&surface.source_intent);
            assert_eq!(
                actions.len(),
                1,
                "idle surface '{}' should normalize to exactly one opening observation",
                surface.meaning_id
            );
            assert_eq!(
                *actions[0].act(),
                BidActionType::Open,
                "idle surface '{}' should normalize to an opening observation",
                surface.meaning_id
            );
        }
    }
}
