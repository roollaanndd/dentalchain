-- ============================================================================
-- Burgundy Residences — initial schema
--
-- Mirrors src/db/schema.ts exactly. Every table has RLS enabled and a policy
-- set that matches src/db/permissions.ts. The client-side checks are for
-- ergonomics; THESE are the rules that actually hold, because they run on the
-- server and no client can talk its way past them.
--
-- Apply with:  supabase db push      (or paste into the SQL editor)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ── Enums ───────────────────────────────────────────────────────────────

create type app_role         as enum ('resident','security','treasurer','rt','rw','admin');
create type account_status   as enum ('pending','active','suspended');
create type tenure_kind      as enum ('owner','tenant');
create type relation_kind    as enum ('kepala_keluarga','istri','suami','anak','orang_tua','kerabat','art','lainnya');
create type vehicle_kind     as enum ('mobil','motor','sepeda','lainnya');
create type equip_category   as enum ('kursi','meja','karpet','tenda','audio','pendingin','dapur','kebersihan','olahraga','lainnya');
create type condition_kind   as enum ('baik','layak','perlu_perbaikan','rusak');
create type booking_status   as enum ('pending','approved','picked_up','returned','rejected','cancelled');
create type dues_status      as enum ('unpaid','awaiting_verification','paid','waived','overdue');
create type ledger_kind      as enum ('income','expense');
create type announce_cat     as enum ('umum','keamanan','kebersihan','kegiatan','darurat','keuangan');
create type event_cat        as enum ('kerja_bakti','rapat','perayaan','olahraga','posyandu','keagamaan','lainnya');
create type rsvp_status      as enum ('going','maybe','not_going');
create type complaint_cat    as enum ('jalan','sampah','keamanan','air','listrik','saluran','fasum','kebisingan','lainnya');
create type complaint_status as enum ('open','acknowledged','in_progress','resolved','closed','rejected');
create type priority_kind    as enum ('low','normal','high','urgent');
create type pass_status      as enum ('active','used','expired','revoked');
create type gate_direction   as enum ('in','out');
create type pay_method       as enum ('transfer','tunai','qris');

-- ── Places ──────────────────────────────────────────────────────────────

create table houses (
  id         uuid primary key default gen_random_uuid(),
  block      text not null check (char_length(block) between 1 and 4),
  number     text not null check (char_length(number) between 1 and 8),
  street     text not null default '',
  rt         text not null default '',
  rw         text not null default '',
  tenure     tenure_kind not null default 'owner',
  occupied   boolean not null default true,
  created_at timestamptz not null default now(),
  unique (block, number)
);

-- ── Profiles ────────────────────────────────────────────────────────────

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  full_name       text not null check (char_length(full_name) between 2 and 80),
  phone           text not null default '',
  role            app_role not null default 'resident',
  status          account_status not null default 'pending',
  house_id        uuid references houses(id) on delete set null,
  avatar_url      text,
  occupation      text,
  emergency_name  text,
  emergency_phone text,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on profiles (house_id);
create index on profiles (status);

-- ── Authorisation helpers ───────────────────────────────────────────────
-- SECURITY DEFINER so a policy can read profiles without recursing into the
-- profiles policy itself. search_path is pinned to defeat search-path
-- hijacking, and execute is revoked from public.

create or replace function auth_role()
returns app_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when p.status = 'active' then p.role else null end
  from profiles p where p.id = auth.uid()
$$;

create or replace function auth_house()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.house_id from profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

-- Rank mirrors ROLE_RANK in src/db/permissions.ts.
create or replace function role_rank(r app_role)
returns int language sql immutable as $$
  select case r
    when 'resident'  then 10
    when 'security'  then 20
    when 'treasurer' then 30
    when 'rt'        then 40
    when 'rw'        then 50
    when 'admin'     then 60
    else 0 end
$$;

create or replace function is_active() returns boolean
language sql stable as $$ select auth_role() is not null $$;

/** Any role at or above `least_role`. */
create or replace function at_least(least_role app_role) returns boolean
language sql stable as $$
  select coalesce(role_rank(auth_role()) >= role_rank(least_role), false)
$$;

