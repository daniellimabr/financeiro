---
name: Financeiro v2
description: Dashboard financeiro pessoal/familiar com drill-down de receita/despesa até a linha de extrato
colors:
  bg: "#f5f6f1"
  surface: "#ffffff"
  border: "#dfe1d5"
  text: "#6d6f61"
  text-h: "#22231d"
  accent: "#3f7d3f"
  accent-bg: "rgba(63, 125, 63, 0.1)"
  receita: "#3f7d3f"
  despesa: "#b8562f"
  despesa-bg: "rgba(184, 86, 47, 0.1)"
  danger: "#a3374a"
  danger-bg: "rgba(163, 55, 74, 0.1)"
  bg-dark: "#18181b"
  surface-dark: "#212024"
  border-dark: "#2c2c31"
  text-dark: "#9a99a1"
  text-h-dark: "#ececee"
  accent-dark: "#5fc17e"
  receita-dark: "#5fc17e"
  despesa-dark: "#e0855c"
  danger-dark: "#d9748c"
  danger-bg-dark: "rgba(217, 116, 140, 0.14)"
typography:
  display:
    fontFamily: "Archivo, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Public Sans', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Public Sans', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "48px"
components:
  tile-clickable:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-h}"
    rounded: "{rounded.md}"
    padding: "16px"
  tile-clickable-hover:
    backgroundColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-h}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary-hover:
    textColor: "{colors.accent}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.accent-bg}"
    textColor: "{colors.text-h}"
---

# Design System: Financeiro v2

## Overview

**Creative North Star: "The Open Ledger"**

Financeiro v2 is a private, family-scale finance tool — two people checking
their own consolidated money on their own server, not a product selling
anyone on anything. The system's one idea is that a total is never a dead
end: every receita/despesa figure is a legible, clickable entry point into
the transaction that produced it, all the way down (resumo → categoria →
meio de pagamento → linha de extrato). Nothing here is decorative; the
warm-neutral ground and the green/terracotta pair exist to carry that
funnel, not to brand it.

The system explicitly rejected two defaults during its Sprint 5 direction
round: the "cream paper + serif" AI-generic look, and the generic
purple/blue SaaS-fintech dashboard (cards + soft shadow + arbitrary accent).
It landed on a warm-neutral, workhorse-typography register close to
personal-finance-wellbeing apps (YNAB/Copilot), confirmed by the user via
rendered comparison artifacts, with dark mode explicitly adjusted to a
neutral charcoal (never brown) after user feedback — warmth stays confined
to the despesa accent, not spread across the ground.

**Sprint 6** replaced the placeholder `system-ui` stack with a real,
self-hosted typeface pair — Archivo (display/headline/prominent numerals)
and Public Sans (body/label) — chosen by the CEO from three real pairs
rendered against actual dashboard content (a published comparison artifact,
the same "render it for real, don't describe it" process used for the
color direction). The layout also stopped centering everything into an
880px column that left the sides of wide viewports empty; `.dash-page` now
runs up to 1440px.

**Key Characteristics:**
- One brand accent (green), doubling as the "receita" semantic — there is no
  separate marketing accent competing with the data.
- Terracotta despesa is semantic only; it never appears as chrome, a button,
  or a nav state.
- Flat surfaces, 1px borders, no shadows anywhere.
- A real display/body pair (Archivo/Public Sans, self-hosted `.woff2`) —
  distinctive enough to read as a considered choice, still an Operate-mode
  workhorse rather than an invented display face competing with the data.

## Colors

Restrained strategy: neutrals carry the page, one accent (green) carries
interaction, and two semantic colors (green/terracotta) carry the meaning
of a number — never used as decoration.

### Primary
- **Ledger Green** (`#3f7d3f` light / `#5fc17e` dark): the app's only brand
  accent — interactive tiles, links, focus rings, active states. Doubles as
  the "receita" semantic value color, since positive money and the brand
  color are the same idea in this product.

