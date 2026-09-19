# 07 — Content, Admin & Release Batching Rules

## 1. Core principle

**A content edit is not automatically a software release.**

The system must separate:

1. editing;
2. persistence;
3. validation;
4. Git history;
5. software release;
6. Vercel deployment.

AI agents MUST NOT collapse all six into one automatic action.

## 2. Preferred content architecture

Preferred:

```text
Admin edit
  -> mutable content/data store
  -> R2/external media store when applicable
  -> runtime fetch / cache invalidation / revalidation
  -> no new Vercel build
```

The repository currently uses GitHub metadata and R2/media infrastructure. When evolving the architecture, preserve the existing hosting boundaries defined by the other repository rules.

## 3. Git-backed transitional model

If GitHub must remain the mutable content backend, batch writes before they reach the production branch.

Preferred transitional flow:

```text
Edit 1
Edit 2
Edit 3
...
Edit N
  -> staging branch / draft queue
  -> explicit Publish action
  -> consolidated commit or merge to main
  -> one production deployment
```

Forbidden:

```text
Edit 1 -> main -> deploy
Edit 2 -> main -> deploy
Edit 3 -> main -> deploy
```

## 4. Admin dashboard rules

An admin/dashboard implementation MUST NOT:

- create one `main` commit per field edit;
- commit on every keystroke, toggle, reorder, upload, or Save event;
- automatically publish every local mutation to production;
- use Vercel deployment creation as the persistence mechanism.

If Git is used for publication, the dashboard should distinguish:

- Save Draft;
- Review;
- Publish.

Only Publish may create the release boundary.

## 5. Media rules

Artwork originals, thumbnails, responsive derivatives, generated WebP/AVIF files, and frequently changing media should prefer the project's external media path such as R2.

Avoid:

- putting duplicate mutable media copies into every deployment;
- regenerating the full derivative catalogue on every production build when derivatives can be generated once and persisted externally;
- committing temporary upload artifacts or processing output to Git for convenience.

Code and stable configuration belong in Git. Large mutable media should not use Vercel deployments as a storage mechanism.

## 6. Git batching

Multiple local commits are acceptable.

Multiple feature-branch commits are acceptable.

The critical restriction is repeated production-triggering updates to `main`.

Before a release, ask:

- Are more related edits still pending?
- Can this be consolidated?
- Is this only content/media?
- Does the running application actually need a new build?
- Can runtime data/revalidation solve this without a deployment?

If a build is not required, do not intentionally trigger one.

## 7. Commit-message discipline

Prefer release-level messages such as:

```text
content: publish September gallery batch
fix: gallery metadata validation and ordering
feat: add artwork detail navigation
```

Avoid repetitive automated production commits such as:

```text
content(admin): update backend
content(admin): update backend
content(admin): update backend
```

when they are merely individual saves from one editing session.

## 8. Immediate-content requirement

If the user requires immediate content publication, solve that requirement with runtime content architecture, external storage, revalidation, or another non-build mechanism where practical.

Do not solve immediate publication by increasing production deployment frequency by default.
