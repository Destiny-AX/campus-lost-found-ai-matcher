create table if not exists public.lost_found_records (
  id text primary key,
  type text not null check (type in ('lost', 'found')),
  title text not null,
  category text not null,
  color text not null,
  location text not null,
  event_time text not null,
  contact text,
  description text,
  status text not null,
  image_data text,
  image_feature jsonb,
  semantic jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lost_found_records_created_at_idx
  on public.lost_found_records (created_at desc);

create index if not exists lost_found_records_type_idx
  on public.lost_found_records (type);
