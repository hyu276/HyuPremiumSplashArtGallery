# 01 — Architecture Rules

## 1. Production boundaries

Treat the repository as four distinct boundaries:

### Public gallery

- Framework: Next.js.
- Production host: Vercel.
- Purpose: public browsing, SEO, artwork pages, catalogue rendering.
- It MUST NOT become the host for the admin frontend.

### Admin frontend

- Host: GitHub Pages only.
- Entry point: static `admin.html` plus its static assets.
- Purpose: authenticated editorial/control UI.
- It MAY call approved backend APIs, but the UI itself must remain outside Vercel.

### Admin/backend control plane

- GitHub metadata is the authoritative source of catalogue/team/SEO state.
- Any Vercel API used by the GitHub Pages admin is an API service boundary only; it is not permission to host the admin UI on Vercel.
- Cross-origin dependencies must be explicit, minimal, authenticated, and covered by CORS tests.
- Do not silently redesign the control plane during an unrelated feature/fix.

### Media data plane

- Object store: Cloudflare R2.
- Delivery/auth boundary: Cloudflare Worker.
- Public reads and admin writes are separate security behaviors even when they share one Worker.
- Public media delivery must remain cache-oriented; admin writes must remain authenticated.

## 2. Source-of-truth rules

- Do not create competing catalogue sources.
- Do not add a second hidden admin datastore for convenience.
- Repository metadata written by the admin must remain reproducible from Git history.
- Derived thumbnails/variants are media derivatives, not authoritative metadata.

## 3. Separation of concerns

A change should normally touch only one boundary.

Cross-boundary changes require an explicit reason. Examples:

- A public gallery rendering fix should not modify admin auth.
- An admin UI improvement should not alter public media cache semantics.
- An R2 Worker auth fix should not alter gallery layout.
- A deployment fix should not migrate media URLs unless migration is the actual objective.

If a change spans more than one boundary, document the dependency chain in the PR.

## 4. No architecture drift by workaround

Forbidden workaround patterns include:

- Moving the admin UI to Vercel because GitHub Pages has a fetch/CORS issue.
- Proxying large media through Vercel merely to avoid a Worker/CORS problem.
- Creating a second Worker hostname without proving why the first boundary fails.
- Adding polling because deployment freshness is inconvenient.
- Duplicating data between services to avoid fixing the real integration boundary.

Fix the failing layer first.

## 5. Stable interfaces

Treat these as contracts:

- GitHub Pages admin origin.
- Vercel public production URL.
- R2 Worker public media URL format.
- Repository data schemas.
- Worker admin-write authentication behavior.
- Catalogue derivative metadata structure.

Any intentional contract change must include migration/rollback logic and production verification.

## 6. Complexity discipline

For new or substantially rewritten logic:

- Keep cyclomatic complexity below 8 per function where practical.
- Split validation, transport, transformation, and persistence into distinct units.
- Avoid deeply nested control flow.
- Prefer explicit typed boundaries over implicit shared mutable state.
