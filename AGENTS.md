# AGENTS.md — Mandatory Repository Rule Entry Point

This file is the mandatory entry point for AI coding agents working in this repository.

## Mandatory first action

Before editing code, proposing implementation changes, creating commits, changing infrastructure, or suggesting deployment commands:

1. Read `Repository Rules/README.md`.
2. Read every rule file that the README marks as relevant to the task.
3. For any Git, Vercel, GitHub Actions, content-publishing, admin, media, or release task, also read:
   - `Repository Rules/03-DEPLOYMENT-INFRA.md`
   - `Repository Rules/05-GIT-QUALITY-SECURITY.md`
   - `Repository Rules/06-VERCEL-DEPLOYMENT-GOVERNANCE.md`
   - `Repository Rules/07-CONTENT-RELEASE-BATCHING.md`
   - `Repository Rules/08-AI-RELEASE-CHECKLIST.md`
   - `Repository Rules/09-DEPLOYMENT-STORAGE-RUNBOOK.md`

Do not treat this file as a substitute for the full rule set. Its purpose is to route the agent into `Repository Rules/`.

## Rule precedence

Follow this order:

1. The user's explicit instruction in the current task.
2. `Repository Rules/`.
3. Verified production architecture and repository invariants.
4. Existing implementation patterns.
5. Convenience, speculative refactors, or agent preference.

If a proposed action conflicts with a higher-priority rule, stop and explain the conflict.

## Mandatory deployment discipline

A Git commit is not automatically a release.

An admin/content save is not automatically a release.

A content or media update is not automatically a reason to create a Vercel deployment.

Unless the user explicitly requests otherwise, AI agents MUST NOT:

- use repeated pushes to `main` as an iterative testing loop;
- create one production deployment per artwork, metadata edit, admin save, or generated media change;
- run `vercel deploy`, `vercel --prod`, `vercel promote`, `vercel remove`, or equivalent mutation commands autonomously;
- broaden the existing Vercel Git deployment policy;
- design an admin workflow where every Save action commits to `main`;
- remove existing egress/build safety checks just to make deployments easier.

For normal engineering work, use a branch, validate locally, batch related changes, then create one release boundary.

## Stop condition

If a task would create more than one production deployment, the agent must stop and determine whether the work can be batched before proceeding.

If the agent cannot determine whether an action will trigger Vercel, it must assume that it may trigger Vercel and consult the deployment rules first.

## Khung Skin: GitHub Pages only

- The standalone card creator lives at repository-root `khungskin.html` and its canonical production URL is `https://hyu276.github.io/HyuPremiumSplashArtGallery/khungskin.html`.
- This application MUST be published exclusively through GitHub Pages. NEVER add a Next.js route, copy it into Next.js `public/`, import it into the Vercel bundle, create a Vercel deployment/project for it, or redirect its public URL to Vercel.
- Changes exclusive to this GitHub Pages application MUST NOT produce a new Vercel production build. Preserve and verify the `vercel.json` Ignored Build Step allowlist, which skips a release touching only `khungskin.html`, `AGENTS.md`, and `vercel.json` when `khungskin.html` is present in the change set. Any change to actual gallery runtime code MUST continue to build normally.
- The browser card creator may READ the public artwork catalogue and Cloudflare R2 derivative URLs; it MUST NOT retrieve archival originals from Google Drive or depend on Supabase. Custom image uploads are local to the browser and must not be published without the user's explicit authenticated admin action.
- Official badge assets must be managed by the existing GitHub Pages admin/control plane, using the existing authenticated publication boundary. Do not introduce unauthenticated uploads or per-edit Vercel deployments.
- Prepare changes on a feature branch, test desktop/mobile editing and PNG export, and merge as one coherent release only after verifying that the Vercel skip guard excludes Pages-only commits.
