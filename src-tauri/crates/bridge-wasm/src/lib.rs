use wasm_bindgen::prelude::*;

use bridge_engine::types::{Call, Card, Seat};
use bridge_service::{ServicePort, ServicePortImpl, SessionConfig};

// ── Serialization helpers ─────────────────────────────────────────

fn to_js<T: serde::Serialize>(val: &T) -> Result<JsValue, JsError> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    val.serialize(&serializer)
        .map_err(|e| JsError::new(&e.to_string()))
}

fn from_js<T: serde::de::DeserializeOwned>(val: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(val).map_err(|e| JsError::new(&e.to_string()))
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

    // ── Session lifecycle ─────────────────────────────────────────

    pub fn create_session(&mut self, config: JsValue) -> Result<JsValue, JsError> {
        let config: SessionConfig = from_js(config)?;
        let handle = self
            .inner
            .create_session(config)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&handle)
    }

    pub fn start_drill(&mut self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .start_drill(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    // ── Bidding ───────────────────────────────────────────────────

    pub fn submit_bid(&mut self, handle: &str, call: JsValue) -> Result<JsValue, JsError> {
        let call: Call = from_js(call)?;
        let result = self
            .inner
            .submit_bid(handle, call)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
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
        let result = self
            .inner
            .accept_prompt(handle, mode.as_deref(), seat_override)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
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
        let result = self
            .inner
            .play_card(handle, card, seat)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn play_single_card(
        &mut self,
        handle: &str,
        card: JsValue,
        seat: JsValue,
    ) -> Result<JsValue, JsError> {
        let card: Card = from_js(card)?;
        let seat: Seat = from_js(seat)?;
        let result = self
            .inner
            .play_single_card(handle, card, seat)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn record_play_recommendation(
        &mut self,
        handle: &str,
        recommendation: JsValue,
    ) -> Result<JsValue, JsError> {
        let rec: bridge_session::session::PlayRecommendation = from_js(recommendation)?;
        self.inner
            .record_play_recommendation(handle, rec)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&())
    }

    pub fn skip_to_review(&mut self, handle: &str) -> Result<JsValue, JsError> {
        self.inner
            .skip_to_review(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&())
    }

    pub fn update_play_profile(
        &mut self,
        handle: &str,
        profile_id: &str,
    ) -> Result<JsValue, JsError> {
        self.inner
            .update_play_profile(handle, profile_id)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&())
    }

    // ── Query (viewport getters) ──────────────────────────────────

    pub fn get_bidding_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_bidding_viewport(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_declarer_prompt_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_declarer_prompt_viewport(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_playing_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_playing_viewport(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_explanation_viewport(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_explanation_viewport(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    // ── Inference ─────────────────────────────────────────────────

    pub fn get_public_belief_state(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_public_belief_state(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    // ── DDS ───────────────────────────────────────────────────────

    pub fn get_dds_solution(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_dds_solution(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_deal_pbn(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_deal_pbn(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    // ── Catalog ───────────────────────────────────────────────────

    pub fn list_conventions(&self) -> Result<JsValue, JsError> {
        let result = self.inner.list_conventions();
        to_js(&result)
    }

    pub fn list_modules(&self) -> Result<JsValue, JsError> {
        let result = self.inner.list_modules();
        to_js(&result)
    }

    // ── Learning ──────────────────────────────────────────────────

    pub fn get_module_learning_viewport(&self, module_id: &str) -> Result<JsValue, JsError> {
        let result = self.inner.get_module_learning_viewport(module_id);
        to_js(&result)
    }

    pub fn get_bundle_flow_tree(&self, bundle_id: &str) -> Result<JsValue, JsError> {
        let result = self.inner.get_bundle_flow_tree(bundle_id);
        to_js(&result)
    }

    pub fn get_module_flow_tree(&self, module_id: &str) -> Result<JsValue, JsError> {
        let result = self.inner.get_module_flow_tree(module_id);
        to_js(&result)
    }
}

// ── DevServicePort methods (debug builds only) ────────────────────

#[cfg(debug_assertions)]
#[wasm_bindgen]
impl WasmServicePort {
    pub fn get_expected_bid(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_expected_bid(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_debug_snapshot(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_debug_snapshot(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_debug_log(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_debug_log(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_inference_timeline(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_inference_timeline(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }

    pub fn get_convention_name(&self, handle: &str) -> Result<JsValue, JsError> {
        let result = self
            .inner
            .get_convention_name(handle)
            .map_err(|e| JsError::new(&e.to_string()))?;
        to_js(&result)
    }
}
