//! normalizeIntent — translates convention-shaped sourceIntent into canonical observations.
//!
//! Generated from TS `pipeline/observation/normalize-intent.ts`.
//! When the TS mapping changes, re-run generation to update this file.
//!
//! Unknown intents return `[]` (graceful degradation).

use crate::types::bid_action::*;
use crate::types::meaning::SourceIntent;

fn other_major(suit: &str) -> ObsSuit {
    if suit == "hearts" {
        ObsSuit::Spades
    } else {
        ObsSuit::Hearts
    }
}

fn param_suit(params: &std::collections::HashMap<String, serde_json::Value>) -> Option<ObsSuit> {
    params
        .get("suit")
        .and_then(|v| v.as_str())
        .and_then(|s| match s {
            "clubs" => Some(ObsSuit::Clubs),
            "diamonds" => Some(ObsSuit::Diamonds),
            "hearts" => Some(ObsSuit::Hearts),
            "spades" => Some(ObsSuit::Spades),
            _ => None,
        })
}

fn param_strain(
    params: &std::collections::HashMap<String, serde_json::Value>,
) -> Option<BidSuitName> {
    params
        .get("suit")
        .and_then(|v| v.as_str())
        .and_then(|s| match s {
            "clubs" => Some(BidSuitName::Clubs),
            "diamonds" => Some(BidSuitName::Diamonds),
            "hearts" => Some(BidSuitName::Hearts),
            "spades" => Some(BidSuitName::Spades),
            "notrump" => Some(BidSuitName::Notrump),
            _ => None,
        })
}

