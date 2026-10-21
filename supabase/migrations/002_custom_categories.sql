-- Migration 002: user-defined categories.
-- Run ONCE on a project that already has the original schema (budgets + expenses.category text).
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.

-- 1. One row per category per user. The budget now lives on the category itself.
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

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_select_own" on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.categories from anon;
grant select, insert, update, delete on public.categories to authenticated;

-- 2. Move existing data over (only if the old text column is still there).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'category'
  ) then
    -- Give every existing user the three default categories, keeping any budget they had customised.
    insert into public.categories (user_id, name, emoji, budget, position)
    select u.id, d.name, d.emoji, coalesce(b.amount, d.budget), d.position
    from auth.users u
    cross join (values
      ('food',      'Food',            '🍝', 250, 0),
      ('going_out', 'Going out',       '🎉', 150, 1),
      ('hobbies',   'Hobbies & other', '🎸', 100, 2)
    ) as d (slug, name, emoji, budget, position)
    left join public.budgets b on b.user_id = u.id and b.category = d.slug
    on conflict (user_id, name) do nothing;

    alter table public.expenses add column if not exists category_id uuid;

    -- Point each old expense at the matching new category row.
    update public.expenses e
    set category_id = c.id
    from public.categories c
    join (values ('food', 'Food'), ('going_out', 'Going out'), ('hobbies', 'Hobbies & other'))
      as m (slug, name) on m.name = c.name
    where c.user_id = e.user_id and m.slug = e.category and e.category_id is null;

    alter table public.expenses alter column category_id set not null;
    alter table public.expenses drop column category;
  end if;
end $$;

-- 3. Composite FK: the category must belong to the same user as the expense.
--    Deleting a category deletes its expenses (the app asks for confirmation first).
alter table public.expenses drop constraint if exists expenses_category_fk;
alter table public.expenses
  add constraint expenses_category_fk
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade;

create index if not exists expenses_category_idx on public.expenses (category_id);

-- 4. Budgets now live on categories.
drop table if exists public.budgets;
