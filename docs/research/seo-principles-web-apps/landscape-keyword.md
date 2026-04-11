# Landscape Scan — Agent A (keyword)

## Papers/Sources Found

### 1. Google Search Central (2024) "Understand JavaScript SEO Basics"
- **Venue:** Google for Developers (official documentation)
- **Type:** guide
- **Key Terms:** two-phase indexing, render queue, Web Rendering Service (WRS), hydration, crawl budget
- **Relevance:** Authoritative source on how Googlebot handles JS-heavy SPAs — directly applies to this WASM/Svelte app's crawlability challenges.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

### 2. Google Search Central (2024) "Dynamic Rendering as a Workaround"
- **Venue:** Google for Developers (official documentation)
- **Type:** guide
- **Key Terms:** dynamic rendering (deprecated), prerendering, static rendering, crawler detection, hydration
- **Relevance:** Google officially deprecates dynamic rendering in favor of SSR/SSG/hydration — critical decision input for choosing a rendering strategy for this app.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering

### 3. Google/Chrome Team (2019, updated) "Rendering on the Web"
- **Venue:** web.dev
- **Type:** guide / technical reference
- **Key Terms:** SSR, SSG, CSR, streaming server rendering, rehydration, progressive hydration, trisomorphic rendering
- **Relevance:** Canonical taxonomy of rendering strategies with performance/SEO tradeoffs — helps evaluate SSR vs prerendering vs current CSR-only approach.
- **Source:** https://web.dev/articles/rendering-on-the-web

### 4. Onely (2024) "All JavaScript SEO Best Practices You Need To Know For 2024"
- **Venue:** Onely (technical SEO agency specializing in JS SEO)
- **Type:** empirical / guide (backed by proprietary crawl studies)
- **Key Terms:** render queue delay (9x slower), two-phase indexing, partial rendering, JavaScript indexation gap
- **Relevance:** Empirical data showing JS-rendered content takes 9x longer to crawl and 42% never gets indexed — quantifies the SEO cost of the app's current CSR-only architecture.
- **Source:** https://www.onely.com/blog/ultimate-guide-javascript-seo/

### 5. Onely (2023) "Rendering Queue: Google Needs 9X More Time To Crawl JS Than HTML"
- **Venue:** Onely blog (research study)
- **Type:** empirical study
- **Key Terms:** rendering queue, crawl queue, indexation delay, JavaScript link discovery, two-wave processing
- **Relevance:** Empirical measurement of Googlebot's JS processing delay — demonstrates why prerendering or SSG is essential for timely indexation of SPA content.
- **Source:** https://www.onely.com/blog/google-needs-9x-more-time-to-crawl-js-than-html/

### 6. Vercel (2024) "How Google Handles JavaScript Throughout the Indexing Process"
- **Venue:** Vercel Engineering Blog
- **Type:** empirical study / case study
- **Key Terms:** full rendering confirmation, Next.js indexation, 100% render rate at scale, framework-specific crawl behavior
- **Relevance:** Counter-evidence showing modern frameworks with SSR achieve 100% Googlebot rendering — demonstrates that framework choice (SSR-capable vs CSR-only) is the key variable.
- **Source:** https://vercel.com/blog/how-google-handles-javascript-throughout-the-indexing-process

### 7. SALT.agency (2025) "Making JavaScript Websites AI and LLM Crawler Friendly"
- **Venue:** SALT.agency blog
- **Type:** guide / emerging research
- **Key Terms:** AI crawlers, GPTBot, ClaudeBot, LLM discoverability, non-rendering bots, AI search visibility
- **Relevance:** AI crawlers (GPTBot, ClaudeBot) cannot execute JavaScript at all — a WASM SPA is completely invisible to AI-powered search unless content is server-rendered or prerendered.
- **Source:** https://salt.agency/blog/ai-crawlers-javascript/

### 8. eSEOspace (2024) "Micro-Niche SEO and Building Topical Authority"
- **Venue:** eSEOspace blog
- **Type:** guide / case study
- **Key Terms:** micro-niche SEO, topical clusters, pillar-cluster model, content hubs, semantic coverage, E-E-A-T for niche sites
- **Relevance:** Directly applicable strategy for a bridge bidding app — covers how micro-niche sites build topical authority through comprehensive content clustering around a specialized subject.
- **Source:** https://eseospace.com/how-to-build-topical-authority-through-micro-niche-seo/

## Vocabulary Discovered
- **render queue**: Google's secondary processing queue for JS pages, separate from and slower than the initial crawl queue
- **two-phase indexing**: Googlebot's process of first crawling HTML, then deferring JS rendering to a later pass
- **trisomorphic rendering**: Technique combining SSR, CSR, and service worker rendering for optimal performance
- **pillar-cluster model**: Content architecture where a comprehensive "pillar" page links to detailed "cluster" articles on subtopics
- **E-E-A-T**: Experience, Expertise, Authoritativeness, Trustworthiness — Google's quality rater guidelines framework
- **AI crawler blindness**: The inability of LLM-powered search crawlers (GPTBot, ClaudeBot) to execute any JavaScript
- **crawl budget**: The number of pages Googlebot will crawl on a site within a given timeframe — JS rendering consumes more budget

## Landscape Notes

The evidence strongly converges on one finding: CSR-only SPAs face severe SEO penalties (9x crawl delay, ~42% content never indexed, complete invisibility to AI crawlers). The recommended path is SSR or prerendering for any content meant to be discoverable. For niche educational apps specifically, the content strategy literature emphasizes topical authority through pillar-cluster content architectures — but this requires crawlable HTML content pages to exist in the first place. The gap in the literature is WASM-specific SEO guidance: no source addresses WebAssembly directly, treating it as equivalent to any JS-rendered content from a crawler perspective.

## Queries Used
1. `SPA SEO "single page application" search engine optimization rendering crawling 2024 2025` — Good breadth of practitioner guides; confirmed core challenges and solutions
2. `"JavaScript SEO" client-side rendering Googlebot crawlability WebAssembly WASM 2024 2025` — Strong results on JS SEO; no WASM-specific findings (treated as subset of JS)
3. `niche educational web app SEO "content strategy" "topical authority" long-tail keywords 2024 2025` — Good coverage of content strategy; mostly general niche SEO (not app-specific)
4. `Google Search Central JavaScript SEO documentation prerendering dynamic rendering 2024` (scoped to developers.google.com, web.dev) — Authoritative primary sources from Google
5. `Onely JavaScript SEO study Googlebot rendering research empirical data` — Best empirical data found; quantified crawl/render delays