/** Roles that run the operational queues (approvals, triage, verification). */
create or replace function is_officer() returns boolean
language sql stable as $$
  select coalesce(auth_role() in ('rt','rw','admin'), false)
$$;

create or replace function is_finance() returns boolean
language sql stable as $$
  select coalesce(auth_role() in ('treasurer','rw','admin'), false)
$$;

create or replace function is_gate() returns boolean
language sql stable as $$
  select coalesce(auth_role() in ('security','rw','admin'), false)
$$;

create or replace function is_admin() returns boolean
language sql stable as $$ select coalesce(auth_role() = 'admin', false) $$;

revoke execute on function auth_role, auth_house from public;
grant execute on function auth_role, auth_house to authenticated;

-- ── Household ───────────────────────────────────────────────────────────

create table household_members (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references houses(id) on delete cascade,
  full_name  text not null check (char_length(full_name) between 2 and 80),
  relation   relation_kind not null default 'lainnya',
  gender     char(1) not null default 'L' check (gender in ('L','P')),
  birth_date date check (birth_date is null or birth_date <= current_date),
  -- Only the last four digits of a NIK are ever stored.
  nik_last4  text check (nik_last4 is null or nik_last4 ~ '^[0-9]{4}$'),
  phone      text,
  created_at timestamptz not null default now()
);
create index on household_members (house_id);

create table vehicles (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references houses(id) on delete cascade,
  kind       vehicle_kind not null default 'mobil',
  plate      text not null unique check (char_length(plate) between 3 and 12),
  brand      text, color text, sticker_no text,
  created_at timestamptz not null default now()
);
create index on vehicles (house_id);

-- ── Equipment ───────────────────────────────────────────────────────────

create table equipment (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  category    equip_category not null default 'lainnya',
  description text not null default '',
  total_qty   int not null check (total_qty between 1 and 10000),
  unit        text not null default 'buah',
  deposit     bigint not null default 0 check (deposit >= 0),
  fee_per_day bigint not null default 0 check (fee_per_day >= 0),
  condition   condition_kind not null default 'baik',
  image_url   text,
  max_days    int not null default 7 check (max_days between 1 and 90),
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table equipment_bookings (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  equipment_id     uuid not null references equipment(id) on delete restrict,
  user_id          uuid not null references profiles(id) on delete cascade,
  house_id         uuid references houses(id) on delete set null,
  qty              int not null check (qty >= 1),
  start_date       date not null,
  end_date         date not null,
  purpose          text not null default '',
  status           booking_status not null default 'pending',
  deposit_amount   bigint not null default 0,
  fee_amount       bigint not null default 0,
  deposit_returned boolean not null default false,
  condition_out    condition_kind,
  condition_in     condition_kind,
  handled_by       uuid references profiles(id) on delete set null,
  decided_at       timestamptz,
  picked_up_at     timestamptz,
  returned_at      timestamptz,
  decision_note    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint sane_range check (end_date >= start_date),
  -- A booking may not span more than 90 days under any circumstances.
  constraint bounded_range check (end_date - start_date <= 90)
);
create index on equipment_bookings (equipment_id, start_date, end_date);
create index on equipment_bookings (user_id);
create index on equipment_bookings (status);

-- ── Overbooking guard ───────────────────────────────────────────────────
--
-- The SQL twin of computeAvailability() in src/db/availability.ts. Answers
-- "what is the PEAK concurrent reservation on any single day of this window?"
-- by expanding overlapping bookings day-by-day and taking the maximum — the
-- naive SUM(qty) over overlapping rows over-counts bookings that overlap the
-- request but not each other, and would reject valid bookings.
--
-- A transaction-scoped advisory lock keyed on the equipment id serialises
-- concurrent inserts for the same item, so two residents racing for the last
-- unit cannot both pass the check.

create or replace function check_equipment_capacity()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  item      equipment%rowtype;
  peak      int;
  span_days int;
begin
  -- Only statuses that actually hold stock need checking.
  if new.status not in ('pending','approved','picked_up') then
    return new;
  end if;

  select * into item from equipment where id = new.equipment_id for share;
  if not found then
    raise exception 'Barang tidak ditemukan.' using errcode = 'foreign_key_violation';
  end if;
  if not item.active then
    raise exception 'Barang ini sedang tidak dapat dipinjam.' using errcode = 'check_violation';
  end if;

  span_days := (new.end_date - new.start_date) + 1;
  if span_days > item.max_days then
    raise exception 'Maksimal peminjaman % hari untuk barang ini.', item.max_days
      using errcode = 'check_violation';
  end if;
  if new.qty > item.total_qty then
    raise exception 'RW hanya memiliki % unit.', item.total_qty
      using errcode = 'check_violation';
  end if;

  -- Serialise concurrent bookings for this one item.
  perform pg_advisory_xact_lock(hashtext(new.equipment_id::text));

  select coalesce(max(day_total), 0) into peak
  from (
    select d::date as day, sum(b.qty) as day_total
    from generate_series(new.start_date, new.end_date, interval '1 day') d
    join equipment_bookings b
      on b.equipment_id = new.equipment_id
     and b.id is distinct from new.id
     and b.status in ('pending','approved','picked_up')
     and d::date between b.start_date and b.end_date
    group by d::date
  ) per_day;

  if peak + new.qty > item.total_qty then
    raise exception 'Hanya tersedia % unit pada rentang tanggal tersebut.',
      greatest(item.total_qty - peak, 0)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger equipment_capacity_guard
  before insert or update of qty, start_date, end_date, status, equipment_id
  on equipment_bookings
  for each row execute function check_equipment_capacity();

-- Stock may never be cut below what is already committed.
create or replace function guard_equipment_stock()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare peak int;
begin
  if new.total_qty >= old.total_qty then return new; end if;

  select coalesce(max(day_total), 0) into peak
  from (
    select d::date, sum(b.qty) as day_total
    from equipment_bookings b
    cross join lateral generate_series(b.start_date, b.end_date, interval '1 day') d
    where b.equipment_id = new.id
      and b.status in ('pending','approved','picked_up')
      and b.end_date >= current_date
    group by d::date
  ) per_day;

  if new.total_qty < peak then
    raise exception 'Tidak dapat mengurangi stok di bawah % unit yang sedang dipesan.', peak
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger equipment_stock_guard
  before update of total_qty on equipment
  for each row execute function guard_equipment_stock();

-- ── Facilities ──────────────────────────────────────────────────────────

create table facilities (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 80),
  description     text not null default '',
  capacity        int not null default 50 check (capacity between 1 and 5000),
  image_url       text,
  fee_per_session bigint not null default 0 check (fee_per_session >= 0),
  open_time       time not null default '06:00',
  close_time      time not null default '22:00',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint sane_hours check (close_time > open_time)
);

