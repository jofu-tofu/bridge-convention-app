# Evaluation Framework

> Bridge domain knowledge, evaluation tiers, agent personas, CLI metrics, and reference sources for expert review.

---

## Evaluation Tiers

### Tier 1: CLI Coverage Runner (Primary)

The CLI coverage-runner (`src/cli/coverage-runner.ts`) tests convention correctness headlessly using these subcommands:

- **`list --bundle=X`** — enumerate all coverage atoms
- **`eval --bundle=X --atom=ATOM_ID --seed=N`** — show hand, HCP, auction, legal calls (no correct answer)
- **`eval --bundle=X --atom=ATOM_ID --seed=N --bid=CALL`** — submit a bid, get full teaching feedback (ViewportBidFeedback + TeachingDetail)
- **`play --bundle=X --seed=N [--step=N] [--bid=CALL] [--reveal]`** — playthrough evaluation
- **`selftest --bundle=X --seed=N`** or **`selftest --all --seed=N`** — strategy vs itself across all atoms
- **`plan --bundle=X --agents=N [--coverage=2]`** — precompute two-phase evaluation plan

Same seed = same deal across `eval` and `eval --bid`. Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error.

Available bundle IDs: `nt-bundle`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`.

The `eval --bid` command returns structured JSON:
- **`yourBid`:** the bid submitted
- **`correctBid`:** the strategy's recommended bid
- **`grade`:** "correct" or "wrong"
- **`correct`:** boolean
- **`requiresRetry`:** boolean — should the agent try again?
- **`explanation`:** explanation from the strategy
- **`meaning`:** meaning label for the correct bid
- **`feedback`:** human-readable feedback string

**CLI handles these evaluation areas (no browser needed):**
- Convention logic correctness (wrong bid recommendations)
- Feedback/explanation accuracy (wrong or misleading teaching content)
- Constraint validation (HCP ranges, suit lengths, shape requirements)
- Coverage completeness (are all bidding states reachable?)

### Tier 2: CLI Evaluation Agents (Deep-Dive)

CLI evaluation agents perform deep convention analysis using `exec` (to run coverage-runner commands) and `read` (to examine source code). They do NOT use the browser skill or Playwright. The orchestrator decides how many agents to spawn based on the review scope — there is no fixed count. Agents are assigned non-overlapping focus areas from the list below:

**CLI agents handle these evaluation areas:**
- Deep convention logic verification (source code analysis against bridge references)
- Teaching content accuracy (labels, feedback messages, condition descriptions)
- Coverage completeness (unreachable states, missing atoms, edge cases)

---

## CLI Metrics

These metrics are computed from CLI JSON output and form the quantitative backbone of every review:

| Metric | Definition | Target |
|--------|-----------|--------|
| **First-attempt accuracy** | % of targets where `eval --bid` returned `correct: true` on first try | 100% for a correct app |
| **Post-feedback accuracy** | % of targets where the correct call was made after seeing feedback | 100% — feedback should always lead to the right answer |
| **Selftest pass rate** | pass / totalAtoms from `selftest` output | 100% of non-skip atoms |
| **Coverage** | Total atoms tested / total atoms in the bundle | 100% of reachable atoms |
| **Failure count** | Number of targets that failed (wrong call or bad feedback) | 0 for a correct app |

**Interpreting CLI results:**

| Result | Meaning | Severity |
|--------|---------|----------|
| PASS | Correct call, correct feedback | None |
| FAIL — wrong correctBid | App recommends the wrong bid for this hand/auction | CRITICAL |
| FAIL — bad feedback | Correct call but explanation is wrong or misleading | MAJOR |
| FAIL — first attempt wrong, post-feedback correct | Ambiguous teaching led to wrong first choice, feedback corrected it | Review needed |
| SKIP | Strategy returned null (no recommendation) | Informational |

---

## Agent Personas

### CLI Evaluation (replaces Agent 1: Convention Correctness Expert)

Convention correctness is now evaluated by the CLI coverage-runner, not a browser agent. The CLI exercises the same checklist below across all (state, surface) pairs automatically. When analyzing CLI failures, apply this expert knowledge:

**Expert knowledge applied to CLI failures:** Tournament director and ACBL-certified teacher with 30 years of experience. Knows SAYC, 2/1 GF, Precision, and every major convention treatment by heart.

**Checklist (used to verify CLI failures against authoritative sources):**
- [ ] After 1NT opening (15-17 HCP): Stayman requires exactly one 4-card major (or both)
- [ ] Stayman: 2C response to 1NT asks for 4-card major. Opener bids 2D (no major), 2H (4+ hearts), 2S (4+ spades)
- [ ] When opener has both 4-card majors after Stayman, standard treatment is to bid 2H first (up-the-line in SAYC, hearts first in many partnerships)
- [ ] Jacoby Transfers: 2D = transfer to hearts (5+ hearts), 2H = transfer to spades (5+ spades)
- [ ] Transfer completion: opener bids the next suit up (accepts the transfer)
- [ ] Super-accept: opener jumps to 3 of the transfer suit with 4+ card support and maximum
- [ ] Bergen Raises: after 1M opening, 3C = 4-card limit raise (7-10 dummy points), 3D = 4-card constructive raise (11-12)
- [ ] Bergen only applies to major suit openings with exactly 4-card support by responder
- [ ] Weak Two openings: 6-card suit, 5-10 HCP (some play 6-10), no side 4-card major (debatable)
- [ ] Ogust: 2NT response to Weak Two asks for hand quality. 3C = bad hand bad suit, 3D = bad hand good suit, 3H = good hand bad suit, 3S = good hand good suit, 3NT = solid suit
- [ ] DONT: over opponent's 1NT. Double = single-suited hand. 2C = clubs + higher suit. 2D = diamonds + major. 2H = hearts + spades. 2S = long spades.
- [ ] Pass should be graded wrong when a convention bid is clearly correct
- [ ] The app should not recommend bids that violate the convention being taught
- [ ] Edge case: hands that are borderline (e.g., 14 HCP for 1NT opening range) — check that the app handles range boundaries correctly
- [ ] Verify that AI opponents' bids (if any) make basic sense — no 1NT opening with 8 HCP

### CLI Agent 1: Convention Logic Agent (covers convention rules & display)

**Persona:** Bridge journalist who has written for the ACBL Bulletin and Bridge World magazine for 15 years, combined with tournament director expertise. Extremely particular about correct convention rules and terminology.

**Specialty:** Verify all convention rules in the source code match standard bridge practice. Uses CLI `list` output to identify all coverage atoms, then reads convention spec source code to verify each rule against authoritative bridge references.

**Checklist (verified via source code analysis + webfetch):**
- [ ] Suit ranking displayed correctly: Spades > Hearts > Diamonds > Clubs (high to low)
- [ ] Suit symbols correct: spades (black), hearts (red), diamonds (red), clubs (black)
- [ ] "Notrump" or "NT" — not "No Trump" or "NoTrump" or "no-trump"
- [ ] Bid notation: "1NT" not "1 NT" or "1nt" (numeral immediately followed by strain)
- [ ] "Double" and "Redouble" — not "X" and "XX" in user-facing text (though X/XX acceptable in compact notation)
- [ ] "Pass" — not "PASS" or "pass" in user-facing labels
- [ ] Hand display: cards grouped by suit, in standard order (AKQJT98765432 within each suit)
- [ ] HCP (High Card Points): A=4, K=3, Q=2, J=1. Verify any HCP display is calculated correctly
- [ ] Vulnerability labels: "Vul" / "Not Vul" or "Vulnerable" / "Not Vulnerable" — not "Red" / "White"
- [ ] Dealer indication is clear and correct (rotates: N, E, S, W)
- [ ] Compass directions: North, East, South, West — not abbreviated inconsistently
- [ ] "Opener" / "Responder" / "Overcaller" / "Advancer" — correct role terminology
- [ ] Card ranks: A, K, Q, J, 10 (or T in compact notation), 9, 8, 7, 6, 5, 4, 3, 2
- [ ] "Game" = 3NT, 4H, 4S, 5C, 5D. "Slam" = 6-level. "Grand slam" = 7-level.
- [ ] "Trick" terminology used correctly (not "round" or "turn" for tricks)

### CLI Agent 2: Teaching & Feedback Agent

**Persona:** ACBL tournament director who enforces alerting regulations at NABCs (North American Bridge Championships), combined with professional bridge teacher expertise. Has adjudicated hundreds of alerting disputes and knows exactly what must be alerted, what must be announced, and what is self-alerting.

**Specialty:** Verify that alert rules and teaching content in the convention spec source code follow ACBL General Convention Chart regulations. Reads convention module source to check alert annotations, teaching labels, and feedback messages. Uses `exec` and `read` only — no browser.

**Checklist (verified via source code analysis + webfetch):**
- [ ] 1NT opening: ANNOUNCE the range (e.g., "15 to 17")
- [ ] Stayman 2C: Do NOT alert (considered standard, self-alerting at most levels)
- [ ] Jacoby Transfers (2D/2H over 1NT): ALERT required (conventional meaning)
- [ ] Bergen Raises (3C/3D over 1M): ALERT required (conventional)
- [ ] Weak Two bids: typically not alerted if on the convention card, but range should be disclosable
- [ ] Ogust 2NT: ALERT required (asks for hand description)
- [ ] DONT bids: ALERT required (all DONT bids are conventional)
- [ ] Natural bids at the 1-level: Do NOT alert
- [ ] A raise of partner's suit: Do NOT alert (natural)
- [ ] Doubles that are NOT for penalty: ALERT required (e.g., negative, responsive, support)
- [ ] Any bid where the meaning is NOT what it sounds like: ALERT required
- [ ] Alert text should describe the MEANING, not just say "Alert" — e.g., "Transfer to hearts" not just "Conventional"
- [ ] Announcements are spoken (range announcements, transfer announcements)
- [ ] Alerts use the alert strip/card (visual indicator)
- [ ] Check that alerts appear at the RIGHT TIME — the PARTNER of the bidder alerts, not the bidder themselves (this is a common app mistake)

### CLI Teaching & Feedback: Accuracy Analysis

**Persona knowledge applied to CLI feedback analysis:** Professional bridge teacher who runs group lessons and mentors new duplicate players. Has a gift for explaining why a bid is correct and why alternatives are wrong. Very sensitive to misleading or confusing explanations.

**Specialty:** The CLI captures feedback text for every (state, surface) pair. When analyzing CLI output, verify that feedback messages are accurate and pedagogically sound using this checklist.

**Checklist (used to analyze CLI feedback text in JSON output):**
- [ ] When the user bids correctly: confirmation is clear and reinforcing
- [ ] When the user bids wrong: the explanation of WHY it's wrong is accurate
- [ ] The "correct" bid shown is actually correct for the hand and auction
- [ ] Near-miss feedback (e.g., "You bid 2H but 2S was better because...") is accurate
- [ ] Explanations reference the right constraints (HCP range, suit length, shape)
- [ ] No circular reasoning ("Bid X because X is correct")
- [ ] Point count references are accurate (e.g., "With 10 HCP" — verify the hand actually has 10 HCP)
- [ ] Suit length references are accurate ("With 5 hearts" — verify the hand has 5 hearts)
- [ ] Convention requirements are stated correctly ("Stayman requires a 4-card major" — not 3-card, not 5-card)
- [ ] Feedback does not suggest bids that violate the system being taught
- [ ] "Why not [alternative]?" explanations correctly identify what disqualifies the alternative
- [ ] Grading makes sense: a reasonable alternative bid should not be graded as completely wrong
- [ ] Feedback tone is encouraging, not condescending
- [ ] No factual errors in supplementary information (e.g., links, convention descriptions)

### CLI Agent 3: Coverage Completeness Agent

**Persona:** Experienced online bridge player who plays daily on BBO (Bridge Base Online) and also has software testing expertise. Knows exactly how a bridge game should flow and what convention states should exist. Also evaluates coverage completeness and edge cases.

**Specialty:** Verify that the coverage enumeration is complete — all expected convention states have atoms, unreachable states make sense, and edge cases are handled. Runs `list` and `summary` for all conventions, then cross-references against expected states from bridge knowledge. Uses `exec` and `read` only — no browser.

**Checklist (verified via CLI output + source code analysis):**
- [ ] Bidding proceeds clockwise: dealer bids first, then left-hand opponent, partner, right-hand opponent
- [ ] User always bids as South (verify this is consistent)
- [ ] After three consecutive passes, the auction ends (unless only one bid has been made total, in which case the opener's LHO must still pass)
- [ ] The auction ends after 4 consecutive passes if no bid has been made (all pass — passed out)
- [ ] Bid buttons respect the Laws of Bridge: cannot bid lower than the last bid, can only double opponent's last bid, can only redouble opponent's double
- [ ] Available bids are correctly constrained (cannot bid 1H after partner opened 2H)
- [ ] The bidding box feels natural to a bridge player (comparable to BBO or similar platforms)
- [ ] Phase transitions make sense (bidding → play or bidding → feedback)
- [ ] Convention select screen clearly describes what each convention teaches
- [ ] The learning screen (if accessible) presents conventions accurately
- [ ] Card play (if implemented): follows suit, trick-taking rules, correct winner determination
- [ ] Deal display: 13 cards per hand, 52 cards total, no duplicates
- [ ] Vulnerability and dealer should rotate or be clearly indicated for each deal
- [ ] The app does not freeze, crash, or become unresponsive during normal play
- [ ] Navigation (back button, menu) works smoothly without losing game state unexpectedly
- [ ] Coverage URL `?coverage=true` shows the bundle picker correctly
- [ ] Coverage URL `?coverage=true&convention=X` shows the bundle's targets
- [ ] Coverage URL `?convention=X&targetState=Y&targetSurface=Z` navigates to the specific (state, surface) drill
- [ ] Coverage drill-down links are clickable and navigate correctly
- [ ] Back navigation from coverage drill-down returns to the right place

---

## Reference Sources

When verifying correctness, agents MUST use `webfetch` and cite actual URLs. Preferred sources in priority order:

| Source | URL | Use For |
|--------|-----|---------|
| **BridgeBum (primary)** | https://www.bridgebum.com/ | Convention pages with detailed rules and examples (e.g., `/stayman.php`, `/jacoby_transfer.php`, `/bergen_raises.php`, `/weak_two_bids.php`, `/dont.php`) |
| Larry Cohen | https://www.larryco.com/ | Convention explanations, Bergen Raises (Bergen invented them) |
| Bridge Guys | https://www.bridgeguys.com/ | Convention encyclopedia |
| ACBL Convention Charts | https://web2.acbl.org/documentlibrary/play/ConventionCharts.pdf | What's alertable, legal conventions |
| Bridge Winners | https://bridgewinners.com/ | Expert discussions, edge cases |
| Karen's Bridge Library | https://www.kwbridge.com/ | Clear convention explanations |
| Richard Pavlicek | http://www.rpbridge.net/ | Standard treatments, point count |
| Laws of Duplicate Bridge | https://www.worldbridge.org/laws-of-bridge/ | Official rules |

**Every correctness issue must include at least one URL you actually fetched and read.** "Standard ACBL practice" or "any bridge textbook" is not an acceptable reference. If you cannot find a URL to back your claim, mark the finding as UNVERIFIED.

---

## Severity Definitions

| Severity | Definition | Example |
|----------|-----------|---------|
| **CRITICAL** | The app teaches something that is factually wrong about bridge. A player who learned from this would make errors at the table. | App recommends 2D as Stayman (instead of 2C). App says Jacoby Transfer to hearts is 2H (instead of 2D). |
| **MAJOR** | The app is misleading, confusing, or incomplete in a way that would erode an experienced player's trust. | Alert shown on a natural bid. Wrong HCP count displayed. Explanation says "5-card suit required" when 4-card is correct. |
| **MINOR** | A cosmetic, terminology, or preference issue that a purist would notice but that doesn't teach incorrect bridge. | "No Trump" instead of "Notrump". Suits displayed in wrong color. Inconsistent abbreviation style. |
| **OBSERVATION** | Not wrong, but noteworthy. Could be improved. | "Feedback is correct but could be more detailed." "Convention select screen could show example hands." |

---

## Structured Report Format

### CLI Report

The CLI `eval --bid` command returns structured JSON per target. The orchestrator collects these responses and parses them into the CLI Coverage Report format defined in `RunReview.md` Step 6. Key fields per `eval --bid` response:
- `yourBid`, `grade`, `correct`, `requiresRetry`
- `correctBid`, `conditions`, `feedback`
- Convention, targetState, targetSurface (from the `list`/`eval` parameters)
- BiddingViewport from `eval` (hand, auction, alerts, legal calls)
- Result: correct / incorrect / infeasible

### CLI Agent Reports

Every CLI agent produces a report following the template in `RunReview.md` Step 8. Key requirements:

1. **Evidence is mandatory** — No finding without CLI output or source code excerpts
2. **CLI and source code only** — Agents use `exec` and `read`, never the browser skill
3. **Severity must be justified** — Explain why this severity level, not just assert it
4. **Atoms table is mandatory** — List every coverage atom reviewed with pass/fail
5. **Minimum 10 atoms** — Agents must review at least 10 coverage atoms per convention

### Combined Metrics

The compiled report (see `CompileFeedback.md`) merges orchestrator metrics with CLI agent findings:
- CLI first-attempt accuracy and selftest pass rate are the primary quality signals
- CLI agent findings supplement with deep convention analysis
- A convention correctness error is always more severe than a coverage gap
