-- schema.sql: run once in Supabase -> SQL Editor -> New query -> Run
-- Owner: Person 2. Tables follow CONTRACT.md.

create table if not exists topics (
  id                   integer primary key,
  domain               text    not null check (domain in (
                         'Cloud Concepts',
                         'Azure Architecture and Services',
                         'Azure Management and Governance')),
  title                text    not null,
  estimated_minutes    integer not null check (estimated_minutes between 30 and 60),
  learn_url            text,
  fallback_explanation text
);

create table if not exists plans (
  id            uuid primary key default gen_random_uuid(),
  exam_date     date not null,
  hours_per_day numeric(3,1) not null check (hours_per_day > 0 and hours_per_day <= 8),
  ratings       jsonb not null,
  created_at    timestamptz not null default now()
);

create table if not exists plan_tasks (
  id             bigint generated always as identity primary key,
  plan_id        uuid not null references plans(id) on delete cascade,
  topic_id       integer not null references topics(id),
  scheduled_date date not null,
  done           boolean not null default false,
  is_revision    boolean not null default false
);

create index if not exists plan_tasks_plan_id_idx on plan_tasks(plan_id);

-- HACKATHON DEMO ONLY: open policies for the public (anon) key, no login.
-- A real product would add user accounts and stricter rules.
alter table topics     enable row level security;
alter table plans      enable row level security;
alter table plan_tasks enable row level security;

drop policy if exists "demo read topics"  on topics;
drop policy if exists "demo read plans"   on plans;
drop policy if exists "demo add plans"    on plans;
drop policy if exists "demo read tasks"   on plan_tasks;
drop policy if exists "demo add tasks"    on plan_tasks;
drop policy if exists "demo update tasks" on plan_tasks;

create policy "demo read topics"  on topics     for select to anon using (true);
create policy "demo read plans"   on plans      for select to anon using (true);
create policy "demo add plans"    on plans      for insert to anon with check (true);
create policy "demo read tasks"   on plan_tasks for select to anon using (true);
create policy "demo add tasks"    on plan_tasks for insert to anon with check (true);
create policy "demo update tasks" on plan_tasks for update to anon using (true) with check (true);

-- ---------------------------------------------------------------
-- TEST DATA ONLY so the app works before Person 4's CSV arrives.
-- Delete these rows before importing the real topics.csv:
--   delete from topics;
-- ---------------------------------------------------------------
insert into topics (id, domain, title, estimated_minutes, learn_url, fallback_explanation) values
 (1, 'Cloud Concepts', 'What is cloud computing', 30, 'https://learn.microsoft.com/training/', 'TEST ONLY: replace with Person 4 content.'),
 (2, 'Cloud Concepts', 'Shared responsibility model', 45, 'https://learn.microsoft.com/training/', 'TEST ONLY: replace with Person 4 content.'),
 (3, 'Azure Architecture and Services', 'Regions and availability zones', 45, 'https://learn.microsoft.com/training/', 'TEST ONLY: replace with Person 4 content.'),
 (4, 'Azure Architecture and Services', 'Resource groups and subscriptions', 40, 'https://learn.microsoft.com/training/', 'TEST ONLY: replace with Person 4 content.'),
 (5, 'Azure Management and Governance', 'Role-based access control (RBAC)', 45, 'https://learn.microsoft.com/training/', 'TEST ONLY: replace with Person 4 content.'),
 (6, 'Azure Management and Governance', 'Azure Monitor and Service Health', 45, 'https://learn.microsoft.com/training/', 'TEST ONLY: replace with Person 4 content.')
on conflict (id) do nothing;
