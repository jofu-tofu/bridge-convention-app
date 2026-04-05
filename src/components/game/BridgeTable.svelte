<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Hand, Card as CardType, HandEvaluationView } from "../../service";
  import { Seat, Rank, Suit as SuitEnum, Vulnerability, isVulnerable } from "../../service";
  import { viewSeat } from "../shared/seat-mapping";
  import HandFan from "./HandFan.svelte";

  interface Props {
    /** All 4 hands (classic mode — requires faceUpSeats). */
    hands?: Record<Seat, Hand>;
    /** Set of seats whose cards should be shown face-up (classic mode). */
    faceUpSeats?: ReadonlySet<Seat>;
    /** Pre-filtered visible hands from a viewport (viewport mode).
     *  When provided, only seats present in the map are rendered face-up.
     *  Seats absent from the map are shown face-down with no cards. */
    visibleHands?: Partial<Record<Seat, Hand>>;
    /** Pre-computed hand evaluation from viewport (avoids calling engine functions). */
    handEvaluation?: HandEvaluationView;
    children?: Snippet;
    /** During play: legal cards for the active seat */
    legalPlays?: readonly CardType[];
    /** During play: callback when user clicks a card */
    onPlayCard?: (card: CardType, seat: Seat) => void;
    /** During play: seat currently playing */
    currentPlayer?: Seat;
    /** During play: seats controlled by user (for showing clickable cards) */
    userControlledSeats?: readonly Seat[];
    /** During play: remaining cards per seat (after cards played in tricks) */
    remainingCards?: Partial<Record<Seat, readonly CardType[]>>;
    /** When true, rotate table 180°: North at bottom, South at top, E↔W swapped */
    rotated?: boolean;
    /** Deal vulnerability for visual indicators on seat labels */
    vulnerability?: Vulnerability;
    /** During play: trump suit placed leftmost in hand display */
    trumpSuit?: SuitEnum;
  }

  let {
    hands,
    faceUpSeats,
    visibleHands,
    handEvaluation,
    children,
    legalPlays = [],
    onPlayCard,
    currentPlayer,
    userControlledSeats = [],
    remainingCards,
    rotated = false,
    vulnerability,
    trumpSuit,
  }: Props = $props();

  // ── Mode detection: viewport mode when visibleHands is provided ───
  const useViewport = $derived(visibleHands !== undefined);

  // 13 placeholder cards for rendering face-down hands on desktop
  const PLACEHOLDER_CARDS: readonly CardType[] = Array.from({ length: 13 }, (_, i) => ({
    suit: [SuitEnum.Spades, SuitEnum.Hearts, SuitEnum.Diamonds, SuitEnum.Clubs][Math.floor(i / 4)]!,
    rank: Object.values(Rank)[i]!,
  }));

  // Use pre-computed viewport handEvaluation when available
  const hasEvaluation = $derived(handEvaluation !== undefined);
  const southHcp = $derived(handEvaluation?.hcp ?? 0);

  // Map physical screen positions to logical seats
  const northSeat = $derived(viewSeat(Seat.North, rotated));
  const southSeat = $derived(viewSeat(Seat.South, rotated));
  const eastSeat = $derived(viewSeat(Seat.East, rotated));
  const westSeat = $derived(viewSeat(Seat.West, rotated));

  function isFaceUp(seat: Seat): boolean {
    if (useViewport) {
      return visibleHands?.[seat] !== undefined;
    }
    return faceUpSeats?.has(seat) ?? false;
  }

  function getCards(seat: Seat): readonly CardType[] {
    if (remainingCards?.[seat]) {
      return remainingCards[seat];
    }
    if (useViewport) {
      return visibleHands?.[seat]?.cards ?? PLACEHOLDER_CARDS;
    }
    return hands?.[seat]?.cards ?? PLACEHOLDER_CARDS;
  }

  function getSeatLegalPlays(seat: Seat): readonly CardType[] {
    if (currentPlayer === seat && userControlledSeats.includes(seat)) {
      return legalPlays;
    }
    return [];
  }

  function getSeatOnPlayCard(
    seat: Seat,
  ): ((card: CardType) => void) | undefined {
    if (
      currentPlayer === seat &&
      userControlledSeats.includes(seat) &&
      onPlayCard
    ) {
      return (card: CardType) => onPlayCard(card, seat);
    }
    return undefined;
  }

  function seatLabelClass(seat: Seat): string {
    const vul = vulnerability ? isVulnerable(seat, vulnerability) : false;
    const bg = vul ? "bg-vulnerable/80 ring-1 ring-vulnerable-ring/40" : "bg-bg-elevated/80";
    const base = `seat-badge text-[--text-body] font-bold ${bg} px-2.5 py-0.5 rounded-full`;
    if (currentPlayer === seat) {
      return `${base} text-accent-primary`;
    }
    return `${base} ${vul ? "text-vulnerable-text" : "text-text-secondary"}`;
  }

  function vulBadgeLabel(): string {
    switch (vulnerability) {
      case Vulnerability.None: return "None Vul";
      case Vulnerability.NorthSouth: return "N-S Vul";
      case Vulnerability.EastWest: return "E-W Vul";
      case Vulnerability.Both: return "Both Vul";
      default: return "";
    }
  }

  const showVulBadge = $derived(
    vulnerability !== undefined && vulnerability !== Vulnerability.None,
  );
