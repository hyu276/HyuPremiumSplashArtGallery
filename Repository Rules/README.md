# Repository Rules — HyuPremiumSplashArtGallery

This folder is the repository governance source for future vibe-coding work.

## 1. Rule precedence

When changing this repository, follow this order:

1. The user's explicit instruction in the current task.
2. The rules in this folder.
3. Existing verified production architecture and invariants.
4. Existing implementation patterns.
5. Convenience or speculative refactors.

If a proposed change conflicts with a higher-priority rule, stop and explain the conflict instead of silently changing the architecture.

## 2. Core invariants

The following are repository-level invariants and MUST NOT be changed casually:

- The public gallery is deployed on Vercel.
- The admin frontend is hosted on GitHub Pages only.
- Never create, restore, redirect to, or silently deploy an admin frontend on Vercel.
- GitHub repository metadata is the authoritative content source.
- Cloudflare R2 is the media object store; the Worker is the media delivery/auth boundary.
- Existing public media URLs and immutable cache keys should remain stable whenever possible.
- Media egress must not increase without an explicit reason, request-cost analysis, and verification.
- No direct commits to `main`; use a branch and pull request.
- Production fixes must preserve previously solved regressions unless the user explicitly accepts a trade-off.

## 3. Required reading by task type

- Architecture or routing changes: read `01-ARCHITECTURE.md`.
- Admin/dashboard changes: read `02-ADMIN-BOUNDARIES.md`.
- Vercel, GitHub Pages, Worker, GitHub Actions, or rollout changes: read `03-DEPLOYMENT-INFRA.md`.
- Gallery image loading, derivatives, cache, R2, bandwidth, or performance changes: read `04-CACHE-EGRESS-PERFORMANCE.md`.
- Any code change, branch, commit, PR, auth, CORS, or secrets work: read `05-GIT-QUALITY-SECURITY.md`.

## 4. Change discipline

Before editing:

- Identify the exact failing boundary instead of patching the visible symptom only.
- Determine whether the change affects the public gallery, admin control plane, media data plane, deployment, or more than one boundary.
- Prefer the smallest change that fixes the root cause.
- Do not introduce a new service, hostname, proxy, polling loop, prefetch path, or retry policy unless its failure modes are understood.

After editing:

- Verify the relevant production path, not only compilation.
- State what was changed, what was intentionally not changed, and which invariants were checked.
- If verification is incomplete, say so explicitly; do not present assumptions as production proof.

## 5. Anti-regression principle

A later fix MUST NOT reintroduce an earlier fixed issue. When a sequence of fixes has accumulated multiple constraints, treat all still-valid constraints as a single contract.

Example: an image-loading fix must preserve responsiveness, sharpness, cache behavior, and egress constraints simultaneously rather than optimizing only one dimension.
