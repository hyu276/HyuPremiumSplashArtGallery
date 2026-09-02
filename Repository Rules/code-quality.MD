# Code Quality Rules

## 1. Objective

Code quality is a production constraint. Every change must preserve or improve correctness, maintainability, predictability, and failure isolation. Shorter code is not automatically better code.

## 2. Complexity budget

- Keep cyclomatic complexity below 8 per function.
- One function should normally own one primary responsibility: validate, transform, fetch, persist, render, or orchestrate.
- Prefer early returns over deep nesting.
- Extract named predicates for complex business or infrastructure conditions.
- Split catch-all modules by stable responsibility before they become high-risk change surfaces.

## 3. Type safety and contracts

- Prefer explicit TypeScript types at API, storage, data, and component boundaries.
- Do not use `any` when the shape is known or can be narrowed safely.
- Validate untrusted input before persistence, GitHub writes, R2 writes, or rendering.
- Treat repository schemas, API payloads, media metadata, and URL formats as contracts.
- Do not silently coerce malformed data into plausible defaults when that could hide corruption.

## 4. Naming and constants

- Components, classes, and types: PascalCase.
- Functions, hooks, variables, and properties: camelCase.
- Replace repeated magic numbers and policy strings with named constants.
- Names should describe intent, not implementation trivia.
- Standard project acronyms such as R2, CDN, URL, API, SEO, and CORS are acceptable.

## 5. Duplication and abstraction

- Do not duplicate auth, CORS, cache, retry, URL-normalization, media-key, or validation policy across multiple paths.
- Extract shared logic only when behavior is genuinely identical.
- Avoid generic helpers that hide distinct policies behind one abstraction.
- Prefer one authoritative implementation for a stable invariant.

## 6. Side effects and state

- Keep side effects at explicit boundaries.
- Pure transformation logic should remain deterministic.
- Avoid hidden global mutable state.
- React state should not duplicate reliable derived state unnecessarily.
- Do not mutate state-owned arrays, objects, Sets, or Maps in place.
- Clean up listeners, timers, observers, object URLs, and AbortControllers when their lifecycle ends.

## 7. Async and remote-service discipline

- Every external request must have a defined success path, failure path, timeout/retry policy, and owning service boundary.
- Do not swallow errors that affect publishing, metadata, media, authentication, or persistence.
- Distinguish validation, auth, authorization, transient upstream, and internal failures.
- Retry only when the operation is safe and idempotent.
- Avoid unbounded Promise fan-out against GitHub, R2, Vercel, or third-party services.
- Use bounded concurrency for batch work.

## 8. Logging

- No debug `console.log` in committed production paths unless it is deliberate structured operational logging.
- Never log PATs, secrets, authorization headers, signed credentials, or sensitive request bodies.
- Operational logs should identify boundary, operation, status, and correlation/request ID when useful.
- Logging volume must not become a performance or cost issue.

## 9. Dependency discipline

- Do not add a dependency for functionality that is trivial to implement safely with the platform or existing stack.
- New dependencies require a clear benefit in reliability, maintainability, security, or performance.
- Avoid overlapping libraries that solve the same problem.

## 10. Refactoring discipline

- Do not mix speculative refactors into unrelated fixes.
- Root-cause fixes should touch the smallest stable boundary that owns the problem.
- Preserve existing behavior unless behavior change is the explicit objective.
- When replacing an implementation, remove obsolete parallel paths instead of leaving permanent dead architecture.

## 11. Performance-aware code quality

- Do not repeatedly parse, sort, filter, clone, or normalize stable data inside hot render paths.
- Memoize only where repeat cost or rerender impact is meaningful.
- Avoid recreating large objects or closures when that triggers costly downstream work.
- Keep synchronous CPU-heavy work away from interaction-critical client paths.
- Move expensive image processing and batch transforms away from latency-sensitive UI interactions.

## 12. Required verification

Use the checks that actually exist in the repository and report them accurately:

- `npm run egress:check`
- `npm run typecheck`
- `npm run build`

If lint/test/format scripts are added later, they become required according to their documented scope. Never claim a nonexistent check passed.

## 13. Merge rejection conditions

Do not merge code that:

- increases complexity without a justified architectural reason;
- duplicates an existing policy implementation;
- introduces unbounded retries, polling, concurrency, or listeners;
- weakens type safety at a critical boundary;
- hides errors that can corrupt metadata or media state;
- leaks secrets into code, logs, storage, or URLs;
- passes build only by deleting or weakening a regression guard.
