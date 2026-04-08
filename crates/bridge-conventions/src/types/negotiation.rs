//! Negotiation state types.
//!
//! Mirrors TS types from `conventions/core/committed-step.ts`.
//! Only the data types reachable from ConventionBundle — CommittedStep, ClaimRef,
//! AuctionContext are deferred to Phase 2-3.

use serde::{Deserialize, Serialize};

use super::bid_action::BidSuitName;

/// Confidence level for an agreed fit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ConfidenceLevel {
    #[serde(rename = "tentative")]
    Tentative,
    #[serde(rename = "final")]
    Final,
}

/// Agreed fit information.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FitAgreed {
    pub strain: BidSuitName,
    pub confidence: ConfidenceLevel,
}

/// Competition status — mixed union: three bare strings + one object variant.
/// Uses custom serde to handle the mixed string/object representation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Competition {
    /// Simple string variant: "uncontested", "doubled", "redoubled"
    Simple(CompetitionSimple),
    /// Object variant with kind: "overcalled"
    Overcalled(OvercalledData),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompetitionSimple {
    #[serde(rename = "uncontested")]
    Uncontested,
    #[serde(rename = "doubled")]
    Doubled,
    #[serde(rename = "redoubled")]
    Redoubled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OvercalledData {
    pub kind: OvercalledKind,
    pub strain: BidSuitName,
    pub level: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OvercalledKind {
    #[serde(rename = "overcalled")]
    Overcalled,
}

/// Forcing level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ForcingLevel {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "one-round")]
    OneRound,
    #[serde(rename = "game")]
    Game,
}

/// Captain role.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Captain {
    #[serde(rename = "opener")]
    Opener,
    #[serde(rename = "responder")]
    Responder,
    #[serde(rename = "undecided")]
    Undecided,
}

/// Negotiation state — small, closed, purely semantic state owned by the framework.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NegotiationState {
    pub fit_agreed: Option<FitAgreed>,
    pub forcing: ForcingLevel,
    pub captain: Captain,
    pub competition: Competition,
}

/// Partial negotiation state — all fields optional (TS `Partial<NegotiationState>`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NegotiationDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fit_agreed: Option<Option<FitAgreed>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forcing: Option<ForcingLevel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub captain: Option<Captain>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub competition: Option<Competition>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confidence_level_serde() {
        assert_eq!(
            serde_json::to_string(&ConfidenceLevel::Tentative).unwrap(),
            "\"tentative\""
        );
        assert_eq!(
            serde_json::to_string(&ConfidenceLevel::Final).unwrap(),
            "\"final\""
        );
    }

    #[test]
    fn competition_uncontested_roundtrip() {
        let comp = Competition::Simple(CompetitionSimple::Uncontested);
        let json = serde_json::to_string(&comp).unwrap();
        assert_eq!(json, "\"uncontested\"");
        let back: Competition = serde_json::from_str(&json).unwrap();
        assert_eq!(back, comp);
    }

    #[test]
    fn competition_doubled_roundtrip() {
        let comp = Competition::Simple(CompetitionSimple::Doubled);
        let json = serde_json::to_string(&comp).unwrap();
        assert_eq!(json, "\"doubled\"");
        let back: Competition = serde_json::from_str(&json).unwrap();
        assert_eq!(back, comp);
    }

    #[test]
    fn competition_overcalled_roundtrip() {
        let comp = Competition::Overcalled(OvercalledData {
            kind: OvercalledKind::Overcalled,
            strain: BidSuitName::Hearts,
            level: 2,
        });
        let json = serde_json::to_string(&comp).unwrap();
        assert!(json.contains("\"overcalled\""));
        let back: Competition = serde_json::from_str(&json).unwrap();
        assert_eq!(back, comp);
    }

    #[test]
    fn negotiation_state_roundtrip() {
        let state = NegotiationState {
            fit_agreed: Some(FitAgreed {
                strain: BidSuitName::Spades,
                confidence: ConfidenceLevel::Final,
            }),
            forcing: ForcingLevel::Game,
            captain: Captain::Responder,
            competition: Competition::Simple(CompetitionSimple::Uncontested),
        };
        let json = serde_json::to_string(&state).unwrap();
        let back: NegotiationState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, state);
    }

    #[test]
    fn negotiation_state_null_fit() {
        let state = NegotiationState {
            fit_agreed: None,
            forcing: ForcingLevel::None,
            captain: Captain::Undecided,
            competition: Competition::Simple(CompetitionSimple::Uncontested),
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"fitAgreed\":null"));
        let back: NegotiationState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, state);
    }

    #[test]
    fn negotiation_delta_partial() {
        let delta = NegotiationDelta {
            forcing: Some(ForcingLevel::Game),
            ..Default::default()
        };
        let json = serde_json::to_string(&delta).unwrap();
        assert!(json.contains("\"forcing\":\"game\""));
        assert!(!json.contains("fitAgreed"));
        let back: NegotiationDelta = serde_json::from_str(&json).unwrap();
        assert_eq!(back, delta);
    }
}
