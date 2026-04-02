//! Annotation production -- creates `BidAnnotation` from auction entry + rule result.
//!
//! Convention bids: constraints from the rule result + extractor.
//! Natural bids: constraints converted from the natural provider.
//! Pass/double/redouble: no constraints.

use bridge_engine::types::{Auction, AuctionEntry, Call};
use bridge_conventions::types::meaning::FactConstraint;

use super::derive_beliefs::hand_inference_to_constraints;
use super::types::{
    BidAnnotation, InferenceExtractor, InferenceExtractorInput, InferenceProvider,
};

/// Produce a `BidAnnotation` for a single auction entry.
///
/// Convention bids: constraints from the rule result alert + extractor.
/// Natural bids: constraints converted from the natural provider.
/// Pass/double/redouble: no constraints.
pub fn produce_annotation(
    entry: &AuctionEntry,
    rule_result: Option<&InferenceExtractorInput>,
    convention_id: Option<&str>,
    extractor: &dyn InferenceExtractor,
    natural_provider: &dyn InferenceProvider,
    auction_before: &Auction,
) -> BidAnnotation {
    let call = entry.call.clone();
    let seat = entry.seat;
    let conv_id = convention_id.map(|s| s.to_string());

    // Convention bid
    if let Some(result) = rule_result {
        let meaning = result.meaning.clone().unwrap_or_else(|| result.explanation.clone());

        let extracted = extractor.extract_constraints(result, seat);

        // When the convention extractor produces constraints, use them.
        if !extracted.is_empty() {
            return BidAnnotation { call, seat, convention_id: conv_id, meaning, constraints: extracted };
        }

        // Use constraints directly -- no lossy conversion
        if !result.constraints.is_empty() {
            return BidAnnotation { call, seat, convention_id: conv_id, meaning, constraints: result.constraints.clone() };
        }

        // Fall through with convention metadata but natural constraints
        if matches!(call, Call::Bid { .. }) {
            let natural_constraints = infer_natural_constraints(natural_provider, entry, auction_before);
            return BidAnnotation { call, seat, convention_id: conv_id, meaning, constraints: natural_constraints };
        }

        return BidAnnotation { call, seat, convention_id: conv_id, meaning, constraints: Vec::new() };
    }

    // Natural contract bid (not pass/double/redouble)
    if matches!(call, Call::Bid { .. }) {
        let natural_constraints = infer_natural_constraints(natural_provider, entry, auction_before);
        return BidAnnotation { call, seat, convention_id: None, meaning: String::new(), constraints: natural_constraints };
    }

    // Pass / double / redouble — no meaningful label to show
    BidAnnotation { call, seat, convention_id: None, meaning: String::new(), constraints: Vec::new() }
}

/// Get constraints from natural provider, converting HandInference at the boundary.
fn infer_natural_constraints(
    provider: &dyn InferenceProvider,
    entry: &AuctionEntry,
    auction_before: &Auction,
) -> Vec<FactConstraint> {
    match provider.infer_from_bid(entry, auction_before, entry.seat) {
        Some(inference) => hand_inference_to_constraints(&inference),
        None => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::{BidSuit, Seat};
    use bridge_conventions::types::meaning::{ConstraintValue, FactOperator};
    use std::collections::HashMap;

    use crate::inference::types::{HandInference, NoopExtractor};

    /// A natural provider that returns a fixed inference for any bid.
    struct FixedNaturalProvider {
        inference: Option<HandInference>,
    }

    impl InferenceProvider for FixedNaturalProvider {
        fn id(&self) -> &str { "fixed-natural" }
        fn name(&self) -> &str { "fixed-natural" }
        fn infer_from_bid(
            &self,
            _entry: &AuctionEntry,
            _auction_before: &Auction,
            _seat: Seat,
        ) -> Option<HandInference> {
            self.inference.clone()
        }
    }

    fn empty_auction() -> Auction {
        Auction { entries: vec![], is_complete: false }
    }

    #[test]
    fn convention_bid_with_direct_constraints() {
        let entry = AuctionEntry {
            seat: Seat::South,
            call: Call::Bid { level: 2, strain: BidSuit::Clubs },
        };
        let rule_result = InferenceExtractorInput {
            rule: "stayman".to_string(),
            explanation: "Stayman".to_string(),
            meaning: Some("Asking for 4-card major".to_string()),
            constraints: vec![FactConstraint {
                fact_id: "hand.hcp".to_string(),
                operator: FactOperator::Gte,
                value: ConstraintValue::int(8),
                is_public: Some(true),
            }],
        };
        let extractor = NoopExtractor;
        let provider = FixedNaturalProvider { inference: None };

        let ann = produce_annotation(
            &entry,
            Some(&rule_result),
            Some("stayman"),
            &extractor,
            &provider,
            &empty_auction(),
        );

        assert_eq!(ann.convention_id, Some("stayman".to_string()));
        assert_eq!(ann.meaning, "Asking for 4-card major");
        assert_eq!(ann.constraints.len(), 1);
    }

    #[test]
    fn natural_bid_uses_natural_provider() {
        let entry = AuctionEntry {
            seat: Seat::North,
            call: Call::Bid { level: 1, strain: BidSuit::Hearts },
        };
        let extractor = NoopExtractor;
        let provider = FixedNaturalProvider {
            inference: Some(HandInference {
                seat: Seat::North,
                min_hcp: Some(12),
                max_hcp: None,
                is_balanced: None,
                suits: HashMap::new(),
                source: "natural".to_string(),
            }),
        };

        let ann = produce_annotation(
            &entry,
            None,
            None,
            &extractor,
            &provider,
            &empty_auction(),
        );

        assert_eq!(ann.convention_id, None);
        assert!(ann.meaning.is_empty());
        assert_eq!(ann.constraints.len(), 1);
        assert_eq!(ann.constraints[0].fact_id, "hand.hcp");
    }

    #[test]
    fn pass_has_no_constraints() {
        let entry = AuctionEntry { seat: Seat::East, call: Call::Pass };
        let extractor = NoopExtractor;
        let provider = FixedNaturalProvider { inference: None };

        let ann = produce_annotation(
            &entry,
            None,
            None,
            &extractor,
            &provider,
            &empty_auction(),
        );

        assert!(ann.meaning.is_empty());
        assert!(ann.constraints.is_empty());
    }

    #[test]
    fn double_has_no_constraints() {
        let entry = AuctionEntry { seat: Seat::East, call: Call::Double };
        let extractor = NoopExtractor;
        let provider = FixedNaturalProvider { inference: None };

        let ann = produce_annotation(
            &entry,
            None,
            None,
            &extractor,
            &provider,
            &empty_auction(),
        );

        assert!(ann.meaning.is_empty());
        assert!(ann.constraints.is_empty());
    }

    #[test]
    fn redouble_has_no_constraints() {
        let entry = AuctionEntry { seat: Seat::East, call: Call::Redouble };
        let extractor = NoopExtractor;
        let provider = FixedNaturalProvider { inference: None };

        let ann = produce_annotation(
            &entry,
            None,
            None,
            &extractor,
            &provider,
            &empty_auction(),
        );

        assert!(ann.meaning.is_empty());
        assert!(ann.constraints.is_empty());
    }
}
