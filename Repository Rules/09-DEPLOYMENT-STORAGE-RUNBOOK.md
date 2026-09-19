# 09 — Deployment Storage Prevention & Incident Runbook

## 1. Prevention is the primary control

Deployment cleanup is not a normal publishing strategy.

The repository has already experienced a high deployment-count/storage incident. Deleted deployments may remain recoverable in Vercel's Recently Deleted state for a retention window, so quota may not be reclaimed immediately after deletion.

Therefore:

**Stop deployment creation at the source before relying on cleanup.**

## 2. Healthy steady state

Target:

- current production;
- approximately 5–10 recent production rollback candidates;
- no large accumulation of Preview/Error/Canceled deployments;
- production deployment frequency aligned with actual software releases, not content-edit frequency.

## 3. Warning signals

Treat these as deployment incidents:

- dozens of production deployments in a few days;
- repeated automated commits from admin/content workflows;
- deployment count growing faster than intentional releases;
- Deployment Storage approaching the plan quota;
- repeated builds whose only meaningful difference is content metadata or media;
- large numbers of canceled/error builds caused by rapid successive pushes.

## 4. Immediate response

When abnormal growth is detected:

1. Stop or pause the workflow creating repeated deployments.
2. Stop per-edit pushes to `main`.
3. Move ongoing engineering work to a non-production branch.
4. Determine whether the triggering changes are code, content, or media.
5. Batch pending changes.
6. Inspect active deployment count.
7. Inspect Deployment Storage project attribution.
8. Fix the publishing architecture before deleting historical deployments.

## 5. Cleanup order

If cleanup is necessary, preserve the current production deployment and a small rollback set.

Typical order:

1. obsolete Preview deployments;
2. Error deployments;
3. Canceled deployments;
4. old production deployments outside the selected rollback window.

Deletion must be scoped carefully to the correct project.

Never delete the current production deployment merely to reduce quota.

## 6. Recently Deleted behavior

A deployment reported as deleted may still appear under Vercel Recently Deleted and remain recoverable during the retention window.

Operational consequence:

- active deployment count may drop immediately;
- Deployment Storage may not drop immediately;
- repeated deletion commands are not a substitute for permanent garbage collection;
- do not delete the final rollback/current production set attempting to force the meter down.

## 7. Escalation condition

Escalate to Vercel when:

- active deployments have been reduced to a small expected set;
- project-level Deployment Storage remains unexpectedly high;
- Recently Deleted contains the historical deployments;
- no other project accounts for the usage.

Provide:

- project name and project ID;
- before/after active deployment count;
- current Deployment Storage;
- screenshot of project-level attribution;
- screenshot of Recently Deleted;
- approximate deletion time.

## 8. AI behavior during an incident

An AI agent MUST NOT respond to storage pressure by automatically creating a permanent delete loop without first identifying the source of deployment growth.

The first question is always:

**What workflow is creating deployments, and why?**

Only after that workflow is fixed should cleanup be automated.
