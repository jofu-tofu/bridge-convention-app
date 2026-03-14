/**
 * NT-bundle integration tests for public snapshot building.
 *
 * These tests exercise buildSnapshotFromAuction with real NT convention
 * surfaces and machine. Moved from core/runtime/__tests__/public-snapshot-builder.test.ts
 * to separate convention-specific tests from core infrastructure tests.
 */
import { describe, it, expect } from "vitest";
import { buildSnapshotFromAuction } from "../../core/runtime/public-snapshot-builder";
import { buildAuction } from "../../../engine/auction-helpers";
import { Seat } from "../../../engine/types";
import {
  createNtSurfaceRouter,
  NT_ROUTED_SURFACES,
} from "../../definitions/nt-bundle/surface-routing";
import { createNtConversationMachine } from "../../definitions/nt-bundle/machine";

describe("buildSnapshotFromAuction — publicCommitments (NT bundle)", () => {
  const surfaceRouter = createNtSurfaceRouter(NT_ROUTED_SURFACES, createNtConversationMachine());

  it("populates publicCommitments when surfaceRouter is provided", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, [], {
      surfaceRouter,
    });

    // 2C = Stayman ask: at least 2 commitments (HCP >= 8, hasFourCardMajor)
    expect(snapshot.publicCommitments).toBeDefined();
    expect(snapshot.publicCommitments!.length).toBeGreaterThanOrEqual(2);
  });

  it("returns undefined publicCommitments when no surfaceRouter", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.publicCommitments).toBeUndefined();
  });
});
