-- HYU PREMIUM / optimized gallery thumbnails
-- Existing-project migration. Run once on the production Supabase project.

alter table public.artworks
  add column if not exists thumbnail text;

comment on column public.artworks.thumbnail is
  'Optimized 16:9 WebP used for gallery cards; original image remains in image and is loaded only for expanded artwork view.';
