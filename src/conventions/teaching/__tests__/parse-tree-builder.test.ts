import { describe, expect, test } from "vitest";
import { BidSuit } from "../../../engine/types";
import { buildParseTree } from "../parse-tree-builder";
import {
  makeCall,
  makeProposal,
  makeEncoded,
  makeArbitration,
  makeProvenance,
  makeClause,
} from "../../../test-support/convention-factories";
import { bidName, bidSummary } from "../../core/authored-text";
import type { TeachingLabel } from "../../core/authored-text";

const tl = (name: string): TeachingLabel => ({ name: bidName(name), summary: bidSummary("[TODO] test") });

describe("buildParseTree", () => {
  test("empty arbitration and provenance produces empty tree with no selected path", () => {
    const arbitration = makeArbitration();
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    expect(tree.modules).toEqual([]);
    expect(tree.selectedPath).toBeNull();
  });

  test("selected module gets 'selected' verdict", () => {
    const proposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
      teachingLabel: tl("Stayman"),
    });
    const encoded = makeEncoded({
      proposal,
      call: makeCall(2, BidSuit.Clubs),
    });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    expect(tree.modules).toHaveLength(1);
    expect(tree.modules[0]!.moduleId).toBe("stayman");
    expect(tree.modules[0]!.verdict).toBe("selected");
  });

  test("truth-set module that is not selected gets 'applicable' verdict", () => {
    const selectedProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const selectedEncoded = makeEncoded({
      proposal: selectedProposal,
      call: makeCall(2, BidSuit.Clubs),
    });
    const otherProposal = makeProposal({
      meaningId: "transfer:hearts",
      moduleId: "transfers",
      teachingLabel: tl("Transfer to hearts"),
    });
    const otherEncoded = makeEncoded({
      proposal: otherProposal,
      call: makeCall(2, BidSuit.Diamonds),
    });
    const arbitration = makeArbitration({
      selected: selectedEncoded,
      truthSet: [selectedEncoded, otherEncoded],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    const transfersNode = tree.modules.find(m => m.moduleId === "transfers");
    expect(transfersNode).toBeDefined();
    expect(transfersNode!.verdict).toBe("applicable");
  });

  test("eliminated module gets 'eliminated' verdict with rejection reason", () => {
    const selectedProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const selectedEncoded = makeEncoded({
      proposal: selectedProposal,
      call: makeCall(2, BidSuit.Clubs),
    });
    const arbitration = makeArbitration({
      selected: selectedEncoded,
      truthSet: [selectedEncoded],
      eliminations: [
        {
          candidateBidName: "transfer:hearts",
          moduleId: "transfers",
          reason: "HCP too low",
        },
      ],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    const transfersNode = tree.modules.find(m => m.moduleId === "transfers");
    expect(transfersNode).toBeDefined();
    expect(transfersNode!.verdict).toBe("eliminated");
    expect(transfersNode!.eliminationReason).toBe("HCP too low");
  });

  test("modules are sorted: selected first, then applicable, then eliminated", () => {
    const selectedProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const selectedEncoded = makeEncoded({
      proposal: selectedProposal,
      call: makeCall(2, BidSuit.Clubs),
    });
    const applicableProposal = makeProposal({
      meaningId: "transfer:hearts",
      moduleId: "transfers",
    });
    const applicableEncoded = makeEncoded({
      proposal: applicableProposal,
      call: makeCall(2, BidSuit.Diamonds),
    });
    const arbitration = makeArbitration({
      selected: selectedEncoded,
      truthSet: [selectedEncoded, applicableEncoded],
      eliminations: [
        {
          candidateBidName: "bergen:constructive",
          moduleId: "bergen",
          reason: "No major fit",
        },
      ],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    expect(tree.modules).toHaveLength(3);
    expect(tree.modules[0]!.verdict).toBe("selected");
    expect(tree.modules[0]!.moduleId).toBe("stayman");
    expect(tree.modules[1]!.verdict).toBe("applicable");
    expect(tree.modules[1]!.moduleId).toBe("transfers");
    expect(tree.modules[2]!.verdict).toBe("eliminated");
    expect(tree.modules[2]!.moduleId).toBe("bergen");
  });

  test("selectedPath reflects the winning proposal's module, meaning, and call", () => {
    const proposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const call = makeCall(2, BidSuit.Clubs);
    const encoded = makeEncoded({ proposal, call });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    expect(tree.selectedPath).toEqual({
      moduleId: "stayman",
      meaningId: "stayman:ask-major",
      call,
    });
  });

  test("truth-set meanings appear as matched in their module node", () => {
    const proposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
      teachingLabel: tl("Stayman"),
    });
    const call = makeCall(2, BidSuit.Clubs);
    const encoded = makeEncoded({ proposal, call });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    const staymanNode = tree.modules[0]!;
    expect(staymanNode.meanings).toHaveLength(1);
    expect(staymanNode.meanings[0]!.meaningId).toBe("stayman:ask-major");
    expect(staymanNode.meanings[0]!.displayLabel).toBe("Stayman");
    expect(staymanNode.meanings[0]!.matched).toBe(true);
    expect(staymanNode.meanings[0]!.call).toEqual(call);
  });

  test("eliminated meanings appear as not matched in their module node", () => {
    const arbitration = makeArbitration({
      eliminations: [
        {
          candidateBidName: "transfer:hearts",
          moduleId: "transfers",
          reason: "Wrong shape",
        },
      ],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    const transfersNode = tree.modules.find(m => m.moduleId === "transfers");
    expect(transfersNode).toBeDefined();
    expect(transfersNode!.meanings).toHaveLength(1);
    expect(transfersNode!.meanings[0]!.meaningId).toBe("transfer:hearts");
    expect(transfersNode!.meanings[0]!.matched).toBe(false);
  });

  test("conditions are populated from truth-set clauses", () => {
    const clauses = [
      makeClause({ factId: "hand.hcp", satisfied: true, description: "HCP >= 8", observedValue: 12 }),
      makeClause({ factId: "hand.spadeLength", satisfied: false, description: "Spades >= 4", observedValue: 3 }),
    ];
    const proposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
      clauses,
    });
    const encoded = makeEncoded({
      proposal,
      call: makeCall(2, BidSuit.Clubs),
    });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    const staymanNode = tree.modules[0]!;
    expect(staymanNode.conditions).toHaveLength(2);
    expect(staymanNode.conditions[0]!.factId).toBe("hand.hcp");
    expect(staymanNode.conditions[0]!.satisfied).toBe(true);
    expect(staymanNode.conditions[0]!.observedValue).toBe(12);
    expect(staymanNode.conditions[1]!.factId).toBe("hand.spadeLength");
    expect(staymanNode.conditions[1]!.satisfied).toBe(false);
  });

  test("deactivated module gets 'eliminated' verdict from activation trace", () => {
    const arbitration = makeArbitration();
    const provenance = makeProvenance({
      activation: [
        {
          moduleId: "bergen",
          activated: false,
          reason: "No major opening",
        },
      ],
    });

    const tree = buildParseTree(arbitration, provenance);

    const bergenNode = tree.modules.find(m => m.moduleId === "bergen");
    expect(bergenNode).toBeDefined();
    expect(bergenNode!.verdict).toBe("eliminated");
    expect(bergenNode!.eliminationReason).toBe("No major opening");
  });

  test("module with both truth-set and eliminated meanings uses truth-set for verdict", () => {
    const proposal = makeProposal({
      meaningId: "transfers:hearts",
      moduleId: "transfers",
    });
    const encoded = makeEncoded({
      proposal,
      call: makeCall(2, BidSuit.Diamonds),
    });
    const arbitration = makeArbitration({
      truthSet: [encoded],
      eliminations: [
        {
          candidateBidName: "transfers:spades",
          moduleId: "transfers",
          reason: "Not enough spades",
        },
      ],
    });
    const provenance = makeProvenance();

    const tree = buildParseTree(arbitration, provenance);

    const transfersNode = tree.modules.find(m => m.moduleId === "transfers");
    expect(transfersNode).toBeDefined();
    // Has truth-set meanings so verdict is "applicable" (not selected, not eliminated)
    expect(transfersNode!.verdict).toBe("applicable");
    // Both matched and unmatched meanings present
    expect(transfersNode!.meanings).toHaveLength(2);
    const matched = transfersNode!.meanings.filter(m => m.matched);
    const unmatched = transfersNode!.meanings.filter(m => !m.matched);
    expect(matched).toHaveLength(1);
    expect(unmatched).toHaveLength(1);
  });

  test("eliminated module conditions are enriched from provenance elimination traces", () => {
    const arbitration = makeArbitration({
      eliminations: [
        {
          candidateBidName: "bergen:constructive",
          moduleId: "bergen",
          reason: "No major fit",
        },
      ],
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "bergen:constructive",
          stage: "applicability",
          reason: "No major fit",
          evidence: [
            {
              conditionId: "bridge.majorFit",
              satisfied: false,
              observedValue: false,
              description: "Major fit required",
            },
          ],
          strength: "hard",
        },
      ],
    });

    const tree = buildParseTree(arbitration, provenance);

    const bergenNode = tree.modules.find(m => m.moduleId === "bergen");
    expect(bergenNode).toBeDefined();
    expect(bergenNode!.conditions).toHaveLength(1);
    expect(bergenNode!.conditions[0]!.factId).toBe("bridge.majorFit");
    expect(bergenNode!.conditions[0]!.satisfied).toBe(false);
  });
});
