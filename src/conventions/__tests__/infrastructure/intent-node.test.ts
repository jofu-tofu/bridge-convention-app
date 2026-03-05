import { describe, test, expect } from "vitest";
import { createIntentBidFactory } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { Call } from "../../../engine/types";

const defaultCall = (): Call => ({ type: "pass" });
const intent = { type: SemanticIntentType.NaturalBid, params: {} };

describe("createIntentBidFactory", () => {
  test("generates prefix/name IDs deterministically", () => {
    const bid = createIntentBidFactory("stayman");
    const node1 = bid("ask", "Ask", intent, defaultCall);
    const node2 = bid("response", "Response", intent, defaultCall);

    expect(node1.nodeId).toBe("stayman/ask");
    expect(node2.nodeId).toBe("stayman/response");
  });

  test("duplicate names within same prefix throw", () => {
    const bid = createIntentBidFactory("test");
    bid("unique-name", "First", intent, defaultCall);

    expect(() => bid("unique-name", "Duplicate", intent, defaultCall)).toThrow(
      'Duplicate IntentNode name "unique-name" in factory "test"',
    );
  });

  test("different prefixes have independent namespaces", () => {
    const bidA = createIntentBidFactory("conv-a");
    const bidB = createIntentBidFactory("conv-b");

    const nodeA = bidA("ask", "Ask A", intent, defaultCall);
    const nodeB = bidB("ask", "Ask B", intent, defaultCall);

    expect(nodeA.nodeId).toBe("conv-a/ask");
    expect(nodeB.nodeId).toBe("conv-b/ask");
  });

  test("produces valid IntentNode shape", () => {
    const bid = createIntentBidFactory("test");
    const node = bid("my-bid", "My meaning", intent, defaultCall);

    expect(node.type).toBe("intent");
    expect(node.name).toBe("my-bid");
    expect(node.meaning).toBe("My meaning");
    expect(node.intent).toEqual(intent);
  });
});
