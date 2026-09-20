# 04 — Cache, Egress & Performance Rules

## 1. Egress is a first-class constraint

Every media-path change must answer:

- Does it create a new request?
- Does it increase object size transferred?
- Does it bypass Cloudflare cache?
- Does it cause a derivative candidate switch?
- Does it fetch an archival original or another provider unnecessarily?
- Does it proxy bytes through another provider?

If the answer to any is yes, quantify the trade-off before implementation.

## 2. Media delivery rules

- Cloudflare R2 is the public media origin and stores web-serving derivatives only.
- Google Drive owns verified full-resolution originals as non-serving cold storage.
- A publish flow may use temporary authenticated R2 staging originals only long enough to generate derivatives and verify archival; staging originals must never serve public traffic and must be purged after archive verification.
- Preserve immutable public cache semantics for stable derivative objects.
- Keep existing public derivative URLs stable whenever possible.
- Do not add cache-busting query parameters to normal media URLs.
- Canonicalize accidental query variants instead of letting them fragment cache keys.
- Never fetch Google Drive originals from browser/runtime code.

## 3. Retired provider boundary

- Supabase is not part of the HyuPremium runtime, build, admin, media, metadata, auth, or persistence architecture.
- Do not add Supabase SDK dependencies, project URLs, API keys, environment variables, Storage paths, Database/Auth calls, Realtime, or Edge Functions.
- The egress safety gate must fail if a runtime/config/automation reference to the retired provider is reintroduced.
- Reintroducing Supabase requires explicit user approval and a new architecture review.

## 4. Derivative policy

Derivatives are the only public artwork payloads.

- Listing/card/SEO traffic should select the smallest existing derivative that preserves expected quality.
- Existing 640/960/1600 tiers must not be expanded or replaced casually.
- Expanded artwork uses the deterministic 1600px derivative.
- Do not regenerate unchanged derivatives unnecessarily.
- Do not create a new derivative tier unless measured savings justify the storage/generation complexity.

## 5. Expanded artwork contract

- User click must produce immediate UI response.
- The final expanded image is the existing 1600px R2 derivative.
- Do not request a full-resolution original from Drive, R2 staging, Supabase, Vercel, or another provider.
- Do not speculative-prefetch archival originals on hover/touch.
- Direct-link expanded routes must resolve to the same derivative-only topology.
- Preserve intrinsic dimensions/aspect ratio and avoid layout shift.

## 6. No large-media proxying through Vercel

Do not proxy artwork uploads/downloads through Vercel solely to avoid browser-to-Worker CORS or Access issues.

Fix Cloudflare/CORS/auth at its own boundary instead.

## 7. Retry and duplication cost

- Do not automatically retry large archival transfers.
- Do not retry uploads unless the object key and operation are demonstrably idempotent.
- Avoid generating the same derivative multiple times in one publish flow.
- Avoid background prefetch that is not tied to clear user intent.

## 8. Performance rules

- Prefer CSS-only loading ambience/skeletons over extra media requests.
- Animate `transform` and `opacity` where animation is necessary.
- Avoid broad `will-change`, expensive backdrop blur, or mass reveal animation on mobile.
- Avoid layout shifts when changing image loading behavior.
- Performance fixes must be evaluated together with visual quality and egress, not in isolation.

## 9. Egress regression gate

`scripts/assert-egress-safety.mjs` is a policy gate, not an obstacle to work around.

When an intentional architecture change invalidates an assertion:

1. Explain why the old invariant is no longer correct.
2. Replace it with an equally explicit new invariant.
3. Verify the new request topology.
4. Never simply delete the guard to make the build pass.
