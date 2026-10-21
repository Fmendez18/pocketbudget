# PocketBudget

PocketBudget helps students living on a monthly allowance see how much they have left for food,
going out and hobbies, so they don't run out of money before the month ends.

Built with Next.js and Supabase (Auth + Postgres with Row Level Security).

## Run locally

1. Create `.env.local` with your Supabase project's URL and publishable key:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

2. In the Supabase SQL Editor, run `supabase/schema.sql` (fresh project).
3. Install and start:

   ```bash
   npm install
   npm run dev
   ```

Then open http://localhost:3000.
