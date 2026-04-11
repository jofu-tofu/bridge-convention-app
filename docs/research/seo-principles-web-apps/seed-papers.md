# Seed Papers

## Papers (ranked by relevance)

| # | Paper | Type | Found by | Relevance |
|---|-------|------|----------|-----------|
| 1 | Google (2024) "Understand JavaScript SEO Basics" | guide | A, B, C | Authoritative primary source on how Googlebot renders/indexes JS SPAs — two-phase indexing, render queue |
| 2 | Vercel & MERJ (2024) "How Google Handles JavaScript Throughout the Indexing Process" | empirical | A, B | Only large-scale study (100k+ Googlebot fetches): 100% render success, median 10s delay |
| 3 | Sitebulb (2025) "JavaScript SEO Report 2025: Survey & Audit Data" | empirical | C | Most comprehensive JS SEO study; 73% of CSR→SSR migrations without SSR saw 35%+ organic drops; LLM crawlers can't render JS |
| 4 | Google (2024) "Dynamic Rendering as a Workaround" | guide | A, B | Google officially deprecates dynamic rendering in favor of SSR/SSG — key decision input |
| 5 | SALT.agency / GSQI (2025) "AI Crawlers and JavaScript Rendering" | case study | A, B | AI crawlers (GPTBot, ClaudeBot, Perplexity) cannot execute JS at all — WASM SPA invisible to AI search |
| 6 | Onely (2023) "Rendering Queue: Google Needs 9X More Time To Crawl JS" | empirical | A | Quantified: JS content takes 9x longer to crawl, ~42% never indexed |
| 7 | Google/Chrome Team (2024) "Rendering on the Web" | guide | A | Canonical taxonomy of rendering strategies (SSR/SSG/CSR/streaming/hydration) with tradeoffs |
| 8 | Google (2024) "SEO Starter Guide: The Basics" | guide | C | Canonical first-party SEO fundamentals reference, refreshed Feb 2024 |
| 9 | Google (2024) "SEO Guide for Web Developers" | guide | C | Developer-focused companion — structured data, rendering budget, implementation specifics |
| 10 | Backlinko (2025) "We Analyzed 11.8 Million Google Search Results" | empirical | C | Largest ranking factor correlation study: 3.8x more backlinks at #1, strong content comprehensiveness signal |
| 11 | Google/web.dev (2024) "How SPA Architectures Affect Core Web Vitals" | guide | B | Official guidance on SPA+CWV: INP measurement challenges, SPAs can score well |
| 12 | DebugBear / RUMvision (2025) "Are Core Web Vitals A Ranking Factor?" | empirical | B, C | CWV impact is modest (1-2% in competitive queries); for low-competition niche, content relevance dominates |
| 13 | Clearscope (2025) "How to Build Topical Authority" | guide | B | Content strategy framework: pillar-cluster architecture for niche topic domination |
| 14 | Diggity Marketing (2024) "User-First SEO Strategy +3700% Traffic" | case study | C | Niche site grew via topical authority + hub-and-spoke content, not backlink farming |
| 15 | Onely (2024) "All JavaScript SEO Best Practices for 2024" | guide | A | Practitioner guide with empirical backing: 42% JS content indexation gap |
| 16 | WeWeb (2026) "SEO Single Page Application: The Ultimate Guide" | review | C | Covers prerendering, SSR, hybrid rendering strategies for SPA SEO |
| 17 | Prerender.io (2024) "How to Optimize SPAs for Crawling and Indexing" | guide | C | Practical prerendering implementation without SSR migration |
| 18 | eSEOspace (2024) "Micro-Niche SEO and Building Topical Authority" | guide | A | Micro-niche pillar-cluster model directly applicable to bridge bidding content |

## Vocabulary Discovered
- **render queue / two-wave indexing**: Google crawls HTML shell first, defers JS rendering to second pass in headless Chromium
- **INP (Interaction to Next Paint)**: Core Web Vital replacing FID (March 2024), measures all interaction latency
- **AI crawler blindness / LLM crawler blindness**: GPTBot, ClaudeBot, Perplexity cannot execute JavaScript — CSR-only content invisible
- **topical authority**: Search trust signal from comprehensively covering a narrow subject with interlinked content
- **pillar-cluster model / hub-and-spoke**: Content architecture with central pillar page linking to detailed subtopic cluster pages
- **E-E-A-T**: Experience, Expertise, Authoritativeness, Trustworthiness — Google quality signals
- **crawl budget**: Pages Googlebot will process per visit — JS rendering consumes more budget
- **trisomorphic rendering**: SSR + CSR + service worker rendering combined
- **soft navigations**: SPA route changes without full page loads — Google developing metrics for these
- **dynamic rendering (deprecated)**: Serving prerendered HTML to bots while CSR to users — Google now recommends SSR/SSG instead

## Existing Reviews Found
- Sitebulb JS SEO Report 2025 — most comprehensive industry-wide synthesis of JS SEO challenges
- Backlinko 11.8M results study — largest public ranking factor correlation analysis
- Google SEO Starter Guide (Feb 2024 refresh) — canonical first-party fundamentals
- WeWeb SPA SEO Ultimate Guide — comprehensive SPA-specific synthesis

## Saturation Check
- Agent A unique papers: 2 (Onely render queue study, eSEOspace micro-niche)
- Agent B unique papers: 2 (web.dev SPA+CWV, DebugBear CWV ranking)
- Agent C unique papers: 5 (SEO Starter Guide, Dev Guide, Backlinko, Sitebulb, WeWeb, Prerender.io, Diggity)
- Overlap (found by 2+): 5 (Google JS SEO Basics, Vercel/MERJ study, Dynamic Rendering guide, AI crawler studies, Topical Authority guides)
- Total unique: 18

## Landscape Assessment
- **Major findings**: (1) CSR-only SPAs suffer measurable SEO penalties — 9x crawl delay, indexation gaps. (2) AI crawlers cannot render JS at all — growing channel missed entirely. (3) Google CAN render JS effectively (10s delay, ~100% success) but recommends SSR/SSG. (4) For niche topics with low competition, content relevance and topical authority dominate; CWV is a tiebreaker only.
- **Consensus solution**: Hybrid approach — static/SSG content pages for discoverability + CSR/WASM for the interactive app experience
- **Gaps**: No WASM-specific SEO literature exists; treated as equivalent to JS rendering. No academic studies specifically on niche educational web app SEO (all practitioner/industry sources).
