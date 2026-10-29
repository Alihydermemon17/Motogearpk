# Storefront redesign — “night ride / garage”

Visual and UX pass only. Pass 1 rebuilt the storefront shell; Pass 2 tightened
the shop and rebuilt the admin into an operations console. Routes, data access,
cart/wishlist/auth logic, RLS and the manual payment workflow are unchanged.
Everything here is presentation.

---

## 1. Design tokens (`src/styles/tokens.css`)

One palette, declared once and mapped onto the semantic tokens the rest of the
stylesheet already consumes. The CSS is split by surface (`base.css`,
`storefront/*.css`, `admin/*.css`) and `src/styles.css` imports the parts in
cascade order.

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
| `ProductGrid` | 4 columns ≥1024 on Home (4 items = complete row everywhere); Shop is 4 / 3 / 2 / 2. `align-items: stretch`, 24px gap (12px phone). A trailing gap is closed by one ask tile spanning exactly the empty cells, never two. |
| `ProductCard` | One component used by Home, Shop and Wishlist. Flex column, `height:100%`, 4:3 media with a soft gradient tile, `object-fit: contain`, one category chip, two-line clamped title with reserved height, footer pinned with `margin-top:auto`. Whole card is **one** focusable link (stretched-link) with wishlist/cart buttons above it. Prices 20px/700 with a struck original and an amber discount pill only when the data records a discount. “Add to cart” is 44px, full width on mobile, shows “Added ✓” for 1.5s. |
| `AskCard` | Dark graphite tile used only to close a partial grid row. Amber WhatsApp action, Browse all ghost action, no price/stock/cart. |
| `CtaBand` | Workshop photograph under a directional scrim, real `wa.me` link from `business_settings`, plus a “Browse catalog” ghost button. |
| `Footer` | Four columns, dark ink, no duplicated COD chips, contact rows from live settings, single bottom bar. |
| `Shop` | 300px category band (200px phone) with breadcrumb, category `h1` and live count; filter bar below on canvas with sort, count and scrollable category pills; header search is the only search ≥1120px; active-filter chips; card-shaped skeletons; empty state with Ask on WhatsApp + Browse all; `?q=` / `?category=` / `?bike=` deep links. |
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

## 5. Pass 2 — Shop and the operations console

Pass 2 kept the Pass 1 palette and type system. It finished the shop’s entry
states and replaced the old single-file admin with a dense, live-data console.
No query, RPC, migration, RLS policy, cart/checkout rule or payment rule was
changed.

### 5.1 Shop

* **Category band.** The shop opens on a 300px band (200px on phones): category
  or catalog photograph, an ink scrim, a `Shop / <Category>` breadcrumb, the
  category name as the `h1` (or `PARTS FOR EVERY RIDE.` for the full catalog),
  one line of context and a live product count. `?category=` accepts either a
  slug or a display name and rewrites the URL to the canonical slug. An empty or
  unknown category resolves to All.
* **One search, one category control.** Above 1120px the header search is the
  only search; the filter-bar copy is hidden. Header search submits to
  `/shop?q=`. Category pills are the primary category control; each pill shows
  its live count and the active pill exposes `aria-pressed`. Header Categories
  items are real `/shop?category=<slug>` anchors, so the matching pill is active
  after navigation.
* **No half-empty rows.** Shop is 4 / 3 / 2 / 2 columns; Home and Wishlist use
  their own breakpoints. When the last row would leave cells blank, exactly one
  dark **“Can’t find your part?”** tile spans the remaining cells and offers an
  amber WhatsApp action plus Browse all. It is never rendered twice, and never
  when the row is already complete. Cards stretch to equal height; the footer
  (price + cart) is pinned.
* **Zero-product categories.** On Home the tile reads **Coming soon** in amber
  (no arrow, no navigation) and offers a WhatsApp request link. On Shop the
  category remains in the pill row with `0`, and the grid shows
  **“Nothing in <Category> yet”** with Ask on WhatsApp and Browse all.
* **Illustration fallback.** `ProductImage` is the only place the SVG fallbacks
  are chosen. Card media stay 4:3 with `object-fit: contain`, a light neutral
  tile and 16px padding in both themes. A small sentence-case **Photo coming
  soon** label identifies an illustration without pretending it is photography.
* **Login.** The left panel is a photograph under an ink scrim; the QR block is
  hidden below 1024px. `WELCOME BACK` uses Barlow Condensed at the same clamp as
  the Shop `h1`.

