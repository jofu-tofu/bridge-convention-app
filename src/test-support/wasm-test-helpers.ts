/**
 * WASM test helpers — replace the deleted createStubEngine + createLocalService pattern.
 *
 * initTestService() initializes the WASM module once (idempotent).
 * createTestSession() creates a session with a given convention and returns
 * { service, handle } for store/component tests.
 */
import { initWasmService, WasmService } from "../service";
import type { DevServicePort, SessionHandle, SessionConfig } from "../service";
import type { PracticeMode, PracticeRole } from "../service/session-types";

let initialized = false;
let service: DevServicePort | null = null;

/** Initialize the WASM service module. Idempotent — safe to call multiple times. */
export async function initTestService(): Promise<DevServicePort> {
  if (!initialized) {
    await initWasmService();
    initialized = true;
  }
  if (!service) {
    service = new WasmService();
  }
  return service;
}

/** Options for createTestSession. */
export interface TestSessionOptions {
  readonly seed?: number;
  readonly practiceMode?: PracticeMode;
  readonly practiceRole?: PracticeRole;
}

/**
 * Create a session with a given convention bundle and return the service + handle.
 * Initializes WASM if needed.
 */
export async function createTestSession(
  conventionId: string,
  opts?: TestSessionOptions,
): Promise<{ service: DevServicePort; handle: SessionHandle }> {
  const svc = await initTestService();
  const config: SessionConfig = {
    conventionId,
    ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
    ...(opts?.practiceMode ? { practiceMode: opts.practiceMode } : {}),
    ...(opts?.practiceRole ? { practiceRole: opts.practiceRole } : {}),
  };
  const handle = await svc.createSession(config);
  return { service: svc, handle };
}
