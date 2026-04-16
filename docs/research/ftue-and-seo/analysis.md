# First-Time User Experience & SEO Research

Research document analyzing the first-time user journey, competitor onboarding patterns, SEO strategy, and actionable recommendations for the bridge convention practice app. This document is a reference for implementation -- no code changes are included.

**Date:** April 2026
**Status:** Pre-implementation research
**Related:** `docs/research/seo-principles-web-apps/evidence-map.md` (SEO evidence base), `docs/product/product-direction.md` (monetization model)

---

## Part 1: Current State Analysis & Bottleneck Diagnosis

### What a First-Time User Sees Today

A new visitor arrives at the app URL and encounters this sequence:

1. **WASM loading screen** (`src/App.svelte:68-70`). A centered "Loading engine..." message on a dark background. No branding, no progress indicator, no context for what's loading or why. Duration depends on network speed and WASM binary size (~2MB). On slow connections this could be 3-5 seconds of staring at two words.

2. **Convention grid** (`src/components/screens/ConventionSelectScreen.svelte`). After WASM loads, the user lands on `ConventionSelectScreen` -- a grid titled "Bridge Practice" with the subtitle "Select a convention to learn or practice." The grid shows ~10 convention cards (1NT Responses, Bergen Raises, Weak Twos, DONT, Michaels & Unusual NT, Strong 2C, Negative Doubles, New Minor Forcing, etc.) with category filter pills (All, Responses, Raises, Competitive, etc.) and a search bar.

3. **Lock icons everywhere.** Each convention card has two buttons: "Learn" (always enabled) and "Practice" (enabled or locked). Per `src/stores/entitlements.ts`, only `nt-bundle` is free to practice. The remaining 9 bundles show a lock icon with "Locked" text. There is no explanation of what "Locked" means, no "Free" badge on the one free bundle, and no indication of what unlocking requires.

4. **No guidance, no welcome, no context.** There is no welcome message, no suggested first action, no explanation of what this app does or who it's for. The title "Bridge Practice" and subtitle "Select a convention to learn or practice" are the only orientation. A user who doesn't know what "Jacoby Transfers" or "Bergen Raises" means has no entry point.

5. **Paywall overlay** (`src/components/shared/PaywallOverlay.svelte`). Clicking "Locked" on any premium convention opens a minimal dialog: "Unlock All Conventions" with copy about practice modes and configuration, a "Subscribe" button (placeholder -- no payment integration), and "Maybe later." The Subscribe button simply closes the dialog.

6. **Navigation chrome.** Desktop: a thin left NavRail with Home, Learn, and Settings icons. Mobile: a bottom tab bar with the same. The "Learn" nav item goes to `GuidesScreen`, which currently has one guide ("Why We Built This App"). This content is not surfaced during onboarding.

### Bottleneck Analysis

#### 1. Traffic Qualification (Impact: Critical)

**The biggest problem isn't onboarding UX -- it's that the right users aren't finding the app at all.**

The app is a Svelte SPA with all content rendered client-side via WASM. Per the SEO evidence map (`docs/research/seo-principles-web-apps/evidence-map.md`), AI crawlers (GPTBot, ClaudeBot, Perplexity) cannot execute JavaScript at all, and AI crawler traffic is growing 2,825% YoY. Google can render JS but defers it to a render queue with ~10s delay. The app has no static HTML content pages, no sitemap, no structured data, and no meta tags beyond defaults. **The app is essentially invisible to search engines and AI search.**

Without organic traffic, user acquisition depends entirely on direct links from bridge community forums, word of mouth, and manual promotion. This is the ceiling on all other improvements -- perfecting the onboarding flow doesn't matter if nobody reaches it.

**Ranking: #1 bottleneck.** Fixing this unlocks all other improvements.

#### 2. Comprehension (Impact: High)

A first-time visitor sees "Bridge Practice" and a grid of convention names. This works for users who already know what bridge conventions are and are specifically looking for a practice tool. It fails for:

- **Lena Ortiz** (lesson graduate, experience 2): Knows the convention names from her course but doesn't know what "practice" means in this context. Is she going to play hands? Take a quiz? Read explanations? The word "practice" is ambiguous.
- **Noah Reed** (free-tier explorer, experience 3): Found the app via a forum recommendation. Wants to evaluate it quickly. Sees a grid of locked items and one free option. Can't tell if this is a tutorial site, a game, or a reference tool.

