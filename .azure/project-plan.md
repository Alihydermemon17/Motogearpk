# Project Plan

**Status**: Integrated
**Created**: 2026-09-27
**Mode**: NEW

---

## 1. Project Overview

**Goal**: Build a mobile-first Motogear PK storefront and admin UI inspired by the supplied reference: a charcoal catalog, compact navigation, amber actions, and product-photo-led cards with PKR pricing. Include all requested customer and admin routes as a UI foundation only; exclude backend integrations and fabricated customer data. The project is designed so that every module is independently testable.

**App Type**: Static + API (static frontend only in this phase)

**API Login**: No

**Mode**: NEW

**Deployment Plan**: No deployment plan found

---

## 2. Frontend — Web App

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Framework** | React + Vite |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test |

---

## 3. Services Required

| Azure Service | Role in App | Environment Variable | Default Value (Local) | Classification |
|---------------|------------|---------------------|----------------------|----------------|
| Azure Static Web Apps | Host the storefront frontend and route the SPA shell | STATIC_WEB_APP_URL | https://localhost:3000 | Essential |

---

## 4. Prerequisites

### Run

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Node.js | frontend | ❓ | not detected |
| npm | frontend | ❓ | not detected |

### Debug

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Microsoft Edge | frontend | ❓ | not detected |

---

## 5. Design System & UI

**Component Library**: Fluent UI v9
**Style Direction**: Match the reference's focused automotive catalog: matte graphite surfaces, tightly spaced product tiles, crisp product photography, subtle borders, and warm amber controls. Keep customer-facing screens product-led and admin screens dense and practical, with responsive navigation and no decorative marketing cards. 
**Typography**: Barlow Condensed / Segoe UI Variable

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#FFB400` | Amber buttons, selected navigation, price highlights, and key actions from the reference. |
| `accent` | `#F36B21` | Sale labels and secondary highlights that complement the warm primary accent. |
| `surface` | `#15161A` | Deep charcoal page background for the dark automotive catalog. |
| `text` | `#F3F3F1` | Headings, prices, and primary labels against dark surfaces. |
| `muted` | `#A0A1A6` | Product metadata, captions, ratings, and subdued navigation. |
| `border` | `#303137` | Fine dividers and card edges that separate content without bright outlines. |

### Pages

| Page | Route | Purpose | Layout |
|------|-------|---------|--------|
| Home | `/` | Lead with the product catalog and featured motorcycle gear in the reference's dark visual style. | `header + hero + grid + footer` |
| Shop | `/shop` | Reproduce the reference's product-led browse view with search, filters, availability, and compact cards. | `header + nav + actions + grid + footer` |
| Product Detail | `/product/:slug` | Show a large product image, specifications, availability, price, and add-to-cart action. | `header + two-column(media+meta) + tabs + footer` |
| Cart | `/cart` | Review cart items, quantities, totals, and checkout action. | `header + table + action-bar + footer` |
| Checkout | `/checkout` | Capture delivery details and present a clear order summary. | `header + two-column(form+meta) + actions + footer` |
| Sign In / Sign Up | `/login`, `/signup` | Provide focused account access forms using the same dark surfaces and amber actions. | `header + form + actions + footer` |
| Account / Orders | `/account`, `/orders` | Show account navigation and honest empty states until live account data exists. | `header + nav + main + footer` |
| Admin | `/admin`, `/admin/products`, `/admin/orders`, `/admin/suppliers`, `/admin/agents` | Provide a denser operations shell for product, order, supplier, and agent management screens. | `header + sidebar + table + actions` |

### Sample Content

```
Shop — visible reference products:
| Product | Price (PKR) | Rating | Availability |
| H4 LED Headlight Bulb Kit 6000K | 4,850 | 4.7 (128) | Supplier ready |
| Sequential LED Indicators (Pair) | 2,650 | 4.5 (86) | Limited supply |
| Motorcycle LED Headlight Bulb Kit | — | — | Availability check required |
| Motorcycle rear-view mirror set | — | — | Availability check required |

Product Detail — H4 LED Headlight Bulb Kit 6000K · Price: PKR 4,850 · Availability: Supplier ready
Cart — item: H4 LED Headlight Bulb Kit 6000K · Quantity: 1 · Price: PKR 4,850
Checkout — delivery address: blank form fields · payment: no payment integration in this phase
Account / Orders — no account or order records; show a clear empty state
Admin — no supplier, agent, order, or customer records; show empty states and operational navigation only
```

---

## 6. Project Structure

```
project-root/
├── .azure/
│   ├── project-plan.md
│   └── .preview-temp/
│       ├── manifest.json
│       ├── theme.css
│       └── *.html
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── layouts/
│   ├── routes/
│   ├── services/
│   ├── styles/
│   └── utils/
├── public/
│   └── assets/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .gitignore
└── README.md
```

---

## 7. Route Definitions

| # | Method | Path | Description | Request Body | Response Body | Status Codes |
|---|--------|------|-------------|-------------|--------------|-------------|
| 1 | GET | `/` | Client-side home route | — | Storefront home screen | 200 |
| 2 | GET | `/shop` | Client-side catalog route with search, filters, and availability states | — | Product listing screen | 200 |
| 3 | GET | `/product/:slug` | Client-side product detail route | — | Product detail screen | 200 |
| 4 | GET | `/cart` | Client-side cart route | — | Cart screen | 200 |
| 5 | GET | `/checkout` | Client-side checkout route | — | Checkout form screen | 200 |
| 6 | GET | `/login`, `/signup`, `/account`, `/orders` | Client-side customer access and account routes | — | Account screens with non-fabricated empty states | 200 |
| 7 | GET | `/admin`, `/admin/products`, `/admin/orders`, `/admin/suppliers`, `/admin/agents` | Client-side operations routes | — | Admin screens with non-fabricated empty states | 200 |

> These are frontend routes only. No API handlers, authentication, supplier links, payment integrations, or external data connections are included in this phase.

---

## 8. Next Steps

1. Run **azure-project-scaffold** to execute this plan
2. Run **azure-project-integrate** to wire the frontend to live data, smoke-test the backend, and create the migrations
3. Run **azure-debug-plan** → **azure-debug-generate** for Docker emulators and VS Code debugging
4. Run the **azure-deploy** agent when ready; it uses **azure-app-onboard** for architecture, cost estimation, IaC generation, provisioning, and health verification
