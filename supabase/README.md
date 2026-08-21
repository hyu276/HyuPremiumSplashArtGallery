# HYU PREMIUM Supabase

HYU PREMIUM uses Supabase as the live data/auth/storage layer while GitHub remains source control and Vercel serves the public frontend.

## Current architecture

- **Vercel**: public Gallery, About Us, News and Blog pages.
- **GitHub Pages**: owner Admin Dashboard.
- **Supabase Database**: artworks, categories, image credits, ranks, team members and visibility.
- **Supabase Auth**: owner/admin login.
- **Supabase Storage**: `artworks` bucket for gallery uploads and `team` bucket for About Us portraits.
- **GitHub**: frontend/source history, not mutable catalogue state.

The browser Project URL and publishable/anon key are not secrets. Never put a `service_role` key, secret key, database password or admin password in this repository or browser code. RLS is the security boundary.

## Fresh project setup

Open Supabase Dashboard → **SQL Editor** and run the full contents of:

`supabase/schema.sql`

This creates:

- `categories`
- `image_credits`
- `ranks`
- `artworks`
- `team_members`
- `admins`
- RLS policies
- `artworks` Storage bucket
- `team` Storage bucket

Public visitors can read only visible artworks and visible team members. Authenticated writes are allowed only when the Auth UUID exists in `public.admins`.

## Existing project: add the Our Team feature

If the project already has the original HYU PREMIUM schema, do **not** recreate the project. Run this migration once instead:

`supabase/team-section.sql`

It adds only:

- `public.team_members`
- team-member RLS/grants
- updated-at trigger
- public `team` Storage bucket
- admin-only team image write policies

After the SQL succeeds, reload the Admin Dashboard. The **About Us / Our Team** panel will become active immediately.

## Owner Auth user

Create the owner in Supabase Dashboard → Authentication → Users, then authorize that UUID once:

```sql
insert into public.admins (user_id)
values ('YOUR_AUTH_USER_UUID')
on conflict do nothing;
```

## Team member model

Each team member stores:

- Name
- 1:1 portrait image URL
- Display order
- Member hidden/visible state
- Facebook URL + icon hidden state
- TikTok URL + icon hidden state
- Instagram URL + icon hidden state
- X URL + icon hidden state
- LinkedIn URL + icon hidden state

The public About Us page reads only rows where `hidden = false`. A social icon is rendered only when its URL exists and that platform's `*_hidden` field is false.

## Image behavior

Admin uploads artwork files to the `artworks` bucket and team portraits to the `team` bucket. Both buckets are public-read because their URLs are displayed on public pages; write/delete operations remain restricted to authenticated admins through Storage RLS policies.