### 5.2 Admin shell and header

* 248px sticky full-height sidebar. All 16 destinations fit at 1440×800 and
  1440×900; the nav area is the only scrolling region and gets a fade mask when
  it overflows. Footer links (View storefront, Sign out, signed-in email) are
  pinned to the bottom.
* Live count badges: Approvals from `pending_approvals`, Orders from
  `pending_orders`, open Returns, open Support, reviews awaiting visibility.
  No badge is hardcoded.
* At ≤1280px the sidebar becomes a 64px icon rail with tooltips and remembers
  the choice in `localStorage`. Below 768px the shell becomes a top bar plus
  burger drawer. AI command center is visible but disabled and labelled
  **Coming soon**.
* Every page uses the same `PageHeader`: breadcrumb kicker, 28/34 semibold
  sentence-case `h1`, one-line description, page-specific action and a personal
  menu. The old global **New product** / **Reload** actions are gone. Overview’s
  action is **Process orders**; Products owns **Add product**.

### 5.3 Admin pages

* **Overview** — four KPIs (collected revenue, orders, products live, customers),
  an attention queue with per-type counts, a two-row order pipeline, six recent
  orders with shared payment/fulfilment pills, jump links and estimated profit
  with the missing-supplier-cost caveat. Every number comes from
  `getDashboardMetrics()` / live orders; nothing is invented.
* **Products** — dense table with search + category + status + availability
  filters, 25-row pagination, sort, selection and archive. The right drawer has
  Basics, Pricing & cost, Images, Fitment, Supplier & availability, Warranty &
  returns and SEO sections; the footer is sticky; archive uses a danger
  confirmation. At ≤767px the editor takes over the full page.
* **Orders** — two-pane list and detail. The table shows the short (last 8)
  order number and the full ID in the detail and `title`. Tabs carry live
  counts. Customer and delivery are one block with click-to-call / WhatsApp.
  Payment and fulfilment are visually distinct; payment changes still go through
  `admin_update_order_payment` and the audit table. On phones the detail becomes
  a full-width screen with a back button and no horizontal scroll.
* **Shared pages** — Categories, Bike models, Suppliers, Returns, Customers,
  Reviews, Feedback, Support, FAQs, Approvals and Automation logs all use the
  same table/drawer/empty/error primitives, one `StatusPill`, skeletons and
  inline “Try again” states. FAQ/Support/Returns drawers share the leave guard
  for unsaved edits.
* **Settings** — Store, Contact, Delivery and Policies cards with a sticky save
  bar that appears only when dirty; header save was removed. Contact includes a
  test WhatsApp link and the locked PKR currency is labelled as such.

### 5.4 Code and CSS split

* `src/app/App.tsx` is now the shell (theme, routing, chrome, admin gate).
  Storefront pages live in `src/storefront/pages`, shared components in
  `src/storefront/components`; admin pages and primitives live in `src/admin`.
* The CSS monolith is split into `tokens.css`, `base.css`,
  `storefront/{chrome,catalog,product,shop,cart,orders,footer,responsive,
  premium,pass2,redesign,polish,misc,mobile,components,footer-premium}.css` and
  `admin/{admin,gate}.css`, imported in cascade order from `src/styles.css`.
* Dead legacy admin CSS was deleted and three exact duplicate rule blocks were
  collapsed. `!important` dropped from **430 to 3** (all three are in the
  Fluent admin gate). Where Fluent v9 injects atomic classes at equal
  specificity, the design rules now win with one qualifying ancestor or a
  `:root` prefix instead of `!important`; visual and computed-style snapshots
  at 1440 and 390 were used to confirm the cascade.
* `npm run build` and `npm test` pass; `framer-motion`, Tailwind, PostCSS and
  Autoprefixer were removed from the dependencies.

---

## 6. Screenshots

`docs/screenshots/` holds the Pass 1 before/after pairs and the Pass 2 set. The
Pass 2 “before” captures were taken from the live Pass 1 deployment; “after”
captures are the current local build. All are full-page JPEGs.

