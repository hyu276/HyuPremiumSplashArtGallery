-- HYU PREMIUM / Cross-admin artwork publish moderation
-- Applied to the OWNER Supabase project.
-- Private requests are service-role only. Public catalogue reads only publish_gates,
-- which contains no requester email or user identity.

create table if not exists public.publish_requests (
  id uuid primary key default gen_random_uuid(),
  source_profile text not null,
  source_project_ref text not null,
  artwork_id text not null,
  requester_user_id uuid not null,
  requester_email text not null,
  artwork_name text not null default '',
  candidate_image text not null,
  upload_path text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','declined','superseded','cancelled')),
  previous_approved_image text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text not null default ''
);

create index if not exists publish_requests_status_created_idx
  on public.publish_requests(status, created_at desc);
create index if not exists publish_requests_requester_idx
  on public.publish_requests(requester_user_id, created_at desc);
create index if not exists publish_requests_artwork_idx
  on public.publish_requests(source_profile, artwork_id, created_at desc);

alter table public.publish_requests enable row level security;
revoke all on public.publish_requests from anon, authenticated;

create table if not exists public.publish_gates (
  source_profile text not null,
  artwork_id text not null,
  status text not null check (status in ('pending','approved','declined')),
  request_id uuid references public.publish_requests(id) on delete set null,
  candidate_image text not null default '',
  approved_image text not null default '',
  updated_at timestamptz not null default now(),
  primary key (source_profile, artwork_id)
);

create index if not exists publish_gates_status_idx
  on public.publish_gates(source_profile, status);

alter table public.publish_gates enable row level security;

drop policy if exists "public can read publish gates" on public.publish_gates;
create policy "public can read publish gates"
on public.publish_gates for select
to anon, authenticated
using (true);

grant select on public.publish_gates to anon, authenticated;
revoke insert, update, delete on public.publish_gates from anon, authenticated;
