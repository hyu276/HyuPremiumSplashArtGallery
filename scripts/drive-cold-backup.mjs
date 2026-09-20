import { createHash, createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SOURCE_FILES = ['data/backend/catalogue.json', 'data/backend/team.json'];
const REQUEST_TIMEOUT_MS = 60_000;
const CONCURRENCY = 2;

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function jsonBase64Url(value) {
  return base64Url(JSON.stringify(value));
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function assertString(value, label) {
  if (!String(value || '').trim()) throw new Error(`${label} is required.`);
  return String(value).trim();
}

function loadColdArchive(storage) {
  const archive = storage?.coldArchive || {};
  return {
    provider: assertString(archive.provider, 'coldArchive.provider'),
    rootFolderId: assertString(archive.rootFolderId, 'coldArchive.rootFolderId'),
    mediaFolderId: assertString(archive.mediaFolderId, 'coldArchive.mediaFolderId'),
    manifestsFolderId: assertString(archive.manifestsFolderId, 'coldArchive.manifestsFolderId'),
    ready: archive.ready === true
  };
}

function collectManagedUrls(value, mediaBaseUrl, output) {
  if (typeof value === 'string') {
    try {
      const url = new URL(value);
      const base = new URL(mediaBaseUrl);
      if (url.origin === base.origin && url.pathname.startsWith('/media/')) output.add(url.href);
    } catch {}
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectManagedUrls(item, mediaBaseUrl, output);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectManagedUrls(item, mediaBaseUrl, output);
  }
}

function keyFromMediaUrl(value, mediaBaseUrl) {
  const url = new URL(value);
  const base = new URL(mediaBaseUrl);
  if (url.origin !== base.origin || !url.pathname.startsWith('/media/')) throw new Error(`Unmanaged media URL: ${value}`);
  const parts = url.pathname.slice('/media/'.length).split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length || parts.some(part => part === '.' || part === '..' || part.includes('\\'))) throw new Error(`Unsafe media key: ${value}`);
  return parts.join('/');
}

async function loadPlan() {
  const storage = JSON.parse(await readFile('data/backend/storage.json', 'utf8'));
  const mediaBaseUrl = assertString(storage.publicBaseUrl, 'storage.publicBaseUrl').replace(/\/$/, '');
  const coldArchive = loadColdArchive(storage);
  if (coldArchive.provider !== 'google-drive') throw new Error('coldArchive.provider must be google-drive.');
  const urls = new Set();
  for (const file of SOURCE_FILES) {
    const payload = JSON.parse(await readFile(file, 'utf8'));
    collectManagedUrls(payload, mediaBaseUrl, urls);
  }
  const entries = [...urls].map(url => ({ url, key: keyFromMediaUrl(url, mediaBaseUrl) })).sort((a, b) => a.key.localeCompare(b.key));
  if (!entries.length) throw new Error('No managed R2 media URLs found in authoritative metadata.');
  return { storage, coldArchive, mediaBaseUrl, entries };
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken() {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is required for backup execution.');
  const credentials = JSON.parse(raw);
  const clientEmail = assertString(credentials.client_email, 'service account client_email');
  const privateKey = assertString(credentials.private_key, 'service account private_key');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    jsonBase64Url({ alg: 'RS256', typ: 'JWT' }),
    jsonBase64Url({
      iss: clientEmail,
      scope: DRIVE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600
    })
  ].join('.');
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(privateKey).toString('base64url')}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });
  const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error(`Google OAuth failed: ${response.status} ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json();
  return assertString(payload.access_token, 'Google access token');
}

async function driveRequest(token, path, init = {}) {
  const response = await fetchWithTimeout(`${DRIVE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`Drive API ${response.status}: ${(await response.text()).slice(0, 700)}`);
  return response;
}

async function listNamedChild(token, parentId, name, mimeType) {
  const clauses = [
    `'${escapeDriveQuery(parentId)}' in parents`,
    `name = '${escapeDriveQuery(name)}'`,
    'trashed = false'
  ];
  if (mimeType) clauses.push(`mimeType = '${escapeDriveQuery(mimeType)}'`);
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id,name,mimeType,size,md5Checksum,parents)',
    spaces: 'drive',
    pageSize: '10'
  });
  const response = await driveRequest(token, `/files?${params}`);
  const payload = await response.json();
  return Array.isArray(payload.files) ? payload.files[0] || null : null;
}

async function createFolder(token, parentId, name) {
  const existing = await listNamedChild(token, parentId, name, FOLDER_MIME);
  if (existing) return existing.id;
  const response = await driveRequest(token, '/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] })
  });
  return assertString((await response.json()).id, `folder id for ${name}`);
}

