# Architecture Design: Cross-Cutting Protocols in a Modular FSM + Rule Engine

## Context

We have a system that models multi-turn, two-party cooperative conversations where each party takes actions (from a finite, ordered action space) based on private state that the other party cannot see. The system needs to recommend the best action for the current actor given their private state and the conversation history so far.

The current architecture has two layers:

### Layer 1: Conversation FSM

A finite state machine walks the conversation history (sequence of actions by both parties and by adversaries) and determines the current state. Each state activates a **surface group** — a named set of declarative rules relevant at that point in the conversation.

The FSM also accumulates **registers** along the way — metadata like "which party is currently leading the conversation," "have we agreed on a topic," "are we in a forced-response situation," etc. These registers are set by entry effects and transition effects as the FSM walks the history.

### Layer 2: Rule Engine

Once the FSM determines the current state (and therefore the active surface group), a set of declarative rules are evaluated against the actor's private state. Each rule has:

- **Clauses**: conditions on the actor's private state (e.g., "metric X >= 8", "has property Y")
- **Encoding**: the action this rule recommends
- **Ranking metadata**: priority band, specificity, module precedence, intra-module order

All active rules are evaluated in parallel, and an arbitrator selects the highest-ranked satisfied rule as the recommended action.

### Module Composition

The FSM is assembled from a **skeleton** (shared infrastructure states) and **modules** (pluggable convention packages). The skeleton provides:

- An initial state
- A **dispatch state** with an empty transition list
- Terminal/error states

Each module contributes:

- **Entry transitions** injected into the dispatch state (e.g., "if action is X, go to my-module-state-1")
- **A subtree of post-entry states** owned entirely by that module
- **Declarative rules** for each of its states
- **Fact evaluators** (deterministic and probabilistic) that compute values its rules depend on

At composition time, all modules' entry transitions are concatenated into the dispatch state. First match wins. Once a module's entry transition fires, the FSM is in that module's subtree for the remainder of the conversation.

### What Works

This architecture works well when:
- The initial action selection is a genuine fork (pick protocol A or protocol B, never both)
- Each protocol is self-contained after the initial selection
- Modules don't need to interact after the fork

### The Problem

The architecture breaks down for **cross-cutting protocols** — behaviors that:

1. **Can be entered from states across many different modules.** Example: a "verification sub-protocol" that can be invoked from any state where the registers indicate both parties have agreed on a topic, regardless of which module established that agreement.

2. **Layer on top of the active module.** Example: after any module reaches an "agreement" state, a "refinement protocol" can begin that adds new action meanings on top of whatever module is active, without replacing it.

3. **Modify the meaning of actions within an active module.** Example: when an adversary interrupts, the available actions and their meanings change in ways that depend on both the active module and the type of interruption.

4. **Trigger at various depths in the conversation**, not just at the initial dispatch point. A module might be invocable at round 3 of module A, or round 2 of module B, or round 5 of module C — wherever the registers satisfy certain conditions.

### Current Partial Solutions

The system has two mechanisms that partially address this:

- **Submachines**: A state can declare a `submachineRef` that invokes a separate FSM and returns to a specified state when it completes. This works but requires static wiring — the invoking state must be known at composition time.

- **Hook transitions**: A module can prepend transitions into another module's explicitly exposed states. This allows one module to add paths into another module's subtree, but again requires knowing the target state ID at composition time.

Both mechanisms require the module author to know exactly which states to wire into. They don't support "any state where register X has value Y can invoke protocol Z."

## Design Requirements

Design an architecture that extends or replaces the current system to support cross-cutting protocols. The solution must:

1. **Allow protocols to be invocable from any qualifying state** based on register conditions, not just from statically-wired state IDs.

2. **Support protocol layering** — a cross-cutting protocol activates alongside (not instead of) the current module, potentially contributing additional rules to the active surface group or activating a supplementary surface group.

3. **Maintain the small active rule set property** — at any decision point, only a small number of rules should be evaluated. The solution should not degrade to "evaluate all rules from all modules at every state."

4. **Preserve module isolation** — module authors should not need to know about cross-cutting protocols that might apply to their states. A module that works correctly in isolation should continue to work when cross-cutting protocols are added.

