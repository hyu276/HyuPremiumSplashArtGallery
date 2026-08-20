# HYU PREMIUM Supabase migration

This repository is being migrated from GitHub JSON-as-a-database to Supabase while keeping Vercel as the public frontend host and GitHub as source control.

## Target architecture

- **Vercel**: public `index.html` and static assets.
- **Supabase Database**: artworks, categories, image credits, ranks, visibility.
- **Supabase Auth**: owner/admin login.
- **Supabase Storage**: future repository-independent artwork uploads.
- **GitHub**: source code and deployment history, not catalogue state.

## Safety rule during migration

Do not enable Supabase on the public site until the Admin Dashboard has also been switched to Supabase. Otherwise the public site and GitHub dashboard would write/read different sources of truth.

`assets/js/supabase-config.js` therefore starts with `enabled: false`.

## Step 1 — Create a Supabase project

Create a new Supabase project. Keep the database password private.

From **Project Settings / API**, copy only:

- Project URL
- Publishable key (or legacy anon key)

These browser keys are intended for client applications when RLS is enabled. Never put a `service_role` key in this repository or browser code.

## Step 2 — Create schema and RLS

Open **SQL Editor** and run the full contents of `supabase/schema.sql`.

This creates:

- `categories`
- `image_credits`
- `ranks`
- `artworks`
- `admins`
- RLS policies
- `artworks` Storage bucket

Public visitors can read only visible artworks. Authenticated users can write only when their Auth UUID exists in `public.admins`.

## Step 3 — Create the owner Auth user

In Supabase Dashboard → Authentication → Users, create the owner user with email/password.

Copy that user's UUID and run in SQL Editor:

```sql
insert into public.admins (user_id)
values ('YOUR_AUTH_USER_UUID')
on conflict do nothing;
```

## Step 4 — Configure this repository

Edit `assets/js/supabase-config.js`:

```js
window.HYU_SUPABASE_CONFIG = {
  enabled: false,
  url: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY'
};
```

Keep `enabled: false` until the Admin Dashboard migration is complete.

## Step 5 — Import the current GitHub catalogue

After configuring the URL/key, temporarily set `enabled: true`, open the unlinked migration page on GitHub Pages:

`/supabase/migrate.html`

Sign in using the Supabase owner account, then click **Import current catalogue**.

The importer reads the current `data/artworks.json` and `data/options.json`, preserves hidden entries, creates normalized choices, and upserts all artwork records into Supabase.

After the import, set `enabled: false` again until the Admin Dashboard has been converted.

## Step 6 — Next implementation phase

The next code change will convert `admin.html` from GitHub PAT writes to Supabase Auth + database/storage writes. After that is verified, switch `enabled: true` permanently and make the public gallery read Supabase first.

## Current image strategy

Phase 1 keeps the existing `image` value exactly as-is, including repository-relative `assets/artworks/...` paths and external URLs. This makes the database migration low-risk.

A later phase can move uploaded images into Supabase Storage without changing the metadata model.
