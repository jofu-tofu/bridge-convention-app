/**
 * Shared layout properties passed from GameScreen to each phase component.
 * Keeps responsive scaling logic centralized in GameScreen.
 */
export interface LayoutProps {
  tableScale: number;
  tableOrigin: string;
  tableBaseW: number;
  tableBaseH: number;
  phaseContainerClass: string;
  sidePanelClass: string;
}
