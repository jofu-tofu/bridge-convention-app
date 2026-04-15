# Teaching-Book Survey: Multi-Bid Convention Presentation

Stage 0 V1 survey. Resolves tension T2 in `evidence-map.md`: does the
published *teaching* tradition present multi-entry-point conventions
hero-plus-variants, as the prior summary claimed, or peer-parallel, as
references (ACBL/Wikipedia) do?

## Method

Targets: {Grant *Bridge Basics 3: Popular Conventions* / *Commonly Used
Conventions*, Kantar *Modern Bridge Conventions*, Root *Commonsense
Bidding*, Lawrence *Conventions in the Bridge Club*} x {Bergen Raises,
Jacoby Transfers, DONT, Two-Way NMF}.

Evidence sources accepted: publisher/Google Books previews, archive.org
excerpts, teacher-slide PDFs that cite the book, ACBL Bulletin articles,
and reputable community references (larryco, Wikipedia, Bridge Bulletin).
Direct retail page matter (covers, ToC) alone was not treated as evidence
about internal presentation. PDFs fetched were parsed with `pdftotext`
to read actual section structure, not just landing pages.

Every cell below records: (a) section-heading form, (b) whether one bid
is hero vs peers co-headlined, (c) per-bid layout (sequential prose vs
tabulated/parallel), (d) presence of a discriminator column. Cells with
no direct-source confirmation are marked `[unable to verify]` and not
counted toward the synthesis.

## Bergen Raises

- **Grant, *Bridge Basics 3: Popular Conventions* / *Commonly Used
  Conventions in the 21st Century*** — `[unable to verify]`. Neither
  the Amazon/Baron Barclay listings nor the Archive.org loan page
  exposed the Bergen chapter body. Grant's *Bridge Basics 3* table of
  contents (confirmed via the teacher slide deck at bridgewebs/sedona)
  covers Stayman and Jacoby transfers but Bergen is not a featured
  chapter in the Popular Conventions volume.
- **Pessin teacher handout citing Marty Bergen, *Secrets to Winning
  Bridge No. 6*** (acbld20.org): section titled "BERGEN RAISES" followed
  by a flat bulleted list of responder bids. Both jump bids appear as
  peers at the same indent level:
  > `3♣ : A decent raise with 4 trumps. Promises 7-10 dummy points.`
  > `3♦ : A limit raise with 4 trumps. Promises 10-12 dummy points.`
  No "defining" headline bid; the two lines are parallel and the
  discriminator is the strength class (constructive vs limit). A note
  underneath explicitly names reverse-Bergen as the symmetric swap,
  reinforcing peer framing.
