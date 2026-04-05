use wasm_bindgen::prelude::*;

use bridge_engine::types::{Call, Card, Seat};
#[cfg(debug_assertions)]
use bridge_service::DevServicePort;
use bridge_service::{ServicePort, ServicePortImpl, SessionConfig};

// ── Serialization helpers ─────────────────────────────────────────

fn to_js<T: serde::Serialize>(val: T) -> Result<JsValue, JsError> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    val.serialize(&serializer)
        .map_err(|e| JsError::new(&e.to_string()))
}

fn from_js<T: serde::de::DeserializeOwned>(val: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))
}

fn service_error(err: bridge_service::ServiceError) -> JsError {
    JsError::new(&err.to_string())
}

// ── WasmServicePort ───────────────────────────────────────────────

#[wasm_bindgen]
pub struct WasmServicePort {
    inner: ServicePortImpl,
}

#[wasm_bindgen]
impl WasmServicePort {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: ServicePortImpl::new(),
        }
    }

    fn with_service<T>(
        &self,
        f: impl FnOnce(&ServicePortImpl) -> Result<T, bridge_service::ServiceError>,
    ) -> Result<T, JsError> {
        f(&self.inner).map_err(service_error)
    }

    fn with_service_mut<T>(
        &mut self,
        f: impl FnOnce(&mut ServicePortImpl) -> Result<T, bridge_service::ServiceError>,
    ) -> Result<T, JsError> {
        f(&mut self.inner).map_err(service_error)
    }

    // ── Session lifecycle ─────────────────────────────────────────

    pub fn create_session(&mut self, config: JsValue) -> Result<JsValue, JsError> {
        let config: SessionConfig = from_js(config)?;
        self.with_service_mut(|service| service.create_session(config))
            .and_then(to_js)
    }

    pub fn start_drill(&mut self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service_mut(|service| service.start_drill(handle))
            .and_then(to_js)
    }

    // ── Bidding ───────────────────────────────────────────────────

    pub fn submit_bid(&mut self, handle: &str, call: JsValue) -> Result<JsValue, JsError> {
        let call: Call = from_js(call)?;
        self.with_service_mut(|service| service.submit_bid(handle, call))
            .and_then(to_js)
    }

    // ── Phase transitions ─────────────────────────────────────────

    pub fn accept_prompt(
        &mut self,
        handle: &str,
        mode: JsValue,
        seat_override: JsValue,
    ) -> Result<JsValue, JsError> {
        let mode: Option<String> = from_js(mode)?;
        let seat_override: Option<Seat> = from_js(seat_override)?;
        self.with_service_mut(|service| {
            service.accept_prompt(handle, mode.as_deref(), seat_override)
        })
        .and_then(to_js)
    }

    // ── Play ──────────────────────────────────────────────────────

    pub fn play_card(
        &mut self,
        handle: &str,
        card: JsValue,
        seat: JsValue,
    ) -> Result<JsValue, JsError> {
        let card: Card = from_js(card)?;
        let seat: Seat = from_js(seat)?;
        self.with_service_mut(|service| service.play_card(handle, card, seat))
            .and_then(to_js)
    }

    pub fn play_single_card(
        &mut self,
        handle: &str,
        card: JsValue,
        seat: JsValue,
    ) -> Result<JsValue, JsError> {
        let card: Card = from_js(card)?;
        let seat: Seat = from_js(seat)?;
        self.with_service_mut(|service| service.play_single_card(handle, card, seat))
            .and_then(to_js)
    }

    pub fn skip_to_review(&mut self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service_mut(|service| service.skip_to_review(handle))
            .and_then(to_js)
    }

    pub fn update_play_profile(
        &mut self,
        handle: &str,
        profile_id: &str,
    ) -> Result<JsValue, JsError> {
        self.with_service_mut(|service| service.update_play_profile(handle, profile_id))
            .and_then(to_js)
    }

    // ── Query (viewport getters) ──────────────────────────────────

    pub fn get_bidding_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_bidding_viewport(handle))
            .and_then(to_js)
    }

    pub fn get_declarer_prompt_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_declarer_prompt_viewport(handle))
            .and_then(to_js)
    }

    pub fn get_playing_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_playing_viewport(handle))
            .and_then(to_js)
    }

    pub fn get_explanation_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_explanation_viewport(handle))
            .and_then(to_js)
    }

    // ── Inference ─────────────────────────────────────────────────

    pub fn get_public_belief_state(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_public_belief_state(handle))
            .and_then(to_js)
    }

    // ── DDS ───────────────────────────────────────────────────────

    pub fn get_dds_solution(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_dds_solution(handle))
            .and_then(to_js)
    }

    pub fn get_deal_pbn(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_deal_pbn(handle))
            .and_then(to_js)
    }

    // ── Catalog ───────────────────────────────────────────────────

    pub fn list_conventions(&self) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.list_conventions()))
            .and_then(to_js)
    }

    pub fn list_modules(&self) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.list_modules()))
            .and_then(to_js)
    }

    // ── Learning ──────────────────────────────────────────────────

    pub fn get_module_learning_viewport(&self, module_id: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.get_module_learning_viewport(module_id)))
            .and_then(to_js)
    }

    pub fn get_bundle_flow_tree(&self, bundle_id: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.get_bundle_flow_tree(bundle_id)))
            .and_then(to_js)
    }

    pub fn get_module_flow_tree(&self, module_id: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| Ok(service.get_module_flow_tree(module_id)))
            .and_then(to_js)
    }
}

// ── DevServicePort methods (debug builds only) ────────────────────

#[cfg(debug_assertions)]
#[wasm_bindgen]
impl WasmServicePort {
    pub fn get_expected_bid(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_expected_bid(handle))
            .and_then(to_js)
    }

    pub fn get_debug_log(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_debug_log(handle))
            .and_then(to_js)
    }

    pub fn get_inference_timeline(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_inference_timeline(handle))
            .and_then(to_js)
    }

    pub fn get_convention_name(&self, handle: &str) -> Result<JsValue, JsError> {
        self.with_service(|service| service.get_convention_name(handle))
            .and_then(to_js)
    }
}