### Secondary
- **Kiln Terracotta** (`#b8562f` light / `#e0855c` dark): despesa values,
  expense bar fills, expense chart bars only. Never used for chrome, nav, or
  buttons — see the One Meaning Rule below.

### Tertiary — Natureza (Sprint 12)
A third semantic axis, separate from money direction (receita/despesa) and
from open-ended category identity (the 8-hue `--cat-*` palette): "how
predictable is this spend." Deliberately desaturated relative to `--cat-*`
so it reads as structural, not as a 9th category slot competing for the
same attention. Same contrast band as `--despesa` (≥4.5:1 on `--surface`),
safe for direct use as text/numeral color.
- **Slate** (`--nat-fixa`, `#3d5a80` light / `#7fa3c9` dark): Fixo
  recorrente — the most "planted" of the three, cool and steady.
- **Ochre** (`--nat-variavel`, `#7a6420` light / `#c9ac5c` dark): Variável
  recorrente — recurring but not fixed in amount.
- **Plum** (`--nat-eventual`, `#7a5580` light / `#b98cc4` dark): Eventual —
  the default for anything unclassified, least "anchored" of the three.
  Labeled "Custo eventual" through Sprint 12; the CEO found the label
  implied expense when natureza applies equally to receita, so Sprint 13
  shortened it to "Eventual" everywhere (card, funil, tabela de
  classificação) — cosmetic rename only, `--nat-eventual` and the enum
  value `eventual` are unchanged.

### Quaternary — Danger (Sprint 13)
The system's first warning/destructive color, added when the redesign gave
Excluir a first-class visual treatment. Decided via a rendered-comparison
Impeccable round (Artifact, CEO chose to introduce it rather than ship
Excluir with no color at all).
- **Wine** (`--danger`, `#a3374a` light / `#d9748c` dark): scoped to the
  `Excluir` action only — never Vender/Quitar, which end an asset/
  liability's active life but do not delete data. Deliberately a cool,
  pinkish red, distinct in hue from the warm-orange `--despesa` terracotta
  so the eye never reads "this destroys data" as "this is an expense," or
  vice versa — see the One Meaning Rule below, which this token does not
  reopen (it is independent, not a reuse of `--despesa`).

### Neutral
- **Sage Mist** (`#f5f6f1` light / `#18181b` dark): page background.
- **Surface White** (`#ffffff` light / `#212024` dark): cards, tiles, the
  funnel panel.
- **Quiet Sage Border** (`#dfe1d5` light / `#2c2c31` dark): 1px borders and
  dividers — the only depth cue in the system.
- **Text Sage** (`#6d6f61` light / `#9a99a1` dark): body text, labels, muted
  captions.
- **Ink** (`#22231d` light / `#ececee` dark): headings and tile values.

### Named Rules
**The One Meaning Rule.** Terracotta means despesa and nothing else. It
must never be reused for a warning or destructive color — see `--danger`
above (Sprint 13), added specifically so a future screen never has to
reach for `despesa` to signal risk.

## Typography

**Display/Headline Font:** `Archivo, system-ui, "Segoe UI", Roboto,
sans-serif` (self-hosted `.woff2`, weights 600/700)
**Body/Label Font:** `"Public Sans", system-ui, "Segoe UI", Roboto,
sans-serif` (self-hosted `.woff2`, weights 400/600)

**Character:** an industrial grotesque (Archivo) carries titles, section
headings and every prominent numeral (summary-tile values), paired with a
quieter humanist grotesque (Public Sans) for everything you read rather
than scan. Chosen over two other real pairs (Space Grotesk/Inter,
Sora/Work Sans) specifically for reading closest to the existing
`system-ui` register while still being a considered, distinctive choice —
this stays an Operate surface (a tool you scan and act in), not a Persuade
surface, so the pairing reinforces hierarchy without competing with the
data for attention. Both faces are Google Fonts under OFL, downloaded once
and served from `frontend/public/fonts/` — no external font CDN in
production.

