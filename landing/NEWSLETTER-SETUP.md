# Brevo newsletter signup — Netlify landing

This is a same-origin custom form styled with existing navy/cyan modal CSS, backed by Brevo's official Double Opt-in API. It is **not** a form configured in Brevo's Form Builder.

## Required Netlify variables (Functions scope)
- `BREVO_API_KEY`: existing secret, server-side only.
- `BREVO_DOI_TEMPLATE_ID=8`: active Brevo template, `doiTemplate=true`, `optin` tag, `{{ params.DOIurl }}` link.
- `BREVO_NEWSLETTER_LIST_ID`: a **new dedicated empty list** for people who confirm the Canva Tips + Splash Art Design Tips newsletter. NEVER use existing list IDs 2, 4 or 5, which have mixed or pending consent.
- `PUBLIC_LANDING_URL=https://hyupremium.netlify.app`: existing production origin.

The endpoint returns HTTP 503 if the dedicated list ID or any setting is absent; it never falls back to the legacy `BREVO_LIST_ID=4`. Brevo adds recipients to the list only after they click the DOI email. Previously unsubscribed and blocklisted contacts are not automatically reactivated.

## QA and rollout
1. In Brevo Contacts > Lists, create a new empty list; set its ID as `BREVO_NEWSLETTER_LIST_ID` in Netlify and redeploy. Sender domain authentication should be completed (the active sender is currently Gmail).
2. Use a fresh controlled test address: confirm an unchecked box blocks submission; check the box; confirm email; verify the contact only appears in the dedicated list, and `?newsletter=confirmed` shows confirmation.
3. Check blocked/unsubscribed email, duplicate signup, honeypot, invalid input, Brevo outage, and test keyboard/mobile at 360, 390, 768 and 1280 widths.
4. Review privacy contact and email unsubscribe/suppression handling prior to sending marketing messages.
5. Keep the legacy ebook endpoint and tokens independent; this newsletter form does not promise immediate ebook delivery. Do not merge landing changes to Vercel `main`; Netlify tracks the `feat/netlify-ebook-landing` branch.

The form has exactly one unchecked marketing consent checkbox: "Tôi đồng ý nhận bản tin Canva Tips và Splash Art Design Tips từ Hyu Premium và có thể hủy đăng ký bất kỳ lúc nào.".
