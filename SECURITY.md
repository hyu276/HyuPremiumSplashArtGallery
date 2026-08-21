# HYU PREMIUM Security Notes

## Browser-visible Supabase values

`SUPABASE_URL` and the browser publishable/anon key are not secrets. They must be assumed discoverable by anyone who can load the public site. Security therefore depends on Supabase Row Level Security (RLS), Storage policies, and authentication/authorization rules rather than hiding those values.

Never commit or expose any of the following to browser code:

- Supabase `service_role` key or secret key
- Database password
- Admin account password
- Long-lived private access/refresh tokens
- Private signing keys
- Vercel/hosting API tokens

## Admin authentication behavior

The static admin dashboard is configured to use an in-memory Supabase session:

- `persistSession: false`
- `detectSessionInUrl: false`
- refresh only while the admin tab is open
- old project-specific Supabase auth entries are removed from `localStorage` and `sessionStorage`
- reloading or closing the tab requires signing in again
- the dashboard auto-signs out after 15 minutes of inactivity

The public gallery also creates Supabase clients with session persistence disabled because public reads do not need an authenticated browser session.

## Repository rules

- Keep RLS enabled on every writable Supabase table and Storage bucket.
- Authorization must continue to verify that the authenticated user is present in `public.admins`.
- Do not replace RLS with hidden URLs, client-side checks, or JavaScript obfuscation.
- Do not commit `.env`, credentials, private key files, token dumps, or local secret files. `.gitignore` contains baseline exclusions.
- Treat the GitHub Pages admin URL as public/discoverable even when it is not linked from the gallery.

## Static-host limitations

GitHub Pages cannot provide the strongest admin security controls by repository code alone. In particular, server-side HttpOnly auth cookies, authoritative `Cache-Control: no-store`, `X-Frame-Options`, CSP `frame-ancestors`, request rate limiting, server-side secret storage, and middleware-protected admin routes require a server/CDN platform such as Vercel/Next.js, Cloudflare, or equivalent.

## Incident response

If a real secret is ever committed, deleting it from the latest file is not sufficient. Rotate/revoke the credential immediately, then remove it from repository history if necessary. Assume any secret committed to a public repository has been compromised.