| File | Viewport |
| --- | --- |
| `before-home-1440.jpg` / `after-home-1440.jpg` | Home, 1440px |
| `before-home-390.jpg` / `after-home-390.jpg` | Home, 390px |
| `before-shop-1440.jpg` / `after-shop-1440.jpg` | Shop, 1440px |
| `before-shop-390.jpg` / `after-shop-390.jpg` | Shop, 390px |
| `after-home-dark-1440.jpg` / `after-shop-dark-1440.jpg` | Dark theme |
| `pass2-before-shop-1440.jpg` / `pass2-after-shop-1440.jpg` | Shop, 1440px |
| `pass2-before-shop-390.jpg` / `pass2-after-shop-390.jpg` | Shop, 390px |
| `pass2-before-shop-category-1440.jpg` / `pass2-after-shop-category-1440.jpg` | `?category=lighting-electrics`, 1440px |
| `pass2-before-shop-category-390.jpg` / `pass2-after-shop-category-390.jpg` | `?category=lighting-electrics`, 390px |
| `pass2-before-admin-overview-1440.jpg` / `pass2-after-admin-overview-1440.jpg` | Admin Overview, 1440px |
| `pass2-before-admin-overview-390.jpg` / `pass2-after-admin-overview-390.jpg` | Admin Overview, 390px |
| `pass2-before-admin-products-1440.jpg` / `pass2-after-admin-products-1440.jpg` | Admin Products, 1440px |
| `pass2-before-admin-products-390.jpg` / `pass2-after-admin-products-390.jpg` | Admin Products, 390px |
| `pass2-after-admin-product-editor-390.jpg` | Product editor, 390px |
| `pass2-before-admin-orders-1440.jpg` / `pass2-after-admin-orders-list-1440.jpg` | Admin Orders list + detail, 1440px |
| `pass2-after-admin-orders-detail-1440.jpg` | Admin Orders detail, 1440px |
| `pass2-before-admin-orders-390.jpg` / `pass2-after-admin-orders-list-390.jpg` | Admin Orders list, 390px |
| `pass2-after-admin-orders-detail-390.jpg` | Admin Orders detail, 390px |
| `pass2-before-admin-settings-1440.jpg` / `pass2-after-admin-settings-1440.jpg` | Admin Settings, 1440px |
| `pass2-before-admin-settings-390.jpg` / `pass2-after-admin-settings-390.jpg` | Admin Settings, 390px |

Sticky chrome is pinned to its layout position for these captures (CDP paints
`position: sticky` elements at the last scroll offset otherwise, which reads as
an overlap bug), and every lazy image is forced to decode first.

## 7. Needs backend

These are data/config gaps, not UI work. None of them were worked around with
invented content.

1. **Apply the FAQ accuracy migration**
   (`supabase/migrations/20261022120000_faq_support_signin_accuracy.sql`). The
   app reads the FAQ rows but the migration that corrects the copy has not been
   applied to the project.
2. **Grant anonymous read on `public_product_reviews`.** The policy currently
   returns `42501` for anon, so approved reviews cannot be shown without a
   backend grant (`GRANT SELECT` to `anon` on the approved view/table).
3. **Create/confirm the `product-images` Storage bucket and its upload policy.**
   The admin image picker uploads there; if the bucket or policy is missing the
   upload fails defensively, but new photos cannot be stored.
4. **Verify courier tracking URLs.** TCS, Leopards, M&P, Trax and PostEx links
   are generated from known tracking-number patterns. Copying the number always
   works; the deep links need verification against each courier’s current URL
   format before they are treated as canonical.
5. **Record supplier cost on the six live products.** Every product currently
   has `supplier_cost` unset, so Overview/Pricing can show margin only as
   “Not set” and estimated profit excludes the catalog. This is a data-entry
   task, not a calculation change.
6. **Confirm the Supabase redirect allowlist and Google consent round-trip.**
   The auth code handles the callback errors, but the project’s allowed
   redirect URLs and the Google consent screen need to be verified in the
   dashboard/account. Neither can be checked from the client.

## 8. Known limitations

* **Bike selector has no Year.** `bike_models` stores make, model, slug and
  engine capacity only. Adding a year filter would require a schema change.
* **Product photography is placeholder.** The six live products have no photo
  file, so the card shows the category illustration with a “Photo coming soon”
  label. The fallback is deliberately a neutral tile in both themes, not a fake
  product shot.
* **Hero/band photos** are Unsplash placeholders stored in `public/img/`
  (each < 250 KB, no external request at runtime).
* **Admin data is sparse.** Empty states, zero-value KPIs and “no reviews”
  panels are the honest current state of the live records, not mock data.

## 9. Media credits

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