The "Learn" buttons are always available but their meaning isn't clear from the grid. A user might think "Learn" means "read about" (passive) rather than "interactive teaching flow with decision trees" (which is what it actually is).

**Ranking: #2 bottleneck.** Costs conversions from qualified traffic.

#### 3. Value Proposition Speed (Impact: High)

The time from page load to experiencing the core value loop (bid on a hand, get feedback) is too long:

1. Wait for WASM (~2-5s)
2. Scan the convention grid, figure out what to click
3. Choose between Learn and Practice (unclear difference)
4. If Practice: configure practice mode, role, system (settings dialog)
5. Wait for deal generation
6. Finally: see a hand and make a bidding decision

Competitors like Duolingo and Brilliant get users into an interactive experience in under 2 minutes, often before account creation. This app has no account gate (good), but the cognitive overhead of the convention grid adds 30-60 seconds of decision paralysis before any interaction.

**Ranking: #3 bottleneck.** Users who understand the app still take too long to experience value.

#### 4. Pricing Friction (Impact: Medium)

The current pricing communication has three problems:

- **No "Free" signal.** The one free bundle (1NT Responses) looks identical to paid bundles except for the Practice button state. A user scanning the grid sees 9 locked items and 1 unlocked item with no explanation of why.
- **No value preview for locked content.** Clicking "Locked" shows a generic "Unlock All Conventions" dialog with no preview of what's inside. The "Learn" button works for all bundles (learning is free), but this isn't communicated anywhere.
- **Placeholder paywall.** The Subscribe button does nothing. A user who wants to pay can't. This creates a dead end that damages trust.

Per `docs/product/product-direction.md`, learning pages are the conversion tool -- showing quality drives upgrades. But nothing in the current UI communicates that learning is free for all conventions.

**Ranking: #4 bottleneck.** Causes confusion rather than churn -- users who discover "Learn" works for everything are fine.

#### 5. Technical Friction (Impact: Low)

WASM load time is the only technical friction. The app works on all modern browsers, is responsive on mobile, and doesn't require an account. The "Loading engine..." screen is unbranded and uninformative but brief on fast connections. This is a minor irritant, not a bounce cause.

**Ranking: #5 bottleneck.** Worth polishing but not a priority.

### Bounce Risk by Persona

| Persona | Bounce Risk | Primary Cause |
|---------|-------------|---------------|
| **Lena Ortiz** (lesson grad, exp 2) | High | Comprehension -- doesn't know where to start, overwhelmed by convention grid |
| **Noah Reed** (free explorer, exp 3) | High | Value proposition speed -- can't evaluate the app fast enough, sees mostly locked content |
| **Michael Chen** (returning player, exp 6) | Medium | Comprehension -- wants a calm entry, sees a busy grid, but understands the terminology |
| **Maya Thompson** (time-squeezed, exp 4) | Medium-High | Value speed -- needs to be practicing within 60 seconds, current flow takes 2-3 minutes |
| **Jordan Kim** (tournament climber, exp 8) | Low | Understands everything immediately, scans for relevant conventions, starts practicing |

---

## Part 2: Competitor & Pattern Analysis

### Competitor Findings

#### Duolingo (Language Learning)

- **Time-to-first-value:** Under 2 minutes. Users start an interactive lesson before creating an account. The very first interaction is choosing a language and taking a placement quiz or starting from scratch.
- **Paywall strategy:** Deferred and friction-based. Free tier is fully functional with ads and a "hearts" system (limited mistakes per session). Super Duolingo removes ads and gives unlimited hearts. The paywall doesn't appear during the first lesson -- it surfaces after several sessions, typically as a "try free for 14 days" banner. The hearts system creates natural friction that makes the upgrade feel like relief rather than a purchase.
- **Guided vs. open:** Strongly guided. The app asks your goal (casual to intense), experience level, then funnels you into a placement test or Lesson 1. No browsing of content -- you follow a linear path.
- **Key patterns:** Goal-setting picker, placement test, immediate interactive lesson, animated XP bar, streak counter after first completion, mascot encouragement.

#### Chess.com (Chess)

