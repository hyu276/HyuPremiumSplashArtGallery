# 05 — Git, Quality & Security Rules

## 1. Git workflow

- Never commit engineering changes directly to `main`.
- Create a short kebab-case branch using `type/name`, maximum 40 characters.
- Use Conventional Commit messages: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, or `chore`.
- Keep commits atomic: one logical concern per commit.
- Do not include AI attribution, co-author fingerprints, or generated-by notes in commits/PRs.
- Keep a PR to 6 changed files or fewer when practical; split unrelated work.

## 2. PR requirements

A PR must state:

- what problem is being solved;
- which architectural boundary is affected;
- what invariants must remain unchanged;
- how the change was tested;
- deployment/rollback implications if applicable.

Do not merge because code merely compiles. Merge only after the checks relevant to the affected boundary are green.

## 3. Repository-defined quality checks

Current core scripts are:

- `npm run egress:check`
- `npm run typecheck`
- `npm run build`

Run the relevant checks for code changes. If a check cannot be run, report that limitation instead of claiming success.

## 4. Code quality

For new or substantially changed code:

- Target cyclomatic complexity below 8 per function.
- Use PascalCase for React components/types and camelCase for functions/variables.
- Keep transport, validation, transformation, and persistence logic separated.
- Avoid unused imports and dead branches.
- Avoid policy-sensitive magic numbers; use named constants.
- Operational `console.log` is allowed only for structured, intentional diagnostics. Do not leave ad-hoc debugging logs.
- Preserve TypeScript types at service boundaries instead of falling back to broad `any` without reason.

## 5. Security

Never commit or expose:

- GitHub PATs;
- Cloudflare API tokens;
- Vercel secrets;
- private keys;
- authorization headers;
- user credentials.

Rules:

- Secrets belong in provider secret stores/environment variables.
- Never log token values or partial token prefixes beyond what is necessary to validate format.
- CORS for authenticated writes must use explicit trusted origins.
- Public Cloudflare Access bypass may exist only when application-level Worker auth still protects admin writes.
- Do not weaken authentication to fix availability.

## 6. User-intent preservation

Explicit repository constraints from the user are architectural requirements, not suggestions.

In particular:

- Never deploy the admin frontend on Vercel unless the user explicitly reverses that rule.
- Do not silently change providers, hosting boundaries, cache strategy, authentication model, or data source.
- If a requested fix appears to require violating an existing constraint, explain the trade-off before changing architecture.

## 7. Root-cause standard

Avoid symptom-only patches when the failing layer can be identified.

Before adding retries, fallbacks, proxies, or new infrastructure, determine whether the root cause is:

- browser/client state;
- stale static asset;
- CORS/preflight;
- Cloudflare Access;
- Worker code;
- R2;
- Vercel API;
- GitHub API;
- deployment/version mismatch.

Fix the lowest failing layer that satisfies the repository constraints.

## 8. Completion standard

A task is complete only when:

- the requested change exists in source control;
- relevant checks pass;
- deployment status is known when production behavior changed;
- no known required workflow remains failing;
- the final report distinguishes verified facts from assumptions.
