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
