create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_vote_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null,
  match_id text not null,
  free_votes_used integer not null default 0 check (free_votes_used >= 0 and free_votes_used <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id, match_id)
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('paypal', 'qris')),
  status text not null default 'created' check (status in ('created', 'pending', 'paid', 'cancelled', 'failed')),
  credits_to_grant integer not null check (credits_to_grant > 0),
  amount_major numeric(12, 2) not null check (amount_major > 0),
  currency_code text not null,
  external_order_id text,
  approval_url text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vote_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payment_order_id uuid references public.payment_orders (id) on delete set null,
  delta integer not null check (delta <> 0),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vote_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payment_order_id uuid references public.payment_orders (id) on delete set null,
  category_id text not null,
  match_id text not null,
  team_id text not null,
  quantity_total integer not null check (quantity_total > 0),
  quantity_free integer not null default 0 check (quantity_free >= 0),
  quantity_paid integer not null default 0 check (quantity_paid >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (quantity_total = quantity_free + quantity_paid)
);

create or replace view public.vote_totals as
select
  category_id,
  match_id,
  team_id,
  sum(quantity_total)::integer as total_votes
from public.vote_events
group by category_id, match_id, team_id;

alter table public.user_profiles enable row level security;
alter table public.match_vote_usage enable row level security;
alter table public.payment_orders enable row level security;
alter table public.vote_credit_ledger enable row level security;
alter table public.vote_events enable row level security;

drop policy if exists "profile_select_own" on public.user_profiles;
create policy "profile_select_own"
on public.user_profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profile_update_own" on public.user_profiles;
create policy "profile_update_own"
on public.user_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "usage_select_own" on public.match_vote_usage;
create policy "usage_select_own"
on public.match_vote_usage
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "payments_select_own" on public.payment_orders;
create policy "payments_select_own"
on public.payment_orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "credits_select_own" on public.vote_credit_ledger;
create policy "credits_select_own"
on public.vote_credit_ledger
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "votes_select_own" on public.vote_events;
create policy "votes_select_own"
on public.vote_events
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.get_credit_balance(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select greatest(coalesce(sum(delta), 0), 0)::integer
  from public.vote_credit_ledger
  where user_id = p_user_id;
$$;

create or replace function public.cast_vote(
  p_user_id uuid,
  p_category_id text,
  p_match_id text,
  p_team_id text,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage public.match_vote_usage%rowtype;
  v_free_remaining integer;
  v_free_applied integer;
  v_paid_needed integer;
  v_credit_balance integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into v_usage
  from public.match_vote_usage
  where user_id = p_user_id
    and category_id = p_category_id
    and match_id = p_match_id
  for update;

  if not found then
    insert into public.match_vote_usage (user_id, category_id, match_id, free_votes_used)
    values (p_user_id, p_category_id, p_match_id, 0)
    returning * into v_usage;
  end if;

  v_free_remaining := greatest(0, 1 - v_usage.free_votes_used);
  v_free_applied := least(v_free_remaining, p_quantity);
  v_paid_needed := p_quantity - v_free_applied;
  v_credit_balance := public.get_credit_balance(p_user_id);

  if v_credit_balance < v_paid_needed then
    return jsonb_build_object(
      'ok', false,
      'code', 'PAYMENT_REQUIRED',
      'free_votes_remaining', v_free_remaining,
      'paid_votes_needed', v_paid_needed,
      'credit_balance', v_credit_balance,
      'missing_credits', v_paid_needed - v_credit_balance
    );
  end if;

  if v_free_applied > 0 then
    update public.match_vote_usage
    set
      free_votes_used = free_votes_used + v_free_applied,
      updated_at = now()
    where user_id = p_user_id
      and category_id = p_category_id
      and match_id = p_match_id;
  end if;

  if v_paid_needed > 0 then
    insert into public.vote_credit_ledger (
      user_id,
      delta,
      reason,
      metadata
    )
    values (
      p_user_id,
      -v_paid_needed,
      'vote_spend',
      jsonb_build_object(
        'category_id', p_category_id,
        'match_id', p_match_id,
        'team_id', p_team_id
      )
    );
  end if;

  insert into public.vote_events (
    user_id,
    category_id,
    match_id,
    team_id,
    quantity_total,
    quantity_free,
    quantity_paid
  )
  values (
    p_user_id,
    p_category_id,
    p_match_id,
    p_team_id,
    p_quantity,
    v_free_applied,
    v_paid_needed
  );

  return jsonb_build_object(
    'ok', true,
    'free_votes_used', v_usage.free_votes_used + v_free_applied,
    'free_votes_remaining', greatest(0, 1 - (v_usage.free_votes_used + v_free_applied)),
    'paid_votes_used', v_paid_needed,
    'credit_balance', public.get_credit_balance(p_user_id)
  );
end;
$$;

create or replace function public.complete_payment(
  p_payment_order_id uuid,
  p_external_order_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_new_balance integer;
begin
  select *
  into v_order
  from public.payment_orders
  where id = p_payment_order_id
  for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  if v_order.status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'credit_balance', public.get_credit_balance(v_order.user_id)
    );
  end if;

  update public.payment_orders
  set
    status = 'paid',
    paid_at = now(),
    updated_at = now(),
    external_order_id = coalesce(p_external_order_id, external_order_id),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where id = p_payment_order_id;

  insert into public.vote_credit_ledger (
    user_id,
    payment_order_id,
    delta,
    reason,
    metadata
  )
  values (
    v_order.user_id,
    v_order.id,
    v_order.credits_to_grant,
    'payment_credit',
    jsonb_build_object(
      'provider', v_order.provider,
      'currency_code', v_order.currency_code
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  v_new_balance := public.get_credit_balance(v_order.user_id);

  return jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'credit_balance', v_new_balance
  );
end;
$$;
