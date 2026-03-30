# Migration Architecture

Detailed architectural decisions and Rust type sketches for the Rust/WASM migration.

## Target Crate Structure

```
src-tauri/crates/
  bridge-engine/         # (exists) Game primitives: types, hand eval, deal gen, auction, scoring
  bridge-conventions/    # (new) Convention system — all of conventions/ ported
    src/
      lib.rs
      types/             # BidMeaning, FactDefinition, ConventionModule, etc.
      fact_dsl/          # FactComposition interpreter
      pipeline/          # Surface selection, evaluation, arbitration
      teaching/          # Teaching resolution, projection, parse tree
      adapter/           # Convention→strategy bridge
      bundle/            # Bundle registry, bundle loading
      system_config/     # SystemConfig, system fact vocabulary
  bridge-session/        # (new) Session + inference
    src/
      lib.rs
      session_state/     # SessionState, DrillSession
      controllers/       # BiddingController, PlayController
      heuristics/        # Strategy chain, natural fallback, heuristic play
      inference/         # InferenceEngine, posterior (factor compiler, backend, query port)
      viewports/         # Viewport builders (bidding, playing, review)
  bridge-service/        # (new) ServicePort implementation
    src/
      lib.rs
      port/              # ServicePort trait + impl
      display/           # Call/card formatting, hand summary
      evaluation/        # Atom evaluator, playthrough evaluator
  bridge-wasm/           # (exists, extended) Full ServicePort via wasm-bindgen
  bridge-tauri/          # (exists, extended) Full ServicePort via Tauri commands
```

## Declarative Fact DSL

TS `FactComposition` is already a tree of `and`/`or`/`not`/`primitive` nodes. Migration promotes this to the primary evaluation path, replacing imperative `FactEvaluatorFn` functions.

### Rust Type Sketch

```rust
use serde::{Deserialize, Serialize};

/// A fact composition tree — the declarative DSL for fact evaluation.
/// Deserialized from convention definition JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FactComposition {
    #[serde(rename = "primitive")]
    Primitive { clause: PrimitiveClause },
    #[serde(rename = "and")]
    And { children: Vec<FactComposition> },
    #[serde(rename = "or")]
    Or { children: Vec<FactComposition> },
    #[serde(rename = "not")]
    Not { child: Box<FactComposition> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum PrimitiveClause {
    #[serde(rename = "hcp-range")]
    HcpRange { min: Option<u8>, max: Option<u8> },
    #[serde(rename = "suit-length")]
    SuitLength { suit: Suit, min: Option<u8>, max: Option<u8> },
    #[serde(rename = "boolean")]
    Boolean { fact_id: String, expected: bool },
    #[serde(rename = "enum")]
    Enum { fact_id: String, value: String },
    // ... other clause types
}
```

## Convention Module Serialization

```rust
/// A convention module — the unit of convention authoring.
/// Fully JSON-serializable. No Rust code per convention.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConventionModule {
    pub id: String,
    pub name: String,
    pub system_id: String,
    pub fsm: LocalFsm,
    pub surfaces: Vec<ResolvedSurface>,
    pub fact_definitions: Vec<FactDefinition>,
    pub teaching: ModuleTeaching,
}

/// Local FSM — the state machine for a convention module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalFsm {
    pub initial_state: String,
    pub states: Vec<StateEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateEntry {
    pub id: String,
    pub turn_role: TurnRole,
    pub routes: Vec<RouteExpr>,
    pub negotiations: Vec<NegotiationExpr>,
    pub phase_transition: Option<PhaseTransition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TurnRole {
    #[serde(rename = "acting")]
    Acting,
    #[serde(rename = "partner")]
    Partner,
    #[serde(rename = "opponent")]
    Opponent,
}
```

## BidMeaning and Surface Evaluation

```rust
/// A bid meaning — the canonical unit of convention semantics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BidMeaning {
    pub name: BidName,
    pub summary: BidSummary,
    pub clauses: Vec<MeaningClause>,
    pub recommendation: RecommendationBand,
    pub disclosure: Disclosure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeaningClause {
    pub fact_id: String,
    pub operator: FactOperator,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FactOperator {
    #[serde(rename = "eq")]
    Eq,
    #[serde(rename = "gte")]
    Gte,
    #[serde(rename = "lte")]
    Lte,
    #[serde(rename = "range")]
    Range,
    #[serde(rename = "in")]
    In,
}

/// Branded string types (newtype pattern in Rust)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BidName(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BidSummary(pub String);
```

## ServicePort WASM Boundary

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmServicePort {
    inner: bridge_service::ServicePort,
}

#[wasm_bindgen]
impl WasmServicePort {
    /// All methods accept/return JsValue (JSON serialized).
    /// TS proxy deserializes on the other side.
    #[wasm_bindgen(js_name = "createSession")]
    pub fn create_session(&mut self, config: JsValue) -> Result<JsValue, JsError> {
        let config: SessionConfig = serde_wasm_bindgen::from_value(config)?;
        let result = self.inner.create_session(config);
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    #[wasm_bindgen(js_name = "submitBid")]
    pub fn submit_bid(&mut self, handle: JsValue, call: JsValue) -> Result<JsValue, JsError> {
        let handle: SessionHandle = serde_wasm_bindgen::from_value(handle)?;
        let call: Call = serde_wasm_bindgen::from_value(call)?;
        let result = self.inner.submit_bid(&handle, call);
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    /// Load paid convention definitions at runtime.
    #[wasm_bindgen(js_name = "loadBundleDefs")]
    pub fn load_bundle_defs(&mut self, defs: JsValue) -> Result<(), JsError> {
        let defs: Vec<ConventionModule> = serde_wasm_bindgen::from_value(defs)?;
        self.inner.load_bundle_defs(defs);
        Ok(())
    }
}
```

## Two-Port Model

```
Browser
├── ServicePort (WASM)           ← compute, stateless, client-side
│   ├── createSession()
│   ├── submitBid()
│   ├── playCard()
│   ├── loadBundleDefs()         ← paid content injection
│   └── ... (23 methods total)
│
└── DataPort (HTTP → server)     ← auth, entitlements, progress (future)
    ├── login()
    ├── getEntitlements()
    ├── getBundleDefs(ids)
    ├── syncProgress()
    └── getProfile()
```

## Serialization Format

All convention definitions serialize as JSON. `serde` with `#[serde(tag = "type")]` for enum variants ensures compatibility with existing TS type discriminators. The JSON schema is the contract — TS build scripts serialize current convention definitions to JSON, Rust deserializes them.

## Validation Strategy

Each phase uses **golden-master snapshots as a reference**, not a rigid spec. Capture TS outputs as JSON fixtures before implementing Rust. These catch **unintentional** drift during the port — but intentional simplifications and design improvements are expected. The TS codebase has design decisions made before the full feature set was understood; the migration is an opportunity to fix those.

When Rust output differs from a TS snapshot, ask: "bug or improvement?" If it's an improvement, update the fixture and document the design decision.

- Phase 1: JSON round-trip tests (serialize TS → deserialize Rust → re-serialize → compare)
- Phase 2: Fact evaluation snapshots (hand × bundle → fact results) — reference, not exact-match
- Phase 3: Pipeline result snapshots (auction context → PipelineResult) — reference, not exact-match
- Phase 4: Full drill session replays (create → bid → play → review viewports) — reference, not exact-match
- Phase 5: E2E tests + WASM binary size targets
