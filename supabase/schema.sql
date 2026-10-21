-- PocketBudget schema. Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run.

-- Monthly budget per category. A missing row means "use the default budget".
create table if not exists public.budgets (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category   text not null check (category in ('food', 'going_out', 'hobbies')),
  amount     numeric(10, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  amount      numeric(10, 2) not null default 0 check (amount >= 0),
  category    text not null default 'hobbies' check (category in ('food', 'going_out', 'hobbies')),
  created_at  timestamptz not null default now()
);

create index if not exists expenses_user_created_idx on public.expenses (user_id, created_at desc);

-- Row Level Security: every row is visible/editable only by its owner.
alter table public.budgets  enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "budgets_select_own" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;
drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_select_own" on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy "budgets_insert_own" on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budgets_update_own" on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets_delete_own" on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_select_own" on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy "expenses_insert_own" on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expenses_update_own" on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expenses_delete_own" on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

-- Logged-out visitors (anon role) get no access at all.
revoke all on public.budgets, public.expenses from anon;
grant select, insert, update, delete on public.budgets, public.expenses to authenticated;
