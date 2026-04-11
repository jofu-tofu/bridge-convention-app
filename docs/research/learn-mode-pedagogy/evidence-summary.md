# Learn Mode: Pedagogical Research

Research findings relevant to designing a Learn mode for teaching bridge conventions
to users who have never encountered them before. Based on a multi-wave literature
review (63 papers, 6 meta-analyses). Full artifacts in
`_output/research/20260411-0900-learn-mode-pedagogy/`.

## Core Findings

### Worked examples outperform problem-solving for novice rule acquisition

Showing learners complete, annotated solutions before asking them to solve problems
is one of the most replicated findings in instructional design. For procedural rules
(if hand looks like X, bid Y), novices learn faster and with less cognitive strain
from studying examples than from attempting problems.

- Alfieri et al. (2011): 164-study meta-analysis. Unassisted discovery produces
  *worse* outcomes than direct instruction (d=-0.38). Enhanced discovery with
  scaffolding, worked examples, and feedback produces *better* outcomes (d=+0.30).
- Likourezos et al. (2025): 60-study meta-analysis of expertise reversal. Novices
  under high-assistance conditions: d=0.505 advantage.
- Renkl et al. (2002): Fading worked-out steps (showing complete examples, then
  progressively removing explanation) is more effective than abrupt transitions
  from examples to problems.

### Self-explanation is the mechanism

Passive observation of examples is insufficient. Prompting learners to explain *why*
a step makes sense consistently improves transfer across domains.

- Chi et al. (1989): Self-explaining learners outperform passive studiers.
- Alemdag et al. (2025): 42-paper meta-analysis on erroneous examples. Without
  self-explanation prompts, effect is weak (g=0.136). With prompts, significantly
  stronger.

### Expertise reversal: what helps novices hurts experts

Instructional support effective for novices becomes counterproductive as expertise
grows. This validates making Learn mode a fundamentally different experience from
Practice mode, not just an easier version.

- Likourezos et al. (2025): Same high-assistance that helps novices (d=0.505)
  actively harms experts (d=-0.428).
- Kalyuga et al. (2003): The effect applies to worked examples, redundant
  information, and integrated formats.

### Complex systems justify tutorial investment

- Andersen et al. (2012, CHI): Study of 45,000+ players. Tutorials increased
  engagement by 29% for complex games. No effect for simple ones. Bridge
  conventions are firmly in the complex category (high element interactivity
  across suits, points, shape, position, partnership context).

### Computer-based scaffolding works, especially for adults

- Belland et al. (2017): 144-study meta-analysis. Computer-based scaffolding
  produces consistent moderate effects (g=0.46). Effect sizes are *higher* for
  adult learners than for K-12.

### One convention at a time before mixing

- Hwang (2025): Novices need blocked practice (one topic at a time) before
  interleaving (mixing topics). Premature interleaving creates undesirable
  difficulty rather than desirable difficulty.

## Tensions

### Examples-first vs. productive failure

The strongest counterweight to "always show examples first." Productive failure
research shows that letting learners *struggle* with a problem before receiving
instruction can improve conceptual understanding and transfer.

- Sinha & Kapur (2021): 53-study meta-analysis. Productive failure produces
  g=0.36 advantage over instruction-first for conceptual transfer (grade 6+).

Likely resolution: examples-first for rule acquisition ("what does a Stayman 2C
response mean?"), struggle-first for judgment ("when should I use Stayman vs. a
transfer?"). But this boundary is empirically untested.

### Cognitive efficiency vs. voluntary engagement

Cognitive load theory optimizes for minimal extraneous load, but assumes captive
learners (classrooms). Self-determination theory (Ryan & Deci 2000) says voluntary
learners need autonomy and curiosity-driven exploration. If cognitively optimal
instruction feels sterile, voluntary users leave. These two literatures are poorly
integrated at exactly the operating point of the app.

### Fading timing is unsolved

The fading trajectory is well-established (full examples -> partial examples ->
full problems), but *when* to fade is not. Kim & Hannafin (2011) found premature
fading actively harms learning. No validated automated method exists for detecting
readiness-to-fade in software without an instructor.

## Evidence Gaps

- **No bridge-specific research.** Zero studies on bridge, trick-taking card games,
  or partnership-communication rule learning. Every recommendation is an analogy.
- **Generated vs. authored examples.** The app generates examples algorithmically
  from the convention system. All worked-example research uses hand-authored examples
  that control for difficulty, surface features, and pedagogical salience.
- **Voluntary adult leisure learners.** Most studies use students in compliance
  contexts. Effect sizes may not transfer to adults who can close the browser tab.
- **Partnership dimension.** Bridge conventions are simultaneously decision rules
  and communication protocols. How the partnership aspect affects learning is unknown.

## Key Papers

| Paper | Why it matters |
|-------|---------------|
| Alfieri et al. (2011) | Strongest evidence anchor: 164-study meta-analysis on discovery vs. instruction |
| Sinha & Kapur (2021) | Strongest counterweight: 53-study meta-analysis on productive failure |
| Andersen et al. (2012) | Closest deployment analog: 45K voluntary users, complexity as moderator |
| Renkl et al. (2002) | Canonical fading study: implementation details for examples-to-practice transition |
| Belland et al. (2017) | Computer scaffolding meta-analysis: moderator analyses for adult software learners |
| Likourezos et al. (2025) | Expertise reversal at scale: quantifies when scaffolding flips from help to harm |
