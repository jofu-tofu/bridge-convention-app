//! Handle-based session storage with single-session invariant.
//!
//! `SessionManager` enforces a single active session. Creating a new session
//! silently destroys the previous one. Handles are sequential string IDs.

use std::collections::HashMap;

use bridge_engine::types::Seat;
use bridge_session::session::{DrillConfig, SeatStrategy, SessionState};

use crate::error::ServiceError;
use crate::request_types::SessionHandle;

// ── ActiveSession ─────────────────────────────────────────────────

/// A live session with its handle, state, and config.
pub struct ActiveSession {
    pub handle: SessionHandle,
    pub state: SessionState,
    pub config: DrillConfig,
    /// Seat strategies extracted from DrillConfig for bidding controller.
    pub seat_strategies: HashMap<Seat, SeatStrategy>,
}

// ── SessionManager ────────────────────────────────────────────────

/// Manages the single active drill session.
///
/// `create()` destroys any previous session silently and returns a new handle.
pub struct SessionManager {
    session: Option<ActiveSession>,
    handle_counter: u64,
}

impl SessionManager {
    /// Create an empty session manager.
    pub fn new() -> Self {
        Self {
            session: None,
            handle_counter: 0,
        }
    }

    /// Create a new session, destroying any previous one.
    /// Returns the new session handle.
    pub fn create(
        &mut self,
        state: SessionState,
        config: DrillConfig,
        seat_strategies: HashMap<Seat, SeatStrategy>,
    ) -> SessionHandle {
        self.handle_counter += 1;
        let handle = format!("session-{}", self.handle_counter);
        self.session = Some(ActiveSession {
            handle: handle.clone(),
            state,
            config,
            seat_strategies,
        });
        handle
    }

    /// Get a reference to the active session.
    pub fn get(&self, handle: &str) -> Result<&ActiveSession, ServiceError> {
        match &self.session {
            Some(session) if session.handle == handle => Ok(session),
            Some(_) => Err(ServiceError::InvalidHandle(handle.to_string())),
            None => Err(ServiceError::NoSession),
        }
    }

    /// Get a mutable reference to the active session.
    pub fn get_mut(&mut self, handle: &str) -> Result<&mut ActiveSession, ServiceError> {
        match &mut self.session {
            Some(session) if session.handle == handle => Ok(session),
            Some(_) => Err(ServiceError::InvalidHandle(handle.to_string())),
            None => Err(ServiceError::NoSession),
        }
    }

    /// Destroy the active session.
    pub fn destroy(&mut self) {
        self.session = None;
    }

    /// Check if there is an active session.
    pub fn has_session(&self) -> bool {
        self.session.is_some()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::{Deal, Hand, Seat, Vulnerability};
    use bridge_session::inference::InferenceCoordinator;
    use bridge_session::types::{PlayPreference, PracticeFocus, PracticeMode};
    use std::collections::HashMap;

    fn make_deal() -> Deal {
        let mut hands = HashMap::new();
        for &seat in &bridge_engine::SEATS {
            hands.insert(seat, Hand { cards: vec![] });
        }
        Deal {
            hands,
            dealer: Seat::North,
            vulnerability: Vulnerability::None,
        }
    }

    fn make_state() -> SessionState {
        SessionState::new(
            make_deal(),
            Seat::South,
            "test".to_string(),
            None,
            InferenceCoordinator::new(None),
            false,
            PracticeMode::DecisionDrill,
            PracticeFocus::default(),
            PlayPreference::Skip,
            bridge_session::heuristics::play_profiles::PlayProfileId::ClubPlayer,
            0,
        )
    }

    fn make_config() -> DrillConfig {
        DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        }
    }

    #[test]
    fn create_returns_sequential_handles() {
        let mut mgr = SessionManager::new();
        let h1 = mgr.create(make_state(), make_config(), HashMap::new());
        assert_eq!(h1, "session-1");
        let h2 = mgr.create(make_state(), make_config(), HashMap::new());
        assert_eq!(h2, "session-2");
    }

    #[test]
    fn get_active_session() {
        let mut mgr = SessionManager::new();
        let h = mgr.create(make_state(), make_config(), HashMap::new());
        assert!(mgr.get(&h).is_ok());
    }

    #[test]
    fn get_stale_handle_fails() {
        let mut mgr = SessionManager::new();
        let h1 = mgr.create(make_state(), make_config(), HashMap::new());
        let _h2 = mgr.create(make_state(), make_config(), HashMap::new());
        // h1 is stale
        assert!(mgr.get(&h1).is_err());
    }

    #[test]
    fn get_no_session_fails() {
        let mgr = SessionManager::new();
        assert!(mgr.get("session-1").is_err());
    }

    #[test]
    fn destroy_clears_session() {
        let mut mgr = SessionManager::new();
        let h = mgr.create(make_state(), make_config(), HashMap::new());
        assert!(mgr.has_session());
        mgr.destroy();
        assert!(!mgr.has_session());
        assert!(mgr.get(&h).is_err());
    }

    #[test]
    fn get_mut_works() {
        let mut mgr = SessionManager::new();
        let h = mgr.create(make_state(), make_config(), HashMap::new());
        let session = mgr.get_mut(&h).unwrap();
        session.state.convention_id = "modified".to_string();
        assert_eq!(mgr.get(&h).unwrap().state.convention_id, "modified");
    }
}
