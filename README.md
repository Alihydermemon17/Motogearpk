# MotoGear PK

A React + Vite motorcycle and automotive storefront for Pakistan. The app uses Fluent UI v9, a typed Supabase client, PKR pricing, and Supabase Auth for customer and administrator access.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`

## Supabase

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy `VITE_SUPABASE_ANON_KEY`) in `.env` to connect to Supabase. Without configuration, data requests report a connection error; the app does not substitute sample records.

Apply the SQL files in `supabase/migrations/` in timestamp order using the Supabase CLI or SQL editor. The migrations define schema and policies only; they do not add catalog or customer demo records.
