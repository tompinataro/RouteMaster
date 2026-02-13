-- Minimal schema for MVP

create table if not exists users (
  id serial primary key,
  email text unique not null,
  name text not null,
  password_hash text not null default '',
  role text not null default 'tech',
  created_at timestamptz not null default now(),
  must_change_password boolean not null default false,
  managed_password text,
  phone text
);

alter table users
  add column if not exists role text not null default 'tech',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists must_change_password boolean not null default false,
  add column if not exists managed_password text,
  add column if not exists phone text;

create table if not exists service_routes (
  id serial primary key,
  name text unique not null,
  user_id integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id serial primary key,
  name text not null,
  address text not null default '',
  city text,
  state text,
  zip text,
  contact_name text,
  contact_phone text,
  created_at timestamptz not null default now(),
  service_route_id integer references service_routes(id) on delete set null,
  latitude double precision,
  longitude double precision
);

alter table clients
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists service_route_id integer references service_routes(id) on delete set null,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Today's routes for a user (simple denormalized association for MVP)
create table if not exists routes_today (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  client_id integer not null references clients(id) on delete cascade,
  scheduled_time text not null
);

create unique index if not exists routes_today_client_idx on routes_today(client_id);

create table if not exists visits (
  id serial primary key,
  client_id integer not null references clients(id) on delete cascade,
  scheduled_time text not null
);

create table if not exists visit_checklist (
  visit_id integer not null references visits(id) on delete cascade,
  key text not null,
  label text not null,
  done boolean not null default false,
  primary key (visit_id, key)
);

create table if not exists visit_submissions (
  id serial primary key,
  visit_id integer not null references visits(id) on delete cascade,
  notes text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists timely_notes (
  id serial primary key,
  client_id integer not null references clients(id) on delete cascade,
  note text not null,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists timely_notes_client_active_idx on timely_notes(client_id) where active;

-- Visit state per day and user (Sprint 8)
create table if not exists visit_state (
  visit_id integer not null references visits(id) on delete cascade,
  date date not null,
  user_id integer not null references users(id) on delete cascade,
  status text not null check (status in ('in_progress','completed')),
  created_at timestamptz not null default now(),
  primary key (visit_id, date, user_id)
);

-- Daily start odometer per technician (for accurate mileage delta tracking)
create table if not exists daily_start_odometer (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  date date not null,
  odometer_reading numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);