- **Time-to-first-value:** Under 1 minute. You can play against the computer or solve a puzzle without logging in. The homepage features prominent "Play Online" and "Play Computer" buttons.
- **Paywall strategy:** Feature and quantity gating. Free users get ~5 puzzles per day, limited game analysis, and limited lessons. Premium features show lock icons or diamond badges. Primary paywall trigger is daily puzzle exhaustion -- after solving free puzzles, a modal prompts upgrade.
- **Guided vs. open:** Mostly open. Dashboard with multiple entry points (Play, Puzzles, Lessons) plus a "New to Chess?" section. Optional skill assessment during account creation. Works because chess has a universal entry point (play a game).
- **Key patterns:** Rating estimation quiz, daily puzzle on homepage, truncated free analysis with upgrade prompt, 7-day free trial offers.

#### BBO (Bridge Base Online)

- **Time-to-first-value:** Slow -- requires account creation before any interaction. Must register with email and username before seeing the lobby, playing, or accessing content. This is the weakest pattern among competitors.
- **Paywall strategy:** Pay-per-play for sanctioned games ($2-5 per session). Robot games have free and premium tiers. The paywall is encountered contextually when clicking on paid content. No aggressive upselling.
- **Guided vs. open:** Largely unguided. After registration, users land in a lobby resembling a 2000s-era chat room. A "Learn to Play Bridge" section exists but is not surfaced during onboarding. Beginners face a steep learning curve navigating the interface.
- **Key patterns:** Minimal onboarding, lobby-based navigation, no welcome wizard or tooltip tour. The mobile app is slightly more modern but similarly lacks guided onboarding.

**Note:** BBO's onboarding is behind a login wall. Specific flow details are based on publicly available information and may not reflect the latest version.

#### Funbridge (Bridge Practice)

- **Time-to-first-value:** Moderate -- requires account creation (email or social login), then users can start a practice deal relatively quickly.
- **Paywall strategy:** Usage gating via daily deal limits. Free users get a limited number of deals per day. Premium unlocks unlimited deals, analysis, and tournament access. Messaging emphasizes "unlimited practice" and "compare with thousands of players." Annual discount prominently featured.
- **Guided vs. open:** Semi-guided on mobile. Asks about experience level during setup and may adjust difficulty. Has a tutorial mode for beginners. Convention-specific drilling is an advanced feature, not part of onboarding.
- **Key patterns:** Experience level selector, deal-of-the-day format, leaderboard comparison as engagement hook. Convention settings are buried in preferences rather than part of the learning journey.

**Note:** Funbridge's specific onboarding flow may have evolved. Mobile and desktop experiences differ.

#### Brilliant.org (STEM Education)

- **Time-to-first-value:** Under 2 minutes. The homepage features an interactive widget (math or logic puzzle) that users can manipulate immediately -- no signup required. This "try before you sign up" pattern is central to their conversion strategy.
- **Paywall strategy:** Hard paywall after generous preview. Free users access 1-2 full courses or first few lessons of many courses. Paywall appears after completing preview content, with messaging like "You've completed X problems -- unlock the full course." Free trial (typically 7 days) prominently offered. By the time users hit the paywall, they've experienced the interactive teaching style.
- **Guided vs. open:** Guided with choice. Post-signup questionnaire about goals and experience level, then personalized course recommendations. Users can also browse all courses freely (seeing locked/unlocked status).
- **Key patterns:** Interactive homepage preview, goal-setting questionnaire, personalized learning path, manipulable visualizations (sliders, drag-and-drop), streak system, progress visualization with course map.

### Actionable Takeaways

#### Pattern 1: Time-to-First-Value (Duolingo, Brilliant)

**The strongest onboarding pattern is letting users experience the core interaction before any friction.** Both Duolingo and Brilliant put an interactive element on the very first screen -- no signup, no configuration, no explanation needed. The user does something, gets feedback, and understands the product through experience rather than description.

**Application:** The app's "Learn" flow (interactive decision trees with teaching) is the equivalent of Duolingo's first lesson. A welcome banner should route new users directly to "Learn Stayman" -- the simplest, most universal convention. The user reads the flow tree, sees how the convention works, and understands the app's value. No configuration, no convention selection, no decision paralysis.

#### Pattern 2: Paywall as Natural Friction (Duolingo, Funbridge)

**The best paywalls emerge from usage patterns, not from feature gates.** Duolingo's hearts system creates friction that the paid tier removes. Funbridge gates daily deal count. In both cases, the user understands what they're paying for because they've experienced the free version's limitations naturally.

