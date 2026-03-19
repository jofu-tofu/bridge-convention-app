// Protocol frame architecture — barrel exports.
export type {
  // Expression types
  Ref,
  BoolExpr,
  EffectSpec,
  // Schema
  RegisterSpec,
  RegisterWriterPolicy,
  CapabilitySpec,
  PublicSemanticSchema,
  // Events & transitions
  EventPattern,
  TransitionSpec,
  ReactionSpec,
  // Frame states
  FrameStateSpec,
  // Modules (unified)
  OpeningPatternSpec,
  AnchorPolicy,
  BaseModuleSpec,
  ProtocolModuleSpec,
  ModuleSpec,
  // Surface fragments
  SurfaceRelation,
  SurfaceFragment,
  // Runtime
  ProvenancedValue,
  BaseTrackInstance,
  ProtocolInstance,
  RuntimeSnapshot,
  // Provenance
  RegisterWriteTrace,
  ProtocolAttachTrace,
  DecisionTrace,
  ActionResolution,
  // Top-level
  ConventionSpec,
  // Boot router
  BootTrieNode,
  BootRouter,
} from "./types";

// Expression helpers
export {
  and,
  or,
  not,
  exists,
  eq,
  neq,
  activeTag,
  reg,
  local,
  tagRef,
  cap,
  // ConventionSpec helpers
  getBaseModules,
  getProtocolModules,
} from "./types";

// Boot router
export {
  callToTrieKey,
  compileBootRouter,
  advanceBootRouter,
  getViableTracks,
} from "./boot-router";

// Surface stack composition
export type {
  SurfaceStackEntry,
  ComposedSurface,
  CompositionTraceEntry,
} from "./surface-stack";

export {
  composeSurfaceStack,
  buildSurfaceStack,
} from "./surface-stack";

// Layered replay
export {
  replay,
  computeActiveSurfaces,
} from "./replay";

// Protocol lifecycle
export type {
  ExpressionContext,
} from "./protocol-lifecycle";

export {
  resolveRef,
  evaluateBoolExpr,
  applyEffects,
  advanceProtocolState,
  settleProtocolLifecycle,
} from "./protocol-lifecycle";

// Bridge semantic schema
export { BRIDGE_SEMANTIC_SCHEMA } from "./bridge-schema";

// Coverage enumeration
export type {
  ProtocolCoverageAtom,
  BaseTrackPath,
  ProtocolCoverageManifest,
} from "./coverage-enumeration";

export {
  enumerateBaseTrackStates,
  enumerateBaseTrackAtoms,
  enumerateProtocolAtomsAtBaseState,
  generateProtocolCoverageManifest,
} from "./coverage-enumeration";