5. **Support clean composition** — cross-cutting protocols should be composable with each other and with regular modules without combinatorial explosion.

6. **Handle priority and conflict resolution** — when a cross-cutting protocol's rules conflict with the active module's rules (e.g., both recommend different actions), there must be a clear, configurable resolution strategy.

7. **Support entering and exiting** — a cross-cutting protocol may take over the conversation temporarily (like a submachine) or may augment the current state persistently. Both patterns should be supported.

8. **Be expressible declaratively** — the solution should not require imperative code to wire cross-cutting protocols. Module authors should be able to declare "this protocol activates when registers satisfy condition X" without writing custom FSM traversal logic.

## Constraints

- The action space is finite and ordered (there are roughly 38 possible actions at any point, some of which may be illegal based on conversation history).
- Conversations are short (typically 4-12 actions total across all parties).
- There are 2 cooperating parties and 2 adversary parties. The cooperating parties share a convention system; adversaries have their own.
- The system must support probabilistic reasoning — when an action is taken, observers infer constraints on the actor's private state from the rules that could have produced that action. Cross-cutting protocols must integrate with this inference (i.e., the public constraints emitted by cross-cutting protocol rules must flow into the same inference pipeline).
- Performance is not a primary concern (this runs client-side for a teaching application), but the design should not be architecturally wasteful.

## Deliverables

1. **A concrete architectural proposal** with types/interfaces (in TypeScript or pseudocode) showing how cross-cutting protocols are defined, composed, and evaluated.

2. **A worked example** showing how a "verification sub-protocol" (invocable from any state where `agreedTopic` register is set) would be defined and how it interacts with two different regular modules.

3. **An explanation of how the rule evaluation pipeline changes** — how the active rule set is determined when both a regular module and one or more cross-cutting protocols are active.

4. **Conflict resolution strategy** — how priority between regular module rules and cross-cutting protocol rules is determined.

