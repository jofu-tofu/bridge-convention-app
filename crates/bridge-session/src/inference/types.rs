//! Core inference types — ported from `inference-types.ts` and `types.ts`.

use bridge_conventions::types::meaning::FactConstraint;
use bridge_engine::types::{Auction, AuctionEntry, Call, Seat, Suit};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Hand inference (what a single bid reveals) ─────────────────────

/// Inferred length constraints for a single suit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuitInference {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<u32>,
}

/// What a single bid reveals about the bidder's hand.
/// Used internally by `InferenceProvider`. For public beliefs, prefer `FactConstraint[]`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandInference {
    pub seat: Seat,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_hcp: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_hcp: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_balanced: Option<bool>,
    pub suits: HashMap<Suit, SuitInference>,
    pub source: String,
}

// ── Numeric range ──────────────────────────────────────────────────

/// Min/max range for a numeric property.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct NumberRange {
    pub min: u32,
    pub max: u32,
}

// ── Public beliefs (constraint-first representation) ───────────────

/// Descriptive constraint that doesn't reduce to a flat per-suit range.
/// Displayed as-is in the UI (e.g. "Has 4-card major").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptiveConstraint {
    pub fact_id: String,
    pub label: String,
    pub operator: String,
    pub value: serde_json::Value,
}

/// Derived display-friendly ranges computed from accumulated constraints.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivedRanges {
    pub hcp: NumberRange,
    pub suit_lengths: HashMap<Suit, NumberRange>,
    pub is_balanced: Option<bool>,
}

/// Accumulated public knowledge about a seat's hand.
/// Source of truth is `constraints` (lossless `FactConstraint[]`).
/// `ranges` and `qualitative` are derived for display/querying.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicBeliefs {
    pub seat: Seat,
    /// Raw constraints accumulated from all bids -- canonical, lossless.
    pub constraints: Vec<FactConstraint>,
    /// Derived display-friendly ranges (computed from constraints).
    pub ranges: DerivedRanges,
    /// Constraints that don't reduce to flat ranges -- displayed as-is.
    pub qualitative: Vec<DescriptiveConstraint>,
}

// ── Inference provider trait ───────────────────────────────────────

/// Determines how a partnership's bids are interpreted.
/// Primary difficulty axis: natural (easy) -> posterior (medium) -> oracle (hard).
pub trait InferenceProvider: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    /// Given a bid and auction state, what does it reveal?
    fn infer_from_bid(
        &self,
        entry: &AuctionEntry,
        auction_before: &Auction,
        seat: Seat,
    ) -> Option<HandInference>;
}

// ── Inference config ───────────────────────────────────────────────

/// Per-observer configuration: how does THIS observer interpret bids?
pub struct InferenceConfig {
    /// How to interpret own partnership's bids (convention-aware).
    pub own_partnership: Box<dyn InferenceProvider>,
    /// How to interpret opponent partnership's bids.
    pub opponent_partnership: Box<dyn InferenceProvider>,
}

// ── Inference snapshot ─────────────────────────────────────────────

/// Snapshot of inference state after a single bid is processed.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceSnapshot {
    pub entry: AuctionEntry,
    pub new_constraints: Vec<FactConstraint>,
    pub cumulative_beliefs: HashMap<Seat, PublicBeliefs>,
}

// ── Bid annotation ─────────────────────────────────────────────────

/// Annotation for a single bid in the auction -- what it means and what it reveals.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidAnnotation {
    pub call: Call,
    pub seat: Seat,
    pub convention_id: Option<String>,
    pub meaning: String,
    pub constraints: Vec<FactConstraint>,
}

/// Public belief state -- what a kibitzer can deduce from the auction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicBeliefState {
    pub beliefs: HashMap<Seat, PublicBeliefs>,
    pub annotations: Vec<BidAnnotation>,
}

// ── Inference extractor input ──────────────────────────────────────

/// Narrow input for inference extraction -- minimal typed contract.
/// Captures the fields that annotation-producer reads directly.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceExtractorInput {
    pub rule: String,
    pub explanation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meaning: Option<String>,
    /// All constraints from the winning surface's clauses, with is_public preserved.
    #[serde(default)]
    pub constraints: Vec<FactConstraint>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::BidSuit;

    #[test]
    fn hand_inference_roundtrip() {
        let inf = HandInference {
            seat: Seat::North,
            min_hcp: Some(15),
            max_hcp: Some(17),
            is_balanced: Some(true),
            suits: HashMap::new(),
            source: "test".to_string(),
        };
        let json = serde_json::to_string(&inf).unwrap();
        let back: HandInference = serde_json::from_str(&json).unwrap();
        assert_eq!(back, inf);
    }

    #[test]
    fn bid_annotation_roundtrip() {
        let ann = BidAnnotation {
            call: Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            },
            seat: Seat::South,
            convention_id: None,
            meaning: "Natural bid".to_string(),
            constraints: vec![],
        };
        let json = serde_json::to_string(&ann).unwrap();
        let back: BidAnnotation = serde_json::from_str(&json).unwrap();
        assert_eq!(back, ann);
    }

    #[test]
    fn number_range_serde() {
        let r = NumberRange { min: 15, max: 17 };
        let json = serde_json::to_string(&r).unwrap();
        assert_eq!(json, r#"{"min":15,"max":17}"#);
    }

    #[test]
    fn inference_snapshot_roundtrip() {
        let snap = InferenceSnapshot {
            entry: AuctionEntry {
                seat: Seat::North,
                call: Call::Pass,
            },
            new_constraints: vec![],
            cumulative_beliefs: HashMap::new(),
        };
        let json = serde_json::to_string(&snap).unwrap();
        let back: InferenceSnapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(back, snap);
    }
}
