# Cache & Egress Rules

## 1. Primary objective

Minimize cache misses, origin reads, duplicate requests, and transferred bytes while preserving responsive UX and the intended quality of web derivatives. Full-resolution originals are archival assets and are not part of public runtime delivery.

## 2. Priority order

Preserve these goals simultaneously:

1. Correctness and stable media URLs.
2. Immediate user interaction response.
3. Appropriate derivative quality for the rendered size.
4. High CDN/browser cache reuse.
5. Minimum practical origin egress and request count.
6. Zero runtime requests to archival originals or retired providers.

## 3. Public media cache contract

- Cloudflare R2 remains the public media origin for derivatives.
- Google Drive stores full-resolution originals as non-serving cold storage.
- Supabase is retired and must not appear in runtime, config, automation, auth, persistence, or media paths.
- Stable derivative objects should use long-lived immutable caching.
- Preserve existing public derivative URLs and cache keys whenever possible.
- Canonicalize accidental query-string variants instead of allowing cache fragmentation.
- Do not append cache-busting query parameters to immutable media.

## 4. Cache-hit first design

- Prefer serving repeated requests from Cloudflare edge/browser cache rather than R2 origin.
- Reject media-path changes that materially lower cache hit rate without a demonstrated benefit.
- Do not create multiple equivalent URLs for the same immutable derivative.
- Do not rotate Worker hostnames or object paths as a troubleshooting shortcut.
- Avoid redirects on normal media requests unless they canonicalize a bad cache key.

## 5. Listing and SEO derivative policy

- Select the smallest existing derivative that preserves expected visual quality at the rendered size and device density.
- Do not request 1600px media for a small card when 640/960 is sufficient.
- Do not create new derivative tiers unless measured request/byte savings justify storage and generation complexity.
- Do not regenerate an unchanged derivative unnecessarily.

## 6. Expanded artwork contract

Expanded mode uses the existing 1600px WebP derivative.

- Never fetch a Google Drive original for public display.
- Never retain or fetch a public R2 original after archival/purge.
- Never fetch media from Supabase.
- User click must open/respond immediately.
- Do not issue a second bridge request after the selected 1600px derivative.
- Do not speculative-prefetch archival originals on hover, pointer enter, or touchstart.
- Direct expanded URLs must use the same derivative-only request topology.

## 7. No duplicate media transfers

- Do not proxy large public media through Vercel when Cloudflare can deliver it directly.
- Do not route public bytes through Google Drive.
- Do not route any HyuPremium runtime traffic through Supabase.
- Retry uploads only when the object key makes the operation demonstrably idempotent and retry is bounded.
- Avoid flows that send the same full file through multiple providers except the intentional publish-time archive handoff.

## 8. Request-topology rule

Expected topology:

- initial gallery: 640/960 derivatives as appropriate;
- scrolling/listing: lazy derivative requests only;
- expanded artwork: one deterministic 1600px R2 derivative;
- direct-link expanded artwork: one deterministic 1600px R2 derivative;
- repeat visit: browser/Cloudflare cache reuse;
- full-resolution original: no runtime request.

Any new request must be intentional and justified.

## 9. Egress-aware freshness

- Do not use continuous polling to keep catalogue/media state fresh.
- Prefer tiny metadata revision checks rather than re-fetching catalogue or media payloads.
- A freshness check must not invalidate immutable media URLs.
- Do not couple normal gallery browsing to repeated admin/backend requests.

## 10. Cloudflare Worker rules

- Public GET/HEAD behavior must remain cache-oriented.
- Admin PUT/DELETE behavior must remain authenticated and `no-store`.
- Temporary original/staging namespaces must remain private.
- Production probes should confirm media can reach `CF-Cache-Status: HIT`.
- Query canonicalization must not fetch the R2 object before redirecting to the canonical URL.

## 11. Measuring egress impact

Compare where relevant:

- request count per user flow;
- derivative bytes transferred;
- origin reads vs cache hits;
- whether expansion performs exactly one derivative request when cold;
- whether warm repeat expansion reuses cache;
- whether responsive changes trigger unnecessary candidate swaps;
- whether any request reaches Drive, Supabase, or an original/staging namespace.

Do not claim billing reduction without provider analytics; otherwise describe topology/cache improvements only.

## 12. Regression gate

`scripts/assert-egress-safety.mjs` is mandatory.

It must preserve assertions for:

- derivative-only public runtime;
- no runtime original/Drive request;
- no Supabase dependency/reference in runtime/config/automation;
- initial request budgets;
- stable cache/canonicalization behavior;
- private staging-original boundary;
- GitHub Pages-only admin architecture.

If an assertion becomes obsolete, replace it with a new explicit invariant rather than deleting protection.

## 13. Merge rejection conditions

Do not merge if the change:

- reintroduces Supabase;
- makes Drive a public/runtime origin;
- restores public full-resolution originals to R2;
- fragments immutable cache keys;
- proxies large media through Vercel without a strong architectural requirement;
- increases origin reads while producing the same user-visible result;
- uses cache-busting to solve deployment freshness;
- weakens the derivative-only request topology.
