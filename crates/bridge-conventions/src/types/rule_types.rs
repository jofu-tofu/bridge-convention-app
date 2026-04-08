//! Rule pattern primitives for declarative rule-based surface selection.
//!
//! Mirrors TS types from `conventions/core/rule-module.ts`.

use serde::{Deserialize, Serialize};

use super::bid_action::{BidActionType, BidSuitName, HandFeature, HandStrength, ObsSuit};
use super::meaning::BidMeaning;
use super::negotiation::NegotiationDelta;

/// Role of a bidder relative to the opening bid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TurnRole {
    #[serde(rename = "opener")]
    Opener,
    #[serde(rename = "responder")]
    Responder,
    #[serde(rename = "opponent")]
    Opponent,
}

/// Predicate over a single canonical observation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObsPattern {
    pub act: ObsPatternAct,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feature: Option<HandFeature>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suit: Option<ObsSuit>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strain: Option<BidSuitName>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strength: Option<HandStrength>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<TurnRole>,
}

/// Act field of an ObsPattern — either a specific action type or "any".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ObsPatternAct {
    Specific(BidActionType),
    #[serde(rename = "any")]
    Any,
}

// Custom serialization for ObsPatternAct — BidActionType serializes as its string,
// Any serializes as "any". The untagged approach should handle this since BidActionType
// serializes as a string and "any" is also a string.

/// Pattern over the observation log.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum RouteExpr {
    #[serde(rename = "subseq")]
    Subseq { steps: Vec<ObsPattern> },
    #[serde(rename = "last")]
    Last { pattern: ObsPattern },
    #[serde(rename = "contains")]
    Contains { pattern: ObsPattern },
    #[serde(rename = "and")]
    And { exprs: Vec<RouteExpr> },
    #[serde(rename = "or")]
    Or { exprs: Vec<RouteExpr> },
    #[serde(rename = "not")]
    Not { expr: Box<RouteExpr> },
}

/// Predicate over NegotiationState.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum NegotiationExpr {
    #[serde(rename = "fit")]
    Fit {
        #[serde(skip_serializing_if = "Option::is_none")]
        strain: Option<BidSuitName>,
    },
    #[serde(rename = "no-fit")]
    NoFit,
    #[serde(rename = "forcing")]
    Forcing { level: NegotiationForcingLevel },
    #[serde(rename = "captain")]
    Captain { who: NegotiationCaptain },
    #[serde(rename = "uncontested")]
    Uncontested,
    #[serde(rename = "overcalled")]
    Overcalled {
        #[serde(skip_serializing_if = "Option::is_none")]
        below: Option<OvercalledBelow>,
    },
    #[serde(rename = "doubled")]
    Doubled,
    #[serde(rename = "redoubled")]
    Redoubled,
    #[serde(rename = "and")]
    And { exprs: Vec<NegotiationExpr> },
    #[serde(rename = "or")]
    Or { exprs: Vec<NegotiationExpr> },
    #[serde(rename = "not")]
    Not { expr: Box<NegotiationExpr> },
}

/// Forcing level value for NegotiationExpr::Forcing.
/// Matches NegotiationState["forcing"] values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NegotiationForcingLevel {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "one-round")]
    OneRound,
    #[serde(rename = "game")]
    Game,
}

/// Captain value for NegotiationExpr::Captain.
/// Matches NegotiationState["captain"] values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NegotiationCaptain {
    #[serde(rename = "opener")]
    Opener,
    #[serde(rename = "responder")]
    Responder,
    #[serde(rename = "undecided")]
    Undecided,
}

/// Below threshold for overcalled negotiation expression.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OvercalledBelow {
    pub level: u8,
    pub strain: BidSuitName,
}

/// Local FSM advancement from CommittedStep observations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhaseTransition {
    pub from: PhaseRef,
    pub to: String,
    pub on: ObsPattern,
}

/// Phase reference — either a single phase or multiple phases.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PhaseRef {
    Single(String),
    Multiple(Vec<String>),
}

/// A module's local finite state machine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LocalFsm {
    pub initial: String,
    pub transitions: Vec<PhaseTransition>,
}

/// One resolved surface from a matched state entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSurface {
    pub surface: BidMeaning,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub negotiation_delta: Option<NegotiationDelta>,
}

/// Groups surfaces by conversation state.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateEntry {
    pub phase: PhaseRef,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn: Option<TurnRole>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kernel: Option<NegotiationExpr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub route: Option<RouteExpr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub negotiation_delta: Option<NegotiationDelta>,
    pub surfaces: Vec<BidMeaning>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turn_role_serde() {
        assert_eq!(
            serde_json::to_string(&TurnRole::Opener).unwrap(),
            "\"opener\""
        );
        assert_eq!(
            serde_json::to_string(&TurnRole::Responder).unwrap(),
            "\"responder\""
        );
    }

    #[test]
    fn route_expr_subseq_roundtrip() {
        let expr = RouteExpr::Subseq {
            steps: vec![ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Inquire),
                feature: Some(HandFeature::MajorSuit),
                suit: None,
                strain: None,
                strength: None,
                actor: None,
            }],
        };
        let json = serde_json::to_string(&expr).unwrap();
        let back: RouteExpr = serde_json::from_str(&json).unwrap();
        assert_eq!(back, expr);
    }

    #[test]
    fn negotiation_expr_fit_roundtrip() {
        let expr = NegotiationExpr::Fit {
            strain: Some(BidSuitName::Hearts),
        };
        let json = serde_json::to_string(&expr).unwrap();
        let back: NegotiationExpr = serde_json::from_str(&json).unwrap();
        assert_eq!(back, expr);
    }

    #[test]
    fn negotiation_expr_nested_roundtrip() {
        let expr = NegotiationExpr::And {
            exprs: vec![
                NegotiationExpr::Uncontested,
                NegotiationExpr::Not {
                    expr: Box::new(NegotiationExpr::Fit { strain: None }),
                },
            ],
        };
        let json = serde_json::to_string(&expr).unwrap();
        let back: NegotiationExpr = serde_json::from_str(&json).unwrap();
        assert_eq!(back, expr);
    }

    #[test]
    fn local_fsm_roundtrip() {
        let fsm = LocalFsm {
            initial: "idle".to_string(),
            transitions: vec![PhaseTransition {
                from: PhaseRef::Single("idle".to_string()),
                to: "asked".to_string(),
                on: ObsPattern {
                    act: ObsPatternAct::Specific(BidActionType::Open),
                    feature: None,
                    suit: None,
                    strain: Some(BidSuitName::Notrump),
                    strength: None,
                    actor: None,
                },
            }],
        };
        let json = serde_json::to_string(&fsm).unwrap();
        let back: LocalFsm = serde_json::from_str(&json).unwrap();
        assert_eq!(back, fsm);
    }

    #[test]
    fn phase_ref_single() {
        let p = PhaseRef::Single("idle".to_string());
        let json = serde_json::to_string(&p).unwrap();
        assert_eq!(json, "\"idle\"");
    }

    #[test]
    fn phase_ref_multiple() {
        let p = PhaseRef::Multiple(vec!["a".to_string(), "b".to_string()]);
        let json = serde_json::to_string(&p).unwrap();
        assert_eq!(json, "[\"a\",\"b\"]");
    }
}