async function ensureKeyParent(token, mediaFolderId, key, folderCache) {
  const segments = key.split('/');
  const fileName = segments.pop();
  let parentId = mediaFolderId;
  let logicalPath = '';
  for (const segment of segments) {
    logicalPath = logicalPath ? `${logicalPath}/${segment}` : segment;
    if (!folderCache.has(logicalPath)) folderCache.set(logicalPath, await createFolder(token, parentId, segment));
    parentId = folderCache.get(logicalPath);
  }
  return { parentId, fileName };
}

function md5(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

async function downloadMedia(url) {
  const response = await fetchWithTimeout(url, { headers: { Accept: '*/*' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Media download ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`Empty media response: ${url}`);
  return { bytes, contentType: response.headers.get('content-type') || 'application/octet-stream' };
}

async function createDriveFile(token, parentId, fileName, bytes, contentType) {
  const boundary = `hyu-${crypto.randomUUID()}`;
  const metadata = Buffer.from(JSON.stringify({ name: fileName, parents: [parentId] }));
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([prefix, bytes, suffix]);
  const response = await fetchWithTimeout(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,size,md5Checksum`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!response.ok) throw new Error(`Drive upload ${response.status}: ${(await response.text()).slice(0, 700)}`);
  return response.json();
}

async function replaceDriveFile(token, fileId, bytes, contentType) {
  const response = await fetchWithTimeout(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,size,md5Checksum`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType
    },
    body: bytes
  });
  if (!response.ok) throw new Error(`Drive replace ${response.status}: ${(await response.text()).slice(0, 700)}`);
  return response.json();
}

async function backupEntry(token, archive, entry, folderCache) {
  const { bytes, contentType } = await downloadMedia(entry.url);
  const expectedMd5 = md5(bytes);
  const { parentId, fileName } = await ensureKeyParent(token, archive.mediaFolderId, entry.key, folderCache);
  const existing = await listNamedChild(token, parentId, fileName);
  if (existing && Number(existing.size) === bytes.length && String(existing.md5Checksum || '') === expectedMd5) {
    return { key: entry.key, status: 'skipped', bytes: bytes.length, md5: expectedMd5, driveFileId: existing.id };
  }
  const uploaded = existing
    ? await replaceDriveFile(token, existing.id, bytes, contentType)
    : await createDriveFile(token, parentId, fileName, bytes, contentType);
  if (String(uploaded.md5Checksum || '') !== expectedMd5) throw new Error(`Checksum mismatch after Drive upload: ${entry.key}`);
  return { key: entry.key, status: existing ? 'updated' : 'created', bytes: bytes.length, md5: expectedMd5, driveFileId: uploaded.id };
}

async function runPool(entries, worker) {
  const results = new Array(entries.length);
  let cursor = 0;
  async function consume() {
    while (cursor < entries.length) {
      const index = cursor++;
      results[index] = await worker(entries[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, consume));
  return results;
}

async function uploadManifest(token, folderId, manifest) {
  const name = `r2-drive-backup-${manifest.completedAt.replace(/[:.]/g, '-')}.json`;
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const uploaded = await createDriveFile(token, folderId, name, bytes, 'application/json');
  return uploaded.id;
}

async function main() {
  const plan = await loadPlan();
  const validateOnly = process.argv.includes('--validate');
  console.log(`Cold archive plan: ${plan.entries.length} managed media objects -> Google Drive.`);
  if (validateOnly) {
    console.log(`Validation passed. Archive ready flag: ${plan.coldArchive.ready}.`);
    return;
  }

  const token = await getAccessToken();
  const folderCache = new Map();
  const startedAt = new Date().toISOString();
  const results = await runPool(plan.entries, async (entry, index) => {
    const result = await backupEntry(token, plan.coldArchive, entry, folderCache);
    console.log(`[${index + 1}/${plan.entries.length}] ${result.status} ${entry.key} (${result.bytes} bytes)`);
    return result;
  });
  const manifest = {
    schemaVersion: 1,
    source: plan.mediaBaseUrl,
    destination: { provider: 'google-drive', rootFolderId: plan.coldArchive.rootFolderId, mediaFolderId: plan.coldArchive.mediaFolderId },
    startedAt,
    completedAt: new Date().toISOString(),
    objects: results
  };
  const manifestFileId = await uploadManifest(token, plan.coldArchive.manifestsFolderId, manifest);
  const totals = results.reduce((acc, item) => {
    acc.objects += 1;
    acc.bytes += item.bytes;
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { objects: 0, bytes: 0 });
  console.log(JSON.stringify({ ok: true, manifestFileId, ...totals }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