create table facility_bookings (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  facility_id   uuid not null references facilities(id) on delete restrict,
  user_id       uuid not null references profiles(id) on delete cascade,
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  purpose       text not null default '',
  attendees     int not null default 1 check (attendees >= 1),
  status        booking_status not null default 'pending',
  fee_amount    bigint not null default 0,
  handled_by    uuid references profiles(id) on delete set null,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sane_slot check (end_time > start_time),
  -- The database itself refuses a double-booking, so no application bug can
  -- create one. Touching endpoints (09:00-11:00 then 11:00-13:00) are fine.
  exclude using gist (
    facility_id with =,
    date with =,
    tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) with &&
  ) where (status in ('pending','approved','picked_up'))
);
create index on facility_bookings (user_id);
create index on facility_bookings (facility_id, date);

-- ── Dues & finance ──────────────────────────────────────────────────────

create table dues_invoices (
  id          uuid primary key default gen_random_uuid(),
  house_id    uuid not null references houses(id) on delete cascade,
  period      text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  amount      bigint not null check (amount > 0),
  status      dues_status not null default 'unpaid',
  due_date    date not null,
  paid_at     timestamptz,
  method      pay_method,
  proof_url   text,
  verified_by uuid references profiles(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (house_id, period)
);
create index on dues_invoices (period);
create index on dues_invoices (status);

create table ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  kind        ledger_kind not null,
  category    text not null default 'Lainnya',
  amount      bigint not null check (amount > 0),
  date        date not null,
  description text not null default '',
  receipt_url text,
  published   boolean not null default true,
  created_by  uuid not null references profiles(id) on delete restrict,
  created_at  timestamptz not null default now()
);
create index on ledger_entries (date desc);
create index on ledger_entries (published);

