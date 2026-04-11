# Deep Expansion -- Agent E (forward citations)

## Papers Found

### 1. [Kollox (2026)] "Google's March 2026 Core Update: SEO Impact on JavaScript Frameworks"
- **Found Via:** Extends Seed #1 (Google JS SEO Basics) and Seed #4 (Dynamic Rendering deprecation)
- **Key Finding:** Google's March 2026 core update now evaluates Core Web Vitals holistically at the site level (not per-page), and Google removed its longstanding JS SEO warning on March 4 2026, stating CSR is "no longer making it harder for Google Search" -- a major softening from the seed papers' framing of CSR as penalized.
- **Source:** https://kollox.com/googles-march-2026-core-update-seo-impact-on-javascript-frameworks/

### 2. [Search Engine Journal / Alli AI (2026)] "ChatGPT Now Crawls 3.6x More Than Googlebot"
- **Found Via:** Extends Seed #5 (SALT.agency AI Crawlers and JS Rendering)
- **Key Finding:** Analysis of 24.4M proxy requests across 78,000+ pages (Jan-Mar 2026) found AI crawlers now make 3.6x more requests than traditional search crawlers, yet none execute JavaScript -- confirming and quantifying the AI crawler blindness gap at massive scale.
- **Source:** https://www.searchenginejournal.com/chatgpt-googlebot-crawl-data-alliai-spa/570885/

### 3. [Cloudflare (2025)] "From Googlebot to GPTBot: Who's Crawling Your Site in 2025"
- **Found Via:** Extends Seed #5 (SALT.agency AI Crawlers) and Seed #2 (Vercel/MERJ Googlebot study)
- **Key Finding:** ChatGPT-User requests surged 2,825% YoY in 2025; AI "user action" crawling increased 15x over the year; OpenAI's GPTBot generated 569M requests/month across Vercel's network vs 370M from Anthropic's ClaudeBot -- AI crawlers now represent a dominant share of bot traffic but remain JS-blind.
- **Source:** https://blog.cloudflare.com/from-googlebot-to-gptbot-whos-crawling-your-site-in-2025/

### 4. [Clearscope (2026)] "The 2026 SEO Playbook: How AI Is Reshaping Search"
- **Found Via:** Extends Seed #13 (Clearscope Topical Authority guide)
- **Key Finding:** Introduces "Answer Engine Optimization" (AEO) as a parallel discipline to SEO -- content must be structured for "conversational discoverability" so AI models can cite it in generated answers; winning AI citations can increase CTR up to 35% even as organic CTR drops 61% overall.
- **Source:** https://www.clearscope.io/blog/2026-seo-aeo-playbook

### 5. [The Digital Bloom (2026)] "Organic Traffic Crisis Report, 2026 Update"
- **Found Via:** Extends Seed #10 (Backlinko ranking factor study) and Seed #12 (DebugBear CWV ranking)
- **Key Finding:** Zero-click searches reached 60% baseline (77% on mobile); organic click share dropped 11-23 percentage points across verticals between Jan 2025 and Jan 2026; mid-tier sites (rank 100-10,000) hit hardest while top-10 properties grew 1.6% -- the "Great Decoupling" where rankings hold but clicks vanish.
- **Source:** https://thedigitalbloom.com/learn/organic-traffic-crisis-report-2026-update/

### 6. [ALM Corp (2026)] "Google Removes JavaScript SEO Warning From Official Docs"
- **Found Via:** Extends Seed #1 (Google JS SEO Basics) and Seed #15 (Onely JS SEO Best Practices)
- **Key Finding:** On March 4 2026, Google removed the warning section from its JavaScript SEO Basics page (the fifth documentation update since Dec 2024), officially stating JS rendering is mature enough that CSR is a performance trade-off, not an indexing barrier -- directly contradicting the caution in Seed #6 (Onely 9x render queue study from 2023).
- **Source:** https://almcorp.com/blog/google-removes-javascript-seo-warning/

### 7. [Stackmatix (2026)] "Google AI Overview SEO Impact: 2026 Data & Statistics"
- **Found Via:** Extends Seed #12 (DebugBear CWV ranking) on the broader ranking ecosystem
- **Key Finding:** AI Overviews appear in 25.8% of US searches as of Jan 2026 (39.4% for informational queries); organic CTR for AIO-affected queries dropped from 1.76% to 0.61% since mid-2024, but sites cited within AI Overviews see up to 35% CTR boost -- creating a winner-take-all dynamic for cited sources.
- **Source:** https://www.stackmatix.com/blog/google-ai-overview-seo-impact

### 8. [Digital Applied (2026)] "Google March 2026 Core Update: Holistic CWV Scoring"
- **Found Via:** Extends Seed #11 (web.dev SPA+CWV guide) and Seed #12 (DebugBear CWV ranking)
- **Key Finding:** March 2026 update shifted CWV evaluation from per-page to site-wide aggregation -- a few slow pages can now drag down rankings across an entire domain; 43% of sites fail the 200ms INP threshold, making it the most commonly failed Core Web Vital in 2026.
- **Source:** https://www.digitalapplied.com/blog/google-march-2026-core-update-cwv-holistic-scoring

## Strategy Report
- Seed papers used: #1 (Google JS SEO Basics), #2 (Vercel/MERJ study), #4 (Dynamic Rendering deprecated), #5 (SALT.agency AI Crawlers), #10 (Backlinko study), #11 (web.dev SPA+CWV), #12 (DebugBear CWV ranking), #13 (Clearscope Topical Authority), #15 (Onely JS SEO Best Practices)
- Unique finds (not in seeds): 8
- Key developments since seed papers:
  - Google has significantly softened its JS/CSR stance (March 2026 doc update removes warnings)
  - AI crawler traffic now dwarfs traditional search crawlers (3.6x) but remains JS-blind -- the gap is widening
  - CWV evaluation shifted from per-page to site-wide aggregation (March 2026 core update)
  - "Answer Engine Optimization" (AEO) emerging as parallel discipline to traditional SEO
  - Zero-click searches at 60% baseline, organic CTR cratering, but AI citation winners see CTR gains
