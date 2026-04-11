/**
 * Mock for $app/navigation used in vitest.
 * Provides no-op implementations of SvelteKit navigation functions.
 */
export function goto(_url: string, _opts?: Record<string, unknown>): Promise<void> {
  return Promise.resolve();
}

export function invalidate(_url?: string): Promise<void> {
  return Promise.resolve();
}

export function invalidateAll(): Promise<void> {
  return Promise.resolve();
}

export function preloadData(_href: string): Promise<void> {
  return Promise.resolve();
}

export function preloadCode(..._urls: string[]): Promise<void> {
  return Promise.resolve();
}

export function beforeNavigate(_callback: (navigation: unknown) => void): void {
  // no-op in tests
}

export function afterNavigate(_callback: (navigation: unknown) => void): void {
  // no-op in tests
}

export function onNavigate(_callback: (navigation: unknown) => unknown): void {
  // no-op in tests
}

export function disableScrollHandling(): void {
  // no-op in tests
}