### Hierarchy
- **Display** (Archivo 700, 32px, 1.15): the `h1` — page/section titles only.
- **Headline** (Archivo 600, 24px, -0.01em): `h2` — sub-section titles.
- **Body** (Public Sans 400, 16px, 1.45): running text, table cells.
- **Label** (Public Sans 600, 12px, uppercase, 0.04em tracking): tile labels
  ("RECEITA", "DESPESA"), section eyebrows inside the funnel, table headers.

Summary-tile values (`.dash-tile .v`) use the **display** face at 700
weight — the one place a number is treated as a headline rather than body
text, since it is the single most-scanned figure on the page.

All monetary values use `font-variant-numeric: tabular-nums` so figures
align in columns without extra markup.

### Named Rules
**The Tabular Money Rule.** Any element rendering a currency value sets
`tabular-nums`. Untabulated digits in a financial app read as unfinished.

## Layout

The app lives inside a persistent two-column shell — `240px` sidebar,
fluid main content — described under Components → Navigation. Every screen
renders inside the shell's main area; no screen owns its own top-level
chrome or repeats the nav.

Within the main area, screens run edge-to-edge (no `max-width` cap) with
generous `24px` page padding — widened in Sprint 6 from an `880px`
centered column, then again post-Sprint-11 (first to `1800px`, then to
uncapped) on repeated CEO feedback that wide viewports still had too much
empty margin. Content still reads left-aligned, not centered. The summary
tiles form a
responsive grid (`repeat(auto-fit, minmax(180px, 1fr))`) that reflows from 4-across on
desktop to 2-across on narrow viewports without a breakpoint query. The
funnel (categoria → meio de pagamento → linha de extrato) renders as one
persistent panel below the summary; **as of Sprint 6 it is an accordion,
not a replace-in-place funnel** — expanding a categoria nests its meio de
pagamento breakdown indented below it without hiding the categoria list,
and expanding a meio de pagamento nests the transaction table the same
way. Multiple categorias can be expanded at once. The summary tiles stay
visible throughout so the user never loses the totals that motivated the
drill; a single "Fechar" control in the funnel header collapses the whole
funnel back to the summary.

Spacing follows a fixed scale (`4 / 8 / 12 / 16 / 24 / 32 / 48px`); flex/grid
`gap` is used everywhere sibling groups are laid out — no per-element
margin.

## Elevation & Depth

Flat by design. There are no shadows anywhere in the system; depth is
conveyed entirely by a single 1px border (`--border`) separating a surface
from the page background, and by a subtle `background` shift on hover
(`--accent-bg`) rather than a lift effect.

### Named Rules
**The Flat Ledger Rule.** Nothing casts a shadow. A ledger page doesn't
float above the desk it's written on — this system's cards don't float
above their page either.

## Shapes

Two radius steps: `8px` for interactive controls (buttons, selects) and
`12px` for containers (summary tiles, the funnel panel). No sharp corners,
no pill shapes, no asymmetric radii — the roundedness is quiet enough to
read as "a form field" rather than "a bubble."

## Components

### Buttons
- **Shape:** `8px` radius, 1px border, flat. This is the base `button`
  element style in `index.css` — every button in the app inherits it by
  default; a page never needs to hand-style a plain action button.
- **Default/Secondary** (sync, confirm, connect actions; `.dash-back`,
  filter chrome): `var(--surface)` background, `var(--text-h)` label,
  border shifts to `var(--accent)` on hover — no background fill change.
  `disabled` drops to `0.5` opacity with a not-allowed cursor.
