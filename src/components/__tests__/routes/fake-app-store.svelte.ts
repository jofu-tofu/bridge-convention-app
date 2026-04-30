/**
 * Fake appStore used by AppLayout.test.ts to verify that the layout root
 * binds `data-card-size` and `--card-size-scale` from `appStore.displaySettings.cardSize`.
 *
 * Lives in a `.svelte.ts` file so we can use `$state` for reactivity — the
 * layout component reads `appStore.displaySettings.cardSize` reactively, so
 * the fake must hand back a Svelte-reactive value.
 */

type CardSize = "small" | "medium" | "large";

export interface FakeAppStore {
  readonly displaySettings: { cardSize: CardSize; showEducationalAnnotations: boolean };
  readonly activeLaunch: null;
  readonly baseSystemId: string;
  readonly drillSettings: {
    opponentMode: string;
    playProfileId: string;
    tuning: { vulnerabilityDistribution: { none: number; ours: number; theirs: number; both: number } };
  };
  setBaseSystemId(_id: string): void;
  setCardSize(value: CardSize): void;
}

let captured: FakeAppStore | null = null;

export function createFakeAppStore(): FakeAppStore {
  let cardSize = $state<CardSize>("medium");

  const store: FakeAppStore = {
    get displaySettings() {
      return { cardSize, showEducationalAnnotations: true };
    },
    get activeLaunch() {
      return null;
    },
    get baseSystemId() {
      return "sayc";
    },
    get drillSettings() {
      return {
        opponentMode: "none",
        playProfileId: "world-class",
        tuning: { vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 } },
      };
    },
    setBaseSystemId() {},
    setCardSize(value: CardSize) {
      cardSize = value;
    },
  };

  captured = store;
  return store;
}

export function getCapturedFakeAppStore(): FakeAppStore | null {
  return captured;
}
