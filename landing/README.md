# HYU PREMIUM — Ebook landing (Netlify only)

This is an isolated Netlify project within the HyuPremiumSplashArtGallery repository. The Next.js/Vercel gallery, GitHub Pages admin, catalogue and Cloudflare media infrastructure must stay unchanged.

## Deploy/import

1. Netlify → **Add new project → Import existing project → GitHub** → select `hyu276/HyuPremiumSplashArtGallery`.
2. Set **Base directory:** `landing`; **Build command:** `npm run build`; **Publish directory:** `public`. Use `landing/netlify.toml`, with functions under `landing/netlify/functions`. Do not publish the repository root.
3. Set custom domain and confirm the expected production origin. Existing empty Netlify project: `hyu-premium-ebook` (a Git link or deployment must still be configured).
4. Netlify **Environment variables** (Functions runtime, production):
   - `PUBLIC_LANDING_URL=https://your-site.netlify.app` (the exact deployed public origin; no path)
   - `RESEND_API_KEY`: restricted sending key from your Resend account.
   - `RESEND_FROM_EMAIL`: a sender email on a verified **custom sending domain**. The Vercel/Netlify provided subdomains cannot be used to control SPF/DKIM.
   - `EBOOK_URL`: HTTPS URL of the final PDF (not yet provided).
   - `EBOOK_TOKEN_KEY`: 32 cryptographically random bytes encoded in Base64 (generate offline with `openssl rand -base64 32`).
   - `BREVO_API_KEY`: server-side Brevo API key.
   - `BREVO_LIST_ID`: **dedicated, new, confirmed-consent marketing list**. Never use a preexisting mixed-consent list.
   - `RESEND_SEGMENT_ID`: dedicated confirmed-consent Resend segment (already created; ID available in Resend account).
5. Configure SPF/DKIM/DMARC and a working sender/reply contact. Verify a test recipient and check each provider's logs. Do not open enrollment without confirmed signup/unsubscribe behavior, reliable consent evidence and a reviewed privacy notice.

## API behavior

- GET requests are rejected; only same-origin JSON POST requests are allowed. The public site triggers `/.netlify/functions/ebook`.
- On request: required privacy acknowledgment, unchecked-by-default optional marketing checkbox, validation and honeypot, encrypted time-limited confirmation token, and a transactional verification email.
- On confirmation click: **Resend sends the ebook**. Only when marketing is expressly selected does the API send contact data to the dedicated **Brevo list** and **Resend segment**. A person requesting only the ebook must not be added to either marketing audience.
- Both API keys exist only on the server; the confirmation token uses AES-256-GCM. Netlify rate limit is an additional anti-abuse control.
- This is a starter implementation. Production launch also needs: persistent double-opt-in audit (proof of checkbox choice, source, timestamps, confirmation event and consent version); replay-safe confirmation tracking; consistent **two-way unsubscribe/suppression sync** between Brevo and Resend; automatic reconciliation if one provider succeeds and another fails; proper deletion/retention procedures; abuse protection beyond the simple rate limit. Until these are implemented, **do not send marketing campaigns from both providers**.
- Existing gallery artwork previews are only fetched from the existing public repository URL; Netlify never ingests admin code or full-resolution archival originals.
- The API deliberately returns HTTP 503 until all required credentials and the ebook URL are configured. It does not pretend to have issued a real ebook before the file exists.
- Privacy policy text is a prelaunch draft. Add the valid operator contact, the operative privacy/data processing details, and jurisdiction-specific notices prior to public signup.

## Validation

`npm install && npm run build`. Use `netlify dev` for live serverless function checks and verify UI at mobile widths 360/390/768 and desktop 1280/1920. The gallery's existing `npm run egress:check`, `npm run typecheck` and `npm run build` must be run in the repository root prior to merge.

## Governance

See `../AGENTS.md` and `../Repository Rules/README.md`. Keep the deployment boundary intact: **do not merge into main until checks and Netlify deployment implications have been reviewed**; a merge can trigger one existing Vercel production release. Never broaden `vercel.json` branch-deploy policy. 
