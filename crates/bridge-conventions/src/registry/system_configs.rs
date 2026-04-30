//! Concrete SystemConfig constants for each base bidding system.
//!
//! Mirrors the TS constants in `conventions/definitions/system-config.ts`.

use crate::types::system_config::{
    BaseSystemId, CompetitiveThresholds, DontOvercallConfig, InterferenceThresholds,
    NtOpeningConfig, OneNtForcingStatus, OneNtResponseAfterMajorConfig, OpenerRebidThresholds,
    OpeningConfig, OpeningHcpRange, OpeningRequirements, PointConfig, PointFormula,
    ResponderThresholds, SuitResponseConfig, SuitResponseForcingDuration, SystemConfig,
    TotalPointEquivalent,
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
            minimum_min_hcp: 13,
            minimum_max_hcp: 15,
            medium_min_hcp: 16,
            medium_max_hcp: 18,
            maximum_min_hcp: 19,
            maximum_max_hcp: 22,
            reverse_min_hcp: 16,
            jump_shift_min_hcp: 19,
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
        opening: OpeningConfig {
            weak_two: OpeningHcpRange {
                min_hcp: 6,
                max_hcp: 11,
            },
            strong_2c_min: 22,
        },
        dont_overcall: DontOvercallConfig {
            min_hcp: 8,
            max_hcp: 15,
        },
        competitive: CompetitiveThresholds {
            simple_overcall_min_hcp: 8,
            simple_overcall_max_hcp: 16,
            jump_overcall_max_hcp: 11,
            takeout_double_min_hcp: 12,
            nt_overcall_min_hcp: 15,
            nt_overcall_max_hcp: 18,
        },
        point_config: PointConfig {
            nt_formula: PointFormula {
                include_shortage: false,
                include_length: false,
            },
            trump_formula: PointFormula {
                include_shortage: true,
                include_length: false,
            },
        },
    }
}

/// 2/1 Game Forcing system configuration.
fn two_over_one_system_config() -> SystemConfig {
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
            minimum_min_hcp: 13,
            minimum_max_hcp: 15,
            medium_min_hcp: 16,
            medium_max_hcp: 18,
            maximum_min_hcp: 19,
            maximum_max_hcp: 22,
            reverse_min_hcp: 16,
            jump_shift_min_hcp: 19,
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
        opening: OpeningConfig {
            weak_two: OpeningHcpRange {
                min_hcp: 5,
                max_hcp: 10,
            },
            strong_2c_min: 22,
        },
        dont_overcall: DontOvercallConfig {
            min_hcp: 8,
            max_hcp: 15,
        },
        competitive: CompetitiveThresholds {
            simple_overcall_min_hcp: 8,
            simple_overcall_max_hcp: 16,
            jump_overcall_max_hcp: 10,
            takeout_double_min_hcp: 12,
            nt_overcall_min_hcp: 15,
            nt_overcall_max_hcp: 18,
        },
        point_config: PointConfig {
            nt_formula: PointFormula {
                include_shortage: false,
                include_length: false,
            },
            trump_formula: PointFormula {
                include_shortage: true,
                include_length: false,
            },
        },
    }
}

/// Acol (UK standard weak-NT) system configuration.
fn acol_system_config() -> SystemConfig {
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
            minimum_min_hcp: 12,
            minimum_max_hcp: 12,
            medium_min_hcp: 13,
            medium_max_hcp: 18,
            maximum_min_hcp: 19,
            maximum_max_hcp: 22,
            reverse_min_hcp: 13,
            jump_shift_min_hcp: 19,
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
        opening: OpeningConfig {
            weak_two: OpeningHcpRange {
                min_hcp: 6,
                max_hcp: 10,
            },
            strong_2c_min: 22,
        },
        dont_overcall: DontOvercallConfig {
            min_hcp: 8,
            max_hcp: 15,
        },
        competitive: CompetitiveThresholds {
            simple_overcall_min_hcp: 8,
            simple_overcall_max_hcp: 16,
            jump_overcall_max_hcp: 10,
            takeout_double_min_hcp: 12,
            nt_overcall_min_hcp: 15,
            nt_overcall_max_hcp: 18,
        },
        point_config: PointConfig {
            nt_formula: PointFormula {
                include_shortage: false,
                include_length: false,
            },
            trump_formula: PointFormula {
                include_shortage: true,
                include_length: false,
            },
        },
    }
}

/// Look up SystemConfig by base system ID.
/// Custom systems are caller-provided; falls back to SAYC for the `Custom` variant.
pub fn get_system_config(system_id: BaseSystemId) -> SystemConfig {
    match system_id {
        BaseSystemId::Sayc => sayc_system_config(),
        BaseSystemId::TwoOverOne => two_over_one_system_config(),
        BaseSystemId::Acol => acol_system_config(),
        BaseSystemId::Custom => sayc_system_config(),
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
        assert_eq!(config.opener_rebid.minimum_max_hcp, 15);
        assert_eq!(config.opener_rebid.medium_min_hcp, 16);
        assert_eq!(config.opener_rebid.medium_max_hcp, 18);
        assert_eq!(config.opener_rebid.maximum_min_hcp, 19);
        assert_eq!(config.opener_rebid.maximum_max_hcp, 22);
        assert_eq!(config.opener_rebid.reverse_min_hcp, 16);
        assert_eq!(config.opener_rebid.jump_shift_min_hcp, 19);
        assert_eq!(config.competitive.simple_overcall_min_hcp, 8);
        assert_eq!(config.competitive.simple_overcall_max_hcp, 16);
        assert_eq!(config.competitive.jump_overcall_max_hcp, 11);
        assert_eq!(config.competitive.takeout_double_min_hcp, 12);
        assert_eq!(config.competitive.nt_overcall_min_hcp, 15);
        assert_eq!(config.competitive.nt_overcall_max_hcp, 18);
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
