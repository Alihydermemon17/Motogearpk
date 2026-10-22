# Storefront redesign — “night ride / garage”

Visual and UX pass only. Routes, data access, cart/wishlist/auth logic, admin and
the manual payment workflow are untouched. Everything below is presentation.

---

## 1. Design tokens (`src/styles.css`)

One palette, declared once and mapped onto the semantic tokens the rest of the
stylesheet already consumes.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--ink` | `#0F1417` | `#0F1417` | Hero/band/footer surfaces, text on amber |
| `--surface` | `#FFFFFF` | `#151A1D` | Cards, header, panels |
| `--canvas` | `#F4F3EF` | `#0F1417` | Page background |
| `--brand` | `#2F6B63` | `#2F6B63` | Icon fills, primary buttons, focus ring |
| `--brand-strong` | `#1F4F49` | `#1F4F49` | Hover/press, small teal text |
| `--accent-amber` | `#F5A524` | `#F5A524` | Primary CTA fill, discount pill, slide progress |
| `--muted` | `#5E676E` | `#94A0A2` | Secondary/muted text |
| `--border` | `#E5E7EB` | `#263036` | Hairlines, card borders |

### Contrast discipline

Amber is **2.0:1 on white**, so it is a fill-only token: every amber surface
carries `--ink` on top (9.3:1). Teal (`#2F6B63`) is 6.2:1 on white and 5.6:1 on
canvas, so it can be used for icons *and* small text. Muted text was darkened
from the previous `#6C767B` (4.4:1 on canvas — a fail) to `#5E676E` (5.2:1).

Two unit tokens exist for the same reason:

* `--color-accent` — graphics and icons.
* `--color-accent-text` — small text.
* `--color-accent-on-dark` (`#7FB3AE`) — text on graphite/photo scrims.
* `--color-on-graphite-muted` (`#A3AEAC`) — 8.3:1 on `#0F1417`.

### Type

* Body/UI: **Inter** 400/500/600/700 (one family, everywhere).
* Display + `h1` only: **Barlow Condensed** 700, uppercase.
* `h2` and below: Inter, sentence case — including the product page’s
  “Made for miles.” band and the Fluent `Title*` components.
* Scale: display 56/60 · h1 40/44 · h2 32/38 · h3 20/28 · body 16/24 ·
  small 14/20 · micro 12/16. Clamps shrink these below 720px, never below 13px
  for card titles.

Fluent components resolve type through the theme, not the cascade, so
`fontFamilyBase` is injected into `createLightTheme` / `createDarkTheme` as well
as the CSS custom property. The brand ramp was re-derived from `#2F6B63` so
Fluent buttons no longer render in the old greyed teal.

### Layout, radius, elevation

* Container 1280px, gutters 16 / 24 / 32px.
* Section rhythm 96px desktop → 64px tablet → 26px phone.
* Radius: 12px cards, 8px controls, 999px pills.
* One card shadow `0 1px 2px rgb(0 0 0/.04), 0 8px 24px rgb(0 0 0/.06)`;
  hover adds `--shadow-raised` + `translateY(-2px)`.

---

## 2. Components

