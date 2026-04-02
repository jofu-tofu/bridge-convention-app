//! Public belief state management -- create, accumulate, and derive.

use std::collections::HashMap;
use bridge_engine::types::Seat;

use super::derive_beliefs::derive_public_beliefs;
use super::types::{BidAnnotation, PublicBeliefState, PublicBeliefs};

fn create_loose_beliefs(seat: Seat) -> PublicBeliefs {
    derive_public_beliefs(seat, &[])
}

/// Create a maximally loose public belief state -- no information known about any seat.
pub fn create_initial_belief_state() -> PublicBeliefState {
    let beliefs: HashMap<Seat, PublicBeliefs> = [
        (Seat::North, create_loose_beliefs(Seat::North)),
        (Seat::East, create_loose_beliefs(Seat::East)),
        (Seat::South, create_loose_beliefs(Seat::South)),
        (Seat::West, create_loose_beliefs(Seat::West)),
    ]
    .into_iter()
    .collect();

    PublicBeliefState {
        beliefs,
        annotations: Vec::new(),
    }
}

/// Apply a bid annotation to the public belief state.
/// Mutates the state in-place: appends the annotation's constraints to the
/// seat's accumulated constraints and re-derives ranges + qualitative labels.
pub fn apply_annotation(
    state: &mut PublicBeliefState,
    annotation: BidAnnotation,
) {
    let seat = annotation.seat;

    // Accumulate constraints and re-derive
    let existing = &state.beliefs[&seat];
    let mut all_constraints = existing.constraints.clone();
    all_constraints.extend(annotation.constraints.iter().cloned());
    let updated = derive_public_beliefs(seat, &all_constraints);

    state.beliefs.insert(seat, updated);
    state.annotations.push(annotation);
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::Suit;
    use bridge_conventions::types::meaning::{ConstraintValue, FactConstraint, FactOperator};
    use bridge_engine::types::Call;

    fn make_annotation(seat: Seat, constraints: Vec<FactConstraint>) -> BidAnnotation {
        BidAnnotation {
            call: Call::Pass,
            seat,
            convention_id: None,
            meaning: "Test".to_string(),
            constraints,
        }
    }

    fn hcp_constraints(min: Option<u32>, max: Option<u32>) -> Vec<FactConstraint> {
        let mut result = Vec::new();
        if let Some(min) = min {
            result.push(FactConstraint {
                fact_id: "hand.hcp".to_string(),
                operator: FactOperator::Gte,
                value: ConstraintValue::int(min as i64),
                is_public: None,
            });
        }
        if let Some(max) = max {
            result.push(FactConstraint {
                fact_id: "hand.hcp".to_string(),
                operator: FactOperator::Lte,
                value: ConstraintValue::int(max as i64),
                is_public: None,
            });
        }
        result
    }

    #[test]
    fn initial_state_all_seats_maximally_loose() {
        let state = create_initial_belief_state();

        for seat in &bridge_engine::SEATS {
            let beliefs = &state.beliefs[seat];
            assert_eq!(beliefs.seat, *seat);
            assert_eq!(beliefs.ranges.hcp.min, 0);
            assert_eq!(beliefs.ranges.hcp.max, 40);
            assert_eq!(beliefs.ranges.is_balanced, None);
            assert!(beliefs.constraints.is_empty());
            assert!(beliefs.qualitative.is_empty());

            for suit in &[Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
                assert_eq!(beliefs.ranges.suit_lengths[suit].min, 0);
                assert_eq!(beliefs.ranges.suit_lengths[suit].max, 13);
            }
        }
    }

    #[test]
    fn initial_state_empty_annotations() {
        let state = create_initial_belief_state();
        assert!(state.annotations.is_empty());
    }

    #[test]
    fn apply_annotation_narrows_hcp() {
        let mut state = create_initial_belief_state();
        apply_annotation(&mut state, make_annotation(Seat::South, hcp_constraints(Some(15), Some(17))));

        assert_eq!(state.beliefs[&Seat::South].ranges.hcp.min, 15);
        assert_eq!(state.beliefs[&Seat::South].ranges.hcp.max, 17);
    }

    #[test]
    fn apply_annotation_narrows_suit_length() {
        let mut state = create_initial_belief_state();
        apply_annotation(&mut state, make_annotation(Seat::South, vec![FactConstraint {
            fact_id: "hand.suitLength.spades".to_string(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(5),
            is_public: None,
        }]));

        assert_eq!(state.beliefs[&Seat::South].ranges.suit_lengths[&Suit::Spades].min, 5);
    }

    #[test]
    fn multiple_annotations_monotonically_constrain() {
        let mut state = create_initial_belief_state();

        apply_annotation(&mut state, make_annotation(Seat::South, hcp_constraints(Some(12), None)));
        apply_annotation(&mut state, make_annotation(Seat::South, hcp_constraints(Some(15), None)));

        // min should be 15 (tighter), not 12
        assert_eq!(state.beliefs[&Seat::South].ranges.hcp.min, 15);
    }

    #[test]
    fn empty_constraints_annotation_recorded_beliefs_unchanged() {
        let mut state = create_initial_belief_state();
        apply_annotation(&mut state, make_annotation(Seat::South, vec![]));

        assert_eq!(state.annotations.len(), 1);
        assert_eq!(state.beliefs[&Seat::South].ranges.hcp.min, 0);
        assert_eq!(state.beliefs[&Seat::South].ranges.hcp.max, 40);
    }

    #[test]
    fn only_affects_annotated_seat() {
        let mut state = create_initial_belief_state();
        apply_annotation(&mut state, make_annotation(Seat::South, hcp_constraints(Some(15), Some(17))));

        assert_eq!(state.beliefs[&Seat::North].ranges.hcp.min, 0);
        assert_eq!(state.beliefs[&Seat::North].ranges.hcp.max, 40);
        assert_eq!(state.beliefs[&Seat::East].ranges.hcp.min, 0);
        assert_eq!(state.beliefs[&Seat::West].ranges.hcp.min, 0);
    }

    #[test]
    fn contradiction_clamping() {
        let mut state = create_initial_belief_state();

        apply_annotation(&mut state, make_annotation(Seat::South, hcp_constraints(Some(15), None)));
        apply_annotation(&mut state, make_annotation(Seat::South, hcp_constraints(None, Some(10))));

        // Should not crash. Clamping defined by derive_ranges.
        let hcp = state.beliefs[&Seat::South].ranges.hcp;
        assert!(hcp.min <= hcp.max || hcp.min == hcp.max);
    }

    #[test]
    fn constraints_accumulated_losslessly() {
        let mut state = create_initial_belief_state();
        apply_annotation(&mut state, make_annotation(Seat::South, hcp_constraints(Some(12), None)));
        apply_annotation(&mut state, make_annotation(Seat::South, vec![FactConstraint {
            fact_id: "hand.suitLength.hearts".to_string(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(5),
            is_public: None,
        }]));

        assert_eq!(state.beliefs[&Seat::South].constraints.len(), 2);
    }

    #[test]
    fn balanced_constraint_derives_min_suit_lengths() {
        let mut state = create_initial_belief_state();
        apply_annotation(&mut state, make_annotation(Seat::South, vec![FactConstraint {
            fact_id: "hand.isBalanced".to_string(),
            operator: FactOperator::Boolean,
            value: ConstraintValue::Bool(true),
            is_public: None,
        }]));

        assert_eq!(state.beliefs[&Seat::South].ranges.is_balanced, Some(true));
        for suit in &[Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
            assert_eq!(state.beliefs[&Seat::South].ranges.suit_lengths[suit].min, 2);
        }
    }

    #[test]
    fn monotonic_narrowing_invariant() {
        let mut state = create_initial_belief_state();
        let seat = Seat::South;

        let ranges = [(5u32, 30u32), (10, 25), (12, 20), (15, 17)];

        let mut prev_min = 0u32;
        let mut prev_max = 40u32;

        for (min, max) in &ranges {
            apply_annotation(
                &mut state,
                make_annotation(seat, hcp_constraints(Some(*min), Some(*max))),
            );

            let beliefs = &state.beliefs[&seat];
            assert!(beliefs.ranges.hcp.min >= prev_min);
            assert!(beliefs.ranges.hcp.max <= prev_max);

            prev_min = beliefs.ranges.hcp.min;
            prev_max = beliefs.ranges.hcp.max;
        }
    }
}
