export const SITE_URL = "https://bridgelab.net";
export const SITE_NAME = "BridgeLab";
export const OG_IMAGE = `${SITE_URL}/brand/og-card.png`;

export const SITE_PUBLISHED = "2026-01-01";
export const SITE_MODIFIED = new Date().toISOString().slice(0, 10);

export function truncateDescription(text: string, max = 155): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