| Component | Notes |
| --- | --- |
| `Header` | Sticky top bar + header as one unit. Top bar collapses on scroll; three notices on desktop, one rotating notice on mobile. Centre nav with a hover/focus **Categories** panel, real search field, wishlist + cart counts, theme toggle, admin entry, mobile drawer (focus returns to the burger, Escape closes). |
| `Hero` | Full-bleed motorcycle photography (3 slides), `clamp(520px, 78vh, 720px)`. Auto-advance 6s with amber progress bars, pauses on hover/focus, disabled under `prefers-reduced-motion`. A horizontal + bottom scrim keeps left-aligned copy above 4.5:1 against any photo. |
| `TrustStrip` | One slim inline row of 4 items, divided by hairlines, no boxes. Becomes a single scrollable row on phones with a soft mask edge. |
| `CategoryTiles` | Four photo tiles (4/5 desktop, 4/3 on phones) with title, **live** product count and hint. Counts come from the catalog, never hardcoded. |
| `SectionHeading` | Kicker + h2 + right-aligned “View all →” on the same baseline. |
| `ProductGrid` | 4 columns ≥1024 on Home (4 items = complete row everywhere); Shop is 4 / 3 / 2 / 2. `align-items: stretch`, 24px gap (12px phone). |
| `ProductCard` | One component used by Home, Shop and Wishlist. Flex column, `height:100%`, 4:3 media with a soft gradient tile, `object-fit: contain`, one category chip, two-line clamped title with reserved height, footer pinned with `margin-top:auto`. Whole card is **one** focusable link (stretched-link) with wishlist/cart buttons above it. Prices 20px/700 with a struck original and an amber discount pill only when the data records a discount. “Add to cart” is 44px, full width on mobile, shows “Added ✓” for 1.5s. |
| `CtaBand` | Workshop photograph under a directional scrim, real `wa.me` link from `business_settings`, plus a “Browse catalog” ghost button. |
| `Footer` | Four columns, dark ink, no duplicated COD chips, contact rows from live settings, single bottom bar. |
| `Shop` | Sticky filter bar (search, sort, count), scrollable category pills, active-filter chips, card-shaped skeletons, designed empty state with “Clear filters”, `?q=` / `?category=` / `?bike=` deep links. |
| `BikeSelector` | Make → model picker driven by `bike_models`; deep-links to `/shop?bike=<id>`. Stops at model because the catalog does not record a year — no invented dimension. |
| `Reveal` | Progressive enhancement: content renders **visible**; only an element that starts below the fold is armed and faded in by an IntersectionObserver, with a 1.5s failsafe. Nothing can stay hidden if JS is slow or fails. |

`framer-motion` was removed from the bundle (three usages) in favour of this
pattern — the main chunk dropped from ~1.18 MB to ~1.06 MB.

---

## 3. UX decisions

1. **Motorcycle-led hero.** The previous hero opened on a car-headlight close-up.
   All three slides are now motorcycle photography, and car/4x4 lighting is
   demoted to the Lighting & Electrics category tile.
2. **Featured row is exactly four.** The catalog has six SKUs; four keeps a
   complete row at 4-up and at 2×2, so the landing page never ends on a
   half-empty row. “View all →” carries the rest.
3. **One card, one link.** The whole card navigates, but wishes/add-to-cart stay
   independent buttons (`stopPropagation` + a stretched link) — one tab stop per
   card instead of three overlapping ones.
4. **Discount pills only when real.** `-14%` is computed from
   `discount_price` vs `selling_price`. No product shows a badge without data.
5. **COD appears twice on Home, never three times.** Top bar + trust strip. The
   old promise band repeated it a third time; that card is gone and the band now
   covers warranty, dispatch, availability and delivery instead.
6. **No invented social or courier logos.** The brief asked for Facebook /
   Instagram / TCS / Leopards marks, but the project has no verified URLs or
   partnership records for them. Rendering them would fabricate a business
   claim, so the footer ships with real contact channels only.
7. **Scroll reveal that cannot hide content.** The old `whileInView` pattern
   left every below-the-fold section at `opacity: 0` — which is exactly what the
   previous screenshots showed as blank space. The new `Reveal` is visible by
   default and only animates when it is safe to.
8. **Shop filter bar sticks under the header.** Because the top bar collapses on
   scroll, the sticky offset is a constant 72px (64px phone) instead of jumping.
9. **Phone density.** Home at 390px is ~3,957px tall (target < 4,000) without
   removing content: 26px section rhythm, a single scrollable trust row, 4/3
   category tiles that drop the hint line (title + count only), two-column
   feature grid in the dark band, and a 2-column footer.
10. **Amber is a fill, not a text colour.** Primary CTAs and the discount pill use
    ink-on-amber. Amber headline words (“NIGHT RIDE.”) only sit on the dark hero
    scrim, where they measure 6.4:1.
11. **Search moved into the drawer on phones.** The header input is hidden below
    900px, so the drawer opens with a labelled search field above the links —
    otherwise mobile users had no way to search at all.
12. **Sentence case is enforced, not decorated.** The legacy `.section-head`
    rules forced Barlow uppercase on every `Title3` (cart, wishlist, FAQ,
    reviews, account). Those now render as Inter h2 in sentence case, and the
    product page's “Made for miles.” band followed. The footer column labels were
    `<h2>`s in uppercase; they keep the heading semantics and drop the caps.
