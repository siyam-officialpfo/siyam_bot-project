-- NU 404 BOT Portal
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Admin and user profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Public guides, downloads, reports and announcements
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  content text,
  type text not null
    check (type in ('guide', 'download', 'report', 'announcement')),
  file_url text,
  file_path text,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Public support requests
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  bot_version text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'solved')),
  created_at timestamptz not null default now()
);

-- Automatically create a normal user profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin check function
create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.resources enable row level security;
alter table public.support_tickets enable row level security;

-- Profiles: users can only read their own profile.
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or public.is_portal_admin());

-- Profiles: admins can update profiles.
drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles"
on public.profiles
for update
to authenticated
using (public.is_portal_admin())
with check (public.is_portal_admin());

-- Resources: public visitors can read published resources.
drop policy if exists "Public read published resources" on public.resources;
create policy "Public read published resources"
on public.resources
for select
to anon, authenticated
using (is_published = true or public.is_portal_admin());

-- Resources: only admins can create, update or delete.
drop policy if exists "Admins insert resources" on public.resources;
create policy "Admins insert resources"
on public.resources
for insert
to authenticated
with check (public.is_portal_admin());

drop policy if exists "Admins update resources" on public.resources;
create policy "Admins update resources"
on public.resources
for update
to authenticated
using (public.is_portal_admin())
with check (public.is_portal_admin());

drop policy if exists "Admins delete resources" on public.resources;
create policy "Admins delete resources"
on public.resources
for delete
to authenticated
using (public.is_portal_admin());

-- Anyone can submit a support ticket.
drop policy if exists "Anyone submit support ticket" on public.support_tickets;
create policy "Anyone submit support ticket"
on public.support_tickets
for insert
to anon, authenticated
with check (
  length(trim(name)) between 1 and 100
  and length(trim(email)) between 3 and 200
  and length(trim(subject)) between 1 and 150
  and length(trim(message)) between 10 and 5000
  and status = 'pending'
);

-- Only admins can read and manage tickets.
drop policy if exists "Admins read support tickets" on public.support_tickets;
create policy "Admins read support tickets"
on public.support_tickets
for select
to authenticated
using (public.is_portal_admin());

drop policy if exists "Admins update support tickets" on public.support_tickets;
create policy "Admins update support tickets"
on public.support_tickets
for update
to authenticated
using (public.is_portal_admin())
with check (public.is_portal_admin());

drop policy if exists "Admins delete support tickets" on public.support_tickets;
create policy "Admins delete support tickets"
on public.support_tickets
for delete
to authenticated
using (public.is_portal_admin());

-- Public file bucket for downloadable portal resources.
insert into storage.buckets (id, name, public, file_size_limit)
values ('portal-files', 'portal-files', true, 52428800)
on conflict (id) do update
set public = true,
    file_size_limit = 52428800;

-- Public can read files from the public bucket.
drop policy if exists "Public read portal files" on storage.objects;
create policy "Public read portal files"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'portal-files');

-- Only admins can upload files.
drop policy if exists "Admins upload portal files" on storage.objects;
create policy "Admins upload portal files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'portal-files'
  and public.is_portal_admin()
);

-- Only admins can update or delete files.
drop policy if exists "Admins update portal files" on storage.objects;
create policy "Admins update portal files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'portal-files'
  and public.is_portal_admin()
)
with check (
  bucket_id = 'portal-files'
  and public.is_portal_admin()
);

drop policy if exists "Admins delete portal files" on storage.objects;
create policy "Admins delete portal files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'portal-files'
  and public.is_portal_admin()
);
