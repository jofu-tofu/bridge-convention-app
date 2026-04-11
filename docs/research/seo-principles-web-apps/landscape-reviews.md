# Landscape Scan — Agent C (reviews)

## Papers/Sources Found

### 1. [Google (2024)] "SEO Starter Guide: The Basics"
- **Venue:** developers.google.com/search
- **Type:** comprehensive review / official guide
- **Key Terms:** crawlability, indexability, sitemaps, content discovery, resource accessibility, unique content
- **Relevance:** The canonical first-party reference for SEO fundamentals; refreshed Feb 2024 to be more concise and beginner-focused.
- **Source:** https://developers.google.com/search/docs/fundamentals/seo-starter-guide

### 2. [Google (2024)] "SEO Guide for Web Developers"
- **Venue:** developers.google.com/search
- **Type:** guide (developer-focused)
- **Key Terms:** structured data, rendering budget, JavaScript indexing, developer-specific SEO
- **Relevance:** Directly targets developers building web apps rather than content marketers; covers technical implementation specifics.
- **Source:** https://developers.google.com/search/docs/fundamentals/get-started-developers

### 3. [Backlinko (2025)] "We Analyzed 11.8 Million Google Search Results"
- **Venue:** backlinko.com
- **Type:** empirical / large-scale ranking factor study
- **Key Terms:** referring domains, content grade, topical authority, SERP position correlation, comprehensive content
- **Relevance:** Largest publicly available ranking factor correlation study; finds 3.8x more backlinks at #1 vs #2-10 and strong signal for content comprehensiveness.
- **Source:** https://backlinko.com/search-engine-ranking

### 4. [Sitebulb (2025)] "JavaScript SEO Report 2025: Survey & Audit Data"
- **Venue:** sitebulb.com
- **Type:** empirical / industry survey + crawl data analysis
- **Key Terms:** client-side rendering, Googlebot rendering capability, LLM crawler blindness, JavaScript blocking, rendering delay
- **Relevance:** Most comprehensive JavaScript-specific SEO study; includes finding that LLM crawlers cannot render JS (critical for AI search visibility) and that 73% of CSR migrations without SSR saw 35%+ organic revenue drops.
- **Source:** https://sitebulb.com/javascript-seo/report/

### 5. [RUMvision (2025)] "Core Web Vitals and SEO — Are They a Ranking Factor?"
- **Venue:** rumvision.com
- **Type:** empirical / ongoing analysis with real user monitoring data
- **Key Terms:** INP (Interaction to Next Paint), LCP, CLS, page experience signals, tiebreaker ranking factor, field data vs lab data
- **Relevance:** Data-backed analysis of CWV as ranking signal; concludes CWV is a tiebreaker when relevance/authority are similar — directly relevant for a performance-focused WASM app.
- **Source:** https://www.rumvision.com/blog/impact-core-web-vitals-seo/

### 6. [WeWeb (2026)] "SEO Single Page Application: The Ultimate Guide"
- **Venue:** weweb.io
- **Type:** comprehensive review / technical guide
- **Key Terms:** History API routing, dynamic metadata, prerendering services, hybrid rendering, crawl budget, static shell
- **Relevance:** Directly addresses the SPA SEO problem space; covers prerendering, SSR, and hybrid strategies for apps that render client-side.
- **Source:** https://www.weweb.io/blog/seo-single-page-application-ultimate-guide

### 7. [Prerender.io (2024)] "How to Optimize Single-Page Applications (SPAs) for Crawling and Indexing"
- **Venue:** prerender.io/blog
- **Type:** guide / technical walkthrough
- **Key Terms:** dynamic rendering, prerender middleware, user-agent detection, static HTML snapshots, Rendertron, crawl simulation
- **Relevance:** Practical implementation guide for the specific technical challenge this app faces (WASM SPA with no SSR); covers prerendering as a non-SSR solution path.
- **Source:** https://prerender.io/blog/how-to-optimize-single-page-applications-spas-for-crawling-and-indexing/

### 8. [Diggity Marketing (2024)] "Case Study: A User-First SEO Strategy That Generated +3700% More Traffic in < 12 Months"
- **Venue:** diggitymarketing.com
- **Type:** case study
- **Key Terms:** user-first content, topical map, content hub architecture, hub-and-spoke model, internal linking strategy
- **Relevance:** Demonstrates that niche sites can achieve massive organic growth through topical authority and user-first content strategy rather than backlink-heavy approaches.
- **Source:** https://diggitymarketing.com/user-first-seo-case-study/

## Vocabulary Discovered
- **INP (Interaction to Next Paint):** Replaced FID as Core Web Vital in March 2024; measures latency of all user interactions, not just first input
- **Content Grade:** Clearscope/Surfer metric measuring topical comprehensiveness; correlates with ranking position
- **Dynamic Rendering:** Serving prerendered HTML to bots while serving SPA to users; Google-endorsed pattern for JS-heavy apps
- **LLM Crawler Blindness:** AI search crawlers (ChatGPT, Perplexity) cannot execute JavaScript — client-rendered content is invisible to them
- **Topical Authority:** Covering an entire topic cluster in depth rather than targeting isolated keywords; signals expertise to Google
- **Hub-and-Spoke Model:** Content architecture where pillar pages link to detailed subtopic pages, distributing page authority

## Landscape Notes
The SEO landscape for SPAs in 2024-2025 centers on a key tension: modern frameworks render client-side, but search engines (and especially AI crawlers) still prefer server-rendered HTML. Google's own renderer has improved (~80% JS content indexed per crawl cycle) but delays and gaps persist. The consensus across guides is that SPAs need either SSR, SSG for marketing/content pages, or prerendering middleware. For niche educational apps specifically, topical authority through comprehensive content hubs appears more achievable than backlink-heavy strategies. Core Web Vitals remain a tiebreaker signal rather than a dominant factor, but WASM apps that load fast have a natural advantage here.

## Queries Used
1. "SEO best practices 2024 2025 comprehensive guide site:web.dev OR site:developers.google.com" → Did not hit web.dev/developers.google.com directly but surfaced general guides; moderate quality
2. "JavaScript rendering SEO comprehensive study OR research 2024 2025" → Excellent; found Sitebulb's empirical JS SEO reports with survey + audit data
3. "Core Web Vitals impact ranking study OR analysis 2024 2025" → Good; found RUMvision's data-backed analysis and multiple correlation studies
4. "content strategy niche website case study OR guide SEO 2024" → Good; found Diggity Marketing user-first case study and hub-and-spoke approaches
5. "Google SEO starter guide developers.google.com 2024 2025" → Excellent; found official Google guides directly
6. "Backlinko OR Ahrefs ranking factors study 2024 2025 comprehensive" → Excellent; found 11.8M result study
7. "SPA single page application SEO prerendering best practices guide 2024" → Excellent; found multiple SPA-specific comprehensive guides