/// Normalize a sourceIntent into canonical bridge observations.
///
/// Returns empty vec for unknown intent types (graceful degradation).
pub fn normalize_intent(intent: &SourceIntent) -> Vec<BidAction> {
    let p = &intent.params;
    match intent.intent_type.as_str() {
        // ── Natural openings ────────────────────────────────────────
        "NTOpening" => vec![BidAction::Open {
            strain: BidSuitName::Notrump,
            strength: None,
        }],
        "SuitOpen" => vec![BidAction::Open {
            strain: param_strain(p).unwrap_or(BidSuitName::Clubs),
            strength: None,
        }],
        "NTInvite" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Invitational,
        }],
        "NTGame" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Game,
        }],
        "TerminalPass" => vec![BidAction::Pass],

        // ── Stayman ──────────────────────────────────────────────────
        "StaymanAsk" => vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }],
        "ShowHeldSuit" | "ShowFiveCardMajor" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "DenyMajor" => vec![BidAction::Deny {
            feature: HandFeature::MajorSuit,
            suit: None,
        }],
        "RaiseGame" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "RaiseInvite" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Invitational,
        }],
        "StaymanNTGame" => vec![BidAction::Place {
            strain: BidSuitName::Notrump,
        }],
        "StaymanNTInvite" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Invitational,
        }],
        "CrossMajorInvite" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "CrossMajorGF" => vec![
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: param_suit(p),
                quality: None,
                strength: None,
            },
            BidAction::Force {
                level: HandStrength::Game,
            },
        ],
        "MinorSuitGF" => vec![
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: param_suit(p),
                quality: None,
                strength: None,
            },
            BidAction::Force {
                level: HandStrength::Game,
            },
        ],
        "MajorSignoff64" => vec![BidAction::Signoff {
            strain: param_strain(p),
        }],
        "Quantitative4NT" | "QuantitativeSlam" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::SlamInvite,
        }],
        "RedoubleStrength" => vec![BidAction::Redouble {
            feature: HandFeature::Strength,
        }],

        // ── Jacoby Transfers ─────────────────────────────────────────
        "TransferToHearts" => vec![BidAction::Transfer {
            target_suit: ObsSuit::Hearts,
        }],
        "TransferToSpades" => vec![BidAction::Transfer {
            target_suit: ObsSuit::Spades,
        }],
        "AcceptTransfer" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            strength: None,
        }],
        "Signoff" | "SignoffWithFit" => vec![BidAction::Signoff {
            strain: param_strain(p),
        }],
        "GameInMajor" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "TransferNTGame" => vec![BidAction::Place {
            strain: BidSuitName::Notrump,
        }],
        "Invite" | "InviteMajorMajor" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Invitational,
        }],
        "AcceptInvite" => vec![BidAction::Accept {
            feature: HandFeature::Strength,
            suit: None,
            strength: Some(HandStrength::Invitational),
        }],
        "DeclineInvite" => vec![BidAction::Decline {
            feature: HandFeature::Strength,
            suit: None,
        }],
        "PlacementCorrection" => vec![BidAction::Place {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
        }],
        "PlacementPass" | "WeakPass" | "PostOgustPass" => vec![BidAction::Pass],

        // ── Smolen ───────────────────────────────────────────────────
        "Smolen" => {
            let long_major = p
                .get("longMajor")
                .and_then(|v| v.as_str())
                .unwrap_or("spades");
            vec![
                BidAction::Show {
                    feature: HandFeature::ShortMajor,
                    suit: Some(other_major(long_major)),
                    quality: None,
                    strength: None,
                },
                BidAction::Force {
                    level: HandStrength::Game,
                },
            ]
        }
        "SmolenPlacement" => vec![BidAction::Place {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
        }],
        "SmolenAcceptance" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            strength: None,
        }],

        // ── Major Opening ────────────────────────────────────────────
        "MajorOpen" => vec![BidAction::Open {
            strain: param_strain(p).unwrap_or(BidSuitName::Spades),
            strength: None,
        }],

        // ── Bergen ───────────────────────────────────────────────────
        "Splinter" => vec![
            BidAction::Show {
                feature: HandFeature::Shortage,
                suit: param_suit(p),
                quality: None,
                strength: None,
            },
            BidAction::Raise {
                strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
                strength: HandStrength::Game,
            },
        ],
        // ── Strong 2C ────────────────────────────────────────────────
        "Strong2COpen" => vec![BidAction::Open {
            strain: BidSuitName::Clubs,
            strength: Some(HandStrength::Strong),
        }],
        "Strong2CWaiting" => vec![BidAction::Relay { forced: false }],
        "Strong2CPositiveHearts" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: None,
            strength: None,
        }],
        "Strong2CPositiveSpades" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            quality: None,
            strength: None,
        }],
        "Strong2CPositiveClubs" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "Strong2CPositiveDiamonds" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],
        "Strong2CPositiveBalanced" => vec![BidAction::Show {
            feature: HandFeature::Balanced,
            suit: None,
            quality: None,
            strength: None,
        }],
        "Strong2CRebidHearts" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: None,
            strength: None,
        }],
        "Strong2CRebidSpades" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            quality: None,
            strength: None,
        }],
        "Strong2CRebidClubs" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "Strong2CRebidDiamonds" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],
        "Strong2CRebid2NT" | "Strong2CRebid3NT" => vec![BidAction::Show {
            feature: HandFeature::Balanced,
            suit: None,
            quality: None,
            strength: None,
        }],
        "Strong2CPass2NT" => vec![BidAction::Pass],
        "Strong2CRaise3NT" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Game,
        }],
        "Strong2CRaise4NT" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::SlamInvite,
        }],
        "Strong2CShowHeartsOver2NT" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: None,
            strength: None,
        }],
        "Strong2CShowSpadesOver2NT" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            quality: None,
            strength: None,
        }],
        "Strong2CStaymanOver2NT" => vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }],
        "Strong2CRaiseHearts" => vec![BidAction::Raise {
            strain: BidSuitName::Hearts,
            strength: HandStrength::Game,
        }],
        "Strong2CRaiseSpades" => vec![BidAction::Raise {
            strain: BidSuitName::Spades,
            strength: HandStrength::Game,
        }],
        "Strong2CRaiseClubs" => vec![BidAction::Raise {
            strain: BidSuitName::Clubs,
            strength: HandStrength::Game,
        }],
        "Strong2CRaiseDiamonds" => vec![BidAction::Raise {
            strain: BidSuitName::Diamonds,
            strength: HandStrength::Game,
        }],
        "Strong2CResp2NTAfterSuit" | "Strong2CResp3NTAfterSuit" => vec![BidAction::Show {
            feature: HandFeature::Balanced,
            suit: None,
            quality: None,
            strength: None,
        }],
        "Strong2CRespNewClubs" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "Strong2CRespNewDiamonds" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],
        "Strong2CRespNewHearts" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: None,
            strength: None,
        }],
        "Strong2CRespNewSpades" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            quality: None,
            strength: None,
        }],
        "Strong2COpenerRaiseHearts" => vec![BidAction::Raise {
            strain: BidSuitName::Hearts,
            strength: HandStrength::Game,
        }],
        "Strong2COpenerRaiseSpades" => vec![BidAction::Raise {
            strain: BidSuitName::Spades,
            strength: HandStrength::Game,
        }],
        "Strong2COpenerRaiseClubs" => vec![BidAction::Raise {
            strain: BidSuitName::Clubs,
            strength: HandStrength::Game,
        }],
        "Strong2COpenerRaiseDiamonds" => vec![BidAction::Raise {
            strain: BidSuitName::Diamonds,
            strength: HandStrength::Game,
        }],
        "Strong2COpener3NTAfterPositive" | "Strong2COpener3NTAfter2NT" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Game,
        }],
        "Strong2COpener4NTAfter2NT" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::SlamInvite,
        }],
        "Strong2COpenerShowClubs" | "Strong2COpenerClubsAfter2NT" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "Strong2COpenerShowDiamonds" | "Strong2COpenerDiamondsAfter2NT" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],
        "Strong2COpenerShowHearts" | "Strong2COpenerHeartsAfter2NT" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: None,
            strength: None,
        }],
        "Strong2COpenerShowSpades" | "Strong2COpenerSpadesAfter2NT" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            quality: None,
            strength: None,
        }],
        "Strong2CSecondNegative" => vec![BidAction::Show {
            feature: HandFeature::Strength,
            suit: None,
            quality: None,
            strength: Some(HandStrength::Weak),
        }],
        "Strong2CJumpRebid" => vec![BidAction::Show {
            feature: HandFeature::SuitQuality,
            suit: param_suit(p),
            quality: Some(SuitQuality::Solid),
            strength: None,
        }],
        "SplinterRelay" => vec![BidAction::Inquire {
            feature: HandFeature::Shortage,
            suit: None,
        }],
        "SplinterReveal" => vec![BidAction::Show {
            feature: HandFeature::Shortage,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "GameRaise" | "RaiseToGame" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "LimitRaise" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Limit,
        }],
        "ConstructiveRaise" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Constructive,
        }],
        "PreemptiveRaise" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Preemptive,
        }],
        "AcceptInvitation" | "GameTry" => vec![BidAction::Accept {
            feature: HandFeature::Strength,
            suit: param_suit(p),
            strength: Some(HandStrength::Invitational),
        }],
        "DeclineInvitation" => vec![BidAction::Decline {
            feature: HandFeature::Strength,
            suit: param_suit(p),
        }],
        "AcceptPartnerDecision" => vec![BidAction::Pass],
        "NaturalNtResponse" => vec![BidAction::Place {
            strain: BidSuitName::Notrump,
        }],

        // ── Weak Twos ────────────────────────────────────────────────
        "WeakTwoOpen" => vec![BidAction::Open {
            strain: param_strain(p).unwrap_or(BidSuitName::Diamonds),
            strength: Some(HandStrength::Weak),
        }],
        "OgustAsk" => vec![BidAction::Inquire {
            feature: HandFeature::SuitQuality,
            suit: None,
        }],
        "InviteRaise" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Invitational,
        }],
        "NewSuitGameForce" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "ShortageSlamTry" => vec![BidAction::Show {
            feature: HandFeature::Shortage,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "SlamTrySecondMajor" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: Some(HandStrength::SlamInvite),
        }],
        "GameInOtherMajor" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "OgustSolid" => vec![BidAction::Show {
            feature: HandFeature::SuitQuality,
            suit: None,
            quality: Some(SuitQuality::Solid),
            strength: None,
        }],
        "OgustMinBad" => vec![
            BidAction::Show {
                feature: HandFeature::Strength,
                suit: None,
                quality: None,
                strength: Some(HandStrength::Minimum),
            },
            BidAction::Show {
                feature: HandFeature::SuitQuality,
                suit: None,
                quality: Some(SuitQuality::Bad),
                strength: None,
            },
        ],
        "OgustMinGood" => vec![
            BidAction::Show {
                feature: HandFeature::Strength,
                suit: None,
                quality: None,
                strength: Some(HandStrength::Minimum),
            },
            BidAction::Show {
                feature: HandFeature::SuitQuality,
                suit: None,
                quality: Some(SuitQuality::Good),
                strength: None,
            },
        ],
        "OgustMaxBad" => vec![
            BidAction::Show {
                feature: HandFeature::Strength,
                suit: None,
                quality: None,
                strength: Some(HandStrength::Maximum),
            },
            BidAction::Show {
                feature: HandFeature::SuitQuality,
                suit: None,
                quality: Some(SuitQuality::Bad),
                strength: None,
            },
        ],
        "OgustMaxGood" => vec![
            BidAction::Show {
                feature: HandFeature::Strength,
                suit: None,
                quality: None,
                strength: Some(HandStrength::Maximum),
            },
            BidAction::Show {
                feature: HandFeature::SuitQuality,
                suit: None,
                quality: Some(SuitQuality::Good),
                strength: None,
            },
        ],
        "PostOgustGame" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "PostOgust3NT" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Game,
        }],
        "PostOgustSignoff" => vec![BidAction::Signoff {
            strain: param_strain(p),
        }],
        "NewSuitForcing" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: None,
            quality: None,
            strength: None,
        }],
        "NsfSupport" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Minimum,
        }],
        "NsfRebid" => vec![BidAction::Signoff {
            strain: param_strain(p),
        }],

        // ── DONT ─────────────────────────────────────────────────────
        "DONTBothMajors" => vec![
            BidAction::Overcall {
                feature: HandFeature::TwoSuited,
                suit: None,
            },
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Hearts),
                quality: None,
                strength: None,
            },
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Spades),
                quality: None,
                strength: None,
            },
        ],
        "DONTDiamondsMajor" => vec![
            BidAction::Overcall {
                feature: HandFeature::TwoSuited,
                suit: None,
            },
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Diamonds),
                quality: None,
                strength: None,
            },
        ],
        "DONTClubsHigher" => vec![
            BidAction::Overcall {
                feature: HandFeature::TwoSuited,
                suit: None,
            },
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Clubs),
                quality: None,
                strength: None,
            },
        ],
        "DONTNaturalSpades" => vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
        }],
        "DONTMajorMinorMonster" | "DONTMajorTwoSuiterMonster" => vec![BidAction::Overcall {
            feature: HandFeature::TwoSuited,
            suit: None,
        }],
        "DONTPreemptClubs" => vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
        }],
        "DONTPreemptDiamonds" => vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
        }],
        "DONTPreemptHearts" => vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
        }],
        "DONTPreemptSpades" => vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
        }],
        "DONTSingleSuited" => vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: None,
        }],
        "DONTPass" => vec![BidAction::Pass],
        "DONTAcceptHearts" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            strength: None,
        }],
        "DONTPreferSpades" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            quality: None,
            strength: None,
        }],
        "DONTEscapeClubs" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "DONTEscapeDiamonds" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],
        "DONTAcceptDiamonds" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            strength: None,
        }],
        "DONTRelayAskMajor" => vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }],
        "DONTAcceptClubs" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            strength: None,
        }],
        "DONTRelayAskHigher" => vec![BidAction::Inquire {
            feature: HandFeature::HeldSuit,
            suit: None,
        }],
        "DONTForcingInquiry" => vec![
            BidAction::Inquire {
                feature: HandFeature::HeldSuit,
                suit: None,
            },
            BidAction::Force {
                level: HandStrength::Game,
            },
        ],
        "DONTStrongInvite2NT" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Invitational,
        }],
        "DONTAcceptSpades" | "DONTAcceptSpadesFallback" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            strength: None,
        }],
        "DONTForcedRelay" => vec![BidAction::Relay { forced: true }],
        "DONTSOSRedouble" => vec![BidAction::Redouble {
            feature: HandFeature::HeldSuit,
        }],
        "DONTTakeoutDouble" => vec![BidAction::Double {
            feature: HandFeature::HeldSuit,
        }],
        "DONTRevealClubs" | "DONTShowClubs" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "DONTRevealDiamonds" | "DONTShowDiamonds" | "DONTBypassDiamonds" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],
        "DONTRevealHearts"
        | "DONTShowHearts"
        | "DONTBypassHearts"
        | "DONTBypassHeartsAfter2C"
        | "DONTShowHeartsFromDiamonds" => {
            vec![BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Hearts),
                quality: None,
                strength: None,
            }]
        }
        "DONTShowSpades"
        | "DONTBypassSpades"
        | "DONTBypassSpadesAfter2C"
        | "DONTBypassSpadesAfter2D"
        | "DONTShowSpadesFromDiamonds" => {
            vec![BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Spades),
                quality: None,
                strength: None,
            }]
        }
        "DONTEscape3CAfter2S" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "DONTEscape3DAfter2S" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],
        "DONTEscape3HAfter2S" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: None,
            strength: None,
        }],

        // ── Michaels / Unusual 2NT ──────────────────────────────
        "MichaelsCueBidBothMajors" => vec![
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Hearts),
                quality: None,
                strength: None,
            },
            BidAction::Show {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Spades),
                quality: None,
                strength: None,
            },
        ],
        "MichaelsCueBidSpadesMinor" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
            quality: None,
            strength: None,
        }],
        "MichaelsCueBidHeartsMinor" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: None,
            strength: None,
        }],
        "UnusualBothMinors" => vec![BidAction::Show {
            feature: HandFeature::TwoSuited,
            suit: None,
            quality: None,
            strength: None,
        }],
        "MichaelsPass" => vec![BidAction::Pass],
        "MichaelsAdvancerPreferHearts" | "MichaelsAdvancerAcceptHearts" => {
            vec![BidAction::Accept {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Hearts),
                strength: None,
            }]
        }
        "MichaelsAdvancerPreferSpades" | "MichaelsAdvancerAcceptSpades" => {
            vec![BidAction::Accept {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Spades),
                strength: None,
            }]
        }
        "MichaelsAdvancerInvite2NT" => vec![BidAction::Inquire {
            feature: HandFeature::HeldSuit,
            suit: None,
        }],
        "MichaelsAdvancerPreemptHearts" => vec![BidAction::Raise {
            strain: BidSuitName::Hearts,
            strength: HandStrength::Preemptive,
        }],
        "MichaelsAdvancerPreemptSpades" => vec![BidAction::Raise {
            strain: BidSuitName::Spades,
            strength: HandStrength::Preemptive,
        }],
        "MichaelsAdvancerInviteHearts" => vec![BidAction::Raise {
            strain: BidSuitName::Hearts,
            strength: HandStrength::Invitational,
        }],
        "MichaelsAdvancerInviteSpades" => vec![BidAction::Raise {
            strain: BidSuitName::Spades,
            strength: HandStrength::Invitational,
        }],
        "MichaelsAdvancerForceAsk" => vec![BidAction::Force {
            level: HandStrength::Game,
        }],
        "MichaelsAdvancerGameHearts" => vec![BidAction::Raise {
            strain: BidSuitName::Hearts,
            strength: HandStrength::Game,
        }],
        "MichaelsAdvancerGameSpades" => vec![BidAction::Raise {
            strain: BidSuitName::Spades,
            strength: HandStrength::Game,
        }],
        "MichaelsAdvancerPass" | "UnusualAdvancerPass" => vec![BidAction::Pass],
        "MichaelsAdvancerAskMinor" => vec![BidAction::Inquire {
            feature: HandFeature::HeldSuit,
            suit: None,
        }],
        "MichaelsAdvancerPassOrCorrect" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            strength: None,
        }],
        "UnusualAdvancerPreferClubs" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            strength: None,
        }],
        "UnusualAdvancerPreferDiamonds" => vec![BidAction::Accept {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            strength: None,
        }],
        "UnusualAdvancerGameClubs" => vec![BidAction::Raise {
            strain: BidSuitName::Clubs,
            strength: HandStrength::Game,
        }],
        "UnusualAdvancerGameDiamonds" => vec![BidAction::Raise {
            strain: BidSuitName::Diamonds,
            strength: HandStrength::Game,
        }],
        "MichaelsRevealClubs" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Clubs),
            quality: None,
            strength: None,
        }],
        "MichaelsRevealDiamonds" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Diamonds),
            quality: None,
            strength: None,
        }],

        // ── Negative Doubles ─────────────────────────────────────
        "NegDblOpponentOvercall" => vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
        }],
        "NegativeDouble" => vec![BidAction::Double {
            feature: HandFeature::HeldSuit,
        }],
        "NegDblResponderPass" => vec![BidAction::Pass],
        "NegDblResponderNewSuit" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "NegDblOpenerRaise" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Constructive,
        }],
        "NegDblOpenerJumpRaise" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "NegDblOpenerRebid" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "NegDblOpenerNT" => vec![BidAction::Place {
            strain: BidSuitName::Notrump,
        }],
        "NegDblOpenerNewSuit" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "NegDblOpenerPass" => vec![BidAction::Pass],

        // ── New Minor Forcing ────────────────────────────────────
        "NMFAsk" => vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }],
        "NMFResponderSignoff" => vec![BidAction::Signoff {
            strain: param_strain(p),
        }],
        "NMFResponderNTInvite" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Invitational,
        }],
        "NMFResponderNTGame" => vec![BidAction::Place {
            strain: BidSuitName::Notrump,
        }],
        "NMFResponderPass" => vec![BidAction::Pass],
        "NMFOpenerShowSupport" => vec![BidAction::Show {
            feature: HandFeature::Fit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "NMFOpenerJumpSupport" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "NMFOpenerShowOtherMajor" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "NMFOpenerJumpOtherMajor" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Notrump),
            strength: HandStrength::Game,
        }],
        "NMFOpener1NTRebid" => vec![BidAction::Show {
            feature: HandFeature::Balanced,
            suit: None,
            quality: None,
            strength: Some(HandStrength::Minimum),
        }],
        "NMFOpenerRaiseMinor" => vec![BidAction::Raise {
            strain: param_strain(p).unwrap_or(BidSuitName::Clubs),
            strength: HandStrength::Minimum,
        }],
        "NMFOpenerRebidOwn" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],
        "NMFOpenerNTMin" => vec![BidAction::Place {
            strain: BidSuitName::Notrump,
        }],
        "NMFOpenerNTMax" => vec![BidAction::Raise {
            strain: BidSuitName::Notrump,
            strength: HandStrength::Game,
        }],
        "OpenerRebid1NT" => vec![BidAction::Show {
            feature: HandFeature::Balanced,
            suit: None,
            quality: None,
            strength: None,
        }],
        "ResponderShowMajor" => vec![BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: param_suit(p),
            quality: None,
            strength: None,
        }],

        // ── Blackwood ──────────────────────────────────────────────
        "BlackwoodAsk" => {
            let feature_str = p
                .get("feature")
                .and_then(|v| v.as_str())
                .unwrap_or("keyCards");
            let feature = if feature_str == "kings" {
                HandFeature::Control
            } else {
                HandFeature::KeyCards
            };
            vec![BidAction::Inquire {
                feature,
                suit: None,
            }]
        }
        "ShowAceCount" => vec![BidAction::Show {
            feature: HandFeature::KeyCards,
            suit: None,
            quality: None,
            strength: None,
        }],
        "ShowKingCount" => vec![BidAction::Show {
            feature: HandFeature::Control,
            suit: None,
            quality: None,
            strength: None,
        }],
        "BlackwoodSignoff" => vec![BidAction::Signoff {
            strain: Some(BidSuitName::Notrump),
        }],

        // Unknown intent — graceful degradation
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn intent(t: &str) -> SourceIntent {
        SourceIntent {
            intent_type: t.to_string(),
            params: HashMap::new(),
        }
    }

    fn intent_with_suit(t: &str, suit: &str) -> SourceIntent {
        let mut params = HashMap::new();
        params.insert("suit".into(), serde_json::Value::String(suit.into()));
        SourceIntent {
            intent_type: t.to_string(),
            params,
        }
    }

    #[test]
    fn nt_opening() {
        let result = normalize_intent(&intent("NTOpening"));
        assert_eq!(result.len(), 1);
        assert_eq!(*result[0].act(), BidActionType::Open);
    }

    #[test]
    fn stayman_ask() {
        let result = normalize_intent(&intent("StaymanAsk"));
        assert_eq!(result.len(), 1);
        assert_eq!(*result[0].act(), BidActionType::Inquire);
        assert_eq!(result[0].feature(), Some(&HandFeature::MajorSuit));
    }

    #[test]
    fn transfer_to_hearts() {
        let result = normalize_intent(&intent("TransferToHearts"));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].target_suit(), Some(&ObsSuit::Hearts));
    }

    #[test]
    fn show_held_suit_with_param() {
        let result = normalize_intent(&intent_with_suit("ShowHeldSuit", "spades"));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].suit(), Some(&ObsSuit::Spades));
    }

    #[test]
    fn unknown_intent() {
        let result = normalize_intent(&intent("UnknownIntent"));
        assert!(result.is_empty());
    }

    #[test]
    fn smolen() {
        let mut params = HashMap::new();
        params.insert(
            "longMajor".into(),
            serde_json::Value::String("hearts".into()),
        );
        let intent = SourceIntent {
            intent_type: "Smolen".into(),
            params,
        };
        let result = normalize_intent(&intent);
        assert_eq!(result.len(), 2);
        assert_eq!(*result[0].act(), BidActionType::Show);
        assert_eq!(result[0].feature(), Some(&HandFeature::ShortMajor));
        // Short major is the OTHER one — spades when long is hearts
        assert_eq!(result[0].suit(), Some(&ObsSuit::Spades));
    }

    #[test]
    fn dont_both_majors() {
        let result = normalize_intent(&intent("DONTBothMajors"));
        assert_eq!(result.len(), 3);
        assert_eq!(*result[0].act(), BidActionType::Overcall);
    }
}
