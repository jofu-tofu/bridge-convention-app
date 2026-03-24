const DEFAULT_TABLE_W = 800;
const DEFAULT_TABLE_H = 650;

export function computeTableScale(
  viewportW: number,
  viewportH: number,
  options: {
    sidePanel?: boolean;
    padding?: number;
    headerH?: number;
    tableW?: number;
    tableH?: number;
    sidePanelW?: number;
  } = {},
): number {
  const {
    sidePanel = true,
    padding = 32,
    headerH = 64,
    tableW = DEFAULT_TABLE_W,
    tableH = DEFAULT_TABLE_H,
    sidePanelW = 400,
  } = options;
  const spW = sidePanel ? sidePanelW : 0;
  const availW = Math.max(0, viewportW - spW - padding);
  const availH = Math.max(0, viewportH - headerH - padding);
  if (availW === 0 || availH === 0) return 0.35;
  return Math.max(0.35, Math.min(1.4, availW / tableW, availH / tableH));
}
