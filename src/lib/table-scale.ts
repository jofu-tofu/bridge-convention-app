const TABLE_W = 800;
const TABLE_H = 650;

export function computeTableScale(
  viewportW: number,
  viewportH: number,
  options: { sidePanel?: boolean; padding?: number; headerH?: number } = {},
): number {
  const { sidePanel = true, padding = 32, headerH = 64 } = options;
  const sidePanelW = sidePanel ? 220 : 0;
  const availW = Math.max(0, viewportW - sidePanelW - padding);
  const availH = Math.max(0, viewportH - headerH - padding);
  if (availW === 0 || availH === 0) return 0.35;
  return Math.max(0.35, Math.min(1.4, availW / TABLE_W, availH / TABLE_H));
}
