/**
 * Phase transition sub-module.
 *
 * Owns the phase state machine, the unified lifecycle executor, and transition
 * helpers. Created via `createPhaseTransitions()` and called from the game store
 * coordinator.
 *
 * All phase transitions route through `executeTransition(handle, event)` which
 * enforces the pipeline: resolve descriptor -> reset play state -> run service
 * actions -> fetch viewports -> phase transitions -> side effects -> chained events.
 */

import type { Seat, Contract } from "../service";
import type { DevServicePort, DrillHandle } from "../service";
import type {
  GamePhase,
  PhaseEvent,
  ServiceAction,
  TransitionResult,
  PlayEntryResult,
} from "../service";
import type { PlayPreference, PromptMode } from "../service";
import { Seat as SeatEnum } from "../service";
import { isValidTransition, resolveTransition } from "../service";
import { computePromptMode } from "./prompt-logic";
import type { PlayPhase } from "./play-phase.svelte";
import type { ViewportCacheModule } from "./viewport-cache.svelte";
import type { DDSSolverModule } from "./dds-solver.svelte";

// ── Dependency contract ─────────────────────────────────────────────

export interface PhaseTransitionDeps {
  getActiveHandle: () => DrillHandle | null;
  getActiveService: () => DevServicePort;
  getPhase: () => GamePhase;
  setPhase: (p: GamePhase) => void;
  getEffectiveUserSeat: () => Seat | null;
  setEffectiveUserSeat: (s: Seat | null) => void;
  getUserSeat: () => Seat | null;
  getContract: () => Contract | null;
  getPlayPreference: () => PlayPreference;
  playPhase: PlayPhase;
  viewportCache: ViewportCacheModule;
  ddsSolver: DDSSolverModule;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createPhaseTransitions(deps: PhaseTransitionDeps) {
  // ── Lifecycle guard ──────────────────────────────────────────────
  // guarded() drops concurrent calls rather than queuing them because lifecycle
  // actions (skip-to-review, accept-prompt, etc.) are user-initiated and
  // idempotent -- a dropped click is harmless, but a queued action executing
  // after the phase has changed would be wrong.
  let transitioning = $state(false);

  function guarded<Args extends unknown[]>(
    fn: (...args: Args) => void | Promise<void>,
  ): (...args: Args) => void {
    return (...args: Args): void => {
      if (transitioning) return;
      transitioning = true;
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          void result.catch(() => {}).finally(() => { transitioning = false; });
        } else {
          transitioning = false;
        }
      } catch {
        transitioning = false;
      }
    };
  }

  // ── Phase machine ───────────────────────────────────────────────

  function transitionTo(target: GamePhase): boolean {
    const current = deps.getPhase();
    if (isValidTransition(current, target)) {
      deps.setPhase(target);
      return true;
    }
    const msg = `Invalid phase transition: ${current} → ${target}`;
    if (import.meta.env.DEV) {
      throw new Error(msg);
    }
    return false;
  }

  // ── Service action executor ─────────────────────────────────────

  async function executeServiceAction(
    handle: DrillHandle,
    action: ServiceAction,
  ): Promise<PlayEntryResult | void> {
    const svc = deps.getActiveService();
    switch (action.type) {
      case "enterPlay":
        return svc.enterPlay(handle, action.seat);
      case "declinePlay":
        return void await svc.declinePlay(handle);
      case "returnToPrompt":
        return void await svc.returnToPrompt(handle);
      case "restartPlay":
        return svc.restartPlay(handle);
      case "skipToReview":
        return svc.skipToReview(handle);
    }
  }

  function resetPlayState(): void {
    const { playPhase } = deps;
    playPhase.play.aborted = false;
    playPhase.animatedTrickOverride = null;
    playPhase.play.score = null;
    playPhase.play.showingTrickResult = false;
    playPhase.play.processing = false;
    playPhase.play.log = [];
  }

  // ── Unified lifecycle executor ──────────────────────────────────

  async function executeTransition(
    handle: DrillHandle,
    event: PhaseEvent,
  ): Promise<TransitionResult> {
    const cancelled = (): TransitionResult => ({ serviceResult: null, completed: false });
    const currentPhase = deps.getPhase();

    const desc = resolveTransition(currentPhase, event);
    if (!desc.targetPhase) {
      if (desc.chainedEvent) {
        return executeTransition(handle, desc.chainedEvent);
      }
      return { serviceResult: null, completed: true };
    }

    // 1. Reset play state if needed
    if (desc.resetPlay) resetPlayState();

    // 2. Run service actions
    let lastResult: PlayEntryResult | null = null;
    for (const action of desc.serviceActions) {
      const result = await executeServiceAction(handle, action);
      if (deps.getActiveHandle() !== handle) return cancelled();
      if (result && typeof result === "object" && "phase" in result) {
        lastResult = result;
      }
    }

    // 3. Fetch viewports
    for (const vp of desc.viewportsNeeded) {
      await deps.viewportCache.fetchAndCache(handle, vp);
      if (deps.getActiveHandle() !== handle) return cancelled();
    }

    // 4. Phase transitions -- intermediate phases first, then target
    for (const p of desc.intermediatePhases) {
      transitionTo(p);
    }
    // Skip transitionTo when target === current phase (e.g. RESTART_PLAY: PLAYING -> PLAYING)
    if (desc.targetPhase !== deps.getPhase()) {
      transitionTo(desc.targetPhase);
    }

    // 5. Side effects
    if (desc.triggerDDS) void deps.ddsSolver.triggerSolve();

    // 6. Chained event
    if (desc.chainedEvent) {
      return executeTransition(handle, desc.chainedEvent);
    }

    return { serviceResult: lastResult, completed: true };
  }

  async function dispatchPlayTransition(
    handle: DrillHandle,
    event: PhaseEvent,
  ): Promise<void> {
    const { serviceResult, completed } = await executeTransition(handle, event);
    if (!completed) return;
    const aiPlays = serviceResult?.aiPlays ?? [];
    if (aiPlays.length > 0) {
      const { ok } = await deps.playPhase.animateAiPlays(handle, [...aiPlays], []);
      if (!ok) return;
    }
  }

  // ── Post-auction orchestration ──────────────────────────────────

  /**
   * Handle auto-transition from DECLARER_PROMPT based on playPreference.
   */
  async function handleAutoPromptTransition(handle: DrillHandle): Promise<boolean> {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference: deps.getPlayPreference() });
    if (!desc.chainedEvent) return true; // "prompt" mode -- stay at DECLARER_PROMPT

    if (desc.chainedEvent.type === "ACCEPT_PLAY") {
      const seat = deps.getEffectiveUserSeat() ?? deps.getUserSeat() ?? SeatEnum.South;
      await dispatchPlayTransition(handle, { type: "ACCEPT_PLAY", seat });
      return deps.getActiveHandle() === handle;
    }
    if (desc.chainedEvent.type === "DECLINE_PLAY") {
      await executeTransition(handle, { type: "DECLINE_PLAY" });
      return deps.getActiveHandle() === handle;
    }
    return true;
  }

  /**
   * Handle post-auction phase transition using the phase coordinator.
   */
  async function handlePostAuction(
    handle: DrillHandle,
    servicePhase: GamePhase,
  ): Promise<boolean> {
    const desc = resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase });
    if (!desc.targetPhase) return true;

    // 1. Fetch viewports (contract is auto-derived from them)
    for (const vpName of desc.viewportsNeeded) {
      await deps.viewportCache.fetchAndCache(handle, vpName);
      if (deps.getActiveHandle() !== handle) return false;
    }
    if (desc.targetPhase === "DECLARER_PROMPT" || desc.targetPhase === "PLAYING") {
      deps.setEffectiveUserSeat(deps.getUserSeat());
    }

    // 2. Phase transition
    transitionTo(desc.targetPhase);

    // 3. Post-transition actions
    if (desc.resetPlay) deps.playPhase.play.aborted = false;
    if (desc.triggerDDS) void deps.ddsSolver.triggerSolve();

    // 4. Auto-transition from prompt
    if (desc.targetPhase === "DECLARER_PROMPT") {
      return handleAutoPromptTransition(handle);
    }

    return true;
  }

  // ── Prompt mode helper ──────────────────────────────────────────

  function getPromptMode(): PromptMode | null {
    return computePromptMode(deps.getPhase(), deps.getContract(), deps.getUserSeat());
  }

  // ── Public surface ──────────────────────────────────────────────

  return {
    get transitioning() { return transitioning; },
    set transitioning(v: boolean) { transitioning = v; },

    guarded,
    transitionTo,
    executeTransition,
    dispatchPlayTransition,
    handlePostAuction,
    getPromptMode,
  };
}

export type PhaseTransitionModule = ReturnType<typeof createPhaseTransitions>;
