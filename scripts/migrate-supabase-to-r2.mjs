import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/backend');
const seed = JSON.parse(await fs.readFile(path.join(OUT, 'migration-seed.json'), 'utf8'));
const R2_BASE = String(process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
const MIGRATION_KEY = String(process.env.R2_MIGRATION_KEY || '');
if (!R2_BASE || !MIGRATION_KEY) throw new Error('R2_PUBLIC_BASE_URL and R2_MIGRATION_KEY are required.');

const SOURCES = [
  { id: 'owner', url: 'https://zkrhwqgmynbbmoktokdq.supabase.co', key: 'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq' },
  { id: 'huy9vnd', url: 'https://unggkruzjmsjscdiukfr.supabase.co', key: 'sb_publishable_UQXSQcKH_81clodAPnceYg_1UUYz7bc' }
];
const MODERATION_ENFORCEMENT_MS = 1787542800000;
const gates = new Map((seed.publishGates || []).map(g => [`${g.source_profile}:${g.artwork_id}`, g]));
const uploaded = new Map();

function alpha(a, b) { return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }); }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(alpha); }
function localizeCredit(value) { return String(value || '').trim().toLowerCase() === 'uncredited' ? 'Chưa có credit' : String(value || 'Chưa có credit'); }
function normalized(value) { try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); } }
function uploadTimestamp(value) { const m = normalized(value).match(/\/uploads\/[^/?#]*-(\d{13})\.[a-z0-9]+(?:[?#].*)?$/i); return m ? Number(m[1]) : 0; }
function extFromType(type) { return ({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif' })[String(type).split(';')[0].toLowerCase()] || ''; }
function safeSegment(value) { return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'; }
function encodeKey(key) { return key.split('/').map(encodeURIComponent).join('/'); }

async function rest(source, route) {
  const response = await fetch(`${source.url}/rest/v1/${route}`, { headers: { apikey: source.key } });
  if (!response.ok) throw new Error(`${source.id} REST ${response.status}: ${await response.text()}`);
  return response.json();
}

function moderatedImage(source, row) {
  const current = String(row.image || '');
  if (source.id === 'owner') return current;
  const gate = gates.get(`${source.id}:${row.id}`);
  if (gate) {
    const approved = String(gate.approved_image || '');
    if (gate.status === 'approved' && approved && normalized(approved) === normalized(current)) return current;
    if (approved) return approved;
    return '';
  }
  const timestamp = uploadTimestamp(current);
  return !timestamp || timestamp < MODERATION_ENFORCEMENT_MS ? current : '';
}

function firstPartyDescriptor(raw, sourceId, kind, id) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const u = new URL(value, 'https://hyupremium.vercel.app/');
    const supabase = SOURCES.find(s => new URL(s.url).origin === u.origin);
    const marker = '/storage/v1/object/public/';
    if (supabase && u.pathname.startsWith(marker)) {
      const restPath = decodeURIComponent(u.pathname.slice(marker.length));
      return { fetchUrl: u.href, key: `legacy/${supabase.id}/${restPath}` };
    }
    if (u.hostname === 'hyupremium.vercel.app' && u.pathname.startsWith('/assets/')) {
      const assetPath = u.pathname.replace(/^\//, '');
      return { fetchUrl: `https://raw.githubusercontent.com/hyu276/HyuPremiumSplashArtGallery/main/${assetPath}`, key: `legacy/repo/${assetPath}` };
    }
    if (!/^https?:\/\//i.test(value) && value.replace(/^\.\//, '').startsWith('assets/')) {
      const assetPath = value.replace(/^\.\//, '');
      return { fetchUrl: `https://raw.githubusercontent.com/hyu276/HyuPremiumSplashArtGallery/main/${assetPath}`, key: `legacy/repo/${assetPath}` };
    }
  } catch {}
  return null;
}

async function migrateMedia(raw, sourceId, kind, id) {
  if (!raw) return '';
  const descriptor = firstPartyDescriptor(raw, sourceId, kind, id);
  if (!descriptor) return String(raw);
  if (uploaded.has(descriptor.fetchUrl)) return uploaded.get(descriptor.fetchUrl);
  const source = await fetch(descriptor.fetchUrl);
  if (!source.ok) throw new Error(`Media fetch failed ${source.status}: ${descriptor.fetchUrl}`);
  const body = await source.arrayBuffer();
  const contentType = source.headers.get('content-type') || 'application/octet-stream';
  let key = descriptor.key;
  if (!/\.[a-z0-9]{2,5}$/i.test(key)) {
    const ext = extFromType(contentType);
    if (ext) key += `.${ext}`;
  }
  const put = await fetch(`${R2_BASE}/admin/media/${encodeKey(key)}`, {
    method: 'PUT',
    headers: { 'content-type': contentType, 'x-hyu-migration-key': MIGRATION_KEY },
    body
  });
  if (!put.ok) throw new Error(`R2 upload failed ${put.status}: ${await put.text()}`);
  const result = await put.json();
  const url = String(result.url || `${R2_BASE}/media/${encodeKey(key)}`);
  uploaded.set(descriptor.fetchUrl, url);
  return url;
}

async function loadSource(source) {
  const select = 'id,name,description,image,thumbnail,tags,hidden,updated_at,is_vietnamese_skin,category:categories(name),rank:ranks(name,sort_order),credit:image_credits(name)';
  const [rows, categories, ranks, credits] = await Promise.all([
    rest(source, `artworks?select=${encodeURIComponent(select)}&hidden=eq.false`),
    rest(source, 'categories?select=name&order=name.asc'),
    rest(source, 'ranks?select=name,sort_order&order=sort_order.asc'),
    rest(source, 'image_credits?select=name&order=name.asc')
  ]);
  const filtered = rows.flatMap(row => {
    const image = moderatedImage(source, row);
    if (!image) return [];
    const usesCurrent = normalized(image) === normalized(String(row.image || ''));
    return [{ ...row, effectiveImage: image, effectiveThumbnail: usesCurrent ? (row.thumbnail || row.image) : image }];
  });
  const items = [];
  for (const row of filtered) {
    const id = source.id === 'owner' ? String(row.id) : `${source.id}:${String(row.id)}`;
    items.push({
      id,
      source: source.id,
      sourceId: String(row.id),
      name: String(row.name || 'Tác phẩm chưa đặt tên').trim(),
      description: String(row.description || '').trim(),
      image: await migrateMedia(row.effectiveImage, source.id, 'originals', id),
      thumbnail: await migrateMedia(row.effectiveThumbnail || row.effectiveImage, source.id, 'thumbnails', id),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      hidden: false,
      category: String(row.category?.name || 'Chưa phân loại'),
      rank: String(row.rank?.name || 'Chưa xếp hạng'),
      rankOrder: Number(row.rank?.sort_order) || 0,
      credit: localizeCredit(row.credit?.name),
      isVietnameseSkin: Boolean(row.is_vietnamese_skin),
      updatedAt: row.updated_at || undefined
    });
  }
  return {
    items,
    categories: categories.map(x => String(x.name)),
    ranks: ranks.map(x => ({ name: String(x.name), sortOrder: Number(x.sort_order) || 0 })),
    credits: credits.map(x => localizeCredit(x.name))
  };
}

const loaded = await Promise.all(SOURCES.map(loadSource));
const owner = loaded[0];
for (const hidden of seed.hiddenArtworks || []) {
  const item = {
    ...hidden,
    source: 'owner',
    sourceId: hidden.id,
    image: await migrateMedia(hidden.image, 'owner', 'originals', hidden.id),
    thumbnail: await migrateMedia(hidden.thumbnail || hidden.image, 'owner', 'thumbnails', hidden.id),
    credit: localizeCredit(hidden.credit),
    hidden: true
  };
  const at = owner.items.findIndex(x => x.id === item.id);
  if (at >= 0) owner.items[at] = item; else owner.items.push(item);
}

const rankOrder = new Map();
for (const source of loaded) for (const rank of source.ranks) {
  if (!rankOrder.has(rank.name) || rank.sortOrder < rankOrder.get(rank.name)) rankOrder.set(rank.name, rank.sortOrder);
}
const items = loaded.flatMap(s => s.items).sort((a,b) => alpha(a.category,b.category) || (a.rankOrder-b.rankOrder) || alpha(a.name,b.name));
const team = [];
for (const member of seed.teamMembers || []) team.push({ ...member, image: await migrateMedia(member.image, 'owner', 'team', member.id) });

const catalogue = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  items,
  categories: unique(loaded.flatMap(s => s.categories)),
  ranks: [...rankOrder.entries()].sort((a,b) => a[1]-b[1] || alpha(a[0],b[0])).map(([name]) => name),
  credits: unique(loaded.flatMap(s => s.credits))
};
const storage = { provider: 'cloudflare-r2', publicBaseUrl: R2_BASE, bucket: 'hyu-premium-media', migratedAt: new Date().toISOString(), migratedObjects: uploaded.size };

await fs.mkdir(OUT, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(OUT, 'catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n'),
  fs.writeFile(path.join(OUT, 'team.json'), JSON.stringify(team, null, 2) + '\n'),
  fs.writeFile(path.join(OUT, 'seo.json'), JSON.stringify(seed.seo || {}, null, 2) + '\n'),
  fs.writeFile(path.join(OUT, 'publish-gates.json'), JSON.stringify(seed.publishGates || [], null, 2) + '\n'),
  fs.writeFile(path.join(OUT, 'storage.json'), JSON.stringify(storage, null, 2) + '\n')
]);

console.log(JSON.stringify({ items: items.length, hidden: items.filter(x => x.hidden).length, team: team.length, r2Objects: uploaded.size, base: R2_BASE }, null, 2));
