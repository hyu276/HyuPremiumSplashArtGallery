# 06 — Vercel Deployment Governance

## 1. Purpose

This rule exists to prevent deployment-volume incidents and Vercel Deployment Storage exhaustion.

A prior repository incident accumulated hundreds of Vercel deployments because frequent GitHub content/admin updates reached `main` and produced production deployments. After cleanup, deleted deployments remained recoverable under Recently Deleted for a retention window, so storage was not immediately reclaimed.

Therefore the repository MUST prevent unnecessary deployments before they are created.

## 2. Current branch deployment policy is a guardrail

The current `vercel.json` intent is:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "*": false
    }
  }
}
```

This is intentional.

AI agents MUST NOT broaden this policy without explicit user approval.

Implications:

- `main` is a production-release boundary.
- Feature branches are preferred for engineering work.
- Intermediate AI commits belong off `main`.
- Preview deployments are not required for every experiment.
- A merge/push to `main` must be treated as a potentially billable/storage-producing deployment event.

## 3. Deployment budget

Default operational targets:

- Content-only changes: **0 production deployments** whenever runtime content architecture can support it.
- Media-only changes: **0 production deployments** whenever R2/external media delivery can support it.
- One coherent code release: **1 production deployment**.
- More than **3 production deployments in 6 hours** is an anomaly requiring review.
- An autonomous AI task MUST NOT intentionally create more than **1 production deployment** without explicit user approval.

Emergency fixes are allowed, but the additional deployment must be justified.

## 4. Forbidden deployment patterns

Do not use:

```text
edit -> push main -> deploy -> inspect -> edit -> push main -> deploy -> repeat
```

Do not implement:

```text
Admin Save -> GitHub main commit -> Vercel production deployment
```

for every individual content mutation.

Do not create repeated deployments merely to:

- test minor visual variants;
- change data that can live in a mutable store;
- regenerate media that can live in R2;
- change an alias when an existing validated deployment can be promoted;
- recover from a deployment mistake that can be rolled back to an existing deployment.

## 5. Required production release flow

Preferred flow:

```text
branch
  -> local validation
  -> complete coherent task
  -> PR/review
  -> one merge to main
  -> one production deployment
  -> production verification
```

The agent must not split one logical release into many production-triggering merges merely for convenience.

## 6. Vercel mutation commands are controlled actions

The following are release/destructive operations:

```bash
vercel deploy
vercel --prod
vercel deploy --prod
vercel promote
vercel rollback
vercel remove
```

An AI agent may explain or prepare these commands, but MUST NOT execute them unless the user explicitly requests the corresponding action.

## 7. Prefer existing artifacts over duplicate builds

When an already-built deployment has been validated:

- prefer promotion over rebuilding the same source solely to assign production traffic;
- prefer rollback to an existing known-good deployment over rebuilding old source solely to revert;
- do not create a new deployment merely to duplicate an artifact that already exists.

## 8. Verification does not require production spam

Before production:

- use `npm run egress:check`;
- use `npm run typecheck`;
- use `npm run build`;
- use local/browser verification appropriate to the change.

Production deployment is the final release step, not the first test step.

## 9. Retention target

Maintain a small rollback window, not an archive of every release.

Operational target:

- current production;
- approximately 5–10 recent production rollback candidates;
- minimal obsolete Preview/Error/Canceled deployments.

Do not intentionally accumulate hundreds of READY production deployments.

## 10. Ignored Build Step

For future optimization, documentation-only or other proven non-runtime commits may use a reviewed Vercel Ignored Build Step.

Vercel semantics:

- exit code `0` -> skip build;
- exit code `1` -> continue build.

Any ignore logic MUST use a strict allowlist. It MUST NOT skip builds if runtime source, build configuration, dependencies, public runtime assets, or deployment configuration changed.
