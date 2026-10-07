# MotoGear PK Supabase product system

## Configure the frontend

Copy `.env.example` to `.env` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (recommended) or the legacy `VITE_SUPABASE_ANON_KEY`

The frontend always uses its typed Supabase client. Without these values, live requests report a configuration error; no mock catalog or order data is substituted.

## Apply the migrations

Run the SQL migrations in timestamp order in the Supabase SQL editor or through the Supabase CLI migration workflow:

1. `202609270001_product_system.sql` creates the product catalog and admin-only supplier data.
2. `202609270002_customer_order_flow.sql` adds customer profiles, COD orders, order items, status history, own-record RLS, and trusted quote/order RPCs.

The migrations create the catalog, bike, supplier, profile, and order schemas and their access policies without inserting demo catalog or order rows. Auth triggers create a profile only for a real Supabase Auth user. Order totals use a flat PKR 4,500 delivery fee, product discounts from trusted product rows, and cash on delivery only. New orders start with `PENDING` payment and order statuses.

## Access model

- Customers read published records through `public_products`, `public_product_images`, and `public_product_bikes`.
- Supplier cost, estimated profit, contact information, supplier notes, URLs, and availability internals remain on admin-protected base tables.
- Admin access is determined by `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`.
- All eight base tables have RLS enabled. Admin CRUD policies require the admin claim.
- `estimated_supplier_quantity` and `estimated_quantity` are supplier estimates only; they are never physical MotoGear PK inventory.

Admin users must be provisioned with the `admin` app metadata claim through a trusted Supabase Auth workflow. The browser must never be given a service role key.
