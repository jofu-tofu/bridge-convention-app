//! Phase state machine — pure logic ported from `src/session/phase-machine.ts`.

use crate::types::GamePhase;

/// Valid phase transitions. Returns the set of phases reachable from `from`.
pub fn valid_targets(from: GamePhase) -> &'static [GamePhase] {
    match from {
        GamePhase::Bidding => &[
            GamePhase::DeclarerPrompt,
            GamePhase::Playing,
            GamePhase::Explanation,
        ],
        GamePhase::DeclarerPrompt => &[GamePhase::Playing, GamePhase::Explanation],
        GamePhase::Playing => &[GamePhase::Explanation],
        GamePhase::Explanation => &[GamePhase::DeclarerPrompt],
    }
}

/// Check if a phase transition is valid.
pub fn is_valid_transition(from: GamePhase, to: GamePhase) -> bool {
    valid_targets(from).contains(&to)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bidding_can_go_to_three_phases() {
        assert!(is_valid_transition(
            GamePhase::Bidding,
            GamePhase::DeclarerPrompt
        ));
        assert!(is_valid_transition(GamePhase::Bidding, GamePhase::Playing));
        assert!(is_valid_transition(
            GamePhase::Bidding,
            GamePhase::Explanation
        ));
    }

    #[test]
    fn bidding_cannot_go_to_bidding() {
        assert!(!is_valid_transition(GamePhase::Bidding, GamePhase::Bidding));
    }

    #[test]
    fn declarer_prompt_transitions() {
        assert!(is_valid_transition(
            GamePhase::DeclarerPrompt,
            GamePhase::Playing
        ));
        assert!(is_valid_transition(
            GamePhase::DeclarerPrompt,
            GamePhase::Explanation
        ));
        assert!(!is_valid_transition(
            GamePhase::DeclarerPrompt,
            GamePhase::Bidding
        ));
    }

    #[test]
    fn playing_only_goes_to_explanation() {
        assert!(is_valid_transition(
            GamePhase::Playing,
            GamePhase::Explanation
        ));
        assert!(!is_valid_transition(GamePhase::Playing, GamePhase::Bidding));
        assert!(!is_valid_transition(
            GamePhase::Playing,
            GamePhase::DeclarerPrompt
        ));
        assert!(!is_valid_transition(GamePhase::Playing, GamePhase::Playing));
    }

    #[test]
    fn explanation_only_goes_to_declarer_prompt() {
        assert!(is_valid_transition(
            GamePhase::Explanation,
            GamePhase::DeclarerPrompt
        ));
        assert!(!is_valid_transition(
            GamePhase::Explanation,
            GamePhase::Bidding
        ));
        assert!(!is_valid_transition(
            GamePhase::Explanation,
            GamePhase::Playing
        ));
        assert!(!is_valid_transition(
            GamePhase::Explanation,
            GamePhase::Explanation
        ));
    }
}
