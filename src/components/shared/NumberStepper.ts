/** Pure helpers for NumberStepper — clamp and auto-repeat logic. */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Creates an auto-repeat controller for +/- button long-press. */
export function createAutoRepeat(action: () => void): {
  start: () => void;
  stop: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (interval !== null) { clearInterval(interval); interval = null; }
  }

  function start() {
    stop();
    action();
    timer = setTimeout(() => {
      interval = setInterval(action, 80);
    }, 200);
  }

  return { start, stop };
}
