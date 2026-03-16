/** Specification for how a module emits surfaces at runtime.
 *  Currently a placeholder -- the default behavior is "emit all surfaces
 *  in the matching surfaceGroupId". Future: custom emission logic. */
export interface SurfaceEmitterSpec {
  readonly kind: "group-match" | "custom";
  /** For "custom" kind -- the module provides a function. Currently unused. */
  readonly emitter?: unknown;
}
