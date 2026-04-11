# Landscape Scan — Agent B (semantic)

## Papers/Sources Found

### 1. Google (2025) "Understand JavaScript SEO Basics"
- **Venue:** Google Search Central Documentation
- **Type:** guide
- **Key Terms:** rendering queue, headless Chromium, shadow DOM flattening, content fingerprinting, two-wave indexing
- **Relevance:** Authoritative primary source on how Googlebot discovers, renders, and indexes JavaScript/WASM SPAs — directly applicable to the bridge app's CSR architecture.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

### 2. Vercel & MERJ (2024) "How Google Handles JavaScript Throughout the Indexing Process"
- **Venue:** Vercel Blog (empirical study using MERJ Web Rendering Monitor)
- **Type:** empirical
- **Key Terms:** rendering delay, Web Rendering Monitor (WRM), median render latency (10s), 100% render success rate, crawl-to-render gap
- **Relevance:** Only large-scale empirical study (100k+ Googlebot fetches) measuring actual JS rendering delays — debunks myth of long rendering queues, showing median 10s delay with 100% render success for well-structured JS apps.
- **Source:** https://vercel.com/blog/how-google-handles-javascript-throughout-the-indexing-process

### 3. Google / web.dev (2024) "How SPA Architectures Affect Core Web Vitals"
- **Venue:** web.dev
- **Type:** guide
- **Key Terms:** INP (Interaction to Next Paint), post-load experience, soft navigations, MPA vs SPA measurement parity
- **Relevance:** Official Google guidance on how SPA architecture interacts with CWV metrics — confirms SPAs can score well but flags INP measurement challenges relevant to WASM-heavy interactions.
- **Source:** https://web.dev/articles/vitals-spa-faq

### 4. Google (2025) "Understanding Core Web Vitals and Google Search Results"
- **Venue:** Google Search Central Documentation
- **Type:** guide
- **Key Terms:** page experience signal, tie-breaker ranking factor, LCP/INP/CLS thresholds, good URL ratio
- **Relevance:** Clarifies CWV's actual ranking weight — a tie-breaker, not a primary factor. Important for prioritization: content relevance matters more than performance for a niche app with few competitors.
- **Source:** https://developers.google.com/search/docs/appearance/core-web-vitals

### 5. DebugBear (2025) "Are Core Web Vitals A Ranking Factor for SEO?"
- **Venue:** DebugBear (performance monitoring tool research)
- **Type:** empirical / review
- **Key Terms:** correlation studies, ranking lift, page experience update, competitive SERP analysis
- **Relevance:** Synthesizes multiple correlation studies showing CWV impact is modest but measurable — 1-2% ranking difference in competitive queries. For low-competition niche queries (bridge conventions), content relevance dominates.
- **Source:** https://www.debugbear.com/docs/core-web-vitals-ranking-factor

### 6. Google (2025) "Dynamic Rendering as a Workaround"
- **Venue:** Google Search Central Documentation
- **Type:** guide
- **Key Terms:** dynamic rendering, user-agent detection, prerender service, cloaking distinction, deprecation signals
- **Relevance:** Documents Google's official (now deprecated) dynamic rendering approach and why prerendering/SSG is preferred — relevant for choosing the bridge app's rendering strategy.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering

### 7. GSQI (2025) "AI Search and JavaScript Rendering — How Client-Side Rendering Causes Visibility Problems"
- **Venue:** GSQI (search quality consultancy, case study)
- **Type:** case study
- **Key Terms:** AI search crawlers, ChatGPT/Perplexity/Claude visibility, CSR invisibility to non-Google crawlers, LLM citation
- **Relevance:** Documents that while Google renders JS, AI search engines (ChatGPT, Perplexity) cannot — CSR-only apps are invisible to the emerging AI search channel. Directly relevant to future discoverability.
- **Source:** https://www.gsqi.com/marketing-blog/ai-search-javascript-rendering/

### 8. Clearscope (2025) "How to Build Topical Authority Like a Master SEO"
- **Venue:** Clearscope Blog
- **Type:** guide / review
- **Key Terms:** topical authority, content clusters, pillar pages, semantic coverage, entity coverage, internal linking topology
- **Relevance:** Outlines the content strategy framework most applicable to a niche educational app — building comprehensive coverage of a narrow topic (bridge conventions) to signal authority to search engines.
- **Source:** https://www.clearscope.io/blog/build-topical-authority

## Vocabulary Discovered
- **rendering queue / two-wave indexing**: Google's process where JS pages are first crawled (HTML shell), then queued for rendering in headless Chromium before indexing
- **INP (Interaction to Next Paint)**: Core Web Vital replacing FID in 2024, measures responsiveness across full page lifecycle — especially relevant for interactive WASM apps
- **soft navigations**: SPA route changes that don't trigger full page loads — Google is developing metrics to measure these but does not yet fully attribute CWV to them
- **topical authority**: Search engine trust signal built by comprehensively covering a narrow subject area with interlinked content
- **Web Rendering Monitor (WRM)**: MERJ's technology for tracking when/whether Googlebot renders JS content
- **AI search crawlers**: Non-Google discovery agents (ChatGPT, Perplexity, Claude) that typically cannot render JavaScript — a growing visibility channel that CSR apps miss entirely

## Landscape Notes
The evidence converges on three findings: (1) Google CAN render and index JS/WASM SPAs effectively (median 10s delay, 100% success), but AI search crawlers cannot — making SSR/SSG important for future discoverability beyond Google. (2) For low-competition niche queries, content relevance and topical authority dominate ranking factors; CWV is a tie-breaker. (3) The most actionable strategy for a niche educational app is hybrid rendering (static landing/content pages for crawlability + CSR for the interactive app) combined with topical authority content clusters.

## Queries Used
1. "How does Google crawl and index single-page applications built with WebAssembly 2025" → Good: surfaced Google docs, Web Almanac WASM stats, multiple SPA SEO guides
2. "JavaScript SEO best practices SPA rendering strategies Google 2025" → Good: surfaced rendering strategy comparisons, framework recommendations, Google documentation
3. "technical SEO factors small web applications Core Web Vitals ranking impact study" → Good: surfaced CWV ranking evidence, Google docs, practitioner analyses
4. "Google JavaScript SEO basics documentation rendering indexing 2025" (domain-filtered) → Excellent: surfaced primary Google documentation set
5. "niche educational web app SEO content strategy topical authority small sites" → Good: surfaced topical authority frameworks and EdTech SEO strategies
6. "Vercel MERJ study Google JavaScript rendering indexing delay 2024" → Excellent: confirmed empirical study details and key metrics
7. "web.dev INP Core Web Vitals SPA single page application performance 2025" → Good: surfaced SPA-specific CWV guidance from Google
