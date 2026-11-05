# HYU PREMIUM — Ebook landing (Netlify only)

This is an isolated Netlify project within the HyuPremiumSplashArtGallery repository. The Next.js gallery stays on Vercel; the editorial admin stays on GitHub Pages.

## Deploy/import

1. The **existing** Netlify site `hyupremium` is linked to `hyu276/HyuPremiumSplashArtGallery` and deploys the `feat/netlify-ebook-landing` branch. Keep the landing release separate from the Vercel `main` boundary.
2. Set **Base directory:** `landing`; **Build command:** `npm run build`; **Publish directory:** `public`. Use `landing/netlify.toml`, with functions under `landing/netlify/functions`. Do not publish the repository root.
3. Production origin: `https://hyupremium.netlify.app`. Confirm the new deploy's commit SHA and state in Netlify after pushing the landing branch.
4. Configure Netlify environment variables for Functions / Production:
   - `PUBLIC_LANDING_URL=https://hyupremium.netlify.app`
   - `BREVO_API_KEY`: Brevo v3 API key (never commit to the repository).
   - `BREVO_SENDER_ID`: verified/active Brevo sender ID (existing account currently lists sender 1; test transactional delivery).
   - `BREVO_LIST_ID`: a **separate, newly created** ebook newsletter contact list ID. Do not point to existing mixed-consent Canva lists.
   - `EBOOK_URL`: final HTTPS PDF URL (not provided yet).
   - `EBOOK_TOKEN_KEY`: 32 cryptographically random bytes encoded as Base64 (generate locally using `openssl rand -base64 32`).
   - `EBOOK_LAUNCH_ENABLED`: `false` by default. Set to `true` **only after all prerequisites and end-to-end tests are complete**.
5. Set a consistent Reply-To mailbox and verify Brevo will actually send transactional email through its fallback domain on this account. Brevo's fallback sender is provider-controlled, not a user-owned `@brevo.com` mailbox. Stop if delivery is rejected.
6. Test new signup and confirmation with a controlled test address. Do not run marketing campaigns until reliable consent logs, suppression, and unsubscribe flows are tested. Redeploy Netlify after updating runtime variables.

## Conditional ebook / marketing disclosure

Participation in this ebook program requires an *affirmative, unchecked-by-default* newsletter/marketing consent and double confirmation. The form states this condition plainly and offers a link to the privacy notice. **This commercial condition may not constitute freely given consent in every jurisdiction (especially where the GDPR applies)**; obtain a jurisdiction-specific legal review and consider offering a non-marketing ebook path if required. Unsubscribing must remain possible independently of the ebook delivery. Do not characterize conditioned consent as automatically valid solely because the checkbox is ticked.

## API behavior (Brevo-only)

- The public frontend posts same-origin requests to `/.netlify/functions/ebook`. The function always returns HTTP 503 unless `EBOOK_LAUNCH_ENABLED=true` and every required configuration variable is present.
- The user explicitly opts into marketing (checkbox unchecked by default) and acknowledges privacy, then receives an email confirmation from Brevo's `/v3/smtp/email` transactional API.
- After verifying the token, the function checks existing Brevo contact suppression information before adding the confirmed subscriber to `BREVO_LIST_ID`. It **does not** set `updateEnabled:true` and refuses to automatically re-enable blacklisted/unsubscribed contacts.
- Brevo then sends the ebook link. Brevo also handles later marketing campaigns. **Resend is not used by this landing page**, no Resend credentials or segments are required.
- Confirmation token expiry is 24 hours; encryption is AES-256-GCM. There is an IP-based function rate limit. Email is validated server-side.
- **Prelaunch blockers:** persistent double-opt-in proof (consent source/version/verification timestamp), replay prevention, proper idempotence if the contact add succeeds but email delivery fails, working marketing unsubscribe/suppression flow, monitored delivery logs, completed privacy notice with actual operator contact, and real end-to-end tests. The current token is not single-use; keep the launch gate false until those are resolved.
- The ebook PDF has not been provided. Do not promise delivery until the valid HTTPS URL exists. The Brevo fallback domain behavior has not been verified for actual transactional delivery.
- All credentials must remain Netlify server-side environment variables and must never appear in frontend code or GitHub commits.

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
