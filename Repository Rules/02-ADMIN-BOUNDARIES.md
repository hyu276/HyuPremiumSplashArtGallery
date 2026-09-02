# 02 — Admin Boundaries

## 1. Admin hosting rule — absolute

The admin frontend MUST be served from GitHub Pages only.

Never:

- add `app/admin/page.tsx` for a Vercel-hosted admin UI;
- add an `admin-legacy` redirect on Vercel;
- redirect `admin.html` to `hyupremium.vercel.app/admin`;
- treat a temporary Vercel admin deployment as an acceptable shortcut;
- duplicate the admin UI across GitHub Pages and Vercel.

Vercel may expose an authenticated API consumed by GitHub Pages only when that API is part of the approved architecture.

## 2. Static admin asset rules

- `admin.html` must load the GitHub Pages admin bundle directly.
- Any change to the admin JS bundle must include a cache-versioning strategy so old tabs do not silently run incompatible code. Prefer content-hashed assets; otherwise use an explicit revisioned query/version controlled by the repository.
- Do not rely on users hard-refreshing as the primary deployment mechanism.
- Stale tabs must fail safely and preserve drafts where possible.

## 3. Cross-origin rules

The admin currently crosses service boundaries, so CORS is a production contract.

- Admin-write CORS must explicitly allow the GitHub Pages origin.
- Do not use `*` for authenticated admin-write responses.
- Preflight behavior must be tested with the real GitHub Pages origin.
- A request that is blocked before reaching application code must be diagnosed at the upstream layer; adding client retries is not a substitute for fixing Access/CORS.

## 4. Authentication rules

- GitHub fine-grained PATs must remain in memory for the active tab only.
- Never store PATs in repository files, localStorage, sessionStorage, analytics, logs, URLs, or query parameters.
- Never print authorization headers or token fragments.
- Worker admin writes must independently verify owner identity and repository write permission.
- A Cloudflare Access bypass for the media Worker does not replace Worker-level GitHub PAT authentication.

## 5. Retry semantics

Retries are allowed only when operation semantics are understood.

- GET/HEAD metadata requests may retry a small bounded number of times for transient network/5xx failures.
- Idempotent R2 PUT using the same object key may retry at most once when the failure is transport/transient and duplicate storage effects are impossible.
- DELETE may retry only when repeated deletion is safe.
- Non-idempotent publish POST MUST NOT be automatically replayed after an ambiguous network failure.
- No infinite retries, hidden retry loops, or continuous polling.

## 6. Draft safety

When an admin operation fails:

- Keep the in-tab draft whenever possible.
- Do not clear pending uploads solely because a network request failed.
- Distinguish authentication, validation, CORS/network, transient upstream, and permanent backend errors in the UI.
- Error messages should identify the failing service boundary when known.

## 7. Cloudflare Worker / Access rule

If account-wide Cloudflare Worker Access protection is enabled:

- The public media Worker must have an explicit Worker-level bypass if public media/admin preflight must reach Worker code.
- CI should reconcile the bypass idempotently.
- Production verification must prove that GitHub Pages `OPTIONS` reaches the Worker and that an unauthenticated admin PUT returns Worker-auth `401`, not Cloudflare Access `302/403`.

## 8. Admin changes require production-path verification

At minimum verify the affected path:

- GitHub Pages loads the expected admin bundle.
- Admin backend preflight succeeds.
- Login/metadata GET reaches the expected backend.
- R2 upload preflight succeeds.
- Auth boundary responds correctly.
- Publish behavior remains single-attempt.