- **Ghost** (sidebar nav items, drill-down/accordion rows, and — since
  Sprint 13 — the `.btn-ghost` class for secondary actions in plain button
  groups): no border, background transparent at rest, fills
  `var(--accent-bg)` on hover/active. Through Sprint 12 this vocabulary only
  existed baked into `.app-nav button`/`.dash-row`, each reimplementing the
  same look; Sprint 13 generalized it into a reusable `.btn-ghost` class for
  the Ativos/Passivos card button groups (Editar/Vender/Quitar), leaving nav
  and accordion rows on their own selectors since those also carry the
  active-state vocabulary described under Navigation below. `.btn-quiet`
  (opacity `0.72`, smaller label) stacks on top of `.btn-ghost` to de-
  emphasize the least frequent/most consequential action in a group — today
  only `Excluir`, which also stacks `.btn-danger` (`var(--danger)` text,
  `var(--danger-bg)` on hover — see Colors → Quaternary).
- **The One Button Rule.** There is exactly one visual button system in the
  app. A page that needs a button reaches for the base element (or the
  Ghost/Quiet/Danger modifier classes above — additive, not a fork) never a
  bespoke class — `TransactionsPage`'s sync button and `DashboardsPage`'s
  clickable tile share the same `border-radius`/`border`/`hover` contract
  even though one is plain and one is a `.dash-tile`.
- **Card button hierarchy (Ativos/Passivos, Sprint 13).** Only "Ver gasto no
  período" stays Default — the card already surfaces the cost history via
  its sparkline, so that button is the natural continuation of what the
  card already shows. Editar/Vender/Quitar/Excluir are all Ghost: no
  management action competes visually with reading the history, and none of
  them needs the weight Default implies. Decided via a rendered-comparison
  Impeccable round (two candidates, Editar-primary vs. Vender/Quitar-
  primary, both rejected in favor of "only the read action is primary").

### Cards / Containers ("tiles")
- **Corner Style:** `12px` radius.
- **Background:** `var(--surface)`, 1px `var(--border)`.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Interactive variant** (Receita/Despesa summary tiles): identical to the
  static tile, but the border brightens to `var(--accent)` on hover/focus,
  and the tile is a real `<button>` — the only visual delta between a
  drillable and a static total is that one border-color change, deliberately
  subtle rather than a competing color block.

### Cards / Containers ("tiles")
- **Corner Style:** `12px` radius.
- **Background:** `var(--surface)`, 1px `var(--border)`.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Interactive variant** (Receita/Despesa summary tiles): identical to the
  static tile, but the border brightens to `var(--accent)` on hover/focus,
  and the tile is a real `<button>` — the only visual delta between a
  drillable and a static total is that one border-color change, deliberately
  subtle rather than a competing color block.

### List rows ("linha de detalhamento")
The categoria/meio-de-pagamento drill lists reuse one row primitive: a
full-width button (`.dash-row`) with a chevron (rotates 90° and tints
`var(--accent-text)` when the row is expanded — see Funnel accordion
below), a name, an inline proportion bar (`.track`/`.fillbar`, filled with
the current funnel's semantic color — green under Receita, terracotta
under Despesa), a right-aligned tabular amount, and (Sprint 6) a
right-aligned `percentual` value in `--text`. The inline bar echoes the
Recharts chart above it at a glance-able, scannable grain; the chart gives
shape, the row gives the exact number, the percentual and the click
target. Categoria rows additionally carry a small inline SVG trend
sparkline (`RowTrend`) — deliberately a simpler mark than the summary-tile
sparkline (no chart library, no axis, just a stroked polyline) since it is
one of six things competing for space on a single row, not a card's
headline visual. Below `640px` the trend and proportion bar drop from the
row (they duplicate the chart already rendered above the list); name,
amount and percentual are what a cramped touch target needs to stay
legible — a real overflow found via `scripts/browser-check` against the
deployed app, not a preemptive guess.

### Funnel accordion (drill-down)
Categoria → meio de pagamento → linha de extrato nest by indentation
(`.dash-accordion-panel`: left border + left padding, one level per
expansion) instead of one screen replacing another. Expanding a row never
hides the level it belongs to, and more than one categoria can be expanded
at once — each keeps its own nested state. A single "Fechar" control in
the funnel header (`.dash-funnel-head`) collapses the entire funnel back
to the summary tiles; there is no per-level "back", only expand/collapse
per row and one full close. (This replaced a Sprint 5 breadcrumb-and-
replace-in-place funnel — see history below.)

