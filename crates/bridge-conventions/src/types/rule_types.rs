//! Rule pattern primitives for declarative rule-based surface selection.
//!
//! Mirrors TS types from `conventions/core/rule-module.ts`.

use serde::{Deserialize, Serialize};

use super::bid_action::{BidActionType, BidSuitName, HandFeature, HandStrength, ObsSuit};
use super::meaning::BidMeaning;
use super::negotiation::{Captain, ForcingLevel, NegotiationDelta};

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

/// Suit-class qualifier for `ObsPattern.suit_class`. Complements `strain`
/// when authors want to match a class of strains rather than a specific one
/// (e.g. "any minor" for NMF's `1m – 1M – 1NT` opener step).
///
/// `Suit` means "any of the four suits, not NT" — included for completeness
/// even when no current fixture uses it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SuitClass {
    Minor,
    Major,
    Suit,
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
    /// Suit-class qualifier complementing `strain`. When `Some(class)`, the
    /// matched bid's strain must belong to the class. When both `strain` and
    /// `suit_class` are `Some`, the strain check wins (strain is more specific).
    #[serde(rename = "suitClass", skip_serializing_if = "Option::is_none", default)]
    pub suit_class: Option<SuitClass>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strength: Option<HandStrength>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<TurnRole>,
    /// Bid level (1-7). `None` = match any level. `Some(n)` = exact level match.
    /// Level is read from the containing step's `Call::Bid`; steps whose call
    /// is not `Call::Bid` (Pass, Double, Redouble) never match when `Some`.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub level: Option<u8>,
    /// Jump discriminator. `None` = don't care. `Some(true)` = bid's level
    /// strictly exceeds the minimum legal bid level for its strain given prior
    /// calls in the log. `Some(false)` = non-jump (level equals the minimum
    /// legal level). Non-bid calls never match when `Some`.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub jump: Option<bool>,
}

impl SuitClass {
    /// True iff `strain` belongs to this suit class. NoTrump is never a member
    /// of any class.
    pub fn matches_strain(&self, strain: &BidSuitName) -> bool {
        match self {
            SuitClass::Minor => matches!(strain, BidSuitName::Clubs | BidSuitName::Diamonds),
            SuitClass::Major => matches!(strain, BidSuitName::Hearts | BidSuitName::Spades),
            SuitClass::Suit => !matches!(strain, BidSuitName::Notrump),
        }
    }
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
    Forcing { level: ForcingLevel },
    #[serde(rename = "captain")]
    Captain { who: Captain },
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

/// Declares whether a reachable FSM state is fully authored, delegated, or
/// intentionally outside this module's scope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum StateScope {
    /// Authored surfaces handle all intended cases for this state.
    Enumerated,
    /// Auction continues in another module.
    DelegateTo {
        #[serde(rename = "moduleId")]
        module_id: String,
    },
    /// Falls to natural bidding; intentionally outside this module.
    OutOfScope { reason: String },
}

impl Default for StateScope {
    fn default() -> Self {
        default_scope()
    }
}

pub fn default_scope() -> StateScope {
    StateScope::Enumerated
}

/// Drill target selector — picks which module / surface a drill is targeting.
///
/// `Any` means no module/surface filter: any bundle-member surface is fair
/// game. `Module` restricts to a single module's surfaces. `Surface` further
/// pins down a specific `meaning_id` within that module. Phase 1 of the
/// drill-targeting refactor: each existing call site that passed
/// `Some(module_id)` now wraps that as `Module { module_id }`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TargetSelector {
    Any,
    #[serde(rename_all = "camelCase")]
    Module { module_id: String },
    #[serde(rename_all = "camelCase")]
    Surface {
        module_id: String,
        surface_id: String,
    },
}

impl TargetSelector {
    /// Module ID component (`None` for `Any`). Used by code paths that today
    /// take an `Option<&str>` target module override.
    pub fn module_id(&self) -> Option<&str> {
        match self {
            TargetSelector::Any => None,
            TargetSelector::Module { module_id }
            | TargetSelector::Surface { module_id, .. } => Some(module_id.as_str()),
        }
    }

    /// Surface ID component (only present for `Surface` variant).
    pub fn surface_id(&self) -> Option<&str> {
        match self {
            TargetSelector::Surface { surface_id, .. } => Some(surface_id.as_str()),
            _ => None,
        }
    }
}

