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
  bg-dark: "#18181b"
  surface-dark: "#212024"
  border-dark: "#2c2c31"
  text-dark: "#9a99a1"
  text-h-dark: "#ececee"
  accent-dark: "#5fc17e"
  receita-dark: "#5fc17e"
  despesa-dark: "#e0855c"
typography:
  display:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
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

**Key Characteristics:**
- One brand accent (green), doubling as the "receita" semantic — there is no
  separate marketing accent competing with the data.
- Terracotta despesa is semantic only; it never appears as chrome, a button,
  or a nav state.
- Flat surfaces, 1px borders, no shadows anywhere.
- System sans throughout — an Operate-mode surface that leans on legible
  workhorse type rather than an invented display face.

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
**The One Meaning Rule.** Terracotta means despesa and nothing else. If a
future screen needs a warning or destructive color, it must not reuse
`despesa` — that would teach the user's eye to misread money as danger, or
danger as an expense total.

## Typography

**Display/Body/Label Font:** `system-ui, "Segoe UI", Roboto, sans-serif`

**Character:** one workhorse system-sans family for the whole app — this is
an Operate surface (a tool you scan and act in), not a Persuade surface, so
the type voice stays out of the way and lets tabular numerals and weight
steps carry the hierarchy.

### Hierarchy
- **Display** (600, 32px, 1.15): the `h1` — page/section titles only.
- **Headline** (600, 24px, -0.01em): `h2` — sub-section titles.
- **Body** (400, 16px, 1.45): running text, table cells.
- **Label** (600, 12px, uppercase, 0.04em tracking): tile labels
  ("RECEITA", "DESPESA"), section eyebrows inside the funnel, table headers.

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

Within the main area, screens are single-column, content-centered,
`max-width: 880px`, generous `24px` page padding. The summary tiles form a
responsive grid (`repeat(auto-fit, minmax(180px, 1fr))`) that reflows from 4-across on
desktop to 2-across on narrow viewports without a breakpoint query. The
funnel (categoria → meio de pagamento → linha de extrato) renders as one
persistent panel below the summary, replacing its own contents per drill
level rather than navigating to a new page — the summary tiles stay visible
throughout so the user never loses the totals that motivated the drill.

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
- **Ghost** (breadcrumb crumbs, sidebar nav items): no border, background
  transparent at rest. Breadcrumb crumbs underline in `var(--accent-text)`;
  nav items instead fill `var(--accent-bg)` on hover/active — see
  Navigation below for why the two ghost variants differ.
- **The One Button Rule.** There is exactly one visual button system in the
  app. A page that needs a button reaches for the base element, never a
  bespoke class — `TransactionsPage`'s sync button and `DashboardsPage`'s
  clickable tile share the same `border-radius`/`border`/`hover` contract
  even though one is plain and one is a `.dash-tile`.

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
full-width button with a name, an inline proportion bar (`.track`/
`.fillbar`, filled with the current funnel's semantic color — green under
Receita, terracotta under Despesa), and a right-aligned tabular amount. The
inline bar echoes the Recharts chart above it at a glance-able, scannable
grain; the chart gives shape, the row gives the exact number and the click
target.

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
deliberately a filled-background state, not the breadcrumb's underline —
**the Two Ghosts Rule**: an underline marks "you can leave this level and
return," a filled background marks "you are here now." Never swap the two
vocabularies between the sidebar and the breadcrumb.

**Breadcrumb (drill-down trail):** plain text trail (`Despesa / Alimentação
/ Cartão de crédito`), each prior step an underlined ghost button, the
current step un-clickable bold text. No pill/chip styling — this is a path,
not a filter state.

### Table (linha de extrato)
Bottom-bordered rows, uppercase 12px labels for headers, no zebra striping,
no row hover background beyond the default row border — the table is the
terminal, plainest level of the funnel by design.

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
