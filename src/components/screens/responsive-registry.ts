/**
 * Responsive screen registry — every screen and phase component MUST be
 * registered here with its mobile layout strategy.
 *
 * The companion test (responsive-registry.test.ts) auto-discovers all
 * .svelte files under src/components/screens/ and fails if any are
 * missing from this registry.
 *
 * Adding a new screen? Add it here first — the test will tell you if you forgot.
 */

/** How a component adapts to viewports below DESKTOP_MIN (1024px). */
export type MobileStrategy =
  | "stack"            // Side panel stacks below table (game phases via LayoutProps)
  | "centered"         // Centered max-width container, naturally responsive
  | "sidebar-overlay"  // Desktop sidebar becomes mobile overlay
  | "embedded"         // Sub-component embedded inside a parent (not a standalone screen)
  | "full-width";      // Full-width content, no special layout needed

interface ScreenEntry {
  /** Path relative to src/components/screens/ (e.g. "game-screen/GameScreen.svelte") */
  readonly path: string;
  /** How this component handles mobile layout */
  readonly mobileStrategy: MobileStrategy;
  /** Minimum usable viewport width in px. Must be <= 375 for top-level screens. */
  readonly minWidth: number;
  /** Brief description of mobile behavior for documentation */
  readonly mobileNotes: string;
}

/**
 * The canonical list. The type ensures every field is filled in.
 * The test ensures every .svelte file under screens/ is listed here.
 */
export const SCREEN_REGISTRY: readonly ScreenEntry[] = [
  // --- Top-level screens ---
  {
    path: "ConventionSelectScreen.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "max-w-3xl centered container, single-column card grid",
  },
  {
    path: "LearningScreen.svelte",
    mobileStrategy: "sidebar-overlay",
    minWidth: 320,
    mobileNotes: "Sidebar becomes fixed overlay with backdrop on mobile",
  },
  {
    path: "SettingsScreen.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "max-w-3xl centered container, form controls max-w-xs",
  },
  {
    path: "CoverageScreen.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "max-w-4xl centered container, single-column grid",
  },
  {
    path: "WorkshopScreen.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "System management with preset cards, custom system list, and editor",
  },
  {
    path: "SystemEditor.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "Two-panel editor: viz hidden below 1024px, tabbed fields full-width, overflow-y on tab content",
  },
  {
    path: "SystemDetailView.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "Single-system detail view with category cards",
  },
  {
    path: "SystemCompareView.svelte",
    mobileStrategy: "full-width",
    minWidth: 320,
    mobileNotes: "Side-by-side comparison table, horizontally scrollable on mobile",
  },
  {
    path: "ConventionEditorScreen.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "max-w-3xl centered container; parameter editing with steppers adapts naturally",
  },
  {
    path: "PracticePackEditorScreen.svelte",
    mobileStrategy: "centered",
    minWidth: 320,
    mobileNotes: "max-w-3xl centered container; convention checklist and reorder list stack vertically",
  },
  {
    path: "StrengthBar.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Embedded strength visualization bar within SystemEditor",
  },
  {
    path: "ParameterPanel.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Embedded parameter editor; steppers and toggles adapt naturally to width",
  },
  {
    path: "ConversationFlowTree.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Desktop-only SVG tree; hidden on mobile via isDesktop check in LearningScreen",
  },
  {
    path: "MobileFlowTree.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Compact vertical flow tree for mobile; collapsible, depth-capped",
  },

  // --- Game screen orchestrator ---
  {
    path: "game-screen/GameScreen.svelte",
    mobileStrategy: "stack",
    minWidth: 320,
    mobileNotes: "Switches from grid to flex-col, table centers with reduced scale",
  },

  // --- Game phases (receive LayoutProps from GameScreen) ---
  {
    path: "game-screen/BiddingPhase.svelte",
    mobileStrategy: "stack",
    minWidth: 320,
    mobileNotes: "Inherits stack layout from GameScreen via phaseContainerClass",
  },
  {
    path: "game-screen/PlayingPhase.svelte",
    mobileStrategy: "stack",
    minWidth: 320,
    mobileNotes: "3-col desktop grid; mobile stacks vertically, history panel moves into side panel",
  },
  {
    path: "game-screen/DeclarerPromptPhase.svelte",
    mobileStrategy: "stack",
    minWidth: 320,
    mobileNotes: "Inherits stack layout from GameScreen via phaseContainerClass",
  },
  {
    path: "game-screen/ExplanationPhase.svelte",
    mobileStrategy: "stack",
    minWidth: 320,
    mobileNotes: "Inherits stack layout; all-hands view uses 2-col grid that wraps",
  },

  // --- Embedded sub-components (not standalone screens) ---
  {
    path: "game-screen/BiddingSidePanel.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Scrollable flex child, min-w-0 prevents overflow",
  },
  {
    path: "game-screen/SettingsDialog.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Modal dialog overlay; adapts to viewport via max-w-sm and max-h-[80vh]",
  },
  {
    path: "game-screen/BiddingSettingsPanel.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Compact settings panel; hidden on mobile (lg:flex), settings available via Settings screen",
  },
  {
    path: "game-screen/PlaySidePanel.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Vertical sections: contract, tricks count, skip button",
  },
  {
    path: "game-screen/PlayHistoryPanel.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Scrollable trick log; shown in left panel (desktop) or embedded in PlaySidePanel (mobile)",
  },
  {
    path: "game-screen/ReviewSidePanel.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Tabbed interface with scrollable content",
  },
  {
    path: "game-screen/ContractDisplay.svelte",
    mobileStrategy: "embedded",
    minWidth: 200,
    mobileNotes: "Inline display component, no layout concerns",
  },
  {
    path: "game-screen/ScaledTableArea.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "CSS transform scaling with max-width/max-height constraints",
  },

  // --- Convention flow editor (convention-canvas/) ---
  {
    path: "convention-canvas/ConventionFlowEditor.svelte",
    mobileStrategy: "sidebar-overlay",
    minWidth: 320,
    mobileNotes: "3-column flow editor: sidebar + SVG canvas + detail panel; sidebar overlays on mobile",
  },
  {
    path: "convention-canvas/ModulePickerSidebar.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Module list sidebar embedded in ConventionFlowEditor",
  },
  {
    path: "convention-canvas/FlowTreeNodeComponent.svelte",
    mobileStrategy: "embedded",
    minWidth: 200,
    mobileNotes: "Flow tree node rendered via foreignObject inside SVG canvas",
  },
  {
    path: "convention-canvas/FlowTreeEdge.svelte",
    mobileStrategy: "embedded",
    minWidth: 200,
    mobileNotes: "SVG bezier edge between flow tree nodes",
  },
  {
    path: "convention-canvas/NodeDetailPanel.svelte",
    mobileStrategy: "embedded",
    minWidth: 280,
    mobileNotes: "Slide-out detail panel with parameter editing",
  },
] as const;
