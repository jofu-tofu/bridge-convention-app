/**
 * Shared localStorage read/write with try/catch and optional validation.
 *
 * All stores that persist to localStorage should use these helpers
 * instead of inlining their own try/catch blocks.
 */

/**
 * Read and parse JSON from localStorage.
 * Returns `defaultValue` when the key is missing, unparseable, or
 * when `validate` rejects the parsed result (by returning `undefined`).
 */
export function loadFromStorage<T>(
  key: string,
  defaultValue: T,
  validate?: (raw: unknown) => T | undefined,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    const parsed: unknown = JSON.parse(raw);
    if (validate) {
      const result = validate(parsed);
      return result === undefined ? defaultValue : result;
    }
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Stringify and write a value to localStorage.
 * Silently swallows errors (storage full, SSR, etc.).
 */
export function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}
