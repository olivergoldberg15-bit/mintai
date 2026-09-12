-- Tutor Mint schema. Already applied to the linked project; kept here so the
-- database can be rebuilt from scratch. Every table is per-user and locked
-- down with row-level security.

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  grade        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.tutor_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  mode       text not null default 'guide' check (mode in ('guide','explain')),
  source     text not null default 'chat' check (source in ('scan','chat','voice')),
  subject    text,
  title      text,
  problem    text,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  subject    text,
  due_on     date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  subject    text,
  cards      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  subject    text,
  questions  jsonb not null default '[]'::jsonb,
  score      integer,
  total      integer,
  created_at timestamptz not null default now()
);

create table if not exists public.recaps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  subject    text,
  summary    text,
  points     jsonb not null default '[]'::jsonb,
  terms      jsonb not null default '[]'::jsonb,
  transcript text,
  created_at timestamptz not null default now()
);

create index if not exists tutor_sessions_user_idx  on public.tutor_sessions (user_id, created_at desc);
create index if not exists tasks_user_idx           on public.tasks (user_id, due_on);
create index if not exists flashcard_sets_user_idx  on public.flashcard_sets (user_id, created_at desc);
create index if not exists quizzes_user_idx         on public.quizzes (user_id, created_at desc);
create index if not exists recaps_user_idx          on public.recaps (user_id, created_at desc);

-- Give every new signup a profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Only the trigger should ever call it — not anonymous PostgREST callers.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles       enable row level security;
alter table public.tutor_sessions enable row level security;
alter table public.tasks          enable row level security;
alter table public.flashcard_sets enable row level security;
alter table public.quizzes        enable row level security;
alter table public.recaps         enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own sessions" on public.tutor_sessions;
create policy "own sessions" on public.tutor_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own decks" on public.flashcard_sets;
create policy "own decks" on public.flashcard_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own quizzes" on public.quizzes;
create policy "own quizzes" on public.quizzes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own recaps" on public.recaps;
create policy "own recaps" on public.recaps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profile pictures.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "avatars are public" on storage.objects;
create policy "avatars are public" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "own avatar upload" on storage.objects;
create policy "own avatar upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
