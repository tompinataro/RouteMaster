// Simple global banner bus to centralize transient app-wide messages
export type BannerMsg = { type?: 'info' | 'success' | 'error'; message: string; durationMs?: number };

let handler: ((msg: BannerMsg) => void) | null = null;

export function setBannerHandler(fn: ((msg: BannerMsg) => void) | null) {
  handler = fn;
}

export function showBanner(msg: BannerMsg) {
  try { handler?.(msg); } catch {}
}
