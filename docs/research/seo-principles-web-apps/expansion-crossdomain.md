# Deep Expansion -- Agent F (cross-domain)

## Papers Found

### 1. [Morville (2005)] "Ambient Findability: What We Find Changes Who We Become"
- **Found Via:** Information Architecture / Library Science reframing
- **Key Finding:** Findability in digital spaces depends on "information scent" -- the strength of navigational cues that help both users and crawlers predict what lies ahead, meaning faceted navigation and clear taxonomy hierarchies are prerequisites for discoverability, not just usability.
- **Source:** https://www.oreilly.com/library/view/ambient-findability/0596007655/ -- FROM TRAINING (book, O'Reilly)

### 2. [NN/g (2024)] "Taxonomy 101: Definition, Best Practices, and How It Complements Other IA Work"
- **Found Via:** Information Architecture / Library Science reframing
- **Key Finding:** A controlled vocabulary taxonomy for specialized knowledge domains (like bridge conventions) ensures consistent labeling that search engines can parse into topical clusters, directly improving crawlable site structure and internal linking coherence.
- **Source:** https://www.nngroup.com/articles/taxonomy-101/

### 3. [GitBook (2025)] "GEO Guide: How to Optimize Your Docs for AI Search and LLM Ingestion"
- **Found Via:** Technical Documentation SEO reframing
- **Key Finding:** Generative Engine Optimization (GEO) is an emerging discipline parallel to SEO: structured Markdown, llms.txt files, MCP servers, and atomic single-intent pages make content ingestible by AI crawlers that cannot render JavaScript -- directly applicable to WASM SPAs invisible to LLM crawlers.
- **Source:** https://gitbook.com/docs/guides/seo-and-llm-optimization/geo-guide

### 4. [Oncrawl (2024)] "Effective SEO Techniques for Promoting Progressive Web Apps"
- **Found Via:** Progressive Web Apps / App Shell Architecture reframing
- **Key Finding:** App shell architecture causes search engines to initially see only the empty shell (nav, headers, footers) without content; the solution is a "hybrid shell" that expands the server-rendered shell to include all content needed by crawlers, rather than migrating entirely to SSR.
- **Source:** https://www.oncrawl.com/technical-seo/effective-seo-techniques-promoting-progressive-web-apps/

### 5. [Advanced Web Ranking (2024)] "Build Progressive Web Apps That Don't Destroy Your SEO"
- **Found Via:** Progressive Web Apps / App Shell Architecture reframing
- **Key Finding:** PWAs that serve static HTML content pages alongside the app shell (a "content ring" around the interactive core) can achieve full indexability without sacrificing the app-like experience, using the service worker for offline caching while keeping crawlable routes server-rendered.
- **Source:** https://www.advancedwebranking.com/blog/progressive-web-apps-that-dont-destroy-seo

### 6. [dasroot.net (2026)] "Writing Technical Content That Gets Read: SEO and Structure"
- **Found Via:** Technical Documentation SEO reframing
- **Key Finding:** Technical content achieves high organic visibility when each page is written as a standalone answer with a clear TL;DR, structured around explicit questions, and using extractable proof (numbered lists, tables, code blocks) -- patterns that map directly to how bridge convention explanations could be structured as SEO-friendly content pages.
- **Source:** https://dasroot.net/posts/2026/03/writing-technical-content-seo-structure/

### 7. [MADX Digital (2026)] "Ultimate Guide to SEO for EdTech Companies"
- **Found Via:** EdTech / Learning Platform Growth reframing
- **Key Finding:** Niche EdTech platforms with limited budgets achieve organic growth by targeting long-tail keywords specific to their domain (e.g., "Jacoby transfer responses" rather than "bridge card game"), building topical authority through interlinked educational content that search engines recognize as comprehensive coverage of a narrow subject.
- **Source:** https://www.madx.digital/learn/seo-for-edtech

### 8. [Quizlet / Canvasbusinessmodel.com (2025)] "Sales and Marketing Strategy of Quizlet"
- **Found Via:** EdTech user acquisition / User-generated content discovery (own discovery: UGC-driven SEO for educational tools)
- **Key Finding:** Quizlet's organic growth engine was built on user-generated study sets that created millions of long-tail indexable pages (one per topic), turning the platform into a content moat; analogously, a bridge app could generate static, indexable convention reference pages that serve as both learning content and SEO entry points.
- **Source:** https://canvasbusinessmodel.com/blogs/marketing-strategy/quizlet-marketing-strategy

## Strategy Report
- Domains explored: Information Architecture / Library Science, EdTech / Learning Platform Growth, Progressive Web Apps / App Shell Architecture, Technical Documentation SEO, User-Generated Content SEO for Educational Tools (own discovery)
- Unique finds (not in seeds): 8
- Best cross-domain insight: The emerging practice of Generative Engine Optimization (GEO) -- structuring content with llms.txt, atomic Markdown pages, and MCP endpoints for AI crawler ingestion -- is the highest-leverage gap in the seed research, because the seed papers identify AI crawler blindness as a problem but offer no solution beyond SSR; GEO provides a complementary, lower-effort path specifically designed for making WASM/JS-invisible content accessible to AI search engines.
