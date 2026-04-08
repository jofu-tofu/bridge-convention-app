//! Canonical observation ontology — bridge-universal semantic observations.
//!
//! Mirrors TS types from `conventions/pipeline/bid-action.ts`.

use serde::{Deserialize, Serialize};

/// Observation suit (long-form names, not engine single-char).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ObsSuit {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
}

/// Suit name including notrump (used across convention types).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BidSuitName {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
    Notrump,
}

/// Hand feature being communicated by a bid action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HandFeature {
    HeldSuit,
    ShortMajor,
    MajorSuit,
    TwoSuited,
    SuitQuality,
    Strength,
    Shortage,
    Fit,
    Balanced,
    Control,
    KeyCards,
    Stopper,
}

/// Hand strength level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HandStrength {
    Minimum,
    Maximum,
    Invitational,
    Game,
    Slam,
    #[serde(rename = "slam-invite")]
    SlamInvite,
    Preemptive,
    Constructive,
    Limit,
    Weak,
    Strong,
}

/// Suit quality descriptor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SuitQuality {
    Good,
    Bad,
    Solid,
}

/// All known bid action type strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BidActionType {
    Open,
    Show,
    Deny,
    Inquire,
    Transfer,
    Accept,
    Decline,
    Raise,
    Place,
    Signoff,
    Force,
    Agree,
    Relay,
    Overcall,
    Double,
    Pass,
    Redouble,
}

/// Discriminated union of bridge communicative acts.
///
/// Tagged on the `act` field to match TS serialization.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "act")]
pub enum BidAction {
    #[serde(rename = "open")]
    Open {
        strain: BidSuitName,
        #[serde(skip_serializing_if = "Option::is_none")]
        strength: Option<HandStrength>,
    },
    #[serde(rename = "show")]
    Show {
        feature: HandFeature,
        #[serde(skip_serializing_if = "Option::is_none")]
        suit: Option<ObsSuit>,
        #[serde(skip_serializing_if = "Option::is_none")]
        quality: Option<SuitQuality>,
        #[serde(skip_serializing_if = "Option::is_none")]
        strength: Option<HandStrength>,
    },
    #[serde(rename = "deny")]
    Deny {
        feature: HandFeature,
        #[serde(skip_serializing_if = "Option::is_none")]
        suit: Option<ObsSuit>,
    },
    #[serde(rename = "inquire")]
    Inquire {
        feature: HandFeature,
        #[serde(skip_serializing_if = "Option::is_none")]
        suit: Option<ObsSuit>,
    },
    #[serde(rename = "transfer")]
    Transfer { #[serde(rename = "targetSuit")] target_suit: ObsSuit },
    #[serde(rename = "accept")]
    Accept {
        feature: HandFeature,
        #[serde(skip_serializing_if = "Option::is_none")]
        suit: Option<ObsSuit>,
        #[serde(skip_serializing_if = "Option::is_none")]
        strength: Option<HandStrength>,
    },
    #[serde(rename = "decline")]
    Decline {
        feature: HandFeature,
        #[serde(skip_serializing_if = "Option::is_none")]
        suit: Option<ObsSuit>,
    },
    #[serde(rename = "raise")]
    Raise {
        strain: BidSuitName,
        strength: HandStrength,
    },
    #[serde(rename = "place")]
    Place { strain: BidSuitName },
    #[serde(rename = "signoff")]
    Signoff {
        #[serde(skip_serializing_if = "Option::is_none")]
        strain: Option<BidSuitName>,
    },
    #[serde(rename = "force")]
    Force { level: HandStrength },
    #[serde(rename = "agree")]
    Agree { strain: BidSuitName },
    #[serde(rename = "relay")]
    Relay { forced: bool },
    #[serde(rename = "overcall")]
    Overcall {
        feature: HandFeature,
        #[serde(skip_serializing_if = "Option::is_none")]
        suit: Option<ObsSuit>,
    },
    #[serde(rename = "double")]
    Double { feature: HandFeature },
    #[serde(rename = "pass")]
    Pass,
    #[serde(rename = "redouble")]
    Redouble { feature: HandFeature },
}

impl BidAction {
    /// Get the act type of this action.
    pub fn act(&self) -> &BidActionType {
        match self {
            BidAction::Open { .. } => &BidActionType::Open,
            BidAction::Show { .. } => &BidActionType::Show,
            BidAction::Deny { .. } => &BidActionType::Deny,
            BidAction::Inquire { .. } => &BidActionType::Inquire,
            BidAction::Transfer { .. } => &BidActionType::Transfer,
            BidAction::Accept { .. } => &BidActionType::Accept,
            BidAction::Decline { .. } => &BidActionType::Decline,
            BidAction::Raise { .. } => &BidActionType::Raise,
            BidAction::Place { .. } => &BidActionType::Place,
            BidAction::Signoff { .. } => &BidActionType::Signoff,
            BidAction::Force { .. } => &BidActionType::Force,
            BidAction::Agree { .. } => &BidActionType::Agree,
            BidAction::Relay { .. } => &BidActionType::Relay,
            BidAction::Overcall { .. } => &BidActionType::Overcall,
            BidAction::Double { .. } => &BidActionType::Double,
            BidAction::Pass => &BidActionType::Pass,
            BidAction::Redouble { .. } => &BidActionType::Redouble,
        }
    }