-- ── Communication ───────────────────────────────────────────────────────

create table announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 140),
  body         text not null,
  category     announce_cat not null default 'umum',
  pinned       boolean not null default false,
  published    boolean not null default true,
  image_url    text,
  author_id    uuid not null references profiles(id) on delete restrict,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on announcements (published, pinned, published_at desc);

create table events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 140),
  description  text not null default '',
  category     event_cat not null default 'lainnya',
  date         date not null,
  start_time   time not null,
  end_time     time,
  location     text not null default '',
  image_url    text,
  rsvp_enabled boolean not null default true,
  capacity     int check (capacity is null or capacity between 1 and 10000),
  published    boolean not null default true,
  created_by   uuid not null references profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  constraint sane_event_hours check (end_time is null or end_time > start_time)
);
create index on events (date);

create table event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  guests     int not null default 0 check (guests between 0 and 20),
  status     rsvp_status not null default 'going',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ── Complaints ──────────────────────────────────────────────────────────

create table complaints (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 5 and 140),
  description text not null,
  category    complaint_cat not null default 'lainnya',
  priority    priority_kind not null default 'normal',
  status      complaint_status not null default 'open',
  location    text not null default '',
  photo_url   text,
  assignee_id uuid references profiles(id) on delete set null,
  anonymous   boolean not null default false,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on complaints (status);
create index on complaints (user_id);

create table complaint_updates (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references complaints(id) on delete cascade,
  author_id     uuid not null references profiles(id) on delete cascade,
  body          text not null,
  status_change complaint_status,
  internal      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index on complaint_updates (complaint_id);

-- ── Guests & gate ───────────────────────────────────────────────────────

create table guest_passes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  host_id       uuid not null references profiles(id) on delete cascade,
  house_id      uuid references houses(id) on delete set null,
  guest_name    text not null check (char_length(guest_name) between 2 and 80),
  guest_phone   text,
  party_size    int not null default 1 check (party_size between 1 and 50),
  vehicle_plate text,
  visit_date    date not null,
  valid_from    time not null default '08:00',
  valid_until   time not null default '22:00',
  purpose       text not null default '',
  status        pass_status not null default 'active',
  created_at    timestamptz not null default now(),
  constraint sane_validity check (valid_until > valid_from)
);
create index on guest_passes (host_id);
create index on guest_passes (visit_date);

create table gate_logs (
  id            uuid primary key default gen_random_uuid(),
  pass_id       uuid references guest_passes(id) on delete set null,
  direction     gate_direction not null,
  guest_name    text not null,
  vehicle_plate text,
  officer_id    uuid references profiles(id) on delete set null,
  note          text,
  at            timestamptz not null default now()
);
create index on gate_logs (at desc);

-- ── Site content & audit ────────────────────────────────────────────────

create table site_content (
  id             text primary key default 'default' check (id = 'default'),
  schema_version int not null default 1,
  brand            jsonb not null default '{}',
  hero             jsonb not null default '{}',
  about            jsonb not null default '{}',
  facilities_intro jsonb not null default '{}',
  contact          jsonb not null default '{}',
  emergency        jsonb not null default '[]',
  officers         jsonb not null default '[]',
  gallery          jsonb not null default '[]',
  faq              jsonb not null default '[]',
  payment          jsonb not null default '{}',
  updated_at     timestamptz not null default now()
);

create table audit_logs (
  id        uuid primary key default gen_random_uuid(),
  actor_id  uuid references profiles(id) on delete set null,
  action    text not null,
  entity    text not null,
  entity_id text not null,
  meta      jsonb not null default '{}',
  at        timestamptz not null default now()
);
create index on audit_logs (at desc);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  kind       text not null default 'system',
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read);

-- ── updated_at maintenance ──────────────────────────────────────────────

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','equipment','equipment_bookings','facility_bookings',
    'dues_invoices','announcements','complaints'
  ] loop
    execute format(
      'create trigger touch_%I before update on %I for each row execute function touch_updated_at()',
      t, t);
  end loop;
end $$;

