# Brevo Forms embed — Hyu Premium ebook landing

The landing popup uses the **official Brevo Form Builder iframe** supplied by the operator, embedded as a lazy-loaded cross-origin iframe. The native Brevo form owns its fields, single affirmative marketing-consent checkbox, list selection, simple confirmation email, and ebook delivery. The landing code does not send form submissions to a custom API.

## Brevo Form Builder ownership and verification

- Make sure the native form has **exactly one checkbox**, initially **unchecked**, reading:
  "Tôi đồng ý nhận bản tin Canva Tips và Splash Art Design Tips từ Hyu Premium và có thể hủy đăng ký bất kỳ lúc nào."
- The operator explicitly selected **four Brevo lists**. Those list selections live in Brevo, not in the Netlify code. Verify all four groups are intended to receive newly opted-in contacts, especially the list labeled "Consent evidence pending" and any conversational-contact list. Never use list membership alone as proof of permission.
- The goal is **receiving the ebook after form submission**. Verify that the Brevo **Simple confirmation email** has the correct working ebook download URL; a Netlify `EBOOK_URL` variable does not automatically attach that URL to a Brevo Form Builder email. Do not claim ebook delivery is functional until tested with an email you control.
- Test spam/promotions and suppression behavior, plus all selected lists in Brevo. Existing unsubscribed contacts should not be reactivated.
- The dark navy popup chrome is preserved, but styling within the cross-origin Brevo iframe cannot be controlled by Netlify CSS. Style the form background and internal elements in Brevo's Form Builder.

## GitHub / Netlify changes

- Landing page still uses buttons labeled "NHẬN EBOOK" and opens the existing popup.
- Native form URL is loaded when the modal opens, with accessible title and direct-link fallback.
- CSP explicitly allows `frame-src https://5ba93be9.sibforms.com`. Other frame origins remain blocked.
- Legacy pending ebook confirmation links (`?confirm=`) still go through the existing `ebook.mts` function; the native embed does not use that endpoint.
- The old custom `newsletter.mts` endpoint is deleted. Environment variables `BREVO_DOI_TEMPLATE_ID` and `BREVO_NEWSLETTER_LIST_ID` are unused by the embed; they may remain stored on Netlify without being exposed to the browser.
- Deployment target remains Netlify branch `feat/netlify-ebook-landing`, not Vercel main. Validate the PR preview before merging.

## Testing

Open the Netlify deploy preview, click the Ebook CTA, check layout at 360/390/768/1280 px and keyboard navigation, confirm CSP does not block Brevo, submit only with a controlled test address, verify that it receives the PDF link in the Brevo confirmation email, and verify expected Brevo list membership. Verify other gallery, artwork and external links remain unchanged.

## Approved mobile UX and ebook template (2026-10-14)

The user approved the interactive mobile-first demo. This release makes the existing Netlify Brevo iframe dialog full-height on mobile (one scroll surface within the large iframe) and uses a compact header with an always accessible 44px close target. On desktop it remains a centered modal. Cross-origin Brevo form interior styling stays owned by Brevo Form Builder and cannot be restyled by parent Netlify CSS. The iframe now has a 640px fallback height and grows to the dialog's available space. Keyboard Escape and previous-focus restoration remain in app.js.

Brevo transactional template **#13** `HYU PREMIUM | Ebook Delivery | Navy Cyan | 2026` was created active with the approved navy/cyan HTML, subject `Ebook hướng dẫn thiết kế skin của bạn đã sẵn sàng`, and the existing Google Docs ebook URL. **The operator must select template #13 as the Simple confirmation email in Brevo's Form Builder**. The Brevo integration does not expose a form-update action, and creating a template does not attach it to the live form. Do not delete the old confirmation template or change the four list selections without operator approval. Verify the Google Docs sharing permission for recipients.