13. **Hero scrim switches direction on phones.** Desktop keeps the horizontal
    ink gradient; below 900px it becomes vertical (0.22 at the top → 0.95 behind
    the buttons) so the photograph is actually visible instead of a black slab.

---

## 4. Accessibility evidence

* `h1` = 1 on every route; no heading-level skips (Shop gained a visually hidden
  `h2` so card titles stay at `h3`).
* Every icon-only control has an `aria-label`; wishlist and category pills expose
  `aria-pressed`; the drawer exposes `aria-expanded` / `aria-controls`, locks page
  scroll while open, closes on Escape and returns focus to the burger.
* `:focus-visible` ring: 2px `--brand`, 2px offset, applied globally.
* Tap targets: 44px header controls, 44px add-to-cart, 36px wishlist circle with
  a 44px hit area, 25px slide-progress hit area, 48px inputs, full-height search
  input inside its 42px shell.
* Reduced motion: hero autoplay, progress animation, card hover transforms,
  reveal transitions and the drawer slide are all disabled.
* Contrast sweep: 12 routes × 6 widths (320–1440) — 4,264 text pairs — plus a
  second pass over every route whose headings changed. No failures; the worst
  pair on the final pass is **4.91:1** (trust-strip subtext on Home). No layout
  overflow at 320px.
* Disabled controls are visually inert (neutral fill + muted text), not a faded
  version of the active CTA.
* Web vitals measured on the dev server (unminified bundle, no CDN):
  **CLS 0.0008 / 0.0029 / 0.0015** on Home-1440, Home-390 and Shop-390 — no
  layout shift from the hero, the skeleton→grid swap or the font load
  (`document.fonts.status === 'loaded'` for both families). LCP is the hero
  photograph at ~2.1–2.3s in dev, which is why the first hero frame is
  `fetchpriority=high` and preloaded from `index.html`.

## 5. Screenshots

`docs/screenshots/` holds the before/after pairs (JPEG, full page):

| File | Viewport |
| --- | --- |
| `before-home-1440.jpg` / `after-home-1440.jpg` | Home, 1440px |
| `before-home-390.jpg` / `after-home-390.jpg` | Home, 390px |
| `before-shop-1440.jpg` / `after-shop-1440.jpg` | Shop, 1440px |
| `before-shop-390.jpg` / `after-shop-390.jpg` | Shop, 390px |
| `after-home-dark-1440.jpg` / `after-shop-dark-1440.jpg` | Dark theme |

Sticky chrome is pinned to its layout position for these captures (CDP paints
`position: sticky` elements at the last scroll offset otherwise, which reads as an
overlap bug), and every lazy image is forced to decode first.

## 6. Known limitations

* **Shop trailing row.** With six published SKUs, a 4-up Shop grid ends with two
  empty slots. Home is curated to a complete row; Shop shows the whole catalog
  (4 / 3 / 2 / 2) rather than hiding stock to make the grid look neat.
* **Bike selector has no Year.** `bike_models` stores make, model, slug and
  engine capacity only. Adding a year filter would require a schema change.
* **Product photography is placeholder.** Six supplied 4:3 illustrations are
  shown as-is; the card scales them 1.16× to trim the baked-in margin.
* **Hero/band photos** are Unsplash placeholders stored in `public/img/`
  (each < 250 KB, no external request at runtime).

## 7. Media credits

All twelve files in `public/img/` are placeholder photography from **Unsplash**,
used under the Unsplash License (free for commercial use, no attribution
required). They are committed locally so the storefront makes no third-party
image request at runtime.

| Slot | Files |
| --- | --- |
| Hero slide 1 | `hero-1-1920.jpg`, `hero-1-960.jpg` |
| Hero slide 2 | `hero-2-1920.jpg`, `hero-2-960.jpg` |
| Hero slide 3 | `hero-3-1920.jpg`, `hero-3-960.jpg` |
| Category tiles | `cat-lighting.jpg`, `cat-gear.jpg`, `cat-performance.jpg`, `cat-care.jpg` |
| “Why riders pick us” band | `band-riders.jpg` |
| Final CTA band | `cta-workshop.jpg` |

The exact source photo IDs were not recorded at download time. When real
photography is commissioned, replace the files in place (same names, 16:9 for
heroes at 1920×1080 and 960×540, 4:5 or 4:3 for tiles) and record the source
links here.
