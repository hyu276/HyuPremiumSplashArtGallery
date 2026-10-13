import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Config } from "@netlify/functions";

type Signup = { action: "request"; email: string; marketing: boolean; privacy: boolean; company?: string };
type Confirmation = { action: "confirm"; token: string };
type Payload = { email: string; marketing: boolean; created: number; version: string };
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const CONSENT_VERSION = "ebook-newsletter-required-v2-2026-10";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const required = (key: string) => Netlify.env.get(key)?.trim() || "";
const json = (message: string, status = 200) => Response.json({ message }, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
function isReady() {
  return ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "EBOOK_URL", "EBOOK_TOKEN_KEY", "BREVO_API_KEY", "BREVO_LIST_ID", "RESEND_SEGMENT_ID"].every(key => Boolean(required(key)));
}
function encryptionKey() {
  const bytes = Buffer.from(required("EBOOK_TOKEN_KEY"), "base64");
  if (bytes.length !== 32) throw new Error("Invalid EBOOK_TOKEN_KEY");
  return bytes;
}
function encrypt(payload: Payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const value = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), value]).toString("base64url");
}
function decrypt(token: string): Payload {
  if (!/^[A-Za-z0-9_-]{36,1200}$/.test(token)) throw new Error("Bad token");
  const binary = Buffer.from(token, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), binary.subarray(0, 12));
  decipher.setAuthTag(binary.subarray(12, 28));
  const data = JSON.parse(Buffer.concat([decipher.update(binary.subarray(28)), decipher.final()]).toString("utf8")) as Payload;
  if (data.version !== CONSENT_VERSION || !EMAIL_PATTERN.test(data.email)) throw new Error("Bad payload");
  if (Date.now() - data.created > TOKEN_TTL_MS || data.created > Date.now() + 60000) throw new Error("Expired token");
  return data;
}
async function postApi(url: string, apiKey: string, body: Record<string, unknown>, provider: "resend" | "brevo", key?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(provider === "resend" ? { Authorization: "Bearer " + apiKey } : { "api-key": apiKey }) };
  if (key && provider === "resend") headers["Idempotency-Key"] = key;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(9000) });
  if (!response.ok) {
    console.error(JSON.stringify({ service: provider, path: new URL(url).pathname, status: response.status, error: "upstream_failed" }));
    throw new Error(provider + " API unavailable");
  }
  return response;
}
function sender() { return "Hyu Premium <" + required("RESEND_FROM_EMAIL") + ">"; }
async function sendConfirmation(email: string, token: string) {
  const base = required("PUBLIC_LANDING_URL");
  const confirmUrl = new URL(base || "https://hyupremium.netlify.app");
  confirmUrl.searchParams.set("confirm", token);
  const link = confirmUrl.toString();
  const text = "Bạn đã yêu cầu ebook Hyu Premium. Xác nhận email tại: " + link + "\nLiên kết có hiệu lực trong 24 giờ. Nếu không phải bạn đăng ký, hãy bỏ qua thư này.";
  const html = '<!doctype html><html lang="vi"><body style="font-family:Arial,sans-serif;color:#172332;background:#f6fbfd;padding:35px"><h1>Xác nhận email</h1><p>Bạn đã yêu cầu nhận ebook từ Hyu Premium.</p><p><a href="' + link.replaceAll("&", "&amp;") + '" style="background:#077da6;color:white;padding:16px 22px;display:inline-block">Xác nhận yêu cầu</a></p><p>Liên kết hết hạn sau 24 giờ. Nếu không phải bạn, vui lòng bỏ qua thư này.</p></body></html>';
  await postApi("https://api.resend.com/emails", required("RESEND_API_KEY"), { from: sender(), to: [email], subject: "Xác nhận yêu cầu ebook Hyu Premium", text, html }, "resend", "hyu-confirm-" + fingerprint(token).slice(0,48));
}
async function deliverEbook(email: string, token: string) {
  const ebook = new URL(required("EBOOK_URL"));
  if (ebook.protocol !== "https:") throw new Error("Ebook URL must use HTTPS");
  const text = "Cảm ơn bạn đã xác nhận. Ebook hướng dẫn tạo skin Hyu Premium ở đây: " + ebook.toString() + "\nCảm ơn bạn đã quan tâm!";
  const html = '<!doctype html><html lang="vi"><body style="font-family:Arial,sans-serif;color:#172332;background:#f6fbfd;padding:35px"><h1>Ebook của bạn đã sẵn sàng</h1><p>Chào mừng bạn đến với thế giới sáng tạo skin concept của Hyu Premium.</p><p><a href="' + ebook.toString().replaceAll("&", "&amp;").replaceAll('"', "&quot;") + '" style="background:#077da6;color:white;padding:16px 22px;display:inline-block">Đọc ebook</a></p><p>Đây là email giao ebook bạn đã yêu cầu, không phải email quảng cáo.</p></body></html>';
  await postApi("https://api.resend.com/emails", required("RESEND_API_KEY"), { from: sender(), to: [email], subject: "Ebook hướng dẫn thiết kế skin của bạn", text, html }, "resend", "hyu-ebook-" + fingerprint(token).slice(0,48));
}
async function syncConsent(data: Payload) {
  const consentAt = new Date(data.created).toISOString();
  await postApi("https://api.brevo.com/v3/contacts", required("BREVO_API_KEY"), { email: data.email, listIds: [Number(required("BREVO_LIST_ID"))], updateEnabled: true }, "brevo");
  await postApi("https://api.resend.com/contacts", required("RESEND_API_KEY"), { email: data.email, segment_ids: [required("RESEND_SEGMENT_ID")], properties: { hyu_optin_at: consentAt, hyu_optin_source: "netlify-ebook-landing-double-optin", hyu_optin_version: CONSENT_VERSION } }, "resend");
}
function isAllowedOrigin(request: Request) {
  const expected = required("PUBLIC_LANDING_URL");
  if (!expected) return false;
  const origin = request.headers.get("origin");
  try { return Boolean(origin && new URL(origin).origin === new URL(expected).origin); } catch { return false; }
}
async function requestSignup(data: Signup) {
  if (data.company) return json("Nếu email hợp lệ, bạn sẽ nhận hướng dẫn xác nhận.");
  if (data.marketing !== true) return json("Bạn cần chủ động đồng ý nhận bản tin và email marketing để tham gia chương trình ebook.", 400);
  if (!data.privacy || !EMAIL_PATTERN.test(data.email.trim()) || data.email.trim().length > 254) return json("Kiểm tra email và điều khoản xử lý dữ liệu.", 400);
  const email = data.email.trim().toLowerCase();
  const token = encrypt({ email, marketing: data.marketing, created: Date.now(), version: CONSENT_VERSION });
  await sendConfirmation(email, token);
  return json("Kiểm tra hộp thư và bấm xác nhận trong vòng 24 giờ. Ebook sẽ chỉ được gửi sau khi xác nhận.");
}
async function confirmSignup(data: Confirmation) {
  let payload: Payload;
  try { payload = decrypt(data.token); } catch { return json("Liên kết không hợp lệ hoặc đã hết hạn. Hãy đăng ký lại.", 400); }
  if (payload.marketing !== true) return json("Bạn chưa đồng ý nhận marketing nên chưa đủ điều kiện nhận ebook. Vui lòng đăng ký lại.", 403);
  await deliverEbook(payload.email, data.token);
  if (payload.marketing) {
    try { await syncConsent(payload); }
    catch { return json("Ebook đã được gửi. Chưa thể hoàn tất đăng ký nhận tin marketing; vui lòng liên hệ hỗ trợ.", 502); }
  }
  return json("Đã gửi ebook và ghi nhận đăng ký nhận bản tin của bạn. Bạn có thể hủy đăng ký bất kỳ lúc nào.");
}
export default async function handler(request: Request) {
  if (request.method !== "POST") return json("Method not allowed", 405);
  if (!isAllowedOrigin(request)) return json("Origin not permitted", 403);
  if (!isReady()) return json("Hệ thống nhận ebook chưa mở. Vui lòng quay lại sau.", 503);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 3000) return json("Request too large", 413);
  try {
    const raw = await request.text();
    if (raw.length > 3000) return json("Request too large", 413);
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || !("action" in data)) return json("Invalid request", 400);
    if (data.action === "request" && "email" in data && typeof data.email === "string" && "marketing" in data && typeof data.marketing === "boolean" && "privacy" in data && typeof data.privacy === "boolean") return await requestSignup(data as Signup);
    if (data.action === "confirm" && "token" in data && typeof data.token === "string") return await confirmSignup(data as Confirmation);
    return json("Invalid request", 400);
  } catch (error) {
    console.error(JSON.stringify({ service: "ebook", message: error instanceof Error ? error.message : "unknown" }));
    return json("Tạm thời không thể xử lý yêu cầu. Vui lòng thử lại sau.", 502);
  }
}
export const config: Config = { path: "/.netlify/functions/ebook", rateLimit: { action: "rate_limit", aggregateBy: ["ip"], windowSize: 60, windowLimit: 6 } };
