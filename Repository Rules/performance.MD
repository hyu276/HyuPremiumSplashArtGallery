# Performance Rules

## 1. Priority

Performance is a repository-level requirement covering local code execution, client runtime, network behavior, rendering, build output, and deployed production behavior. Optimize measured bottlenecks without sacrificing correctness, image fidelity, cache efficiency, or maintainability.

## 2. Client JavaScript budget

- Prefer server/static rendering for content that does not require client interactivity.
- Do not add client components merely for convenience.
- Keep client boundaries narrow and local to interactive behavior.
- Avoid shipping large libraries for small UI tasks.
- Lazy-load non-critical functionality when it materially reduces initial JS without delaying primary interaction.
- Do not create duplicate client bundles for the same logic.

## 3. Render efficiency

- Avoid unnecessary rerenders caused by unstable props, redundant state, or broad context updates.
- Compute derived values outside repeated render work when practical.
- Virtualize only genuinely large lists; do not add virtualization overhead to small collections.
- Avoid forced synchronous layout loops that alternate DOM reads and writes.
- Batch DOM/state work when multiple updates belong to one interaction.
- Use `requestAnimationFrame` only for visual work synchronized with paint, not as a generic retry mechanism.

## 4. Interaction latency

- User actions should produce immediate visible feedback.
- Do not block click/tap handlers on image decoding, network requests, heavy parsing, or batch computation before showing UI response.
- Expensive work should happen after the interaction shell responds when architecture permits.
- Avoid long synchronous loops on the main thread.
- Preserve keyboard, mouse, and touch responsiveness equally.

## 5. CSS and animation

- Prefer animation of `transform` and `opacity`.
- Avoid broad `will-change` declarations.
- Avoid expensive blur/backdrop-filter effects over large moving regions, especially on mobile.
- Do not animate layout-heavy properties across many elements unless profiling proves it is safe.
- Respect `prefers-reduced-motion` for non-essential motion.

## 6. Images and media

- Listing/card/SEO views should use appropriately sized derivatives.
- Do not load exact originals before user intent requires them.
- Expanded artwork must eventually display the exact uploaded original at full available fidelity.
- Never improve apparent speed by permanently substituting a lower-resolution image in expanded mode.
- Reuse already-loaded previews as temporary visual holds rather than issuing redundant bridge requests.
- Preserve intrinsic dimensions/aspect ratios to avoid layout shift.

## 7. Network efficiency

- Every new request must have a clear user or system benefit.
- Avoid duplicate fetches caused by multiple components asking for the same stable resource independently.
- Do not poll when event-driven, focus-driven, deployment-driven, or explicit user refresh behavior is sufficient.
- Do not cache-bust immutable media URLs.
- Retry only bounded, safe operations according to repository retry rules.
- Do not proxy large media through Vercel when Cloudflare R2 can serve it directly.

## 8. Cache-aware performance

- Fast repeat navigation should come primarily from correct CDN/browser caching, not speculative overfetching.
- Preserve immutable caching for stable media objects.
- Keep cache keys stable and canonical.
- Prefer cache HIT over repeated origin reads.
- Avoid adding query parameters that fragment CDN cache unless the resource is intentionally versioned that way.

## 9. Build and deployment efficiency

- Keep build-time work deterministic and bounded.
- Do not add expensive generation work to every page when it can be computed once or scoped to changed data.
- Avoid build-time network dependencies unless they are essential and failure behavior is explicit.
- Preserve static generation/ISR where it is already the appropriate architecture.
- Do not convert static pages to dynamic/server-rendered routes without a concrete runtime requirement.
- Avoid creating serverless functions for logic that can remain static.

## 10. Server/API performance

- Minimize remote round trips per request.
- Parallelize independent small upstream reads when safe.
- Avoid sequential N+1 API patterns.
- Do not parallelize large media transfers in a way that spikes memory, bandwidth, or provider limits.
- Bound request body size and batch size.
- Avoid reading or buffering large media in Vercel memory when streaming/direct R2 paths are available.

## 11. Memory and lifecycle

- Release object URLs, observers, event listeners, intervals, timeouts, and abort controllers.
- Avoid retaining large image blobs longer than needed.
- Do not keep duplicate full catalogue copies in memory without a concrete reason.
- Prefer streaming for large payloads when supported by the boundary.

## 12. Core Web Vitals discipline

Performance changes should protect:

- LCP: prioritize the actual above-the-fold content without preloading unrelated media.
- CLS: reserve dimensions and avoid late geometry changes.
- INP: keep interaction handlers short and avoid main-thread blocking.

Do not optimize one metric by materially worsening another or by increasing media egress without benefit.

## 13. Measurement before and after

For a meaningful performance change, compare relevant evidence before and after, such as:

- First Load JS / route size from Next build output.
- Number of media/network requests.
- Bytes transferred for listing and expanded flows.
- Cache HIT/MISS behavior.
- Interaction timing or render cost where measurable.
- Static vs dynamic route behavior.

If measurement is unavailable, state the limitation and avoid claiming a quantified improvement.

## 14. Merge rejection conditions

Do not merge a performance change that:

- increases initial JS without a justified user benefit;
- converts static content to dynamic rendering unnecessarily;
- adds background polling or speculative original-media fetches;
- improves perceived speed by reducing expanded-image fidelity;
- increases origin egress when an equivalent cache-preserving solution exists;
- introduces layout shift, interaction blocking, or mobile GPU overload.