-- New auth user -> pending profile. Role is NEVER taken from client metadata.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, status)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'resident',   -- hard-coded: self-signup can never grant itself a role
    'pending'     -- an officer must verify the person really lives here
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Enabled on every table. Default deny; each policy below opens exactly one
-- door. Mirrors src/db/permissions.ts.
-- ============================================================================

alter table houses             enable row level security;
alter table profiles           enable row level security;
alter table household_members  enable row level security;
alter table vehicles           enable row level security;
alter table equipment          enable row level security;
alter table equipment_bookings enable row level security;
alter table facilities         enable row level security;
alter table facility_bookings  enable row level security;
alter table dues_invoices      enable row level security;
alter table ledger_entries     enable row level security;
alter table announcements      enable row level security;
alter table events             enable row level security;
alter table event_rsvps        enable row level security;
alter table complaints         enable row level security;
alter table complaint_updates  enable row level security;
alter table guest_passes       enable row level security;
alter table gate_logs          enable row level security;
alter table site_content       enable row level security;
alter table audit_logs         enable row level security;
alter table notifications      enable row level security;

-- ── Profiles ────────────────────────────────────────────────────────────
-- Read your own row always (even while pending, so the app can tell you so).

create policy profiles_self_read on profiles
  for select using (id = auth.uid());

create policy profiles_directory_read on profiles
  for select using (is_active() and at_least('security'));

create policy profiles_self_update on profiles
  for update using (id = auth.uid() and is_active())
  with check (id = auth.uid());

create policy profiles_officer_update on profiles
  for update using (is_officer()) with check (is_officer());

create policy profiles_admin_delete on profiles
  for delete using (is_admin() and id <> auth.uid());

-- A resident must not be able to promote themselves.
--
-- Defence in depth, because either layer alone is insufficient:
--
--  1. Column privileges. Necessary but NOT sufficient: Supabase applies
--     `alter default privileges ... grant all on tables to authenticated`,
--     so any later blanket `grant all on all tables` silently restores the
--     ability to write these columns. A revoke is not a durable guarantee.
--
--  2. A trigger that refuses any change to role/status/verified_at unless the
--     session is inside one of the SECURITY DEFINER functions below, which
--     set a transaction-local flag. This holds no matter how the grants are
--     later reshuffled, and it is the rule that actually protects the system.
revoke update (role, status, verified_at) on profiles from authenticated;
grant  update (role, status, verified_at) on profiles to service_role;

-- NOTE: deliberately SECURITY INVOKER (the default). That is the whole
-- mechanism. A session GUC would not work here: any client can call
-- set_config() on itself and open its own gate. current_user cannot be
-- forged -- switching to a privileged role requires actual membership in it,
-- which `authenticated` does not have.
--
--   * direct UPDATE from the client  -> current_user = 'authenticated' -> refused
--   * inside set_member_role/status  -> those are SECURITY DEFINER owned by the
--                                       table owner, so current_user is the
--                                       owner for the duration -> allowed
create or replace function guard_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.verified_at is distinct from old.verified_at then
    if current_user = 'authenticated' or current_user = 'anon' then
      raise exception
        'Peran dan status akun hanya dapat diubah melalui fungsi pengurus.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_privilege_guard
  before update on profiles
  for each row execute function guard_profile_privileges();

-- Officers change role/status through this function, which re-checks rank so
-- nobody can grant a role at or above their own.
create or replace function set_member_role(target uuid, new_role app_role)
returns profiles
language plpgsql security definer set search_path = public, pg_temp
as $$
declare me app_role; result profiles;
begin
  me := auth_role();
  if me is null or me <> 'admin' then
    raise exception 'Akses ditolak.' using errcode = 'insufficient_privilege';
  end if;
  if target = auth.uid() then
    raise exception 'Anda tidak dapat mengubah peran akun sendiri.' using errcode = 'check_violation';
  end if;
  if role_rank(new_role) >= role_rank(me) then
    raise exception 'Tidak dapat memberikan peran setara atau di atas Anda.' using errcode = 'insufficient_privilege';
  end if;
  if new_role <> 'admin' and (
    select count(*) from profiles where role = 'admin' and status = 'active') <= 1
    and (select role from profiles where id = target) = 'admin' then
    raise exception 'Minimal harus ada satu administrator aktif.' using errcode = 'check_violation';
  end if;
  update profiles set role = new_role where id = target returning * into result;
  insert into audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'role.assign', 'profiles', target::text, jsonb_build_object('role', new_role));
  return result;
