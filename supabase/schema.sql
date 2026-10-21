-- PocketBudget schema for a FRESH Supabase project.
-- (An existing project created with the old schema should run migrations/002_custom_categories.sql instead.)
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

-- Each user's own categories. New users get Food / Going out / Hobbies & other, created by the app on first load.
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  emoji      text not null default '💸' check (char_length(emoji) between 1 and 16),
  budget     numeric(10, 2) not null default 0 check (budget >= 0),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  -- Lets expenses reference (id, user_id) so an expense can only point at its owner's category.
  unique (id, user_id)
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  description text not null check (char_length(description) between 1 and 200),
  amount      numeric(10, 2) not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now(),
  constraint expenses_category_fk
    foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

create index if not exists expenses_user_created_idx on public.expenses (user_id, created_at desc);
create index if not exists expenses_category_idx on public.expenses (category_id);

-- Row Level Security: every row is visible/editable only by its owner.
alter table public.categories enable row level security;
alter table public.expenses   enable row level security;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_select_own" on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_select_own" on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy "expenses_insert_own" on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expenses_update_own" on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expenses_delete_own" on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

-- Logged-out visitors (anon role) get no access at all.
revoke all on public.categories, public.expenses from anon;
grant select, insert, update, delete on public.categories, public.expenses to authenticated;
