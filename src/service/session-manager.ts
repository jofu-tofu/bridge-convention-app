/**
 * Session manager — maps opaque session handles to session state.
 */

import type { SessionHandle } from "./types";
import type { SessionState } from "./session-state";

let handleCounter = 0;

/** Generate a unique session handle. */
export function createHandle(): SessionHandle {
  return `session-${++handleCounter}-${Date.now()}`;
}

/** Session storage — maps handles to their state. */
export class SessionManager {
  private sessions = new Map<SessionHandle, SessionState>();

  get(handle: SessionHandle): SessionState {
    const state = this.sessions.get(handle);
    if (!state) {
      throw new Error(`Unknown session handle: ${handle}`);
    }
    return state;
  }

  set(handle: SessionHandle, state: SessionState): void {
    this.sessions.set(handle, state);
  }

  delete(handle: SessionHandle): boolean {
    return this.sessions.delete(handle);
  }

  has(handle: SessionHandle): boolean {
    return this.sessions.has(handle);
  }
}
