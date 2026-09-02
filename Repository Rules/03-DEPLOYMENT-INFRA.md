# 03 — Deployment & Infrastructure Rules

## 1. Hosting ownership

### Vercel

Vercel owns the public Next.js application and approved API routes.

It MUST NOT host the admin frontend.

### GitHub Pages

GitHub Pages owns the admin frontend.

Admin static files must remain deployable independently of Vercel UI routes.

### Cloudflare

Cloudflare R2 stores media objects. The media Worker controls public delivery, Range behavior, cache headers, admin-write authentication, and CORS for its routes.

### GitHub Actions

GitHub Actions is the preferred place for deterministic Worker deployment and infrastructure probes that can be expressed from repository state.

## 2. Deployment must preserve boundary ownership

A deployment incident is not permission to move responsibilities between hosts.

Examples:

- A GitHub Pages CORS problem must not be solved by moving the admin frontend to Vercel.
- A Worker Access problem must not be solved by proxying every image through Vercel.
- A Vercel deployment issue must not change R2 object URLs.

## 3. Required verification gates

For public Next.js changes, use the scripts that actually exist in `package.json`:

- `npm run egress:check`
- `npm run typecheck`
- `npm run build`

Do not claim lint/test/format checks passed if the repository does not define those scripts.

For media Worker changes, production/CI probes should cover the relevant invariants:

- Worker health endpoint.
- GitHub Pages admin CORS preflight.
- Unauthenticated admin PUT reaches Worker auth and returns `401`.
- Real Cloudflare cache can produce `CF-Cache-Status: HIT`.
- Range request returns `206` with correct `Content-Range`.
- Query canonicalization preserves stable cache keys.

## 4. Production rollout rules

- Prefer branch -> preview/checks -> PR -> merge -> production verification.
- Never commit directly to `main` for engineering changes.
- Do not mark a task complete while a required production workflow is failing.
- A successful deploy step is not sufficient if post-deploy probes fail.
- If an experiment fails, revert the experiment rather than leaving an unused production endpoint/configuration behind.

## 5. Rollback rules

- Rollbacks should be source-controlled through a branch/PR whenever practical.
- Avoid a Vercel-only rollback that leaves GitHub `main` describing a different architecture from production.
- Preserve data and media objects during rollback unless deletion is explicitly required.
- Record the last known-good architecture/commit when performing a high-risk infrastructure change.

## 6. Infrastructure changes must be idempotent

Automation that reconciles external state should be safe to run repeatedly.

Examples:

- Reuse an existing Cloudflare Worker-level Access bypass instead of creating duplicates.
- Deploy the same Worker configuration without changing public URLs unnecessarily.
- Do not create a new hostname on every troubleshooting attempt.

## 7. No hidden infrastructure dependencies

If a feature depends on an external setting that is not visible in code, document and probe it.

Examples include:

- Cloudflare account-wide Worker Access.
- Required API-token scopes.
- GitHub Pages origin assumptions.
- Vercel environment variables.
- GitHub branch/data-branch assumptions.