5. **Impact on inference** — how the posterior/belief system sees actions taken under cross-cutting protocols (i.e., what public constraints are emitted and how they're attributed).

---

# Follow-Up: Gaps in the Sparse State Vector Proposal

Your sparse state vector proposal (base frame + protocol frames, register-predicated activation, surface fragment layering) is strong for the cross-cutting protocol problem. We've evaluated it against our actual system and domain. Below are the gaps we've identified, along with specific questions.

## Gap 1: Base Module Composition Is Unchanged

The proposal solves cross-cutting protocols elegantly, but doesn't address how **base modules themselves** compose into a skeleton.

Today, each bundle has a handwritten skeleton that hardcodes the conversation shape for a specific opening action type:

```
Opening type A: idle → type-A-opened → dispatch-A → terminal
Opening type B: idle → type-B-opened-{variant} → dispatch-B-{variant} → terminal
Opening type C: idle → dispatch-C → terminal
```

These skeletons are brittle. If we want a user-configurable system where someone picks which modules they want active across multiple opening types, we'd need either:

- A single universal skeleton that covers all opening types, or
- A way to compose multiple skeletons that activate based on which opening action occurs

The protocol frame model addresses cross-cutting concerns *after* a base module is active, but not this initial routing.

**Questions:**

1. Could the skeleton itself be decomposed — e.g., an "opening router" that's itself a protocol-like entity, activating the right base module skeleton based on the first action? Or does the base FSM need to remain monolithic?

2. If multiple base skeletons coexist (one per opening action type), how should the runtime select which one is active? Is this just a degenerate case of protocol activation where exactly one "base protocol" activates based on the opening action, and all others are inert?

3. Is there a way to make the skeleton itself composable from smaller pieces without hand-authoring the full state graph for each opening type?

## Gap 2: Register Vocabulary as a Coordination Contract

The proposal makes registers the join point for protocol activation. This means all modules that want cross-cutting protocols to work must agree on a shared register vocabulary.

Today our registers are typed as structured effects:

```ts
setForcingState?: ForcingState;
setAgreedTopic?: { type: "none" | "specific" | "general"; topic?: string };
setLeader?: string;
setInterruptionMode?: string;
```

If module A sets `agreedTopic` after reaching agreement, and a verification protocol activates on `agreedTopic`, that works. But:

- What if a module sets `agreedTopic` at a point where invoking the verification protocol doesn't make sense (e.g., too early in the conversation, or past the point where verification is actionable)?
- What if two modules use registers with subtly different semantics? (Module A sets `agreedTopic` to mean "we've explicitly agreed" while module B sets it to mean "we've implicitly agreed by exhaustion of alternatives.")

**Questions:**

4. Should there be a formal **register schema** that modules must implement against — essentially a semantic contract with documented invariants? Or is this over-engineering for a small system?

5. How do you handle the case where a register condition is necessary but not sufficient for protocol activation? For example, `agreedTopic` being set is necessary for a verification protocol, but verification also requires that the conversation hasn't progressed past a certain depth and that we're not already in another verification. Do you put all of this in the `activation.when` predicate, or is there a cleaner separation?

## Gap 3: Protocol-to-Protocol Interaction

Your proposal handles base-to-protocol and protocol-to-base interaction well. But what about protocol-to-protocol?

Concrete scenario from our domain:

- **Protocol X** (exclusive takeover) can be entered from any state where `agreedTopic` is set. It runs a verification sub-conversation.
- **Protocol Y** (interference handler) activates when an adversary interrupts during Protocol X, modifying the available responses.
- After Protocol X resolves, **Protocol Z** (refinement) might resume if verification failed.

This is a protocol activating on top of another protocol, which activates on top of a base module. Three layers deep.

**Questions:**

6. Can protocols activate based on *other protocols' states*? E.g., Protocol Y's activation predicate would need to reference not just registers but also "is Protocol X in state S?" Is `{ kind: "protocol"; protocolId: string; path: "stateId" }` a valid `Ref` target, or does that break the abstraction?

7. If Protocol A is exclusive and Protocol B tries to activate on top of it, what happens? Does B queue until A exits? Does B's activation predicate need to explicitly exclude "while A is active"? Or is this handled by the `coexistence.mutexGroup` mechanism?

8. Is there a risk of protocol activation cycles? (Protocol A sets a register that activates Protocol B, which sets a register that activates Protocol A.) If so, what's the termination guarantee?

## Gap 4: Return Context After Exclusive Protocols

When an exclusive protocol completes, the base module needs to resume. But the base module's state may need to *change* based on what the exclusive protocol learned.

Example: A verification protocol discovers that the agreed topic fails validation. The base module should now transition from "ready to commit" to "need to renegotiate." But the base module didn't know verification was happening — it was just sitting in its "agreed" state.

**Questions:**

9. When an exclusive protocol exits, can it write to registers that the base module's transitions then consume? E.g., the verification protocol exits and sets `verificationResult: "failed"`, and the base module has a guard on its "agreed" state that checks this register?

10. Or does the exclusive protocol need to explicitly specify a return target in the base module (like the current `submachineRef.returnTarget`)? If so, how does that interact with the "no static wiring" principle?

## Gap 5: Teaching and Explanation Attribution

Our system is a teaching application. When we recommend an action, we explain *why* — which module, which clauses were satisfied, what the action means.

When a cross-cutting protocol is active, the explanation needs to say something like "Verification action X (checking the topic, because you agreed on topic Y via module A)." That attribution crosses the protocol/base boundary.

**Questions:**

11. How does the explanation system trace provenance across layers? The `RuleProvenance` you proposed gives the immediate source, but the *reason* the protocol was available (the agreed topic from a base module) lives in a different layer.

12. For teaching purposes, we want to show "here are the alternatives you could have chosen instead." When protocols are active, the alternative set includes both protocol rules and base rules. How do you present a coherent "decision space" to the learner when the rules come from different layers with different relations (augment/compete/shadow)?

## Summary

The sparse state vector is the right core abstraction. The gaps are:

1. Base skeleton composition (the "before cross-cutting" problem)
2. Register vocabulary coordination (semantic contract for join points)
3. Protocol-on-protocol layering (depth > 2)
4. Return context from exclusive protocols (resumption semantics)
5. Teaching/explanation across layer boundaries

We'd appreciate your thoughts on how to address these within the proposed framework, or whether any of them require fundamental changes to the model.
