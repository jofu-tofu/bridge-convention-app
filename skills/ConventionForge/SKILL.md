---
name: ConventionForge
description: Project-local workflow for building and verifying bridge conventions in this repo. Build authors or extends module fixtures from authoritative references. Verify compares fixture surfaces to the authority and can delegate runtime review to BridgeExpertReview. USE WHEN add convention OR build convention OR new convention OR convention forge OR verify convention OR check convention correctness OR scaffold convention OR audit convention surfaces.
user-invocable: true
---

# ConventionForge

Project-local workflow for authoring and verifying conventions in this bridge app. `Build` creates or extends fixture-backed convention modules. `Verify` compares the fixture against the convention authority first, then optionally hands runtime review to `BridgeExpertReview`.

> **For agents modifying this skill:** Read `SkillIntent.md` before making changes.

## Workflow Routing

When a workflow is matched, **read its file and follow the steps within it.**

**When running a workflow, output this notification:**

```
Running the **[WorkflowName]** workflow from the **ConventionForge** skill...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **Build** | "add convention", "build convention", "new convention", "scaffold convention", "fill convention gaps" | `Workflows/Build.md` |
| **Verify** | "verify convention", "check convention", "audit convention", "convention correctness", "validate convention" | `Workflows/Verify.md` |

## Examples

**Example 1: Build a new convention**
```
User: "Add the Drury convention"
-> Invokes Build workflow
-> Chooses an authority source and discovery URL
-> Authors a new module fixture and bundle wiring
-> Runs cargo tests and CLI selftest
```

**Example 2: Fill gaps in an existing convention**
```
User: "Build out the missing surfaces for Stayman"
-> Invokes Build workflow
-> Reads the stayman fixture and authority reference
-> Compares reference sequences against `states[].surfaces`
-> Adds the missing surfaces and validates the bundle
```

**Example 3: Verify a convention**
```
User: "Verify the Bergen Raises convention"
-> Invokes Verify workflow
-> Compares the bergen fixture against its authority reference
-> Optionally delegates runtime review to BridgeExpertReview
-> Produces one report with completeness and runtime findings
```
