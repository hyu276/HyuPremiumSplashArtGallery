import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OWNER_EMAIL = "csquocnguyen@gmail.com";
const PROFILES = [
  {
    key: "owner",
    projectRef: "zkrhwqgmynbbmoktokdq",
    url: "https://zkrhwqgmynbbmoktokdq.supabase.co",
    publishableKey: "sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq",
  },
  {
    key: "huy9vnd",
    projectRef: "unggkruzjmsjscdiukfr",
    url: "https://unggkruzjmsjscdiukfr.supabase.co",
    publishableKey: "sb_publishable_UQXSQcKH_81clodAPnceYg_1UUYz7bc",
  },
] as const;

const ALLOWED_ORIGINS = new Set([
  "https://hyu276.github.io",
  "https://hyupremium.vercel.app",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function authenticate(token: string) {
  for (const profile of PROFILES) {
    try {
      const userRes = await fetch(`${profile.url}/auth/v1/user`, {
        headers: {
          apikey: profile.publishableKey,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!userRes.ok) continue;
      const user = await userRes.json();
      if (!user?.id) continue;

      const adminRes = await fetch(
        `${profile.url}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
        {
          headers: {
            apikey: profile.publishableKey,
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!adminRes.ok) continue;
      const rows = await adminRes.json();
      if (Array.isArray(rows) && rows.length) return { profile, user };
    } catch {
      // Continue checking the remaining configured profiles.
    }
  }
  return null;
}

const SERVICE_URL = Deno.env.get("SUPABASE_URL") || "https://zkrhwqgmynbbmoktokdq.supabase.co";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function serviceRest(path: string, init: RequestInit = {}) {
  if (!SERVICE_ROLE) throw new Error("Service role is unavailable.");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_ROLE);
  headers.set("Authorization", `Bearer ${SERVICE_ROLE}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return fetch(`${SERVICE_URL}/rest/v1/${path}`, { ...init, headers });
}

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function getRequest(id: string) {
  const res = await serviceRest(`publish_requests?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!res.ok) throw new Error(`Request lookup failed (${res.status}).`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getGate(sourceProfile: string, artworkId: string) {
  const res = await serviceRest(
    `publish_gates?select=*&source_profile=eq.${encodeURIComponent(sourceProfile)}&artwork_id=eq.${encodeURIComponent(artworkId)}&limit=1`,
  );
  if (!res.ok) throw new Error(`Gate lookup failed (${res.status}).`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function upsertGate(row: Record<string, unknown>) {
  const res = await serviceRest("publish_gates?on_conflict=source_profile,artwork_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Gate update failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || row : row;
}

async function createRequest(req: Request, auth: any, body: any) {
  if (auth.profile.key === "owner") return json(req, 400, { error: "Owner uploads do not require moderation." });

  const sourceProfile = cleanText(body?.sourceProfile, 80);
  const artworkId = cleanText(body?.artworkId, 240);
  const artworkName = cleanText(body?.artworkName, 300);
  const candidateImage = cleanText(body?.candidateImage, 2000);
  const uploadPath = cleanText(body?.uploadPath, 1000);
  const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (sourceProfile !== auth.profile.key) return json(req, 403, { error: "Source profile does not match the authenticated admin." });
  if (!artworkId || !candidateImage || !uploadPath.startsWith("uploads/")) {
    return json(req, 400, { error: "Artwork ID, uploaded image and upload path are required." });
  }
  const expectedPrefix = `${auth.profile.url}/storage/v1/object/public/artworks/`;
  if (!candidateImage.startsWith(expectedPrefix)) {
    return json(req, 400, { error: "Candidate image must belong to the authenticated profile artwork bucket." });
  }

  const oldGate = await getGate(sourceProfile, artworkId);
  const previousApprovedImage = cleanText(oldGate?.approved_image, 2000);

  const supersede = await serviceRest(
    `publish_requests?source_profile=eq.${encodeURIComponent(sourceProfile)}&artwork_id=eq.${encodeURIComponent(artworkId)}&status=eq.pending`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "superseded", decided_at: new Date().toISOString(), decided_by: "resubmitted" }),
    },
  );
  if (!supersede.ok) throw new Error(`Unable to supersede prior request (${supersede.status}).`);

  const insert = await serviceRest("publish_requests", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      source_profile: sourceProfile,
      source_project_ref: auth.profile.projectRef,
      artwork_id: artworkId,
      requester_user_id: auth.user.id,
      requester_email: cleanText(auth.user.email, 320).toLowerCase(),
      artwork_name: artworkName,
      candidate_image: candidateImage,
      upload_path: uploadPath,
      metadata,
      status: "pending",
      previous_approved_image: previousApprovedImage,
    }),
  });
  if (!insert.ok) throw new Error(`Unable to create publish request (${insert.status}): ${await insert.text()}`);
  const insertedRows = await insert.json();
  const requestRow = Array.isArray(insertedRows) ? insertedRows[0] : null;
  if (!requestRow?.id) throw new Error("Publish request was created without an ID.");

  await upsertGate({
    source_profile: sourceProfile,
    artwork_id: artworkId,
    status: "pending",
    request_id: requestRow.id,
    candidate_image: candidateImage,
    approved_image: previousApprovedImage,
    updated_at: new Date().toISOString(),
  });

  return json(req, 201, { request: requestRow });
}

async function cancelRequest(req: Request, auth: any, body: any) {
  const requestId = cleanText(body?.requestId, 80);
  const row = await getRequest(requestId);
  if (!row) return json(req, 404, { error: "Publish request not found." });
  if (row.status !== "pending") return json(req, 409, { error: "Only pending requests can be cancelled." });
  if (row.source_profile !== auth.profile.key || row.requester_user_id !== auth.user.id) {
    return json(req, 403, { error: "You cannot cancel this request." });
  }

  const update = await serviceRest(`publish_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "cancelled", decided_at: new Date().toISOString(), decided_by: cleanText(auth.user.email, 320) }),
  });
  if (!update.ok) throw new Error(`Unable to cancel request (${update.status}).`);

  const gate = await getGate(row.source_profile, row.artwork_id);
  if (gate?.request_id === requestId) {
    if (row.previous_approved_image) {
      await upsertGate({
        source_profile: row.source_profile,
        artwork_id: row.artwork_id,
        status: "approved",
        request_id: null,
        candidate_image: row.previous_approved_image,
        approved_image: row.previous_approved_image,
        updated_at: new Date().toISOString(),
      });
    } else {
      const del = await serviceRest(
        `publish_gates?source_profile=eq.${encodeURIComponent(row.source_profile)}&artwork_id=eq.${encodeURIComponent(row.artwork_id)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
      if (!del.ok) throw new Error(`Unable to restore publish gate (${del.status}).`);
    }
  }

  return json(req, 200, { ok: true, status: "cancelled" });
}

async function decideRequest(req: Request, auth: any, body: any) {
  const email = cleanText(auth.user.email, 320).toLowerCase();
  if (email !== OWNER_EMAIL || auth.profile.key !== "owner") {
    return json(req, 403, { error: "Only the owner can approve or decline publish requests." });
  }

  const requestId = cleanText(body?.requestId, 80);
  const decision = cleanText(body?.decision, 30).toLowerCase();
  if (!["approved", "declined"].includes(decision)) return json(req, 400, { error: "Decision must be approved or declined." });

  const row = await getRequest(requestId);
  if (!row) return json(req, 404, { error: "Publish request not found." });
  if (row.status !== "pending") return json(req, 409, { error: `Request is already ${row.status}.` });

  const now = new Date().toISOString();
  const update = await serviceRest(`publish_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: decision, decided_at: now, decided_by: email }),
  });
  if (!update.ok) throw new Error(`Unable to save decision (${update.status}).`);

  await upsertGate({
    source_profile: row.source_profile,
    artwork_id: row.artwork_id,
    status: decision,
    request_id: row.id,
    candidate_image: row.candidate_image,
    approved_image: decision === "approved" ? row.candidate_image : (row.previous_approved_image || ""),
    updated_at: now,
  });

  return json(req, 200, { ok: true, status: decision, requestId });
}

async function listRequests(req: Request, auth: any) {
  const email = cleanText(auth.user.email, 320).toLowerCase();
  const isOwner = auth.profile.key === "owner" && email === OWNER_EMAIL;
  const url = new URL(req.url);
  const requestedStatus = cleanText(url.searchParams.get("status"), 30).toLowerCase();
  const filters: string[] = ["select=*"];

  if (!isOwner) {
    filters.push(`requester_user_id=eq.${encodeURIComponent(auth.user.id)}`);
    filters.push(`source_profile=eq.${encodeURIComponent(auth.profile.key)}`);
  } else if (requestedStatus && ["pending","approved","declined","superseded","cancelled"].includes(requestedStatus)) {
    filters.push(`status=eq.${encodeURIComponent(requestedStatus)}`);
  }
  filters.push("order=created_at.desc");
  filters.push("limit=200");

  const res = await serviceRest(`publish_requests?${filters.join("&")}`);
  if (!res.ok) throw new Error(`Unable to load publish requests (${res.status}).`);
  const rows = await res.json();
  return json(req, 200, { requests: Array.isArray(rows) ? rows : [], viewer: { email, profile: auth.profile.key, owner: isOwner } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });

  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, 403, { error: "Origin not allowed." });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(req, 401, { error: "Missing access token." });
  const auth = await authenticate(token);
  if (!auth) return json(req, 403, { error: "Admin authorization required." });

  try {
    if (req.method === "GET") return await listRequests(req, auth);
    if (req.method !== "POST") return json(req, 405, { error: "Method not allowed." });

    const body = await req.json().catch(() => ({}));
    const action = cleanText(body?.action, 30).toLowerCase();
    if (action === "create") return await createRequest(req, auth, body);
    if (action === "cancel") return await cancelRequest(req, auth, body);
    if (action === "decide") return await decideRequest(req, auth, body);
    return json(req, 400, { error: "Unknown moderation action." });
  } catch (error) {
    console.error(error);
    return json(req, 500, { error: error instanceof Error ? error.message : "Moderation request failed." });
  }
});