**Application:** The current approach (1 free bundle for practice, all bundles free to learn) aligns well with this pattern. What's missing is clear communication: "Learn any convention for free. Practice Stayman for free. Upgrade to practice all conventions." This framing makes the free tier feel generous rather than restricted.

#### Pattern 3: Guided Entry for Domain-Specific Tools (Duolingo, Brilliant, Anti-pattern: BBO)

**Domain-specific learning tools need guided entry. Open-ended dashboards work for universal activities (chess) but fail for specialized content (bridge conventions, language learning, STEM topics).** BBO's lobby-first approach is the anti-pattern -- it assumes users already know what they want.

**Application:** A welcome banner with a clear CTA ("Start Learning: Stayman") is the minimum viable guided entry. It tells new users: this is what to do first. More sophisticated approaches (experience level selector, personalized path) can come later but aren't necessary for MVP.

#### Pattern 4: Bridge-Specific Opportunity

**Neither BBO nor Funbridge has strong convention-specific onboarding.** Convention selection is treated as a settings choice, not a learning journey. This app's convention-focused design is a genuine differentiator -- but only if the first-time experience highlights it. The current grid-of-conventions approach buries the differentiator behind the same "pick from a list" pattern competitors use.

---

## Part 3: Recommended First-Visit Experience

### Welcome Banner Design

A dismissible banner at the top of `ConventionSelectScreen`, shown only on first visit. The banner replaces the first ~200px of the grid area, pushing convention cards below it.

**Copy (persona-aware -- avoids both over-simplification and jargon):**

> **Welcome to Bridge Practice**
> Master bidding conventions through interactive learning and hands-on practice. Start with Stayman -- our most popular convention -- and see how the app teaches through real bidding decisions.

**CTAs:**
- Primary: **"Learn Stayman"** (accent-colored button, navigates to `LearningScreen` with the `stayman` module)
- Secondary: **"Browse All Conventions"** (text link, dismisses banner and stays on grid)

**Dismiss behavior:**
- Clicking either CTA dismisses the banner permanently
- An "x" close button in the top-right corner also dismisses permanently
- Dismissal sets `bridge-app:has-visited` in localStorage via existing `saveToStorage()` helper from `src/stores/local-storage.ts`
- The banner never shows again once dismissed (read via `loadFromStorage()` on mount)

**Why "Learn Stayman" and not "Practice Stayman":**
Per `docs/product/product-direction.md`, learning pages are the conversion tool. The learning flow (interactive decision tree + teaching content) demonstrates the app's quality better than jumping into practice (which requires understanding the convention already). Learning is also free for all conventions -- it naturally leads to "now try practicing" which surfaces the free practice tier.

### First-Visit Detection

**Implementation:** `bridge-app:has-visited` localStorage boolean, checked on `ConventionSelectScreen` mount.

```
Key: "bridge-app:has-visited"
Value: true (after first dismiss)
Default: false (absent = first visit)
```

This follows the existing `bridge-app:*` key pattern used by:
- `bridge-app:practice-preferences` (drill settings)
- `bridge-app:last-convention` (continue practicing card)
- `bridge-app:user-modules` (forked conventions)
- `bridge-app:custom-systems` (custom system configs)
- `bridge-app:practice-packs` (practice pack configs)

Read/write via the existing `loadFromStorage`/`saveToStorage` helpers in `src/stores/local-storage.ts`.

### Convention Grid Changes

#### "Free" Badge on NT Bundle

Add a small "Free" badge (green text, subtle background) next to the 1NT Responses card title or category tag area. This makes it immediately clear which bundle is free without requiring the user to click each one.

#### "Premium" Labels Replacing Bare Lock Icons

