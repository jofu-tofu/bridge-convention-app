# Learning Screen Design — Research Summary

Distilled from deep research report on teaching bridge bidding conventions as decision models. Source: cognitive load theory, retrieval practice research, DMN decision modeling, ACBL/WBF teaching guidance.

## Core Insight

The app's convention rule trees are already a **formalization of partnership agreements**. The learning screen should render these trees as multiple synchronized views — not one static flowchart — so a generic renderer can teach *any* convention without custom screens.

## Three-Layer Schema (already partially implemented)

| Layer | Purpose | Our implementation |
|---|---|---|
| **Logic** | Computable predicates over auction/hand state | Rule trees in `conventions/definitions/` — `RuleCondition` predicates, `DecisionNode`/`BidNode` |
| **Semantic** | Bridge meaning (artificial, forcing, shows 5+ hearts) | `BidMetadata` (whyThisBid, forcingType, isArtificial), `ConventionTeaching` on config |
| **Pedagogical** | Explanations, rationale, worked examples, common mistakes | `ConventionExplanations` in each convention's `explanations.ts`, `DecisionMetadata`/`BidMetadata` teaching fields |

## Four Views the Learning Screen Should Support

### 1. Guided Flow ("next decision" / coaching mode)
- User inputs auction context + hand features; UI walks the next discriminating question
- Shows recommended bid leaf with short reason
- **Progressive disclosure**: exceptions and advanced continuations one tap away, not visible by default
- Maps to: tree traversal with `evaluateTeachingRound()` highlighting the active path

### 2. Explorable Map (overview / decision tree)
- Helps users build mental model of where a convention sits in the larger system
- **Currently implemented**: `DecisionTree.svelte` — interactive expand/collapse visualization
- Shows full tree structure; user can drill into any branch

### 3. Cheat Sheet (quick reference table)
- "Lookup under time pressure" — scanning, comparing, finding matching scenarios
- **Currently implemented**: quick reference table in `LearningScreen.svelte`
- Keyed by: auction trigger → call → meaning → continuations
- Should support filters (contested/uncontested, beginner/advanced)

### 4. Practice / Quiz Mode (retrieval practice)
- Generate prompts: "Given this auction + hand, what call?"
- Grade against evaluation engine
- Spacing-based scheduling for long-term retention (future: spaced repetition)
- **Not yet implemented** — closest existing thing is the drill/game mode

## Learning Science Principles to Follow

### Cognitive Load (Sweller)
- Novices have limited working memory — don't show everything at once
- **Progressive disclosure**: show only what the user needs now; defer advanced branches
- **Segmenting**: break into learner-paced chunks (one decision at a time)
- **Coherence**: remove extraneous material from primary view

### Worked Examples → Faded Practice
- **Beginners**: full worked solutions (auction + hand + reasoning + call)
- **Intermediates**: "faded" examples — partially worked, learner fills missing steps
- **Advanced**: fast lookup + practice questions only
- This is the **expertise reversal effect** — heavy scaffolding helps novices but hurts experts

### Retrieval Practice (Roediger & Karpicke)
- Being tested (actively retrieving answers) improves retention more than re-studying
- Each bid node → flashcard-like prompt; each decision node → discrimination question
- **Implication for drill mode**: the existing drill/game IS retrieval practice

### Spaced Practice (Cepeda)
- Spacing learning over time beats massing it together
- Future: track which conventions/bids need review and schedule accordingly

## Bridge-Specific Design Considerations

- **Bridge bidding is a constrained "language"** with a small fixed vocabulary of calls → UI focuses on meaning and selection, not free-form input
- **Convention cards are standard artifacts** in bridge → the cheat sheet view is a "next-gen convention card generator"
- **Disclosure matters**: alerts/announcements are regulated. Teaching explanations overlap with what players must disclose to opponents. The semantic layer (artificial, forcing, etc.) serves both purposes.
- **Auction state complexity**: decisions depend on competition, seat, vulnerability, scoring, and prior agreements — the tree already encodes this via `auctionConditions`

## What We Have vs What's Needed

| Capability | Status | Location |
|---|---|---|
| Convention rule trees | Done | `conventions/definitions/{name}/tree.ts` |
| Teaching metadata on nodes | Done | `DecisionMetadata`, `BidMetadata` on tree nodes |
| Convention-level teaching | Done | `ConventionTeaching` on config, `ConventionExplanations` per convention |
| Condition explanations | Done | `display/condition-explanations.ts` |
| Tree flattening for display | Done | `display/tree-display.ts` → `TreeDisplayRow[]` with teaching fields |
| Teaching content extraction | Done | `display/teaching-content.ts` → structured rounds with bid options |
| Decision tree component | Done | `components/game/DecisionTree.svelte` |
| LearningScreen shell | Done | `components/screens/LearningScreen.svelte` — sidebar + tree + table |
| Active path highlighting | Not started | Evaluate hand against tree, highlight matching path |
| Hand evaluation in learning | Not started | Show example hands, evaluate which path they take |
| Guided flow mode | Not started | Step-by-step walk-through with progressive disclosure |
| Quiz/practice mode | Not started | Generate retrieval prompts from tree nodes |
| Skill-adaptive presentation | Not started | Adjust detail level by user expertise |
| Spaced repetition scheduling | Not started | Track review timing across sessions |

## Key Design Decision

The research strongly supports our current architecture: **one source of truth (the rule tree + metadata) → multiple rendered views**. The `ConventionExplanations` + `TeachingContent` extraction pipeline is the right abstraction. Future work extends the renderer, not the data model.
