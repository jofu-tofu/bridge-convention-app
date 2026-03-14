# Learning Screen Design — Research Summary

Distilled from deep research report on teaching bridge bidding conventions as decision models. Source: cognitive load theory, retrieval practice research, DMN decision modeling, ACBL/WBF teaching guidance.

## Core Insight

The app's convention meaning surfaces are a **formalization of partnership agreements**. The learning screen should render these surfaces as multiple synchronized views — not one static flowchart — so a generic renderer can teach *any* convention without custom screens.

## Three-Layer Schema

| Layer | Purpose | Our implementation |
|---|---|---|
| **Logic** | Computable predicates over auction/hand state | `MeaningSurface` clauses evaluated against `FactCatalog` |
| **Semantic** | Bridge meaning (artificial, forcing, shows 5+ hearts) | `semanticClassId`, `teachingLabel` on surfaces, `ConventionTeaching` on config |
| **Pedagogical** | Explanations, rationale, worked examples, common mistakes | `ExplanationCatalogIR` entries, `PedagogicalRelation` graph, `TeachingProjection` |

## Four Views the Learning Screen Should Support

### 1. Guided Flow ("next decision" / coaching mode)
- User inputs auction context + hand features; UI walks the next discriminating question
- Shows recommended bid leaf with short reason
- **Progressive disclosure**: exceptions and advanced continuations one tap away, not visible by default
- Maps to: meaning surface evaluation with `ConversationMachine` highlighting the active state

### 2. Explorable Map (overview / decision surface browser)
- Helps users build mental model of where a convention sits in the larger system
- **Not yet implemented** for meaning pipeline — needs a surface→display adapter
- Shows meaning surfaces grouped by conversation machine state; user can drill into any group

### 3. Cheat Sheet (quick reference table)
- "Lookup under time pressure" — scanning, comparing, finding matching scenarios
- Keyed by: auction trigger → call → meaning → continuations
- Should support filters (contested/uncontested, beginner/advanced)

### 4. Practice / Quiz Mode (retrieval practice)
- Generate prompts: "Given this auction + hand, what call?"
- Grade against evaluation engine
- Spacing-based scheduling for long-term retention (future: spaced repetition)
- **Closest existing thing** is the drill/game mode with `TeachingResolution` grading

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
- Each meaning surface → flashcard-like prompt; each clause → discrimination question
- **Implication for drill mode**: the existing drill/game IS retrieval practice

### Spaced Practice (Cepeda)
- Spacing learning over time beats massing it together
- Future: track which conventions/bids need review and schedule accordingly

## Bridge-Specific Design Considerations

- **Bridge bidding is a constrained "language"** with a small fixed vocabulary of calls → UI focuses on meaning and selection, not free-form input
- **Convention cards are standard artifacts** in bridge → the cheat sheet view is a "next-gen convention card generator"
- **Disclosure matters**: alerts/announcements are regulated. Teaching explanations overlap with what players must disclose to opponents. The semantic layer (artificial, forcing, etc.) serves both purposes.
- **Auction state complexity**: decisions depend on competition, seat, vulnerability, scoring, and prior agreements — the `ConversationMachine` FSM + `MeaningSurface` clauses encode this

## What We Have vs What's Needed

| Capability | Status | Location |
|---|---|---|
| Convention meaning surfaces | Done | `conventions/definitions/{bundle}/meaning-surfaces.ts` |
| Fact catalog + evaluation | Done | `conventions/core/pipeline/fact-evaluator.ts`, `contracts/fact-catalog.ts` |
| Convention-level teaching | Done | `ConventionTeaching` on config |
| Explanation catalog | Done | `ExplanationCatalogIR` per bundle (`explanation-catalog.ts`) |
| Pedagogical relations | Done | `PedagogicalRelation` graph per bundle |
| Teaching projection builder | Done | `teaching/teaching-projection-builder.ts` → `TeachingProjection` |
| Teaching resolution (grading) | Done | `teaching/teaching-resolution.ts` → `BidGrade` |
| LearningScreen shell | Done | `components/screens/LearningScreen.svelte` — sidebar + about card |
| Surface→display adapter | Not started | Map `MeaningSurface[]` to browsable learning view |
| Active path highlighting | Not started | Evaluate hand against surfaces, highlight matching path |
| Hand evaluation in learning | Not started | Show example hands, evaluate which surface they match |
| Guided flow mode | Not started | Step-by-step walk-through with progressive disclosure |
| Quiz/practice mode | Not started | Generate retrieval prompts from surfaces |
| Skill-adaptive presentation | Not started | Adjust detail level by user expertise |
| Spaced repetition scheduling | Not started | Track review timing across sessions |

## Key Design Decision

The research strongly supports **one source of truth (meaning surfaces + fact catalog + explanation catalog) → multiple rendered views**. The `TeachingProjection` builder is the right abstraction for projecting pipeline data into teaching-optimized views. Future work extends the renderer, not the data model.