- **Timm, "Bergen Raises - An Overview"** (bridgewebs/ocala): prose
  paragraph rather than table, but 3♣ and 3♦ are introduced together
  in the opening sentence ("the jump raise to 3♦ shows 10-12 ... and
  the jump raise to 3♣ shows 7-9"). Co-headlined, sequential prose,
  discriminator = dummy points.
- **Wikipedia** (independent confirmation for reference side, not
  teaching): bulleted list, 3♣ and 3♦ peer entries with strength
  discriminator inline.

**Verdict for Bergen:** every directly readable source presents 3♣/3♦
as co-equal peers with a strength discriminator. No source examined
treated one as the defining bid with the other as a variant.

## Jacoby Transfers

- **Grant, *Bridge Basics 3: Popular Conventions*, Chapter 2**
  (Mark Ducharme slide deck reproduces the chapter; bridgewebs/sedona).
  The opening "Jacoby Transfer Bids" slide co-headlines both transfers
  as parallel bullets with identical structure:
  > `With 5 or more spades, responder bids 2♥`
  > `With 5 or more hearts, responder bids 2♦`
  The next slide ("Opener's Rebid After A Transfer") mirrors the
  parallelism:
  > `Bid 2♥ if partner bids 2♦`
  > `Bid 2♠ if partner bids 2♥`
  Discriminator column = target major. Later example hands drill each
  transfer symmetrically (one example transferring to hearts, the next
  to spades). No hero/variant framing.
- **ACBL Bulletin, "Jacoby transfers"** (acbl.org Commonly Used
  Conventions PDF). The explanatory auction block shows both sequences
  stacked, with identical annotation format:
  > `1NT — 2♦ (1)` / `2♥ (2)`  [with footnote "I have at least five hearts"]
  > `1NT — 2♥ (1)` / `2♠ (2)`  [with footnote "I have at least five spades"]
  Parallel layout, peer co-headlined. The body prose then uses a
  heart example and a spade example in alternation. Discriminator =
  target major.
- **Root, *Commonsense Bidding*** — `[unable to verify]` structurally.
  Secondary references confirm Root teaches Jacoby transfers in the
  1NT-response chapter but no excerpt reached shows the sub-section
  layout. Not counted.
- **Kantar, *Modern Bridge Conventions*** — `[unable to verify]`. No
  preview surface returned the Jacoby chapter body.

**Verdict for Jacoby:** both directly readable teaching sources
(Grant *BB3* Chapter 2 and ACBL Bulletin) present 2♦ and 2♥ as peers
with parallel per-bid treatment. The "summary card shows the heart
branch" framing the fixture currently uses has no match in either
teaching source examined.

## DONT

- `[unable to verify]` across Kantar, Grant, Root, Lawrence. The
  Kantar search surfaced book listings but no excerpt showing DONT's
  chapter body. Community reference pages (bridgebum, Wikipedia) do
  present the four calls (X / 2♣ / 2♦ / 2♥) in a flat peer list with
  a "shown suits" discriminator, consistent with the peer pattern,
  but those are references not teaching books and do not resolve T2.

## Two-Way New Minor Forcing

- **Adventures in Bridge "This Week in Bridge #586"** (advinbridge.com)
  and **LarryCo "Two-Way New Minor Forcing"** — both directly readable
  but hierarchical: 2♣ is introduced as the invitational relay (with
  its follow-up tree), then 2♦ separately as game-forcing NMF.
  Discriminator is strength, but the per-bid sections are not
  symmetric — 2♣ gets an expanded follow-up subtree because of the
  forced relay, 2♦ does not. This is the one convention examined
  where a hierarchical layout is plausibly the natural choice, driven
  by asymmetric follow-up structure rather than asymmetric defining
  status.
- **Kantar, Grant book presentations** — `[unable to verify]`.

## Synthesis

Direct-source readable cells: 4 (Bergen x 2, Jacoby x 2) plus Two-Way
NMF x 1 community-reference cell. Of these:

- Bergen (both cells) and Jacoby (both cells): **peer-parallel**
  co-headlined with a strength or target-suit discriminator. No
  hero-plus-variant framing found.
- Two-Way NMF: **hierarchical/asymmetric**, but the asymmetry is driven
  by follow-up-tree shape (forced relay under 2♣), not by any claim
  that one bid is the "defining" 2WNMF call.

We did not succeed in opening Kantar, Root, or Lawrence directly; those
cells are genuinely unverified and the survey cannot speak to them.

## Implication for evidence-map T2

The evidence map previously listed T2 as a tension because the
*reference* tradition was peer-parallel but the *teaching* tradition
was assumed to be hero-plus-variants. On the two target-convention
cells that the fixture PR actually fixes (Bergen, Jacoby), the
readable teaching sources agree with the reference tradition: both
present peer-parallel co-headlined bids with a clear discriminator.

T2 is therefore **not a tension** for Bergen and Jacoby at the
evidence level we can verify — teaching and reference sources agree
that peer presentation is the norm. The structure-match rule
recommendation stands for these two conventions without the
previously-asserted counter-pull from teaching books.

T2 remains a live open question for Two-Way NMF specifically. The
readable sources there are hierarchical, so the structure-match rule
would classify 2WNMF as *not* a peer-grid convention regardless of
whether any book treats it as one. For DONT, Kantar, Root, and
Lawrence coverage, the survey is silent.

## Unverified

- Grant *Commonly Used Conventions* / *More Commonly Used Conventions*
  internal layout — previews not exposed.
- Kantar *Modern Bridge Conventions* internal layout — no preview
  surfaces for any of the four target conventions.
- Root *Commonsense Bidding* sub-section layouts.
- Lawrence *Conventions in the Bridge Club* — not reached.
- DONT teaching-book presentation across all four authors.
