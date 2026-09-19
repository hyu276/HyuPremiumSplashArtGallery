# 08 — Mandatory AI Release Checklist

Before any action that may reach `main` or trigger Vercel, the AI agent must evaluate this checklist.

## A. Classification

- [ ] I classified the change as runtime code, runtime config, content, media, docs, CI/GitHub, tooling, or hotfix.
- [ ] I determined whether a new Vercel build is technically required.

## B. Rule loading

- [ ] I read `Repository Rules/README.md`.
- [ ] I read all task-specific rule files.
- [ ] For any release/deployment task, I read `03-DEPLOYMENT-INFRA.md`, `05-GIT-QUALITY-SECURITY.md`, and `06-VERCEL-DEPLOYMENT-GOVERNANCE.md`.

## C. Batching

- [ ] Related work is complete enough to release together.
- [ ] I am not pushing a small intermediate correction to `main`.
- [ ] I checked whether pending related changes can be included in the same release.
- [ ] The task is expected to create no more than one production deployment.

## D. Content and admin

- [ ] A content/admin save is not being converted directly into a production deployment.
- [ ] If Git is used for content, edits are batched behind an explicit Publish boundary.
- [ ] Mutable media is using R2/external storage where practical.

## E. Validation

- [ ] Relevant local validation has been completed.
- [ ] Existing egress safety checks remain enabled.
- [ ] I did not use a production deployment as the primary test loop.
- [ ] I know what production behavior is expected after release.

## F. Git and Vercel

- [ ] Intermediate engineering work is on a branch/PR unless the user explicitly overrides the repository workflow.
- [ ] Existing main-only Vercel deployment behavior is preserved.
- [ ] I am not enabling branch deployment spam.
- [ ] I am not invoking a Vercel mutation command without explicit user intent.
- [ ] I considered promotion/rollback of an existing artifact before creating a duplicate deployment.

## G. Storage impact

- [ ] The change does not unnecessarily add large mutable media to the deployment bundle.
- [ ] The release does not create a new deployment solely to persist data.
- [ ] There is no known deployment-volume incident currently in progress.

## H. Mandatory stop rule

Stop and ask before proceeding if:

- the current task would intentionally create more than one production deployment;
- the agent cannot determine whether a Git action triggers Vercel;
- an admin feature would commit to `main` per Save;
- the task would broaden branch deployment behavior;
- deployment count/storage is already growing unexpectedly;
- the proposed fix requires weakening existing architecture or safety checks.

Do not mark the release safe if any required item remains unknown.
