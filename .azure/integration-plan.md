# Integration Plan

## Backend / API contracts
- No separate HTTP backend is scaffolded. `src/api/handlers.ts` exposes typed in-process handlers, while `src/api/supabaseClient.ts` queries Supabase directly from the frontend.
- Build: `npm run build`.
- Contracts: `GET /api/health`, `GET /api/catalog`, `GET /api/products/:slug`, `GET /api/account/orders`, `GET /api/admin/orders` are contract names only; they are not registered HTTP routes.

## Frontend
- Folder: repository root.
- Build: `npm run build`.
- Dev: `npm run dev` (Vite, host enabled, allowed hosts enabled, non-strict port).
- API seam: `src/api/index.ts`, wired to the Supabase client.
- Removed mock files: `src/api/mockClient.ts`, `src/mocks/data.ts`, and `src/api/previewState.ts`; removed the preview state switcher from `src/app/App.tsx`.
- API types/contracts: `src/api/types.ts`, `src/api/contracts.ts`.

## Database
- Type: PostgreSQL via Supabase.
- Existing migration directory: `supabase/migrations/` (timestamped SQL).
- Connection environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`).
- Migrations define schema and policies only; do not insert demo records.

## Shared types
- Current typed contract location: `src/api/types.ts`.
- Import alias: none; use relative imports until a backend/shared package is introduced.

## Services
- Essential: Azure Static Web Apps (`STATIC_WEB_APP_URL`).
- Enhancement: none.

## Integration tasks
- Use the typed Supabase implementation through `src/api/index.ts`; no HTTP backend or dev proxy exists in this scaffold.
- Preserve route contract validation in `src/api/contracts.ts`.
- Integration results (2026-09-29): applied `product_system` and `customer_order_flow` to Supabase project `srnhddazfgmphesnmynj`, followed by database permission hardening. Remote migration ledger contains both base migrations and follow-up migrations; all 12 public base tables exist with RLS enabled and are empty. No demo catalog, category, bike, profile, or order rows were added.
- Local SQL migration filenames now match all 10 version/name entries in the remote Supabase migration ledger, so the CLI will not replay the base schema migrations.
- Public catalog views use `security_invoker=true`. Public SELECT access is restricted by RLS to published products, their images/compatibility, active bike models, and categories. `is_admin()` is invoker-secure and unavailable to `anon`; `set_updated_at()` pins its search path. `quote_customer_order` remains callable by `anon` because checkout requests quotes before sign-in; it is read-only and calculates from published products.
- Frontend build passed. Browser smoke test at `http://127.0.0.1:5173/shop` confirmed live `GET /rest/v1/public_products` responses with HTTP 200 and the expected empty-catalog state. Direct anon-role SQL checks of categories, active bikes, products, images, and product-bike compatibility all completed without permission errors. The live API is direct Supabase access; contract names in `src/api/contracts.ts` are not separate HTTP routes, and there is no backend host to start.
- Supabase security advisors no longer report public views or `is_admin()` as security findings. Remaining warnings are the intentional SECURITY DEFINER checkout/order RPCs (`quote_customer_order`, `create_customer_order`); the public quote is necessary pre-auth checkout behavior and validates server-side product data. Performance advisor also reports unindexed order-item product and status-history actor foreign keys, auth policy initplan warnings, and unused indexes on the currently empty database.
- `npm test` exits because no test files are present. Build emits existing third-party Rollup annotation and large-chunk warnings, but succeeds.
