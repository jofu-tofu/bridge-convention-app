// Main barrel — re-exports all tiers for backwards compatibility.
// Prefer importing from a specific tier when possible:
//   engine-types    — bridge primitives (rarely change)
//   convention-types — pipeline infrastructure (convention/strategy/teaching scope)
//   session-types   — session lifecycle & UI (orchestration/presentation scope)
export * from "./engine-types";
export * from "./convention-types";
export * from "./session-types";
