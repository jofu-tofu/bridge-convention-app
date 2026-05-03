/**
 * Typed errors crossing the WASM boundary.
 *
 * The Rust side (`crates/bridge-wasm/src/lib.rs::service_error`) emits
 * `JsError(JSON.stringify({ kind, witnessSummary }))` for the
 * `ServiceError::DealGenerationExhausted` variant. Other variants keep
 * the plain `Display` message (no discriminant). Use the type-guard
 * helpers below at WASM call sites to branch on exhaustion before
 * surfacing the error.
 */

/** JSON shape of the typed service error sidecar. */
export interface DealGenerationExhaustedShape {
  kind: "dealGenerationExhausted";
  witnessSummary: string;
}

/**
 * Thrown (or surfaced via `isDealGenerationExhausted`) when the inner
 * rejection-sampling loop exhausted all 8 seed-shifted retries without
 * producing a deal that satisfied the witness predicate.
 *
 * UI behaviour: try one automatic retry with a fresh seed; on second
 * failure, show a clear modal asking the user to change the convention
 * or refresh.
 */
export class DealGenerationExhaustedError extends Error {
  readonly kind = "dealGenerationExhausted" as const;
  constructor(public readonly witnessSummary: string) {
    super(`Deal generation exhausted: ${witnessSummary}`);
    this.name = "DealGenerationExhaustedError";
  }
}

/**
 * Type-guard for the typed shape on a deserialized JSON payload (does
 * not perform parsing; see `parseDealGenerationExhausted`).
 */
export function isDealGenerationExhausted(
  err: unknown,
): err is DealGenerationExhaustedError | DealGenerationExhaustedShape {
  if (err instanceof DealGenerationExhaustedError) return true;
  if (err === null || typeof err !== "object") return false;
  // Discriminant-based check; mirrors the Rust-emitted `kind` field.
  const kind = (err as { kind?: unknown }).kind;
  return kind === "dealGenerationExhausted";
}

/**
 * Parse a `JsError` thrown by `WasmServicePort` and lift the typed
 * `DealGenerationExhaustedError` when the message body is the
 * Rust-emitted JSON sidecar. Returns the original error unchanged for
 * any other shape.
 */
export function liftServiceError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  // wasm-bindgen surfaces JsError as a JS `Error` whose `message` is the
  // string passed to `JsError::new(...)`. We emit JSON for the typed
  // variant; everything else stays as-is.
  const msg = err.message;
  if (typeof msg !== "string" || !msg.startsWith("{")) return err;
  let parsed: unknown;
  try {
    parsed = JSON.parse(msg);
  } catch {
    return err;
  }
  if (!isDealGenerationExhausted(parsed)) return err;
  return new DealGenerationExhaustedError(parsed.witnessSummary);
}
