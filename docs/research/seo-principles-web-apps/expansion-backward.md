# Deep Expansion — Agent D (backward citations)

## Papers Found

### 1. [Google (2010)] "Our New Search Index: Caffeine"
- **Found Via:** Seed papers on two-wave indexing and render queue (papers #1, #6) build on this as the foundational crawl architecture
- **Key Finding:** Caffeine replaced batch-processing indexing with continuous incremental indexing, enabling 50% fresher results and processing hundreds of thousands of pages per second — the architectural foundation that later enabled the crawl/render split for JS content.
- **Source:** https://developers.google.com/search/blog/2010/06/our-new-search-index-caffeine

### 2. [Google (2016)] "Mobile-First Indexing" — Original Announcement
- **Found Via:** Multiple seed papers reference mobile-first as context for rendering decisions; Sitebulb 2025 report (#3) discusses mobile rendering constraints
- **Key Finding:** Google announced in November 2016 that the mobile version of pages would become the primary version used for indexing and ranking, fundamentally shifting how content visibility is evaluated — mobile-invisible content (including JS-dependent content not rendered on mobile) becomes effectively unindexed.
- **Source:** https://developers.google.com/search/blog/2016/11/mobile-first-indexing (announced Nov 4, 2016; rollout began March 2018; completed 2024)

### 3. [Google/Martin Splitt (2019)] "The New Evergreen Googlebot"
- **Found Via:** Onely render queue study (#6) and Google JS SEO Basics (#1) reference the WRS upgrade as the inflection point for JS rendering capability
- **Key Finding:** Googlebot upgraded from frozen Chrome 41 to latest stable Chromium (74+), adding 1,000+ new web platform features (ES6+, IntersectionObserver, Web Components v1) and committing to stay evergreen — eliminating the need for transpilation/polyfills targeting an outdated renderer.
- **Source:** https://developers.google.com/search/blog/2019/05/the-new-evergreen-googlebot

### 4. [Google/Gary Illyes (2017)] "What Crawl Budget Means for Googlebot"
- **Found Via:** Onely 9x render delay study (#6) and Google SEO Guide for Developers (#9) cite crawl budget as the constraint JS rendering exacerbates
- **Key Finding:** Officially defined crawl budget as the intersection of "crawl rate limit" (server capacity) and "crawl demand" (popularity + staleness), establishing that JS-heavy sites face compounded budget pressure because rendering consumes additional resources beyond initial crawl.
- **Source:** https://developers.google.com/search/blog/2017/01/what-crawl-budget-means-for-googlebot

### 5. [Google (2015)] "Deprecating Our AJAX Crawling Scheme"
- **Found Via:** Google Dynamic Rendering deprecation (#4) and JS SEO Basics (#1) reference this as the earlier paradigm shift — from hashbang workarounds to expecting real rendering
- **Key Finding:** Google deprecated the 2009-era _escaped_fragment_ / hashbang (#!) crawling scheme, signaling that search engines would move toward actually rendering JavaScript rather than requiring developers to serve pre-rendered snapshots via URL conventions.
- **Source:** https://webmasters.googleblog.com/2015/10/deprecating-our-ajax-crawling-scheme.html

### 6. [HubSpot/Mimi An (2017)] "Topic Clusters: The Next Evolution of SEO"
- **Found Via:** Clearscope topical authority guide (#13) and eSEOspace micro-niche guide (#18) both cite HubSpot's research as the origin of pillar-cluster methodology
- **Key Finding:** Formalized the topic cluster model — a pillar page as authority hub with interlinked subtopic pages — and provided empirical evidence that this architecture drives 30-43% more organic traffic than unconnected content, establishing the dominant content architecture framework for niche authority building.
- **Source:** https://blog.hubspot.com/marketing/topic-clusters-seo (research report: https://cdn2.hubspot.net/hubfs/53/assets/hubspot.com/research/reports/Topic%20Clusters%20SEO%20Report.pdf)

### 7. [Google (2020-2021)] "Page Experience Update" — Timing and Details Announcements
- **Found Via:** DebugBear CWV ranking study (#12) and Google SPA+CWV guide (#11) build directly on this as the ranking signal they measure
- **Key Finding:** Announced November 2020, rolled out June-August 2021 — introduced Core Web Vitals (LCP, FID, CLS) as ranking signals within a broader "page experience" signal set. Google explicitly stated it remains "one of many factors" and sites should not expect drastic changes, setting expectations for its modest competitive-tiebreaker role.
- **Source:** https://developers.google.com/search/blog/2020/11/timing-for-page-experience (announcement); https://developers.google.com/search/blog/2021/04/more-details-page-experience (details)

### 8. [Perficient/Eric Enge (2021)] "What Is the Impact of Core Web Vitals on Ranking?"
- **Found Via:** DebugBear CWV study (#12) references this as the primary empirical counterpoint confirming CWV's limited ranking impact
- **Key Finding:** Tracked rankings across 200 keywords in 6 industries from June-September 2021 during the Page Experience rollout; found general correlation between CWV scores and rank but the update "did not change the shape or scope of that correlation to any noticeable degree" — confirming CWV is not a large ranking factor.
- **Source:** https://www.perficient.com/insights/research-hub/impact-of-core-web-vitals-on-ranking

## Strategy Report
- Seed papers used: #1 (Google JS SEO Basics), #3 (Sitebulb 2025), #4 (Dynamic Rendering deprecated), #6 (Onely render queue), #9 (Google SEO Dev Guide), #11 (SPA+CWV), #12 (DebugBear CWV), #13 (Clearscope topical authority), #18 (eSEOspace micro-niche)
- Unique finds (not in seeds): 8
- All sources are first-party Google announcements, official research reports, or large-scale empirical studies — no e-commerce, local SEO, or social media content included
