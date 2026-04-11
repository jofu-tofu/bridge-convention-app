/**
 * Synchronous service helpers for UI components.
 *
 * These wrap WASM ServicePort methods as sync calls, since the underlying
 * WASM calls are synchronous. Components that previously called convention
 * functions directly now call these instead.
 *
 * These are thin wrappers — the real logic is in Rust.
 */

import type { BaseModuleInfo, ConventionInfo, ModuleCatalogEntry } from "./response-types";

const BASE_MODULE_IDS: readonly string[] = [
  "natural-bids",
  "stayman",
  "jacoby-transfers",
  "blackwood",
];

// Access the WASM port directly for sync calls.
// The WasmServicePort instance is initialized by BridgeService.init() at startup.
// We import it lazily from the wasm module.
let wasmModule: Record<string, unknown> | null = null;

function getWasm(): Record<string, unknown> {
  if (!wasmModule) {
    throw new Error("Service not initialized — call init() first");
  }
  return wasmModule;
}

/** Called by BridgeService.init() to share the module reference and port instance. */
export function setWasmModule(mod: Record<string, unknown>, port?: { list_conventions(): unknown[]; list_modules(): unknown[]; get_module_learning_viewport(id: string): unknown; get_module_flow_tree(id: string): unknown }): void {
  wasmModule = mod;
  if (port) cachedPort = port;
}

// Cached singleton port — created once after WASM init.
let cachedPort: { list_conventions(): unknown[]; list_modules(): unknown[]; get_module_learning_viewport(id: string): unknown; get_module_flow_tree(id: string): unknown } | null = null;

function getSyncPort() {
  if (!cachedPort) {
    const mod = getWasm();
    const WasmServicePort = mod.WasmServicePort as new () => typeof cachedPort;
    cachedPort = new WasmServicePort();
  }
  // any: wasm-bindgen generated class — no TS type declarations
  return cachedPort!;
}

/**
 * List all convention bundles from the WASM catalog.
 * Sync — safe to call in $derived blocks.
 *
 * Converts `moduleDescriptions` from WASM plain object to Map
 * (serde_wasm_bindgen serializes HashMap as a JS object, not a Map).
 */
export function listConventions(): ConventionInfo[] {
  const raw = getSyncPort().list_conventions() as ConventionInfo[];
  return raw.map((c) => {
    const md = c.moduleDescriptions;
    if (md && !(md instanceof Map)) {
      return { ...c, moduleDescriptions: new Map(Object.entries(md as unknown as Record<string, string>)) };
    }
    return c;
  });
}

/**
 * List all registered modules with catalog metadata.
 * Sync — safe to call in $derived blocks.
 */
export function listModules(): ModuleCatalogEntry[] {
  return getSyncPort().list_modules() as ModuleCatalogEntry[];
}

/**
 * Get a module learning viewport synchronously (for convention card panel).
 * Returns null if module not found or WASM not ready.
 */
export function getModuleLearningViewportSync(moduleId: string): { teaching: { principle: string | null; tradeoff: string | null; commonMistakes: readonly string[] } } | null {
  try {
    return getSyncPort().get_module_learning_viewport(moduleId) as { teaching: { principle: string | null; tradeoff: string | null; commonMistakes: readonly string[] } } | null;
  } catch {
    return null;
  }
}

/**
 * Get a module flow tree synchronously.
 * Returns null if module not found or WASM not ready.
 */
export function getModuleFlowTreeSync(moduleId: string): unknown {
  try {
    return getSyncPort().get_module_flow_tree(moduleId);
  } catch {
    return null;
  }
}

/**
 * Get a module config schema synchronously.
 * Returns null if module not found or WASM not ready.
 */
export function getModuleConfigSchemaSync(moduleId: string, userModulesJson?: string | null): unknown {
  try {
    // any: cachedPort type doesn't include get_module_config_schema
    const port = getSyncPort() as Record<string, unknown>;
    const fn = port.get_module_config_schema as ((id: string, json: string | null) => unknown) | undefined;
    if (!fn) return null;
    return fn.call(port, moduleId, userModulesJson ?? null);
  } catch {
    return null;
  }
}

/**
 * Build base module info for always-active base modules.
 * When moduleIds is provided, returns info for those specific modules
 * (used by custom systems with non-default base modules).
 */
export function buildBaseModuleInfos(moduleIds?: readonly string[]): readonly BaseModuleInfo[] {
  const ids = moduleIds ?? BASE_MODULE_IDS;
  const allModules = listModules();
  return allModules
    .filter((m) => ids.includes(m.moduleId))
    .map((m) => ({
      id: m.moduleId,
      displayName: m.displayName,
      description: m.description,
    }));
}