### Navigation

**App shell (sidebar):** the whole app lives inside a two-column shell
(`.app-shell`) — a fixed `240px` sidebar (`var(--surface)`, right border)
holding the brand mark, the primary nav, and the signed-in user's
name/email pinned to the bottom; the rest of the viewport is the scrolling
main content area (`var(--bg)`). Below `720px` the sidebar rotates into a
horizontal top bar with a scrollable nav row — the same five items, never a
hamburger menu, since this is a 5-item nav for a 2-person household, not an
app large enough to earn a drawer.

Nav items are full-width ghost buttons, left-aligned, `44px` minimum touch
height. At rest they carry no background; hovering or being the active tab
fills `var(--accent-bg)` — active additionally sets `var(--accent-text)`
and `font-weight: 600`, and carries `aria-current="page"`. This is
deliberately a filled-background state — **the One "Here" Rule**: a filled
background always means "you are here now" (nav tabs, no other UI element
in the app claims this vocabulary). The drill funnel does not compete with
it: since Sprint 6 there is no breadcrumb trail, so "where am I" inside the
funnel is answered by which rows are expanded (chevron rotation + nested
indentation), not by a second navigation idiom living next to the sidebar's.

**History:** Sprint 5 shipped a breadcrumb trail (`Despesa / Alimentação /
Cartão de crédito`, underlined prior steps) alongside a funnel that
replaced its own contents per drill level. Sprint 6 replaced both with the
accordion described above — multiple categorias can be open at once, so a
single linear trail could no longer describe "where you are."

### Table (`.dash-table`, unified — Sprint 13)
One table language for every `<table>` in the app: `table-layout: fixed`
with an explicit `<colgroup>` (every table now declares one — no more
browser-auto column sizing), bottom-bordered rows, uppercase 12px labels
for headers (`font-weight: 700`), no zebra striping, `6px` vertical padding
(denser than the Sprint 5 default so a busy page like Categorização shows
more rows at once), and a full-row `var(--accent-bg)` hover fill — the same
fill the rest of the app already uses for "you're pointing at this," not a
new idiom. Ordering columns (`.sortable` + `useTableSort`/`SortableHeader`)
get an underline + `var(--accent-text)` on the active column, on top of the
existing ▲/▼ direction glyph.

**History:** through Sprint 12, `.dash-table` was deliberately flat — "the
terminal, plainest level of the funnel by design," no hover, no sort on
most tables — and three divergent dialects had grown on top of it:
`.cat-review-table` (Sprint 11, the only one with hover/density/sort),
`.nat-table` (Sprint 12, structured but static), and three separately
hand-rolled "transaction table" implementations in
`DashboardsPage`/`AssetsPage`/`LiabilitiesPage`. The CEO used the app
enough to notice the inconsistency and asked to reopen the rule; Sprint 13
picked a direction via a rendered-comparison Impeccable round (Artifact,
two candidates: "Comfortable" — `.cat-review-table`'s existing look
extended everywhere — vs. "Structured" — denser, with a border-left hover
indicator). The shipped result is a hybrid the CEO asked for directly after
seeing both: Structured's density, Comfortable's hover (a per-cell
`border-left` indicator in the Structured candidate created a false
vertical line between columns and made cell text visibly shift on hover —
rejected on sight). `TransactionsTable.tsx` (a new shared component) now
backs all three former "transaction table" implementations, and
`AssetDrilldown` gained Categoria (editable) and sort columns it never had
before — a deliberate behavior change, not just a visual one (see
PRD-013).