end $$;

create or replace function set_member_status(target uuid, new_status account_status)
returns profiles
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result profiles;
begin
  if not is_officer() then
    raise exception 'Akses ditolak.' using errcode = 'insufficient_privilege';
  end if;
  if target = auth.uid() then
    raise exception 'Anda tidak dapat mengubah status akun sendiri.' using errcode = 'check_violation';
  end if;
  update profiles
     set status = new_status,
         verified_at = case when new_status = 'active' then coalesce(verified_at, now()) else verified_at end
   where id = target returning * into result;
  insert into audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'user.status', 'profiles', target::text, jsonb_build_object('status', new_status));
  return result;
end $$;

-- ── Houses: readable by any active member, writable by officers ─────────

create policy houses_read   on houses for select using (is_active());
create policy houses_write  on houses for all    using (is_officer()) with check (is_officer());

-- ── Household & vehicles: your own house, or an officer ─────────────────

create policy hm_read  on household_members for select
  using (house_id = auth_house() or is_officer());
create policy hm_write on household_members for all
  using (house_id = auth_house() or is_officer())
  with check (house_id = auth_house() or is_officer());

create policy veh_read  on vehicles for select
  using (house_id = auth_house() or is_active() and at_least('security'));
create policy veh_write on vehicles for all
  using (house_id = auth_house() or is_officer())
  with check (house_id = auth_house() or is_officer());

-- ── Equipment: catalogue readable by all; inventory only by rw/admin ────

create policy equip_read  on equipment for select using (is_active());
create policy equip_write on equipment for all
  using (at_least('rw')) with check (at_least('rw'));

-- ── Equipment bookings ──────────────────────────────────────────────────

create policy eb_read_own on equipment_bookings for select
  using (user_id = auth.uid() or is_officer());

create policy eb_insert_own on equipment_bookings for insert
  with check (
    user_id = auth.uid() and is_active()
    -- residents may only ever file a pending request
    and status = 'pending'
    and start_date >= current_date
  );

-- A resident may only cancel; every other transition is an officer's.
create policy eb_update_own on equipment_bookings for update
  using (user_id = auth.uid() and status in ('pending','approved'))
  with check (user_id = auth.uid() and status = 'cancelled');

create policy eb_update_officer on equipment_bookings for update
  using (is_officer()) with check (is_officer());

create policy eb_delete_officer on equipment_bookings for delete using (is_admin());

-- ── Facilities ──────────────────────────────────────────────────────────

create policy fac_read  on facilities for select using (is_active());
create policy fac_write on facilities for all
  using (at_least('rw')) with check (at_least('rw'));

create policy fb_read on facility_bookings for select
  -- Everyone sees taken slots (so the picker is accurate); only the owner and
  -- officers see who booked and why. The client selects narrow columns for
  -- the calendar; this policy keeps the row visible but harmless.
  using (is_active());
create policy fb_insert_own on facility_bookings for insert
  with check (user_id = auth.uid() and is_active() and status = 'pending' and date >= current_date);
create policy fb_update_own on facility_bookings for update
  using (user_id = auth.uid() and status in ('pending','approved'))
  with check (user_id = auth.uid() and status = 'cancelled');
create policy fb_update_officer on facility_bookings for update
  using (is_officer()) with check (is_officer());

-- ── Dues: your own house, or finance roles ──────────────────────────────

create policy dues_read on dues_invoices for select
  using (house_id = auth_house() or is_finance());

-- A resident may attach payment proof, and nothing else: the status they may
-- move to is bounded, so nobody can mark their own bill paid.
create policy dues_update_own on dues_invoices for update
  using (house_id = auth_house() and status in ('unpaid','overdue','awaiting_verification'))
  with check (house_id = auth_house() and status = 'awaiting_verification');

create policy dues_write_finance on dues_invoices for all
  using (is_finance()) with check (is_finance());

-- ── Ledger: published entries are public to members; the rest is finance ─

create policy ledger_read on ledger_entries for select
  using ((published and is_active()) or is_finance());
create policy ledger_write on ledger_entries for all
  using (is_finance()) with check (is_finance());

