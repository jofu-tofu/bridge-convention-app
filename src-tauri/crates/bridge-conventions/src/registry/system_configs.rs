//! Concrete SystemConfig constants for each base bidding system.
//!
//! Mirrors the TS constants in `conventions/definitions/system-config.ts`.

use crate::types::system_config::{
    BaseSystemId, DontOvercallConfig, InterferenceThresholds, NtOpeningConfig,
    OneNtForcingStatus, OneNtResponseAfterMajorConfig, OpeningRequirements,
    OpenerRebidThresholds, ResponderThresholds, SuitResponseConfig,
    SuitResponseForcingDuration, SystemConfig, TotalPointEquivalent,
};

/// Standard American Yellow Card (SAYC) system configuration.
pub fn sayc_system_config() -> SystemConfig {
    SystemConfig {
        system_id: BaseSystemId::Sayc,
        display_name: "Standard American Yellow Card".to_string(),
        nt_opening: NtOpeningConfig {
            min_hcp: 15,
            max_hcp: 17,
        },
        responder_thresholds: ResponderThresholds {
            invite_min: 8,
            invite_max: 9,
            game_min: 10,
            slam_min: 15,
            invite_min_tp: TotalPointEquivalent { trump: 8 },
            invite_max_tp: TotalPointEquivalent { trump: 10 },
            game_min_tp: TotalPointEquivalent { trump: 10 },
            slam_min_tp: TotalPointEquivalent { trump: 16 },
        },
        opener_rebid: OpenerRebidThresholds {
            not_minimum: 16,
            not_minimum_tp: TotalPointEquivalent { trump: 16 },
        },
        interference: InterferenceThresholds { redouble_min: 10 },
        suit_response: SuitResponseConfig {
            two_level_min: 10,
            two_level_forcing_duration: SuitResponseForcingDuration::OneRound,
        },
        one_nt_response_after_major: OneNtResponseAfterMajorConfig {
            forcing: OneNtForcingStatus::NonForcing,
            max_hcp: 10,
            min_hcp: 6,
        },
        opening_requirements: OpeningRequirements {
            major_suit_min_length: 5,
        },
        dont_overcall: DontOvercallConfig {
            min_hcp: 8,
            max_hcp: 15,
        },
    }
}

/// 2/1 Game Forcing system configuration.
pub fn two_over_one_system_config() -> SystemConfig {
    SystemConfig {
        system_id: BaseSystemId::TwoOverOne,
        display_name: "2/1 Game Forcing".to_string(),
        nt_opening: NtOpeningConfig {
            min_hcp: 15,
            max_hcp: 17,
        },
        responder_thresholds: ResponderThresholds {
            invite_min: 8,
            invite_max: 9,
            game_min: 10,
            slam_min: 15,
            invite_min_tp: TotalPointEquivalent { trump: 8 },
            invite_max_tp: TotalPointEquivalent { trump: 10 },
            game_min_tp: TotalPointEquivalent { trump: 10 },
            slam_min_tp: TotalPointEquivalent { trump: 16 },
        },
        opener_rebid: OpenerRebidThresholds {
            not_minimum: 16,
            not_minimum_tp: TotalPointEquivalent { trump: 16 },
        },
        interference: InterferenceThresholds { redouble_min: 10 },
        suit_response: SuitResponseConfig {
            two_level_min: 12,
            two_level_forcing_duration: SuitResponseForcingDuration::Game,
        },
        one_nt_response_after_major: OneNtResponseAfterMajorConfig {
            forcing: OneNtForcingStatus::SemiForcing,
            max_hcp: 12,
            min_hcp: 6,
        },
        opening_requirements: OpeningRequirements {
            major_suit_min_length: 5,
        },
        dont_overcall: DontOvercallConfig {
            min_hcp: 8,
            max_hcp: 15,
        },
    }
}

/// Acol (UK standard weak-NT) system configuration.
pub fn acol_system_config() -> SystemConfig {
    SystemConfig {
        system_id: BaseSystemId::Acol,
        display_name: "Acol".to_string(),
        nt_opening: NtOpeningConfig {
            min_hcp: 12,
            max_hcp: 14,
        },
        responder_thresholds: ResponderThresholds {
            invite_min: 10,
            invite_max: 12,
            game_min: 13,
            slam_min: 19,
            invite_min_tp: TotalPointEquivalent { trump: 10 },
            invite_max_tp: TotalPointEquivalent { trump: 13 },
            game_min_tp: TotalPointEquivalent { trump: 13 },
            slam_min_tp: TotalPointEquivalent { trump: 20 },
        },
        opener_rebid: OpenerRebidThresholds {
            not_minimum: 13,
            not_minimum_tp: TotalPointEquivalent { trump: 13 },
        },
        interference: InterferenceThresholds { redouble_min: 9 },
        suit_response: SuitResponseConfig {
            two_level_min: 10,
            two_level_forcing_duration: SuitResponseForcingDuration::OneRound,
        },
        one_nt_response_after_major: OneNtResponseAfterMajorConfig {
            forcing: OneNtForcingStatus::NonForcing,
            max_hcp: 9,
            min_hcp: 6,
        },
        opening_requirements: OpeningRequirements {
            major_suit_min_length: 4,
        },
        dont_overcall: DontOvercallConfig {
            min_hcp: 8,
            max_hcp: 15,
        },
    }
}

/// Look up SystemConfig by base system ID.
pub fn get_system_config(system_id: BaseSystemId) -> SystemConfig {
    match system_id {
        BaseSystemId::Sayc => sayc_system_config(),
        BaseSystemId::TwoOverOne => two_over_one_system_config(),
        BaseSystemId::Acol => acol_system_config(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sayc_config_values() {
        let config = sayc_system_config();
        assert_eq!(config.nt_opening.min_hcp, 15);
        assert_eq!(config.nt_opening.max_hcp, 17);
        assert_eq!(config.responder_thresholds.invite_min, 8);
        assert_eq!(config.opening_requirements.major_suit_min_length, 5);
    }

    #[test]
    fn acol_weak_nt() {
        let config = acol_system_config();
        assert_eq!(config.nt_opening.min_hcp, 12);
        assert_eq!(config.nt_opening.max_hcp, 14);
        assert_eq!(config.opening_requirements.major_suit_min_length, 4);
    }

    #[test]
    fn two_over_one_game_forcing() {
        let config = two_over_one_system_config();
        assert_eq!(
            config.suit_response.two_level_forcing_duration,
            SuitResponseForcingDuration::Game
        );
        assert_eq!(config.suit_response.two_level_min, 12);
    }

    #[test]
    fn get_system_config_lookup() {
        let sayc = get_system_config(BaseSystemId::Sayc);
        assert_eq!(sayc.system_id, BaseSystemId::Sayc);
        let acol = get_system_config(BaseSystemId::Acol);
        assert_eq!(acol.system_id, BaseSystemId::Acol);
    }
}
