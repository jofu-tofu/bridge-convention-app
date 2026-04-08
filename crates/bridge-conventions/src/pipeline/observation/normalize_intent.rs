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
    params.get("suit").and_then(|v| v.as_str()).and_then(|s| match s {
        "clubs" => Some(ObsSuit::Clubs),
        "diamonds" => Some(ObsSuit::Diamonds),
        "hearts" => Some(ObsSuit::Hearts),
        "spades" => Some(ObsSuit::Spades),
        _ => None,
    })
}

fn param_strain(params: &std::collections::HashMap<String, serde_json::Value>) -> Option<BidSuitName> {
    params.get("suit").and_then(|v| v.as_str()).and_then(|s| match s {
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
        "NTOpening" => vec![BidAction::Open { strain: BidSuitName::Notrump, strength: None }],
        "SuitOpen" => vec![BidAction::Open { strain: param_strain(p).unwrap_or(BidSuitName::Clubs), strength: None }],
        "NTInvite" => vec![BidAction::Raise { strain: BidSuitName::Notrump, strength: HandStrength::Invitational }],
        "NTGame" => vec![BidAction::Raise { strain: BidSuitName::Notrump, strength: HandStrength::Game }],
        "TerminalPass" => vec![BidAction::Pass],

        // ── Stayman ──────────────────────────────────────────────────
        "StaymanAsk" => vec![BidAction::Inquire { feature: HandFeature::MajorSuit, suit: None }],
        "ShowHeldSuit" | "ShowFiveCardMajor" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: param_suit(p), quality: None, strength: None }],
        "DenyMajor" => vec![BidAction::Deny { feature: HandFeature::MajorSuit, suit: None }],
        "RaiseGame" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Game }],
        "RaiseInvite" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Invitational }],
        "StaymanNTGame" => vec![BidAction::Place { strain: BidSuitName::Notrump }],
        "StaymanNTInvite" => vec![BidAction::Raise { strain: BidSuitName::Notrump, strength: HandStrength::Invitational }],
        "CrossMajorInvite" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: param_suit(p), quality: None, strength: None }],
        "CrossMajorGF" => vec![
            BidAction::Show { feature: HandFeature::HeldSuit, suit: param_suit(p), quality: None, strength: None },
            BidAction::Force { level: HandStrength::Game },
        ],
        "MinorSuitGF" => vec![
            BidAction::Show { feature: HandFeature::HeldSuit, suit: param_suit(p), quality: None, strength: None },
            BidAction::Force { level: HandStrength::Game },
        ],
        "MajorSignoff64" => vec![BidAction::Signoff { strain: param_strain(p) }],
        "Quantitative4NT" | "QuantitativeSlam" => vec![BidAction::Raise { strain: BidSuitName::Notrump, strength: HandStrength::SlamInvite }],
        "RedoubleStrength" => vec![BidAction::Redouble { feature: HandFeature::Strength }],

        // ── Jacoby Transfers ─────────────────────────────────────────
        "TransferToHearts" => vec![BidAction::Transfer { target_suit: ObsSuit::Hearts }],
        "TransferToSpades" => vec![BidAction::Transfer { target_suit: ObsSuit::Spades }],
        "AcceptTransfer" => vec![BidAction::Accept { feature: HandFeature::HeldSuit, suit: param_suit(p), strength: None }],
        "Signoff" | "SignoffWithFit" => vec![BidAction::Signoff { strain: param_strain(p) }],
        "GameInMajor" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Game }],
        "TransferNTGame" => vec![BidAction::Place { strain: BidSuitName::Notrump }],
        "Invite" | "InviteMajorMajor" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Invitational }],
        "AcceptInvite" => vec![BidAction::Accept { feature: HandFeature::Strength, suit: None, strength: Some(HandStrength::Invitational) }],
        "DeclineInvite" => vec![BidAction::Decline { feature: HandFeature::Strength, suit: None }],
        "PlacementCorrection" => vec![BidAction::Place { strain: param_strain(p).unwrap_or(BidSuitName::Notrump) }],
        "PlacementPass" | "WeakPass" | "PostOgustPass" => vec![BidAction::Pass],

        // ── Smolen ───────────────────────────────────────────────────
        "Smolen" => {
            let long_major = p.get("longMajor").and_then(|v| v.as_str()).unwrap_or("spades");
            vec![
                BidAction::Show { feature: HandFeature::ShortMajor, suit: Some(other_major(long_major)), quality: None, strength: None },
                BidAction::Force { level: HandStrength::Game },
            ]
        }
        "SmolenPlacement" => vec![BidAction::Place { strain: param_strain(p).unwrap_or(BidSuitName::Notrump) }],
        "SmolenAcceptance" => vec![BidAction::Accept { feature: HandFeature::HeldSuit, suit: param_suit(p), strength: None }],

        // ── Major Opening ────────────────────────────────────────────
        "MajorOpen" => vec![BidAction::Open { strain: param_strain(p).unwrap_or(BidSuitName::Spades), strength: None }],

        // ── Bergen ───────────────────────────────────────────────────
        "Splinter" => vec![
            BidAction::Show { feature: HandFeature::Shortage, suit: param_suit(p), quality: None, strength: None },
            BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Game },
        ],
        "GameRaise" | "RaiseToGame" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Game }],
        "LimitRaise" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Limit }],
        "ConstructiveRaise" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Constructive }],
        "PreemptiveRaise" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Preemptive }],
        "AcceptInvitation" | "GameTry" => vec![BidAction::Accept { feature: HandFeature::Strength, suit: param_suit(p), strength: Some(HandStrength::Invitational) }],
        "DeclineInvitation" => vec![BidAction::Decline { feature: HandFeature::Strength, suit: param_suit(p) }],
        "AcceptPartnerDecision" => vec![BidAction::Pass],
        "NaturalNtResponse" => vec![BidAction::Place { strain: BidSuitName::Notrump }],

        // ── Weak Twos ────────────────────────────────────────────────
        "WeakTwoOpen" => vec![BidAction::Open { strain: param_strain(p).unwrap_or(BidSuitName::Diamonds), strength: Some(HandStrength::Weak) }],
        "OgustAsk" => vec![BidAction::Inquire { feature: HandFeature::SuitQuality, suit: None }],
        "InviteRaise" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Invitational }],
        "NewSuitGameForce" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: param_suit(p), quality: None, strength: None }],
        "ShortageSlamTry" => vec![BidAction::Show { feature: HandFeature::Shortage, suit: param_suit(p), quality: None, strength: None }],
        "SlamTrySecondMajor" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: param_suit(p), quality: None, strength: Some(HandStrength::SlamInvite) }],
        "GameInOtherMajor" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Game }],
        "OgustSolid" => vec![BidAction::Show { feature: HandFeature::SuitQuality, suit: None, quality: Some(SuitQuality::Solid), strength: None }],
        "OgustMinBad" => vec![
            BidAction::Show { feature: HandFeature::Strength, suit: None, quality: None, strength: Some(HandStrength::Minimum) },
            BidAction::Show { feature: HandFeature::SuitQuality, suit: None, quality: Some(SuitQuality::Bad), strength: None },
        ],
        "OgustMinGood" => vec![
            BidAction::Show { feature: HandFeature::Strength, suit: None, quality: None, strength: Some(HandStrength::Minimum) },
            BidAction::Show { feature: HandFeature::SuitQuality, suit: None, quality: Some(SuitQuality::Good), strength: None },
        ],
        "OgustMaxBad" => vec![
            BidAction::Show { feature: HandFeature::Strength, suit: None, quality: None, strength: Some(HandStrength::Maximum) },
            BidAction::Show { feature: HandFeature::SuitQuality, suit: None, quality: Some(SuitQuality::Bad), strength: None },
        ],
        "OgustMaxGood" => vec![
            BidAction::Show { feature: HandFeature::Strength, suit: None, quality: None, strength: Some(HandStrength::Maximum) },
            BidAction::Show { feature: HandFeature::SuitQuality, suit: None, quality: Some(SuitQuality::Good), strength: None },
        ],
        "PostOgustGame" => vec![BidAction::Raise { strain: param_strain(p).unwrap_or(BidSuitName::Notrump), strength: HandStrength::Game }],
        "PostOgust3NT" => vec![BidAction::Raise { strain: BidSuitName::Notrump, strength: HandStrength::Game }],
        "PostOgustSignoff" => vec![BidAction::Signoff { strain: param_strain(p) }],
        "NewSuitForcing" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: None, quality: None, strength: None }],
        "NsfSupport" => vec![BidAction::Raise { strain: BidSuitName::Notrump, strength: HandStrength::Minimum }],
        "NsfRebid" => vec![BidAction::Signoff { strain: param_strain(p) }],

        // ── DONT ─────────────────────────────────────────────────────
        "DONTBothMajors" => vec![
            BidAction::Overcall { feature: HandFeature::TwoSuited, suit: None },
            BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Hearts), quality: None, strength: None },
            BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Spades), quality: None, strength: None },
        ],
        "DONTDiamondsMajor" => vec![
            BidAction::Overcall { feature: HandFeature::TwoSuited, suit: None },
            BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Diamonds), quality: None, strength: None },
        ],
        "DONTClubsHigher" => vec![
            BidAction::Overcall { feature: HandFeature::TwoSuited, suit: None },
            BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Clubs), quality: None, strength: None },
        ],
        "DONTNaturalSpades" => vec![BidAction::Overcall { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Spades) }],
        "DONTSingleSuited" => vec![BidAction::Overcall { feature: HandFeature::HeldSuit, suit: None }],
        "DONTPass" => vec![BidAction::Pass],
        "DONTAcceptHearts" => vec![BidAction::Accept { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Hearts), strength: None }],
        "DONTPreferSpades" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Spades), quality: None, strength: None }],
        "DONTEscapeClubs" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Clubs), quality: None, strength: None }],
        "DONTEscapeDiamonds" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Diamonds), quality: None, strength: None }],
        "DONTAcceptDiamonds" => vec![BidAction::Accept { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Diamonds), strength: None }],
        "DONTRelayAskMajor" => vec![BidAction::Inquire { feature: HandFeature::MajorSuit, suit: None }],
        "DONTAcceptClubs" => vec![BidAction::Accept { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Clubs), strength: None }],
        "DONTRelayAskHigher" => vec![BidAction::Inquire { feature: HandFeature::HeldSuit, suit: None }],
        "DONTAcceptSpades" | "DONTAcceptSpadesFallback" => vec![BidAction::Accept { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Spades), strength: None }],
        "DONTForcedRelay" => vec![BidAction::Relay { forced: true }],
        "DONTRevealClubs" | "DONTShowClubs" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Clubs), quality: None, strength: None }],
        "DONTRevealDiamonds" | "DONTShowDiamonds" | "DONTBypassDiamonds" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Diamonds), quality: None, strength: None }],
        "DONTRevealHearts" | "DONTShowHearts" | "DONTBypassHearts" | "DONTBypassHeartsAfter2C" | "DONTShowHeartsFromDiamonds" => {
            vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Hearts), quality: None, strength: None }]
        }
        "DONTShowSpades" | "DONTBypassSpades" | "DONTBypassSpadesAfter2C" | "DONTBypassSpadesAfter2D" | "DONTShowSpadesFromDiamonds" => {
            vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Spades), quality: None, strength: None }]
        }
        "DONTEscape3CAfter2S" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Clubs), quality: None, strength: None }],
        "DONTEscape3DAfter2S" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Diamonds), quality: None, strength: None }],
        "DONTEscape3HAfter2S" => vec![BidAction::Show { feature: HandFeature::HeldSuit, suit: Some(ObsSuit::Hearts), quality: None, strength: None }],

        // ── Blackwood ──────────────────────────────────────────────
        "BlackwoodAsk" => {
            let feature_str = p.get("feature").and_then(|v| v.as_str()).unwrap_or("keyCards");
            let feature = if feature_str == "kings" { HandFeature::Control } else { HandFeature::KeyCards };
            vec![BidAction::Inquire { feature, suit: None }]
        }
        "ShowAceCount" => vec![BidAction::Show { feature: HandFeature::KeyCards, suit: None, quality: None, strength: None }],
        "ShowKingCount" => vec![BidAction::Show { feature: HandFeature::Control, suit: None, quality: None, strength: None }],
        "BlackwoodSignoff" => vec![BidAction::Signoff { strain: Some(BidSuitName::Notrump) }],

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
        params.insert("longMajor".into(), serde_json::Value::String("hearts".into()));
        let intent = SourceIntent { intent_type: "Smolen".into(), params };
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