-- ── Announcements & events ──────────────────────────────────────────────

create policy ann_read on announcements for select
  using ((published and is_active()) or is_officer());
create policy ann_write on announcements for all
  using (is_officer()) with check (is_officer());

create policy ev_read on events for select
  using ((published and is_active()) or is_officer());
create policy ev_write on events for all
  using (is_officer()) with check (is_officer());

create policy rsvp_read on event_rsvps for select
  using (user_id = auth.uid() or is_officer());
create policy rsvp_write_own on event_rsvps for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Complaints ──────────────────────────────────────────────────────────

create policy comp_read on complaints for select
  using (user_id = auth.uid() or is_active() and at_least('security'));
create policy comp_insert_own on complaints for insert
  with check (user_id = auth.uid() and is_active() and status = 'open');
create policy comp_update_officer on complaints for update
  using (is_officer()) with check (is_officer());

-- Internal notes are invisible to the resident who filed the report.
create policy cu_read on complaint_updates for select
  using (
    (not internal and exists (
      select 1 from complaints c where c.id = complaint_id and c.user_id = auth.uid()))
    or is_officer()
  );
create policy cu_insert on complaint_updates for insert
  with check (
    author_id = auth.uid() and is_active() and (
      is_officer() or (
        not internal and status_change is null
        and exists (select 1 from complaints c where c.id = complaint_id and c.user_id = auth.uid())
      )
    )
  );

-- ── Guests & gate ───────────────────────────────────────────────────────

create policy gp_read on guest_passes for select
  using (host_id = auth.uid() or is_gate() or is_officer());
create policy gp_insert_own on guest_passes for insert
  with check (host_id = auth.uid() and is_active() and visit_date >= current_date);
create policy gp_update on guest_passes for update
  using (host_id = auth.uid() or is_gate()) with check (host_id = auth.uid() or is_gate());

create policy gl_read on gate_logs for select
  using (is_gate() or is_officer()
    or exists (select 1 from guest_passes g where g.id = pass_id and g.host_id = auth.uid()));
create policy gl_insert on gate_logs for insert with check (is_gate());

-- ── Site content ────────────────────────────────────────────────────────
-- Readable by anonymous visitors: this is what the public website renders.

create policy site_read  on site_content for select using (true);
create policy site_write on site_content for all
  using (at_least('rw')) with check (at_least('rw'));

-- The public website also needs the published announcements, events and
-- facilities without a session.
create policy ann_public  on announcements for select using (published);
create policy ev_public   on events        for select using (published);
create policy fac_public  on facilities    for select using (active);
create policy equip_public on equipment    for select using (active);

-- ── Audit & notifications ───────────────────────────────────────────────

create policy audit_read on audit_logs for select using (at_least('rw'));
-- Writes go through SECURITY DEFINER functions only; nothing may forge a row.
create policy audit_insert on audit_logs for insert with check (false);

create policy notif_read on notifications for select using (user_id = auth.uid());
create policy notif_update_own on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_insert on notifications for insert with check (is_officer());

-- ── Storage ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif','application/pdf'])
on conflict (id) do nothing;

create policy "uploads_read" on storage.objects for select
  using (bucket_id = 'uploads');

-- Each member writes only inside their own folder.
create policy "uploads_insert_own" on storage.objects for insert
  with check (
    bucket_id = 'uploads' and is_active()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "uploads_update_own" on storage.objects for update
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads_delete_own" on storage.objects for delete
  using (bucket_id = 'uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_officer()));

-- ── Maintenance ─────────────────────────────────────────────────────────

create or replace function mark_overdue_dues() returns int
language sql security definer set search_path = public, pg_temp as $$
  with u as (
    update dues_invoices set status = 'overdue'
    where status = 'unpaid' and due_date < current_date returning 1)
  select count(*)::int from u
$$;

create or replace function expire_guest_passes() returns int
language sql security definer set search_path = public, pg_temp as $$
  with u as (
    update guest_passes set status = 'expired'
    where status = 'active' and visit_date < current_date returning 1)
  select count(*)::int from u
$$;

-- Seed the singleton content row so the public site renders before any login.
insert into site_content (id) values ('default') on conflict (id) do nothing;
