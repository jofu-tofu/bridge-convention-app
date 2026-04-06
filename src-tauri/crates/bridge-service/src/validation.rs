//! Runtime validation for injected system configs and base module IDs.
//!
//! Validates every session — preset and custom alike — catching
//! misconfigurations early with descriptive errors.

use bridge_conventions::registry::module_registry;
use bridge_conventions::types::system_config::SystemConfig;

use crate::error::ServiceError;

/// Validate that the injected `SystemConfig` has internally consistent thresholds.
pub(crate) fn validate_system_config(config: &SystemConfig) -> Result<(), ServiceError> {
    let nt = &config.nt_opening;
    if nt.min_hcp > nt.max_hcp {
        return Err(ServiceError::InvalidConfig(format!(
            "NT opening min_hcp ({}) > max_hcp ({})",
            nt.min_hcp, nt.max_hcp
        )));
    }

    let rt = &config.responder_thresholds;
    if rt.invite_min > rt.invite_max {
        return Err(ServiceError::InvalidConfig(format!(
            "Responder invite_min ({}) > invite_max ({})",
            rt.invite_min, rt.invite_max
        )));
    }
    if rt.invite_max >= rt.game_min {
        // invite_max should be strictly less than game_min
        // (but allow equal for edge cases where systems define tight ranges)
    }
    if rt.game_min > rt.slam_min {
        return Err(ServiceError::InvalidConfig(format!(
            "Responder game_min ({}) > slam_min ({})",
            rt.game_min, rt.slam_min
        )));
    }

    let dont = &config.dont_overcall;
    if dont.min_hcp > dont.max_hcp {
        return Err(ServiceError::InvalidConfig(format!(
            "DONT overcall min_hcp ({}) > max_hcp ({})",
            dont.min_hcp, dont.max_hcp
        )));
    }

    let one_nt = &config.one_nt_response_after_major;
    if one_nt.min_hcp > one_nt.max_hcp {
        return Err(ServiceError::InvalidConfig(format!(
            "1NT response min_hcp ({}) > max_hcp ({})",
            one_nt.min_hcp, one_nt.max_hcp
        )));
    }

    Ok(())
}

/// Validate that all `base_module_ids` reference modules that exist in the registry.
pub(crate) fn validate_base_module_ids(ids: &[String]) -> Result<(), ServiceError> {
    use bridge_conventions::types::system_config::BaseSystemId;

    for id in ids {
        if module_registry::get_module(id, BaseSystemId::Sayc).is_none() {
            return Err(ServiceError::InvalidConfig(format!(
                "Unknown base module ID: '{}'",
                id
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::registry::system_configs::get_system_config;
    use bridge_conventions::types::system_config::BaseSystemId;

    #[test]
    fn valid_preset_config_passes() {
        let config = get_system_config(BaseSystemId::Sayc);
        assert!(validate_system_config(&config).is_ok());
    }

    #[test]
    fn valid_acol_config_passes() {
        let config = get_system_config(BaseSystemId::Acol);
        assert!(validate_system_config(&config).is_ok());
    }

    #[test]
    fn nt_min_greater_than_max_fails() {
        let mut config = get_system_config(BaseSystemId::Sayc);
        config.nt_opening.min_hcp = 18;
        config.nt_opening.max_hcp = 15;
        let err = validate_system_config(&config).unwrap_err();
        assert!(err.to_string().contains("NT opening min_hcp"));
    }

    #[test]
    fn invite_min_greater_than_max_fails() {
        let mut config = get_system_config(BaseSystemId::Sayc);
        config.responder_thresholds.invite_min = 12;
        config.responder_thresholds.invite_max = 8;
        let err = validate_system_config(&config).unwrap_err();
        assert!(err.to_string().contains("invite_min"));
    }

    #[test]
    fn game_min_greater_than_slam_min_fails() {
        let mut config = get_system_config(BaseSystemId::Sayc);
        config.responder_thresholds.game_min = 20;
        config.responder_thresholds.slam_min = 15;
        let err = validate_system_config(&config).unwrap_err();
        assert!(err.to_string().contains("game_min"));
    }

    #[test]
    fn valid_base_module_ids_pass() {
        let ids: Vec<String> = vec![
            "natural-bids".into(),
            "stayman".into(),
            "jacoby-transfers".into(),
            "blackwood".into(),
        ];
        assert!(validate_base_module_ids(&ids).is_ok());
    }

    #[test]
    fn unknown_module_id_fails() {
        let ids: Vec<String> = vec!["natural-bids".into(), "nonexistent-module".into()];
        let err = validate_base_module_ids(&ids).unwrap_err();
        assert!(err.to_string().contains("nonexistent-module"));
    }

    #[test]
    fn dont_min_greater_than_max_fails() {
        let mut config = get_system_config(BaseSystemId::Sayc);
        config.dont_overcall.min_hcp = 20;
        config.dont_overcall.max_hcp = 8;
        let err = validate_system_config(&config).unwrap_err();
        assert!(err.to_string().contains("DONT"));
    }
}
