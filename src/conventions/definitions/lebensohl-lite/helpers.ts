// Shared helpers within Lebensohl Lite convention.

import type { DialogueState, DialogueFrame } from "../../core/dialogue/dialogue-state";

/** Get the top (most recent) frame from the dialogue state stack. */
export function topFrame(state: DialogueState): DialogueFrame | undefined {
  const frames = state.frames;
  if (!frames || frames.length === 0) return undefined;
  return frames[frames.length - 1];
}