Currently, locked bundles show a lock icon and "Locked" text on the Practice button. Change "Locked" to "Premium" -- this communicates that the content exists and is valuable (it's premium), rather than that it's inaccessible (it's locked). The lock icon can remain as a visual indicator.

#### "All Learning is Free" Signal

Add a subtle note below the search bar or above the grid: "Learning is free for all conventions. Practice requires a subscription for premium bundles." This single line resolves the ambiguity about what's free and what isn't.

### Per-Persona First-Visit Journeys

**Lena Ortiz (lesson graduate, experience 2):**
1. Arrives at app, sees welcome banner
2. "Learn Stayman" resonates -- she just learned about Stayman in her course
3. Clicks primary CTA, lands on LearningScreen with the Stayman module
4. Sees the interactive decision tree showing when to bid Stayman, what responses mean
5. After exploring the learning flow, clicks "Practice" from the learning screen
6. Lands in a practice session with default settings (decision-drill, responder, SAYC)
7. Gets immediate feedback on her first bid -- the core value loop

**Noah Reed (free-tier explorer, experience 3):**
1. Arrives at app, scans welcome banner quickly
2. Clicks "Browse All Conventions" -- he wants to evaluate breadth first
3. Sees the convention grid with "Free" badge on 1NT and "Premium" on others
4. Reads "All learning is free" note, clicks "Learn" on Bergen Raises to test depth
5. Impressed by the teaching quality, returns to try practicing on the free bundle
6. After practicing Stayman, understands the value and considers upgrading

**Jordan Kim (tournament climber, experience 8):**
1. Arrives at app, ignores welcome banner, clicks "x" to dismiss
2. Scans convention grid, finds Negative Doubles
3. Clicks "Learn" to see the app's coverage depth
4. Satisfied with coverage, clicks "Practice" -- encounters paywall
5. Reads the paywall copy about practice modes and configuration, evaluates price

**Maya Thompson (time-squeezed parent, experience 4):**
1. Arrives at app, reads welcome banner in 3 seconds
2. "Learn Stayman" is a clear action -- clicks it
3. Spends 5 minutes exploring the Stayman decision tree
4. Clicks "Practice" to try a few hands in her remaining 5 minutes
5. Completes 3-4 decision-drill rounds, gets feedback, feels productive

### Files That Would Need Modification

| File | Change |
|------|--------|
| `src/components/screens/ConventionSelectScreen.svelte` | Add welcome banner component, "Free"/"Premium" badges, "all learning is free" note |
| `src/stores/app.svelte.ts` | Add `hasVisited` state (read from localStorage on init), `dismissWelcome()` method |
| `src/stores/local-storage.ts` | No changes needed -- existing helpers suffice |
| `src/stores/entitlements.ts` | No changes needed -- `canPractice()` already provides the lock/unlock logic |
| `src/components/shared/PaywallOverlay.svelte` | Enhanced copy: list what premium includes, show "Learning is always free" reassurance, add "Learn this convention" as alternative CTA next to "Subscribe" |

---

## Part 4: SEO & Content Strategy

### The Crawlability Problem

The app is a Svelte SPA with all content rendered client-side via WASM. This creates a fundamental visibility problem:

- **AI crawlers (GPTBot, ClaudeBot, Perplexity):** Cannot execute JavaScript at all. The app is completely invisible. AI crawler traffic is growing 2,825% YoY (Cloudflare 2025 data).
- **Google:** Can render JS via headless Chromium, but defers to a render queue (~10s delay). Google's own docs recommend SSR/SSG. The March 2026 shift to site-wide CWV aggregation means slow WASM init could drag down rankings for any content pages that share the domain.
- **Net effect:** The app has zero organic search presence and zero AI search presence.

### How the Guides Section Fits

The guides system (`src/content/guides.ts`) uses `import.meta.glob` to load markdown files from `content/guides/` at build time, parsing frontmatter and rendering to HTML via `marked`. Currently there is one guide: "Why We Built This App" (`content/guides/why-we-built-this.md`).

**Current limitation:** Despite being rendered at build time, the HTML output is still served within the SPA -- it's not a separate static page that crawlers can access. The `GuidesScreen.svelte` component renders guide content inside the SPA shell after WASM initialization. A crawler that can't execute JS never sees the guide content.

**Opportunity:** The guide content system is the natural foundation for SEO content pages. The markdown-to-HTML pipeline already exists. What's missing is a way to serve these pages as standalone static HTML outside the SPA, accessible at crawlable URLs.

### Guide/Blog Topics Mapped to Convention Bundles

Each convention bundle maps naturally to one or more SEO content pages:

| Convention Bundle | Guide Topics |
|---|---|
| 1NT Responses (nt-bundle) | "What is Stayman?", "Jacoby Transfers Explained", "When to Use Stayman vs. Transfers" |
| Bergen Raises (bergen-bundle) | "Bergen Raises: A Complete Guide", "When to Use Bergen Raises" |
| Weak Twos (weak-twos-bundle) | "Weak Two Bids: Strategy and Responses", "Feature Responses to Weak Twos" |
| DONT (dont-bundle) | "DONT Over 1NT: A Complete Guide" |
| Michaels & Unusual NT (michaels-unusual-bundle) | "Michaels Cue Bid Explained", "Unusual 2NT Convention" |
| Strong 2C (strong-2c-bundle) | "Strong 2 Club Opening: When and How" |
| Negative Doubles (negative-doubles-bundle) | "Negative Doubles in Bridge: A Practical Guide" |
| New Minor Forcing (nmf-bundle) | "New Minor Forcing Convention Explained" |

Additionally, pillar content pages that link to multiple convention guides:
- "Complete Guide to Bridge Bidding Conventions" (pillar page linking to all convention guides)
- "Bridge Conventions for Beginners: Where to Start"
- "SAYC vs 2/1 Game Forcing: Which System Should You Play?"

### Static HTML Solution: Caddy Serving Pre-Rendered Routes

The deployment stack (Docker + Caddy) supports a hybrid architecture where static content pages are served alongside the SPA:

```
Caddy routes:
  /guides/*          → Static HTML pages (pre-rendered at build time)
  /conventions/*     → Static HTML pages (convention explainers)
  /                  → SPA (index.html → WASM app)
  /*                 → SPA fallback
```

**Implementation approach:**
1. Add a build step that renders guide markdown to standalone HTML pages with proper `<head>` (meta tags, Open Graph, structured data)
2. Output to a `/static/` directory in the Docker image
3. Configure Caddy to serve `/guides/*` and `/conventions/*` from static files, falling through to the SPA for all other routes
4. Each static page includes a CTA linking to the app: "Practice this convention interactively"

This keeps the SPA unchanged while adding crawlable content pages at SEO-relevant URLs. The existing `content/guides/` markdown pipeline provides the content source.

### Content Funnel

```
Search query                    → Static content page              → App
"what is stayman in bridge"     → /guides/what-is-stayman          → ?learn=stayman
"jacoby transfers explained"    → /guides/jacoby-transfers         → ?learn=jacoby-transfers
"bridge conventions for         → /conventions/beginners-guide     → ?convention=nt-bundle
 beginners"
```

Each static content page is a standalone, valuable explanation of a convention. It ranks for long-tail keywords in the bridge bidding niche. At the bottom, a CTA leads to the app: "Ready to practice? Try our interactive Stayman trainer." The CTA links to the SPA with appropriate URL params.

This follows the pillar-cluster architecture recommended by the SEO evidence map (Finding #4, medium-high confidence). The pillar page links to cluster pages; cluster pages interlink where conventions relate (e.g., Stayman and Transfers both follow 1NT).

### Meta Tags, Open Graph, and Structured Data

**Static content pages need:**

- `<title>` and `<meta name="description">` with convention-specific copy
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`) for social sharing
- `<meta name="robots" content="index, follow">` (explicit crawl permission)
- JSON-LD structured data using `EducationalOccupationalProgram` or `Course` schema
- `FAQPage` schema for common questions about each convention

**The SPA (`index.html`) needs:**

- A useful `<title>` and `<meta name="description">` for the app itself (currently likely default Vite boilerplate)
- `<meta name="robots" content="noindex">` is NOT recommended -- Google can render the SPA and may surface it for branded queries
- Open Graph tags for social sharing of the app link

**Additional files:**

- `sitemap.xml` listing all static content pages (not SPA routes)
- `robots.txt` allowing all crawlers, pointing to sitemap
- `llms.txt` (emerging standard) with plain-text descriptions of content for AI crawlers -- unvalidated but low-cost to implement

---

## Part 5: Implementation Priorities

### Phase 1: First-Visit Welcome (MVP)

**Goal:** Reduce bounce rate for new visitors by providing a clear first action.

**Changes:**
- Add `bridge-app:has-visited` localStorage flag (read via `loadFromStorage()`, set via `saveToStorage()` in `src/stores/local-storage.ts`)
- Add `hasVisited` derived state to `src/stores/app.svelte.ts` (or a local `$state` in `ConventionSelectScreen`)
- Add welcome banner to `src/components/screens/ConventionSelectScreen.svelte` (above convention grid, shown when `!hasVisited`)
- Welcome banner copy + "Learn Stayman" primary CTA + "Browse All" secondary + dismiss "x"
- Add "Free" badge on 1NT Responses card in the convention grid
- Replace "Locked" button text with "Premium" on locked convention cards

**Estimated scope:** Small -- ~100 lines of Svelte + ~20 lines of store logic. No Rust/WASM changes. No new dependencies.

### Phase 2: Paywall & Messaging Polish

**Goal:** Clearly communicate the free/paid boundary and make the paywall useful even before payment integration.

**Changes:**
- Enhance `src/components/shared/PaywallOverlay.svelte` with:
  - What premium includes (list of features: all bundles, practice modes, role selection, system customization)
  - "Learning is always free" reassurance
  - "Learn this convention instead" secondary CTA (navigates to learning flow for the convention the user tried to practice)
  - Price indication (when pricing is decided)
- Add "All learning is free" note to convention grid (in `ConventionSelectScreen.svelte`)
- Add "Premium" badges with consistent styling across the convention grid

**Estimated scope:** Small-medium -- ~150 lines of Svelte changes across 2 files.

### Phase 3: SEO Content Pages

**Goal:** Make the app discoverable via search engines and AI search systems.

**Changes:**
- Create convention guide markdown files in `content/guides/` (one per convention, plus pillar page)
- Add a build step to render guides to standalone static HTML with proper `<head>` tags
- Configure Caddy routes to serve static content at `/guides/*` and `/conventions/*`
- Add `sitemap.xml`, update `robots.txt`
- Add JSON-LD structured data to static pages
- Add Open Graph meta tags to static pages and `index.html`
- Add `llms.txt` for AI crawler ingestion

**Estimated scope:** Medium -- new build tooling, Caddy config changes, 10+ markdown content files, HTML template for static pages. No Rust/WASM changes. Requires content writing effort.

**Key files:**
- `content/guides/*.md` (new convention guide content)
- `Caddyfile` or equivalent Caddy config (route rules)
- Build script or Vite plugin for static HTML generation
- `static/sitemap.xml`, `static/robots.txt`, `static/llms.txt` (new)

### Phase 4: Measurement & Iteration

**Goal:** Validate that changes are working and identify next improvements.

**Changes:**
- Set up Google Search Console for indexation monitoring and keyword data
- Add Caddy logging for AI crawler traffic (GPTBot, ClaudeBot, PerplexityBot user agents)
- Track welcome banner interaction rates (localStorage-based, no external analytics needed initially):
  - How many users see the banner
  - Which CTA they click (Learn Stayman vs. Browse All vs. dismiss)
  - Whether they proceed to practice after learning
- Track paywall overlay interaction: how often opened, how often "Learn instead" is clicked vs. "Maybe later"
- Use Search Console data to validate keyword assumptions and refine content strategy

**Estimated scope:** Small for basic tracking (localStorage counters), medium for Search Console setup and Caddy logging configuration.

---

## Appendix: Source File Reference

| File | Role in FTUE/SEO |
|------|------------------|
| `src/App.svelte` | WASM init, loading screen -- first thing users see |
| `src/AppShell.svelte` | Screen router + nav chrome (NavRail/BottomTabBar) |
| `src/components/screens/ConventionSelectScreen.svelte` | Current landing screen -- where welcome banner would go |
| `src/components/screens/GuidesScreen.svelte` | Existing guide viewer (sidebar + content, uses `guides` from content system) |
| `src/stores/app.svelte.ts` | Screen navigation, would host `hasVisited` state. Uses `bridge-app:practice-preferences` and `bridge-app:last-convention` keys. |
| `src/stores/entitlements.ts` | `canPractice(user, bundleId)` -- free tier = `nt-bundle` only. `isPremium(user)` for tier checks. |
| `src/stores/local-storage.ts` | `loadFromStorage(key, default, validate?)` / `saveToStorage(key, value)` -- all stores use these |
| `src/stores/feature-flags.ts` | `FEATURES.workshop` -- dev-only flag pattern. Could host `FEATURES.ftue` if gating is needed. |
| `src/components/shared/PaywallOverlay.svelte` | Current placeholder paywall dialog -- needs enhanced copy and CTAs |
| `src/content/guides.ts` | Guide loader: `import.meta.glob` for markdown, frontmatter parsing, `marked` rendering. Foundation for SEO content. |
| `content/guides/why-we-built-this.md` | Only existing guide content |
| `docs/product/product-direction.md` | Monetization model: learning = free conversion tool, practice = product |
| `docs/research/seo-principles-web-apps/evidence-map.md` | SEO evidence base: hybrid architecture, AI crawler blindness, pillar-cluster strategy |
