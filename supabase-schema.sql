-- 拾寻 v2 数据库 Schema
-- 包含：用户表、扩展记录表、代保管点表、通知表、信用日志表
-- 兼容旧版：通过 ALTER TABLE 增量增加字段

-- ============== 用户表 ==============
create table if not exists public.shiyun_users (
  id text primary key,
  nickname text not null,
  avatar_url text default '',
  wechat_openid text default '',
  login_provider text default 'guest',
  is_verified boolean default false,
  real_name_hash text default '',
  credit_score int default 5,
  badges jsonb default '[]'::jsonb,
  is_institution boolean default false,
  institution_name text default '',
  created_at timestamptz default now()
);

create unique index if not exists shiyun_users_openid_idx
  on public.shiyun_users (wechat_openid)
  where wechat_openid <> '';

-- ============== 失物招领记录表（兼容旧版） ==============
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

-- v2 新增字段（如果不存在则添加）
alter table public.lost_found_records add column if not exists owner_id text;
alter table public.lost_found_records add column if not exists item_status text default 'unknown';
alter table public.lost_found_records add column if not exists custody_point_id text default '';
alter table public.lost_found_records add column if not exists pickup_code text default '';
alter table public.lost_found_records add column if not exists fuzzy_location text default '';
alter table public.lost_found_records add column if not exists fuzzy_time text default '';

create index if not exists lost_found_records_created_at_idx
  on public.lost_found_records (created_at desc);
create index if not exists lost_found_records_type_idx
  on public.lost_found_records (type);
create index if not exists lost_found_records_owner_idx
  on public.lost_found_records (owner_id);
create index if not exists lost_found_records_item_status_idx
  on public.lost_found_records (item_status);

-- ============== 代保管点表 ==============
create table if not exists public.shiyun_custody_points (
  id text primary key,
  name text not null,
  address text not null,
  lat numeric,
  lng numeric,
  type text check (type in ('convenience_store', 'locker', 'property_office', 'other')),
  operating_hours text,
  created_at timestamptz default now()
);

-- 种子数据
insert into public.shiyun_custody_points (id, name, address, lat, lng, type, operating_hours) values
  ('cp_001', '便利蜂·南京路店', '南京东路 588 号', 31.2356, 121.4794, 'convenience_store', '07:00-23:00'),
  ('cp_002', '丰巢智能柜·人民广场', '人民大道 200 号 B1', 31.2330, 121.4737, 'locker', '24h'),
  ('cp_003', '万科物业·城市花园', '长寿路 100 弄物业中心', 31.2495, 121.4416, 'property_office', '08:00-22:00'),
  ('cp_004', '全家·静安寺店', '南京西路 1568 号', 31.2235, 121.4493, 'convenience_store', '06:30-23:30'),
  ('cp_005', '丰巢智能柜·徐家汇地铁站', '肇嘉浜路 1000 号 1 号口', 31.1948, 121.4365, 'locker', '05:30-23:30')
on conflict (id) do nothing;

-- ============== 通知表 ==============
create table if not exists public.shiyun_notifications (
  id text primary key,
  user_id text default '',
  type text not null,
  title text not null,
  body text default '',
  related_record_id text default '',
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists shiyun_notifications_user_created_idx
  on public.shiyun_notifications (user_id, created_at desc);

-- ============== 信用日志表 ==============
create table if not exists public.shiyun_credit_logs (
  id text primary key,
  user_id text not null,
  action text not null,
  delta int not null,
  description text default '',
  created_at timestamptz default now()
);

create index if not exists shiyun_credit_logs_user_idx
  on public.shiyun_credit_logs (user_id, created_at desc);

-- ============== v3 升级：用户成长体系字段 ==============
alter table public.shiyun_users add column if not exists level int default 1;
alter table public.shiyun_users add column if not exists exp int default 0;
alter table public.shiyun_users add column if not exists total_published int default 0;
alter table public.shiyun_users add column if not exists total_helped int default 0;
alter table public.shiyun_users add column if not exists streak_days int default 0;
alter table public.shiyun_users add column if not exists last_active_date text default '';

-- ============== v3 升级：记录表地点结构化字段 ==============
alter table public.lost_found_records add column if not exists city text default '上海市';
alter table public.lost_found_records add column if not exists district text default '';
alter table public.lost_found_records add column if not exists street text default '';
alter table public.lost_found_records add column if not exists detail_location text default '';

-- ============== v3 升级：记录表认领相关字段 ==============
alter table public.lost_found_records add column if not exists claim_question text default '';
alter table public.lost_found_records add column if not exists claim_answer text default '';
alter table public.lost_found_records add column if not exists claimed_by text default '';
alter table public.lost_found_records add column if not exists claimed_at timestamptz;

-- ============== v3 升级：评价表 ==============
create table if not exists public.shiyun_reviews (
  id text primary key,
  record_id text not null,
  from_user_id text not null,
  to_user_id text not null,
  rating int check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz default now()
);

create index if not exists shiyun_reviews_record_idx on public.shiyun_reviews (record_id);
create index if not exists shiyun_reviews_to_user_idx on public.shiyun_reviews (to_user_id);

-- ============== v3 升级：认领申请表 ==============
create table if not exists public.shiyun_claim_requests (
  id text primary key,
  record_id text not null,
  claimant_id text not null,
  answer text default '',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create index if not exists shiyun_claim_requests_record_idx on public.shiyun_claim_requests (record_id);
create index if not exists shiyun_claim_requests_claimant_idx on public.shiyun_claim_requests (claimant_id);