</script>

<div
  class="bridge-table bg-table-surface border border-table-border rounded-[--radius-xl] shadow-lg"
  style="width: var(--table-width); height: var(--table-height);"
  role="region"
  aria-label="Bridge table"
  data-testid="bridge-table"
>
  <!-- Physical top position (North normally, South when rotated) -->
  <div class="area-north" class:max-lg:invisible={useViewport && !isFaceUp(northSeat)}>
    <HandFan
      cards={getCards(northSeat)}
      faceUp={isFaceUp(northSeat)}
      legalPlays={getSeatLegalPlays(northSeat)}
      onPlayCard={getSeatOnPlayCard(northSeat)}
      mirrored
      {trumpSuit}
    />
    <div class="text-center mt-2">
      <span
        class={seatLabelClass(northSeat)}
        data-testid="seat-label-{northSeat}"
        aria-label={northSeat === Seat.North ? "North" : "South"}
        >{northSeat === Seat.North ? "N" : "S"}</span
      >
    </div>
  </div>

  <!-- Physical left position (West normally, East when rotated) + label -->
  <div class="area-west" class:max-lg:invisible={useViewport && !isFaceUp(westSeat)}>
    <HandFan
      cards={getCards(westSeat)}
      faceUp={isFaceUp(westSeat)}
      vertical
      legalPlays={getSeatLegalPlays(westSeat)}
      onPlayCard={getSeatOnPlayCard(westSeat)}
      {trumpSuit}
    />
    <span
      class={seatLabelClass(westSeat)}
      data-testid="seat-label-{westSeat}"
      aria-label={westSeat === Seat.West ? "West" : "East"}
      >{westSeat === Seat.West ? "W" : "E"}</span
    >
  </div>

  <!-- Center area (auction or tricks) — dedicated grid cell, cannot overlap hands -->
  <div class="area-center" data-testid="table-center">
    {#if showVulBadge}
      <span
        class="inline-flex items-center gap-1 text-[--text-label] font-semibold tracking-wide text-accent-danger bg-accent-danger/10 border border-accent-danger/20 px-2.5 py-0.5 rounded-[--radius-sm] mb-1"
        data-testid="vul-badge"
        aria-label={vulBadgeLabel()}
      >{vulBadgeLabel()}</span>
    {/if}
    {#if children}
      {@render children()}
    {/if}
  </div>

  <!-- Physical right position (East normally, West when rotated) + label -->
  <div class="area-east" class:max-lg:invisible={useViewport && !isFaceUp(eastSeat)}>
    <span
      class={seatLabelClass(eastSeat)}
      data-testid="seat-label-{eastSeat}"
      aria-label={eastSeat === Seat.East ? "East" : "West"}
      >{eastSeat === Seat.East ? "E" : "W"}</span
    >
    <HandFan
      cards={getCards(eastSeat)}
      faceUp={isFaceUp(eastSeat)}
      vertical
      legalPlays={getSeatLegalPlays(eastSeat)}
      onPlayCard={getSeatOnPlayCard(eastSeat)}
      {trumpSuit}
    />
  </div>

  <!-- Physical bottom position (South normally, North when rotated) -->
  <div class="area-south">
    <div class="text-center mb-2 flex items-center justify-center gap-1.5">
      <span
        class={seatLabelClass(southSeat)}
        data-testid="seat-label-{southSeat}"
        aria-label={southSeat === Seat.South ? "South" : "North"}
        >{southSeat === Seat.South ? "S" : "N"}</span
      >
      {#if hasEvaluation}
        <span
          class="text-[--text-label] text-text-secondary bg-bg-elevated/60 px-1.5 py-0.5 rounded-full"
          data-testid="south-hcp"
          aria-label="{southHcp} high card points"
          >{southHcp} HCP</span
        >
      {/if}
    </div>
    <HandFan
      cards={getCards(southSeat)}
      faceUp={isFaceUp(southSeat)}
      legalPlays={getSeatLegalPlays(southSeat)}
      onPlayCard={getSeatOnPlayCard(southSeat)}
      {trumpSuit}
    />
  </div>
</div>

<style>
  .bridge-table {
    display: grid;
    grid-template-areas:
      "west   north  east"
      "west   center east"
      "west   south  east";
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 6px 14px;
  }
  .area-north {
    grid-area: north;
    justify-self: center;
  }
  .area-south {
    grid-area: south;
    justify-self: center;
  }
  .area-west {
    grid-area: west;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 1;
  }
  .area-east {
    grid-area: east;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 1;
  }
  .seat-badge {
    position: relative;
    z-index: 1;
  }
  .area-center {
    grid-area: center;
    justify-self: center;
    align-self: start;
  }
</style>
