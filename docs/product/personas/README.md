# Personas

Ten user personas for the bridge convention practice app. These are meant to anchor
product decisions, onboarding choices, copy, and prioritization around realistic
combinations of player goals and constraints.

## Shared Dimensions

All persona files use the same six 1-10 scales in YAML frontmatter.

| Dimension                        | 1 Means                                  | 10 Means                                               | Why It Matters                                                       |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| `bridge_experience`              | Brand-new or lesson-table player         | Veteran tournament player or teacher                   | Changes vocabulary, pacing, and assumed prior knowledge              |
| `convention_complexity_appetite` | Wants simple, mainstream agreements only | Enjoys dense or highly structured systems              | Shapes what content feels inviting vs overwhelming                   |
| `competitive_ambition`           | Mostly social bridge                     | Actively optimizing for club or tournament results     | Affects motivation, tolerance for rigor, and willingness to practice |
| `digital_confidence`             | Hesitant with new software               | Comfortable exploring tools and settings               | Changes onboarding, defaults, and discoverability needs              |
| `partnership_alignment_need`     | Primarily self-study                     | Needs exact agreement sync with a regular partner/team | Drives value of precise explanations and repeatable drills           |
| `feedback_depth_desire`          | Wants simple right/wrong guidance        | Wants detailed reasoning and edge-case explanation     | Affects review UX and explanation density                            |

## Persona Set

| File                                       | Persona                  | Why They Matter                                                       |
| ------------------------------------------ | ------------------------ | --------------------------------------------------------------------- |
| `01-lena-ortiz-lesson-graduate.md`         | New club player          | Represents early confidence-building users coming from lessons        |
| `02-michael-chen-returning-player.md`      | Returning retiree        | Represents rusty but motivated players re-entering duplicate bridge   |
| `03-carla-bennett-club-regular.md`         | Core club improver       | Represents the broad middle of recurring practice users               |
| `04-devin-shah-partnership-builder.md`     | Partnership organizer    | Represents users using the app to tighten shared agreements           |
| `05-jordan-kim-tournament-climber.md`      | Competitive aspirant     | Represents users who want rigorous, high-feedback training            |
| `06-priya-nair-club-teacher.md`            | Teacher and mentor       | Represents users who evaluate the app as a teaching aid               |
| `07-noah-reed-free-tier-explorer.md`       | Curious evaluator        | Represents users deciding whether the app is worth adopting or buying |
| `08-eric-holm-system-switcher.md`          | System-transition player | Represents advanced users adapting to a new system or module mix      |
| `09-maya-thompson-time-squeezed-parent.md` | Time-boxed improver      | Represents users practicing in short, interrupted sessions            |
| `10-alex-park-junior-rising-player.md`     | Junior competitor        | Represents younger, coach-guided, high-upside users                   |

## How To Use These

- Use one persona when evaluating a narrow UX decision.
- Use two or three contrasting personas when prioritizing features or copy.
- Prefer concrete tradeoff questions like "would this help Lena without slowing Jordan down?"
- Update scores only when the persona meaning changes, not for minor wording tweaks.