### Simple lists (`.simple-list`, Sprint 13)
Gestão de Contas' connected-accounts list and the sync dialog's account
checklist are plain `<li>` rows, not accordion buttons — they never
expand — but Sprint 13 gave them the same spacing/hover vocabulary as every
other list in the app (`padding` + `border-radius: 8px` per row,
`var(--accent-bg)` fill on hover, no border between rows) so they stop
reading as unstyled HTML next to `.dash-row`/`.dash-table`. This is
presentation only: `.simple-list` adds no button semantics, no chevron, no
expand state — a row that isn't interactive stays exactly that.

### Grouped table (`.dash-table` variant, `SubcategoryGroupTable` component — Sprint 30)
When a table groups rows by a parent entity (e.g., Subcategory rows grouped
by CategoryGroup), visual demarcation of group boundaries prevents users from
losing their place when a list grows large. `SubcategoryGroupTable` signals
group transitions via a **stronger top border** (`border-top: 2px` instead of
`1px`) on the first row of each new group — a pattern validated via
rendered-comparison Impeccable round (Artifact, two candidates: "Strong border"
vs. "Continuous rowSpan treatment"). The CEO chose the strong-border approach
for its clarity at a glance compared to the rowSpan-only candidate. Applied
to `CategoriasPage` (new Gestão de Categorias tela, Sprint 30) and
`NaturezaPage` (refactored to reuse `SubcategoryGroupTable`, same visual
direction). No new color token introduced; the border inherits
`var(--border)` and gains visual emphasis through thickness alone, staying
true to the Flat Ledger Rule and restrained-palette principle.

### Orçado-vs-Realizado status indicator (Sprint 30)
When a Subcategory row in the Despesa or Receita funnel of the Dashboard has
a vigente (current/active) Orçamento for the filtered month, the amount
always gains a muted caption naming the orçado total ("de R$X orçado"). The
proportion bar (`.track`) and a directional symbol appear only when the
realizado is **outside** the orçado — the bar gains a subtle `outline` (not
fill; no new background color) and the caption switches to naming the
direction of the miss:

- **▲** (Despesa only): gasto ultrapassou o orçado (overshoot) — outline +
  caption "estourou o orçado".
- **▼** (Receita only): receita não atingiu o orçado (shortfall) — outline +
  caption "abaixo do orçado".
- Within budget (either tipo): no outline, no symbol — just the muted "de
  R$X orçado" caption.

This design rejects the alternative of introducing a new semantic color
(amber/"alerta" token for warnings). The CEO's explicit choice preserves two
principles already documented in the system: the **One Meaning Rule** (one
color = one meaning; terracotta means despesa/expense and nothing else) and
the **restrained palette** (only green/terracotta/neutral/danger exist). Status
is signaled via outline thickness (a structural cue) and symbol/direction
(a semantic cue without color), not a fourth color token. See the Orçamento
section of `dashboards-guia-cards.md` for user-facing explanation.

## Do's and Don'ts

### Do:
- **Do** keep terracotta scoped to despesa values and expense bar/chart
  fills only.
- **Do** use the green accent for every interactive/brand moment (buttons,
  links, focus rings, active tile borders) — it is the app's only accent.
- **Do** set `tabular-nums` on every rendered currency value.
- **Do** keep summary tiles visible while the funnel is open; never replace
  them with the drill-down view.
- **Do** derive dark mode by swapping to neutral charcoal surfaces
  (`#18181b` / `#212024`) — warmth lives only in the semantic accents, never
  the ground.

### Don't:
- **Don't** introduce a second brand accent color; Restrained means one.
- **Don't** add shadows, gradients, or card-lift hover effects — this system
  is flat by rule, not by omission.
- **Don't** render dark mode as a brown/sepia tint of the light palette —
  the user explicitly rejected that during the direction round.
- **Don't** reuse `despesa` terracotta for warnings, errors, or destructive
  actions; it means expense and nothing else.
- **Don't** add an eyebrow/kicker label above headings, or a hero-metric
  template (icon + big number + accent) for anything that isn't a real
  summary tile in this funnel.
