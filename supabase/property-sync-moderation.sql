-- HYU PREMIUM / Owner property synchronization and moderation deduplication
-- Applied to the OWNER Supabase project.

create unique index if not exists categories_name_normalized_key
  on public.categories ((lower(btrim(name))));

create unique index if not exists image_credits_name_normalized_key
  on public.image_credits ((lower(btrim(name))));

create unique index if not exists ranks_name_normalized_key
  on public.ranks ((lower(btrim(name))));

create or replace function public.moderation_decide_publish_request(
  p_request_id uuid,
  p_decision text,
  p_decided_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.publish_requests%rowtype;
  v_name text;
  v_rank_order integer;
  v_now timestamptz := now();
begin
  if p_decision not in ('approved','declined') then
    raise exception 'Decision must be approved or declined.';
  end if;

  select * into req
  from public.publish_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Publish request not found.';
  end if;

  if req.status <> 'pending' then
    raise exception 'Request is already %.', req.status;
  end if;

  if p_decision = 'approved' then
    v_name := nullif(btrim(req.metadata->>'category_name'), '');
    if v_name is not null and not exists (
      select 1 from public.categories where lower(btrim(name)) = lower(v_name)
    ) then
      insert into public.categories(name) values (v_name) on conflict do nothing;
    end if;

    v_name := nullif(btrim(req.metadata->>'credit_name'), '');
    if v_name is not null and not exists (
      select 1 from public.image_credits where lower(btrim(name)) = lower(v_name)
    ) then
      insert into public.image_credits(name) values (v_name) on conflict do nothing;
    end if;

    v_name := nullif(btrim(req.metadata->>'rank_name'), '');
    if v_name is not null and not exists (
      select 1 from public.ranks where lower(btrim(name)) = lower(v_name)
    ) then
      select coalesce(max(sort_order), -1) + 1 into v_rank_order from public.ranks;
      insert into public.ranks(name, sort_order) values (v_name, v_rank_order) on conflict do nothing;
    end if;
  end if;

  update public.publish_requests
  set status = p_decision,
      decided_at = v_now,
      decided_by = p_decided_by
  where id = p_request_id;

  insert into public.publish_gates(
    source_profile,
    artwork_id,
    status,
    request_id,
    candidate_image,
    approved_image,
    updated_at
  ) values (
    req.source_profile,
    req.artwork_id,
    p_decision,
    req.id,
    req.candidate_image,
    case when p_decision = 'approved' then req.candidate_image else coalesce(req.previous_approved_image,'') end,
    v_now
  )
  on conflict (source_profile, artwork_id)
  do update set
    status = excluded.status,
    request_id = excluded.request_id,
    candidate_image = excluded.candidate_image,
    approved_image = excluded.approved_image,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'status', p_decision,
    'requestId', p_request_id,
    'propertiesSynced', p_decision = 'approved'
  );
end;
$$;

revoke all on function public.moderation_decide_publish_request(uuid,text,text) from public, anon, authenticated;
grant execute on function public.moderation_decide_publish_request(uuid,text,text) to service_role;
