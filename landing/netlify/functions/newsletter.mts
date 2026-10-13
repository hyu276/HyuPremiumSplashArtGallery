import type { Config } from "@netlify/functions";

type SignupPayload = { email: string; consent: boolean; company?: string };
type BrevoContact = { emailBlacklisted?: boolean; listUnsubscribed?: number[]; listIds?: number[] };
const MAX_REQUEST_BYTES = 2048;
const API_TIMEOUT_MS = 10000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const env = (key: string) => Netlify.env.get(key)?.trim() || "";
const reply = (message: string, status = 202) => Response.json({ message }, {
  status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
function getConfig() {
  const apiKey = env("BREVO_API_KEY");
  const listId = Number(env("BREVO_NEWSLETTER_LIST_ID"));
  const templateId = Number(env("BREVO_DOI_TEMPLATE_ID"));
  const origin = env("PUBLIC_LANDING_URL");
  if (!apiKey || !origin || !Number.isSafeInteger(listId) || listId <= 0 ||
      !Number.isSafeInteger(templateId) || templateId <= 0) return null;
  const landing = new URL(origin);
  if (landing.protocol !== "https:") return null;
  return { apiKey, listId, templateId, landing };
}
async function findContact(email: string, key: string): Promise<BrevoContact | null> {
  const response = await fetch("https://api.brevo.com/v3/contacts/" + encodeURIComponent(email) + "?identifierType=email_id", {
    headers: { "api-key": key, accept: "application/json" },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("brevo-contact-" + response.status);
  return response.json() as Promise<BrevoContact>;
}
async function requestDOI(email: string, settings: NonNullable<ReturnType<typeof getConfig>>) {
  const response = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
    method: "POST",
    headers: { "api-key": settings.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      email, includeListIds: [settings.listId], templateId: settings.templateId,
      redirectionUrl: new URL("/?newsletter=confirmed", settings.landing).toString(),
      contactPixelTrackingConsent: false,
    }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("brevo-doi-" + response.status);
}
export default async function handler(request: Request) {
  if (request.method !== "POST") return reply("Method not allowed", 405);
  const settings = getConfig();
  if (!settings) return reply("Đăng ký bản tin chưa được cấu hình. Vui lòng quay lại sau.", 503);
  if (request.headers.get("origin") !== settings.landing.origin) return reply("Origin not permitted", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply("Unsupported content type", 415);
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) return reply("Request too large", 413);
  try {
    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BYTES) return reply("Request too large", 413);
    const unknownPayload: unknown = JSON.parse(raw);
    if (!unknownPayload || typeof unknownPayload !== "object") return reply("Yêu cầu không hợp lệ.", 400);
    const { email, consent, company } = unknownPayload as Partial<SignupPayload>;
    if (typeof company === "string" && company) return reply("Nếu địa chỉ hợp lệ, hãy kiểm tra hộp thư để xác nhận.");
    if (consent !== true) return reply("Bạn cần chủ động đồng ý nhận bản tin.", 400);
    if (typeof email !== "string" || email.length > 254 || !EMAIL_PATTERN.test(email.trim())) return reply("Vui lòng nhập địa chỉ email hợp lệ.", 400);
    const normalized = email.trim().toLowerCase();
    const contact = await findContact(normalized, settings.apiKey);
    if (contact?.emailBlacklisted || contact?.listUnsubscribed?.length || contact?.listIds?.includes(settings.listId)) {
      return reply("Nếu địa chỉ hợp lệ, hãy kiểm tra hộp thư để xác nhận.");
    }
    await requestDOI(normalized, settings);
    return reply("Kiểm tra hộp thư và bấm liên kết xác nhận để hoàn tất đăng ký.");
  } catch (error) {
    console.error(JSON.stringify({
      boundary: "brevo-newsletter", operation: "double-opt-in",
      reason: error instanceof Error ? error.message : "unknown",
    }));
    return reply("Hiện chưa thể xử lý đăng ký. Vui lòng thử lại sau.", 502);
  }
}
export const config: Config = {
  path: "/.netlify/functions/newsletter",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip"], windowSize: 60, windowLimit: 5 },
};
