# Evaluation Framework

> Bridge domain knowledge, evaluation tiers, agent personas, CLI metrics, and reference sources for expert review.

---

## Evaluation Tiers

### Tier 1: CLI Coverage Runner (Primary)

The CLI coverage-runner (`src/cli/coverage-runner.ts`) tests convention correctness headlessly by exercising every (state, surface) pair. It produces structured JSON with:

- **BiddingViewport:** what the player sees (hand, auction, alerts, legal calls)
- **Expected vs actual call:** what bridge rules say vs what the app recommended
- **Feedback text:** the explanation shown after bidding
- **First-attempt accuracy:** did the agent get the right answer before seeing feedback?
- **Post-feedback accuracy:** did the agent get the right answer after feedback?

**CLI handles these evaluation areas (no browser needed):**
- Convention logic correctness (wrong bid recommendations)
- Feedback/explanation accuracy (wrong or misleading teaching content)
- Constraint validation (HCP ranges, suit lengths, shape requirements)
- Coverage completeness (are all bidding states reachable?)

### Tier 2: Browser UI Agents (Secondary)

Browser agents validate what the CLI cannot: visual rendering, layout, and interactive UX. They use 3 specialist roles instead of the original 5, because convention correctness testing has moved to the CLI.

**Browser handles these evaluation areas:**
- Suit symbol rendering (colors, shapes)
- Card display and hand layout
- Alert badge display and annotation text
- Feedback message rendering (truncation, formatting)
- Navigation and page transitions
- Coverage URL drill-down functionality

---

## CLI Metrics

These metrics are computed from CLI JSON output and form the quantitative backbone of every review:

| Metric | Definition | Target |
|--------|-----------|--------|
| **First-attempt accuracy** | % of (state, surface) targets where the correct call was made on first try | 100% for a correct app |
| **Post-feedback accuracy** | % of targets where the correct call was made after seeing feedback | 100% — feedback should always lead to the right answer |
| **Infeasible pair count** | Number of (state, surface) pairs where no deal can reach that state | Informational — not an error, but high counts may indicate design gaps |
| **Coverage** | Total targets tested / total targets in the bundle | 100% of reachable pairs |
| **Failure count** | Number of targets that failed (wrong call or bad feedback) | 0 for a correct app |

**Interpreting CLI results:**

| Result | Meaning | Severity |
|--------|---------|----------|
| PASS | Correct call, correct feedback | None |
| FAIL — wrong expected call | App recommends the wrong bid for this hand/auction | CRITICAL |
| FAIL — bad feedback | Correct call but explanation is wrong or misleading | MAJOR |
| FAIL — first attempt wrong, post-feedback correct | Ambiguous UI led to wrong first choice, feedback corrected it | Review needed |
| INFEASIBLE | No deal can reach this (state, surface) pair | Informational |

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

### Browser Agent 1: UI Rendering Agent (covers terminology & display)

**Persona:** Bridge journalist who has written for the ACBL Bulletin and Bridge World magazine for 15 years. Extremely particular about correct bridge terminology and notation. Will notice if "No Trump" is written instead of "Notrump" or if suit symbols are in the wrong order.

**Specialty:** Verify all bridge terminology, notation, suit symbols, and display conventions match standard bridge practice. This agent validates what the CLI cannot see — the visual rendering layer.

**Checklist:**
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

### Browser Agent 2: Alert & Annotation Agent

**Persona:** ACBL tournament director who enforces alerting regulations at NABCs (North American Bridge Championships). Has adjudicated hundreds of alerting disputes. Knows exactly what must be alerted, what must be announced, and what is self-alerting.

**Specialty:** Verify that alerts and announcements **render correctly in the UI** and follow ACBL General Convention Chart regulations. The CLI validates alert logic; this agent validates alert display.

**Checklist:**
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

### CLI Evaluation: Teaching & Feedback Accuracy (replaces Agent 4)

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

### Browser Agent 3: Navigation & Flow Agent

**Persona:** Experienced online bridge player who plays daily on BBO (Bridge Base Online). Knows exactly how a bridge game should flow. Also evaluates the coverage drill-down UI and navigation UX.

**Specialty:** Verify that game flow, navigation, page transitions, and coverage URL scheme work correctly from a user's perspective.

**Checklist:**
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

The CLI coverage-runner produces structured JSON. The orchestrator parses this into the CLI Coverage Report format defined in `RunReview.md` Step 5. Key fields per target:
- Convention, targetState, targetSurface
- BiddingViewport (hand, auction, alerts, legal calls)
- Expected call, actual call, first-attempt accuracy, post-feedback accuracy
- Feedback text
- Result: PASS / FAIL / INFEASIBLE

### Browser Agent Reports

Every browser agent produces a report following the template in `RunReview.md` Step 9. Key requirements:

1. **Evidence is mandatory** — No finding without a screenshot path or DOM text excerpt
2. **UI focus** — Browser agents validate rendering, not convention logic (CLI does that)
3. **Severity must be justified** — Explain why this severity level, not just assert it
4. **Scenarios table is mandatory** — List every URL/screen tested with pass/fail
5. **Minimum 10 screens** — Agents must check at least 10 distinct screens/states

### Combined Metrics

The compiled report (see `CompileFeedback.md`) merges CLI metrics with browser findings:
- CLI first-attempt accuracy and post-feedback accuracy are the primary quality signals
- Browser issues supplement with rendering and UX quality
- A convention correctness error (from CLI) is always more severe than a UI rendering issue (from browser)
