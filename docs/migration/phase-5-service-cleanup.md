# Phase 5: Service Cleanup

Full ServicePort in Rust. TS service/ becomes a thin WASM proxy. Delete TS backend modules.

**Status:** Complete
**Estimated LOC:** ~2,000 Rust
**Dependencies:** Phase 4 (inference + session)
**Rust concepts to learn:** wasm-bindgen advanced patterns, serde_wasm_bindgen, error handling across WASM boundary

## Goal

The entire backend runs in Rust/WASM. TS `service/` is a ~100 LOC proxy that serializes requests, calls WASM, and deserializes responses. TS `conventions/`, `inference/`, and `session/` directories are deleted.

## TS Source Locations

| Component | TS source | Purpose |
|-----------|-----------|---------|
| ServicePort interface | `src/service/port.ts` | 23-method interface |
| Local implementation | `src/service/local-service.ts` | Current TS impl (factory + SessionManager) |
| Response types | `src/service/response-types.ts` | All viewport/response DTOs |
| Request types | `src/service/request-types.ts` | SessionConfig, request types |
| Display formatting | `src/service/display/` | `format.ts`, `convention-card.ts`, `hand-summary.ts` |
| CLI evaluation | `src/service/evaluation/` | `atom-evaluator.ts`, `playthrough-evaluator.ts` |

## New Crate

```
crates/bridge-service/
  Cargo.toml
  src/
    lib.rs
    port.rs              # ServicePort trait
    impl.rs              # ServicePort implementation (delegates to bridge-session)
    display/
      mod.rs
      format.rs          # Call/card formatting
      convention_card.rs # Convention card builder
      hand_summary.rs    # Hand summary
    evaluation/
      mod.rs
      atom_evaluator.rs
      playthrough_evaluator.rs
    request_types.rs
    response_types.rs
```

## Implementation Steps

1. **Define `ServicePort` trait** in Rust mirroring all 23 TS methods
2. **Implement `ServicePortImpl`** delegating to `bridge-session` crate
3. **Port display/ utilities** (call formatting, convention cards, hand summary)
4. **Port evaluation/ logic** (atom evaluator, playthrough evaluator)
5. **Extend `bridge-wasm`** with full ServicePort via `wasm-bindgen`
6. ~~**Extend `bridge-tauri`** with full ServicePort via Tauri commands~~ (removed — desktop path dropped)
7. **Rewrite TS `service/`** as thin WASM proxy (~100 LOC)
8. **Delete TS backend** (`conventions/`, `inference/`, `session/`)

## TS Service Proxy (Target State)

```typescript
// src/service/wasm-service.ts — the entire TS service layer after migration
import type { ServicePort } from './port';

export class WasmService implements ServicePort {
  private wasm: WasmServicePort;

  async createSession(config: SessionConfig): Promise<DrillStartResult> {
    return this.wasm.createSession(config);
  }

  async submitBid(handle: SessionHandle, call: Call): Promise<BidSubmitResult> {
    return this.wasm.submitBid(handle, call);
  }

  // ... 21 more methods, all one-liners
}
```

## Verification

- **E2E tests pass** with WASM backend (no TS backend)
- **WASM binary size target:** track and report, optimize if needed
- **No TS backend imports remain** in `components/`, `stores/`, `cli/`
- **CI gate:** Full test suite (unit + E2E) with WASM-only backend

## Completion Checklist

- [ ] `ServicePort` trait defined in Rust
- [ ] Full implementation delegating to `bridge-session`
- [ ] Display utilities ported
- [ ] Evaluation logic ported
- [ ] `bridge-wasm` extended with full ServicePort
- [x] ~~`bridge-tauri` extended with full ServicePort~~ (removed — desktop path dropped)
- [ ] TS `service/` rewritten as thin proxy
- [ ] TS `conventions/` deleted
- [ ] TS `inference/` deleted
- [ ] TS `session/` deleted
- [ ] E2E tests pass with WASM backend
- [ ] WASM binary size documented
- [ ] Update `src/service/CLAUDE.md` — rewrite for new proxy architecture
- [ ] Update root `CLAUDE.md` — remove TS backend module references, update architecture
- [ ] Update `docs/migration/index.md` — mark all phases complete
- [ ] Remove or archive per-directory CLAUDE.md files for deleted TS directories