impl Default for TargetSelector {
    fn default() -> Self {
        TargetSelector::Any
    }
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
    #[serde(default = "default_scope")]
    pub scope: StateScope,
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
                suit_class: None,
                strength: None,
                actor: None,
                level: None,
                jump: None,
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
                    suit_class: None,
                    strength: None,
                    actor: None,
                    level: None,
                    jump: None,
                },
            }],
        };
        let json = serde_json::to_string(&fsm).unwrap();
        let back: LocalFsm = serde_json::from_str(&json).unwrap();
        assert_eq!(back, fsm);
    }

    #[test]
    fn state_scope_default_is_enumerated() {
        let entry: StateEntry = serde_json::from_str(
            r#"{
                "phase": "idle",
                "turn": "responder",
                "surfaces": []
            }"#,
        )
        .unwrap();
        assert_eq!(entry.scope, StateScope::Enumerated);
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

    #[test]
    fn target_selector_serde_roundtrip() {
        let any = TargetSelector::Any;
        let any_json = serde_json::to_string(&any).unwrap();
        assert_eq!(any_json, r#"{"kind":"any"}"#);
        assert_eq!(serde_json::from_str::<TargetSelector>(&any_json).unwrap(), any);

        let module = TargetSelector::Module {
            module_id: "stayman".to_string(),
        };
        let module_json = serde_json::to_string(&module).unwrap();
        assert_eq!(module_json, r#"{"kind":"module","moduleId":"stayman"}"#);
        assert_eq!(
            serde_json::from_str::<TargetSelector>(&module_json).unwrap(),
            module
        );

        let surface = TargetSelector::Surface {
            module_id: "stayman".to_string(),
            surface_id: "stayman:nt-game-after-denial".to_string(),
        };
        let surface_json = serde_json::to_string(&surface).unwrap();
        assert_eq!(
            surface_json,
            r#"{"kind":"surface","moduleId":"stayman","surfaceId":"stayman:nt-game-after-denial"}"#
        );
        assert_eq!(
            serde_json::from_str::<TargetSelector>(&surface_json).unwrap(),
            surface
        );
    }

    #[test]
    fn target_selector_helpers() {
        assert_eq!(TargetSelector::Any.module_id(), None);
        assert_eq!(TargetSelector::Any.surface_id(), None);

        let m = TargetSelector::Module {
            module_id: "stayman".to_string(),
        };
        assert_eq!(m.module_id(), Some("stayman"));
        assert_eq!(m.surface_id(), None);

        let s = TargetSelector::Surface {
            module_id: "stayman".to_string(),
            surface_id: "stayman:nt-game-after-denial".to_string(),
        };
        assert_eq!(s.module_id(), Some("stayman"));
        assert_eq!(s.surface_id(), Some("stayman:nt-game-after-denial"));
    }

    #[test]
    fn target_selector_default_is_any() {
        assert_eq!(TargetSelector::default(), TargetSelector::Any);
    }

    #[test]
    fn suit_class_matches_strain_minor_major_suit() {
        assert!(SuitClass::Minor.matches_strain(&BidSuitName::Clubs));
        assert!(SuitClass::Minor.matches_strain(&BidSuitName::Diamonds));
        assert!(!SuitClass::Minor.matches_strain(&BidSuitName::Hearts));
        assert!(!SuitClass::Minor.matches_strain(&BidSuitName::Spades));
        assert!(!SuitClass::Minor.matches_strain(&BidSuitName::Notrump));

        assert!(SuitClass::Major.matches_strain(&BidSuitName::Hearts));
        assert!(SuitClass::Major.matches_strain(&BidSuitName::Spades));
        assert!(!SuitClass::Major.matches_strain(&BidSuitName::Clubs));
        assert!(!SuitClass::Major.matches_strain(&BidSuitName::Notrump));

        assert!(SuitClass::Suit.matches_strain(&BidSuitName::Clubs));
        assert!(SuitClass::Suit.matches_strain(&BidSuitName::Spades));
        assert!(!SuitClass::Suit.matches_strain(&BidSuitName::Notrump));
    }

    #[test]
    fn suit_class_serde_roundtrip() {
        let class = SuitClass::Minor;
        let json = serde_json::to_string(&class).unwrap();
        assert_eq!(json, "\"minor\"");
        let back: SuitClass = serde_json::from_str(&json).unwrap();
        assert_eq!(back, class);
    }

    #[test]
    fn obs_pattern_with_suit_class_serde_roundtrip() {
        let pat = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: None,
            strain: None,
            suit_class: Some(SuitClass::Minor),
            strength: None,
            actor: None,
            level: Some(1),
            jump: None,
        };
        let json = serde_json::to_string(&pat).unwrap();
        let back: ObsPattern = serde_json::from_str(&json).unwrap();
        assert_eq!(back, pat);
    }
}