    /// Get the feature field, if present.
    pub fn feature(&self) -> Option<&HandFeature> {
        match self {
            BidAction::Show { feature, .. }
            | BidAction::Deny { feature, .. }
            | BidAction::Inquire { feature, .. }
            | BidAction::Accept { feature, .. }
            | BidAction::Decline { feature, .. }
            | BidAction::Overcall { feature, .. }
            | BidAction::Double { feature }
            | BidAction::Redouble { feature } => Some(feature),
            _ => None,
        }
    }

    /// Get the suit field, if present.
    pub fn suit(&self) -> Option<&ObsSuit> {
        match self {
            BidAction::Show { suit, .. }
            | BidAction::Deny { suit, .. }
            | BidAction::Inquire { suit, .. }
            | BidAction::Accept { suit, .. }
            | BidAction::Decline { suit, .. }
            | BidAction::Overcall { suit, .. } => suit.as_ref(),
            _ => None,
        }
    }

    /// Get the targetSuit field (transfers only).
    pub fn target_suit(&self) -> Option<&ObsSuit> {
        match self {
            BidAction::Transfer { target_suit } => Some(target_suit),
            _ => None,
        }
    }

    /// Get the strain field, if present.
    pub fn strain(&self) -> Option<&BidSuitName> {
        match self {
            BidAction::Open { strain, .. }
            | BidAction::Raise { strain, .. }
            | BidAction::Place { strain }
            | BidAction::Agree { strain } => Some(strain),
            BidAction::Signoff { strain } => strain.as_ref(),
            _ => None,
        }
    }

    /// Get the strength field, if present.
    pub fn strength(&self) -> Option<&HandStrength> {
        match self {
            BidAction::Open { strength, .. }
            | BidAction::Show { strength, .. }
            | BidAction::Accept { strength, .. } => strength.as_ref(),
            BidAction::Raise { strength, .. } => Some(strength),
            BidAction::Force { level } => Some(level),
            _ => None,
        }
    }
}

impl From<ObsSuit> for BidSuitName {
    fn from(suit: ObsSuit) -> Self {
        match suit {
            ObsSuit::Clubs => BidSuitName::Clubs,
            ObsSuit::Diamonds => BidSuitName::Diamonds,
            ObsSuit::Hearts => BidSuitName::Hearts,
            ObsSuit::Spades => BidSuitName::Spades,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bid_action_open_roundtrip() {
        let action = BidAction::Open {
            strain: BidSuitName::Notrump,
            strength: None,
        };
        let json = serde_json::to_string(&action).unwrap();
        assert!(json.contains(r#""act":"open""#));
        let back: BidAction = serde_json::from_str(&json).unwrap();
        assert_eq!(back, action);
    }

    #[test]
    fn bid_action_show_with_all_fields() {
        let action = BidAction::Show {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Hearts),
            quality: Some(SuitQuality::Good),
            strength: Some(HandStrength::Invitational),
        };
        let json = serde_json::to_string(&action).unwrap();
        let back: BidAction = serde_json::from_str(&json).unwrap();
        assert_eq!(back, action);
    }

    #[test]
    fn bid_action_pass_roundtrip() {
        let action = BidAction::Pass;
        let json = serde_json::to_string(&action).unwrap();
        assert_eq!(json, r#"{"act":"pass"}"#);
        let back: BidAction = serde_json::from_str(&json).unwrap();
        assert_eq!(back, action);
    }

    #[test]
    fn bid_action_transfer_roundtrip() {
        let action = BidAction::Transfer {
            target_suit: ObsSuit::Spades,
        };
        let json = serde_json::to_string(&action).unwrap();
        assert!(json.contains(r#""targetSuit":"spades""#));
        let back: BidAction = serde_json::from_str(&json).unwrap();
        assert_eq!(back, action);
    }

    #[test]
    fn hand_strength_serde() {
        assert_eq!(
            serde_json::to_string(&HandStrength::SlamInvite).unwrap(),
            "\"slam-invite\""
        );
        let back: HandStrength = serde_json::from_str("\"slam-invite\"").unwrap();
        assert_eq!(back, HandStrength::SlamInvite);
    }

    #[test]
    fn bid_action_type_serde() {
        assert_eq!(
            serde_json::to_string(&BidActionType::Open).unwrap(),
            "\"open\""
        );
        assert_eq!(
            serde_json::to_string(&BidActionType::Signoff).unwrap(),
            "\"signoff\""
        );
    }
}
