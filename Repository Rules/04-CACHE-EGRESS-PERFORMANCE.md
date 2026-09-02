# 04 — Cache, Egress & Performance Rules

## 1. Egress is a first-class constraint

Every media-path change must answer:

- Does it create a new request?
- Does it increase object size transferred?
- Does it bypass Cloudflare cache?
- Does it cause a derivative candidate switch?
- Does it preload an original that the user may never open?
- Does it proxy bytes through another provider?

If the answer to any is yes, quantify the trade-off before implementation.

## 2. Media delivery rules

- Keep Cloudflare R2 as the media origin.
- Preserve immutable public cache semantics for stable media objects.
- Keep existing public object URLs stable whenever possible.
- Do not add cache-busting query parameters to normal media URLs.
- Canonicalize accidental query variants instead of letting them fragment cache keys.
- Preserve byte-range support for large originals.

## 3. Derivative policy

Derivatives exist to reduce listing/SEO bandwidth.

- Listing/card/SEO traffic should use appropriate derivatives rather than exact originals.
- Existing derivative tiers such as 640/960/1600 must not be expanded or replaced casually.
- Do not change derivative budgets or initial loading budgets without measuring request/byte impact and updating the egress safety gate.

## 4. Expanded artwork contract

The accumulated expansion rules are one contract:

- User click must produce immediate UI response.
- Do not stretch a low-resolution derivative to full expanded size and show a blurry image.
- The exact uploaded original is the final expanded image.
- Do not speculative-prefetch exact originals on hover/touch merely to hide cold-load latency.
- Do not introduce an extra 1600px bridge request between thumbnail and original.
- If a preview is retained while the original loads, reuse the already-loaded preview and keep it at its pre-expansion rendered size rather than upscaling it.
- Direct-link expanded routes should not fetch a derivative solely to create a placeholder.

## 5. No large-media proxying through Vercel

Do not proxy artwork uploads/downloads through Vercel solely to avoid browser-to-Worker CORS or Access issues.

Reasons:

- duplicates the media transfer path;
- increases bandwidth/provider coupling;
- makes cache accounting harder;
- creates new serverless limits and failure modes.

Fix Cloudflare/CORS/auth at its own boundary instead.

## 6. Retry and duplication cost

- Do not automatically retry large original downloads.
- Do not retry uploads unless the object key and operation are demonstrably idempotent.
- Avoid generating the same derivative multiple times in one publish flow.
- Avoid background prefetch that is not tied to clear user intent.

## 7. Performance rules

- Prefer CSS-only loading ambience/skeletons over extra media requests.
- Animate `transform` and `opacity` where animation is necessary.
- Avoid broad `will-change`, expensive backdrop blur, or mass reveal animation on mobile.
- Avoid layout shifts when changing image loading behavior.
- Performance fixes must be evaluated together with visual quality and egress, not in isolation.

## 8. Egress regression gate

`scripts/assert-egress-safety.mjs` is a policy gate, not an obstacle to work around.

When an intentional architecture change invalidates an assertion:

1. Explain why the old invariant is no longer correct.
2. Replace it with an equally explicit new invariant.
3. Verify the new request topology.
4. Never simply delete the guard to make the build pass.
