# Cache & Egress Rules

## 1. Primary objective

Minimize cache misses, origin reads, duplicate requests, and transferred bytes while preserving website responsiveness and the exact visual fidelity of expanded artwork. Egress reduction must never be achieved by making the website slower, showing blurry expanded images, or weakening user-visible quality.

## 2. Priority order

When optimizing media delivery, preserve these goals simultaneously:

1. Correctness and stable media URLs.
2. Immediate user interaction response.
3. Exact-original fidelity for the final expanded image.
4. High CDN/browser cache reuse.
5. Minimum practical origin egress and request count.
6. Minimum unnecessary derivative or bridge traffic.

Do not optimize one item by violating a higher-priority item.

## 3. Public media cache contract

- Cloudflare R2 remains the media origin.
- Stable media objects should use long-lived immutable caching.
- Preserve existing public media URLs and cache keys whenever possible.
- Canonicalize accidental query-string variants instead of allowing cache fragmentation.
- Do not append cache-busting query parameters to immutable media.
- Preserve validators/metadata such as ETag where useful.
- Preserve byte-range behavior for large originals.

## 4. Cache-hit first design

- Prefer serving repeated requests from Cloudflare edge/browser cache rather than R2 origin.
- A media-path change should be rejected if it materially lowers cache hit rate without a demonstrated benefit.
- Do not create multiple equivalent URLs for the same immutable object.
- Do not rotate Worker hostnames or object paths as a troubleshooting shortcut.
- Avoid redirects on normal media requests unless they canonicalize a bad cache key.

## 5. Listing and SEO derivative policy

- Listing/card/SEO traffic should use existing right-sized derivatives rather than exact originals.
- Select the smallest derivative that preserves expected visual quality at the rendered size and device density.
- Do not request 1600px media for a small card when 640/960 is sufficient.
- Do not create new derivative tiers unless measured request/byte savings justify the storage and generation complexity.
- Do not regenerate an unchanged derivative unnecessarily.

## 6. Expanded artwork fidelity contract

Expanded mode has a strict rule: the final visible artwork is the exact uploaded original.

- Never permanently substitute a 640/960/1600 derivative for the exact original in expanded mode.
- Never upscale a derivative to fill the expanded canvas and present it as the final image.
- User click must open/respond immediately; exact-original decoding must not block the shell from appearing.
- While the original loads, reuse the already-loaded listing preview if available and keep it at its pre-expansion rendered size.
- Do not issue an extra 1600px bridge request between listing preview and exact original.
- Do not speculative-prefetch exact originals on hover, pointer enter, or touchstart merely to hide cold-load latency.
- A direct expanded URL must not fetch a derivative solely to manufacture a placeholder.

This preserves sharpness while avoiding redundant traffic.

## 7. No duplicate media transfers

- Do not proxy large public media through Vercel when Cloudflare can deliver it directly.
- Do not fetch the same object once for validation and again for display if metadata/head information can satisfy validation.
- Do not retry large original downloads automatically.
- R2 PUT retry is allowed only when the same object key makes the operation demonstrably idempotent and the retry is bounded.
- Avoid upload flows that send the same full file through multiple providers.

## 8. Request-topology rule

Before changing image loading, document the expected request topology for:

- initial gallery load;
- scrolling/listing load;
- artwork expansion from an already rendered card;
- direct-link expanded artwork;
- repeat visit with warm browser/CDN cache.

Any new request must be intentional and justified.

## 9. Egress-aware freshness

- Do not use continuous polling to keep catalogue/media state fresh.
- Prefer tiny metadata revision checks rather than re-fetching catalogue or media payloads.
- A freshness check must not invalidate immutable media URLs.
- Do not couple normal gallery browsing to repeated admin/backend requests.

## 10. Cloudflare Worker rules

- Public GET/HEAD behavior must remain cache-oriented.
- Admin PUT/DELETE behavior must remain authenticated and `no-store`.
- Do not let admin CORS/auth changes weaken public media cache semantics.
- Production probes should confirm that media can reach `CF-Cache-Status: HIT`.
- Query canonicalization must not fetch the R2 object before redirecting to the canonical URL.

## 11. Measuring egress impact

For any media-loading/cache change, compare where relevant:

- request count per user flow;
- derivative/original bytes transferred;
- number of origin reads vs cache hits;
- whether a cold expansion makes exactly one required original request;
- whether a warm repeat expansion reuses cache;
- whether viewport/responsive changes trigger unnecessary candidate swaps;
- whether SEO/listing paths still avoid original media.

Do not claim egress savings without evidence. If Cloudflare billing analytics are unavailable, describe the result as request-topology or cache-behavior improvement rather than measured billing reduction.

## 12. Regression gate

`scripts/assert-egress-safety.mjs` is mandatory for media/cache changes.

A valid optimization must preserve all still-relevant assertions for:

- initial request budget;
- derivative use on listing/SEO paths;
- exact-original expanded behavior;
- no speculative original prefetch;
- no redundant bridge request;
- stable cache/canonicalization behavior;
- GitHub Pages-only admin architecture when affected.

If an assertion is intentionally obsolete, replace it with a new explicit invariant rather than deleting protection.

## 13. Merge rejection conditions

Do not merge if the change:

- lowers expanded-image fidelity;
- adds speculative original prefetching;
- adds a redundant bridge image request;
- fragments immutable cache keys;
- proxies large media through Vercel without a strong architectural requirement;
- increases origin reads while producing the same user-visible result;
- uses cache-busting to solve deployment freshness;
- reduces egress by making interaction latency materially worse.
