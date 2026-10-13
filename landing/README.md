# HYU PREMIUM — Ebook landing (Netlify only)

This is an isolated Netlify project within the HyuPremiumSplashArtGallery repository. The Next.js gallery stays on Vercel; the editorial admin stays on GitHub Pages.

## Deploy/import

1. The **existing** Netlify site `hyupremium` is linked to `hyu276/HyuPremiumSplashArtGallery` and deploys the `feat/netlify-ebook-landing` branch. Keep the landing release separate from the Vercel `main` boundary.
2. Set **Base directory:** `landing`; **Build command:** `npm run build`; **Publish directory:** `public`. Use `landing/netlify.toml`, with functions under `landing/netlify/functions`. Do not publish the repository root.
3. Production origin: `https://hyupremium.netlify.app`. Confirm the new deploy's commit SHA and state in Netlify after pushing the landing branch.
4. Netlify **Environment variables** (Functions runtime, production):
   - `PUBLIC_LANDING_URL=https://hyupremium.netlify.app` (the exact deployed public origin; no path)
   - `RESEND_API_KEY`: restricted sending key from your Resend account.
   - `RESEND_FROM_EMAIL`: a sender email on a verified **custom sending domain**. The Vercel/Netlify provided subdomains cannot be used to control SPF/DKIM.
   - `EBOOK_URL`: HTTPS URL of the final PDF (not yet provided).
   - `EBOOK_TOKEN_KEY`: 32 cryptographically random bytes encoded in Base64 (generate offline with `openssl rand -base64 32`).
   - `BREVO_API_KEY`: server-side Brevo API key.
   - `BREVO_LIST_ID`: **dedicated, new, confirmed-consent marketing list**. Never use a preexisting mixed-consent list.
   - `RESEND_SEGMENT_ID`: dedicated confirmed-consent Resend segment (already created; ID available in Resend account).
5. Configure SPF/DKIM/DMARC and a working sender/reply contact. Verify a test recipient and check each provider's logs. Do not open enrollment without confirmed signup/unsubscribe behavior, reliable consent evidence and a reviewed privacy notice.

## Conditional ebook / marketing disclosure

Participation in this ebook program requires an *affirmative, unchecked-by-default* newsletter/marketing consent and double confirmation. The form states this condition plainly and offers a link to the privacy notice. **This commercial condition may not constitute freely given consent in every jurisdiction (especially where the GDPR applies)**; obtain a jurisdiction-specific legal review and consider offering a non-marketing ebook path if required. Unsubscribing must remain possible independently of the ebook delivery. Do not characterize conditioned consent as automatically valid solely because the checkbox is ticked.

## API behavior

- GET requests are rejected; only same-origin JSON POST requests are allowed. The public site triggers `/.netlify/functions/ebook`.
- On request: required privacy acknowledgment, unchecked-by-default **required** marketing newsletter consent checkbox, validation and honeypot, encrypted time-limited confirmation token, and a transactional verification email.
- On confirmation click: the API verifies that consent is true; Resend then sends the ebook and attempts to register the confirmed opt-in in the **dedicated Brevo list** and **Resend segment**. Requests without explicit marketing consent are rejected in the client and server; this is advertised as a newsletter-subscriber ebook benefit, not as an unconditional giveaway.
- Both API keys exist only on the server; the confirmation token uses AES-256-GCM. Netlify rate limit is an additional anti-abuse control.
- This is a starter implementation. Production launch also needs: persistent double-opt-in audit (proof of checkbox choice, source, timestamps, confirmation event and consent version); replay-safe confirmation tracking; consistent **two-way unsubscribe/suppression sync** between Brevo and Resend; automatic reconciliation if one provider succeeds and another fails; proper deletion/retention procedures; abuse protection beyond the simple rate limit. Until these are implemented, **do not send marketing campaigns from both providers**.
- Landing artwork uses existing Cloudflare R2 WebP derivatives. The public page does not fetch full-resolution archival originals.
- The API deliberately returns HTTP 503 until all required credentials and the ebook URL are configured. It does not pretend to have issued a real ebook before the file exists.
- Privacy policy text is a prelaunch draft. Add the valid operator contact, the operative privacy/data processing details, and jurisdiction-specific notices prior to public signup.

## Validation

`npm install && npm run build`. Use `netlify dev` for live serverless function checks and verify UI at mobile widths 360/390/768 and desktop 1280/1920. The gallery's existing `npm run egress:check`, `npm run typecheck` and `npm run build` must be run in the repository root prior to merge.

## Landing artwork editing

The GitHub Pages admin has a separate **Artwork Netlify** navigation item at `landing-artwork-admin.html`. Sign in there using an owner-scoped fine-grained GitHub PAT with Contents read/write permission. The PAT stays in memory for that tab; public artwork drafts may be saved locally without the token.

- `landing/public/artwork-defaults.json` and the HTML image URLs are the reviewed fallback included in a Netlify deployment.
- The published configuration is `landing/content/artworks.json` on the dedicated `content/landing-artwork` branch. Admin **Save Draft** writes only on the trusted device. **Publish** makes one SHA-guarded GitHub commit; the UI reads the file back to verify it. A conflict retains the draft and requires review.
- The landing page fetches the public raw GitHub configuration once per page load. GitHub's cache can delay visibility by a few minutes; there is no polling or per-edit Netlify/Vercel build. If this fetch fails, the included defaults stay visible.
- All 17 slots support selecting an existing gallery derivative, manually entering an approved R2 derivative URL, desktop/mobile X/Y crop, zoom and navy overlay. The gallery picker loads catalogue metadata only when opened.
- No new admin write service, browser-stored cleartext token, media origin, or Vercel branch deployment was added.

## Governance

See `../AGENTS.md` and `../Repository Rules/README.md`. Keep the deployment boundary intact: **do not merge into main until checks and Netlify deployment implications have been reviewed**; a merge can trigger one existing Vercel production release. Never broaden `vercel.json` branch-deploy policy. 
