-- HYU PREMIUM: Vietnamese skin property
-- Safe to run more than once.

alter table public.artworks
  add column if not exists is_vietnamese_skin boolean not null default false;

create index if not exists artworks_visible_vietnamese_skin_idx
  on public.artworks (is_vietnamese_skin)
  where hidden = false;
