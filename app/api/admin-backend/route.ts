import { revalidatePath, revalidateTag } from 'next/cache';

const REPO = 'hyu276/HyuPremiumSplashArtGallery';
const OWNER = 'hyu276';
const API = 'https://api.github.com';
const DATA_ROOT = 'data/backend';

type GitHubUser = { login?: string };
type GitHubRepo = { permissions?: { push?: boolean; admin?: boolean } };
type GitHubContent = { content?: string; encoding?: string };
type OwnerOptions = { categories?: string[]; ranks?: string[]; credits?: string[] };
type Catalogue = {
  schemaVersion?: number;
  generatedAt?: string;
  items: any[];
  categories: string[];
  ranks: string[];
  credits: string[];
  ownerOptions?: OwnerOptions;
};

type AdminPayload = {
  ownerItems?: any[];
  categories?: string[];
  ranks?: string[];
  credits?: string[];
  team?: any[];
  seo?: any;
};

function tokenFrom(request: Request) {
  const value = request.headers.get('authorization') || '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

function dataBranch() {
  const explicit = String(process.env.GITHUB_DATA_BRANCH || '').trim();
  if (explicit) return explicit;
  const vercelRef = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
  return vercelRef || 'main';
}

function ghHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'HYU-PREMIUM-ADMIN'
  };
}

async function gh<T>(token: string, pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { ...ghHeaders(token), ...(init.headers || {}) },
    cache: 'no-store'
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json() as Promise<T>;
}

async function verify(token: string) {
  if (!token.startsWith('github_pat_')) throw new Error('Hãy sử dụng GitHub fine-grained personal access token bắt đầu bằng github_pat_.');
  const [user, repo] = await Promise.all([
    gh<GitHubUser>(token, '/user'),
    gh<GitHubRepo>(token, `/repos/${REPO}`)
  ]);
  const login = String(user.login || '');
  if (login.toLowerCase() !== OWNER.toLowerCase()) throw new Error(`Token thuộc tài khoản @${login || 'unknown'}, không phải chủ repository @${OWNER}.`);
  if (!repo.permissions?.push && !repo.permissions?.admin) throw new Error('Token cần quyền Contents: Read and write đối với repository này.');
  return { login };
}

function decodeBase64(content: string) {
  return Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf8');
}

async function readJson<T>(token: string, file: string, branch = dataBranch()): Promise<T> {
  const result = await gh<GitHubContent>(token, `/repos/${REPO}/contents/${file}?ref=${encodeURIComponent(branch)}`);
  if (!result.content) throw new Error(`Không đọc được ${file} từ GitHub.`);
  return JSON.parse(result.encoding === 'base64' ? decodeBase64(result.content) : result.content) as T;
}

function alpha(a: string, b: string) {
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

function unique(values: string[]) {
  return [...new Set(values.map(String).filter(Boolean))].sort(alpha);
}

function rankList(preferred: string[], external: any[]) {
  const ordered = [...preferred.map(String).filter(Boolean)];
  for (const item of external) if (item?.rank && !ordered.includes(String(item.rank))) ordered.push(String(item.rank));
  return ordered;
}

async function createBlob(token: string, content: string) {
  return gh<{ sha: string }>(token, `/repos/${REPO}/git/blobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, encoding: 'utf-8' })
  });
}

async function atomicCommit(token: string, branch: string, files: Record<string, unknown>) {
  const refPart = branch.split('/').map(encodeURIComponent).join('/');
  const ref = await gh<{ object: { sha: string } }>(token, `/repos/${REPO}/git/ref/heads/${refPart}`);
  const parent = ref.object.sha;
  const commit = await gh<{ tree: { sha: string } }>(token, `/repos/${REPO}/git/commits/${parent}`);
  const tree: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
  for (const [file, value] of Object.entries(files)) {
    const blob = await createBlob(token, JSON.stringify(value, null, 2) + '\n');
    tree.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await gh<{ sha: string }>(token, `/repos/${REPO}/git/trees`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: commit.tree.sha, tree })
  });
  const next = await gh<{ sha: string }>(token, `/repos/${REPO}/git/commits`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'content(admin): cập nhật backend GitHub từ dashboard', tree: newTree.sha, parents: [parent] })
  });
  await gh(token, `/repos/${REPO}/git/refs/heads/${refPart}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: next.sha, force: false })
  });
  return next.sha;
}

function ownerOptions(catalogue: Catalogue) {
  return {
    categories: catalogue.ownerOptions?.categories || catalogue.categories || [],
    ranks: catalogue.ownerOptions?.ranks || catalogue.ranks || [],
    credits: catalogue.ownerOptions?.credits || catalogue.credits || []
  };
}

export async function GET(request: Request) {
  try {
    const token = tokenFrom(request);
    const admin = await verify(token);
    const branch = dataBranch();
    const [catalogue, team, seo, storage] = await Promise.all([
      readJson<Catalogue>(token, `${DATA_ROOT}/catalogue.json`, branch),
      readJson<any[]>(token, `${DATA_ROOT}/team.json`, branch),
      readJson<any>(token, `${DATA_ROOT}/seo.json`, branch),
      readJson<any>(token, `${DATA_ROOT}/storage.json`, branch)
    ]);
    const ownerItems = (catalogue.items || []).filter(item => String(item?.source || 'owner') === 'owner');
    const options = ownerOptions(catalogue);
    return Response.json({
      ok: true, user: admin, branch,
      catalogue: { ...catalogue, items: ownerItems, categories: options.categories, ranks: options.ranks, credits: options.credits },
      team, seo, storage
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const message = error?.message || 'Không thể xác thực GitHub hoặc đọc backend metadata.';
    const status = /github_pat_|Token|GitHub 401|GitHub 403|quyền/.test(message) ? 401 : /404/.test(message) ? 409 : 500;
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  try {
    const token = tokenFrom(request);
    const admin = await verify(token);
    const payload = await request.json() as AdminPayload;
    const branch = dataBranch();
    const [current, currentTeam, currentSeo] = await Promise.all([
      readJson<Catalogue>(token, `${DATA_ROOT}/catalogue.json`, branch),
      readJson<any[]>(token, `${DATA_ROOT}/team.json`, branch),
      readJson<any>(token, `${DATA_ROOT}/seo.json`, branch)
    ]);
    const previousOwnerOptions = ownerOptions(current);
    const nextOwnerOptions = {
      categories: Array.isArray(payload.categories) ? payload.categories.map(String) : previousOwnerOptions.categories,
      ranks: Array.isArray(payload.ranks) ? payload.ranks.map(String) : previousOwnerOptions.ranks,
      credits: Array.isArray(payload.credits) ? payload.credits.map(String) : previousOwnerOptions.credits
    };
    const external = (current.items || []).filter(item => String(item?.source || 'owner') !== 'owner');
    const owner = Array.isArray(payload.ownerItems)
      ? payload.ownerItems.map(item => ({ ...item, source: 'owner', sourceId: String(item?.sourceId || item?.id || '') }))
      : (current.items || []).filter(item => String(item?.source || 'owner') === 'owner');
    const categories = unique([...nextOwnerOptions.categories, ...external.map(item => String(item?.category || ''))]);
    const credits = unique([...nextOwnerOptions.credits, ...external.map(item => String(item?.credit || ''))]);
    const ranks = rankList(nextOwnerOptions.ranks, external);
    const catalogue: Catalogue = {
      ...current,
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      ownerOptions: nextOwnerOptions,
      items: [...owner, ...external].sort((a, b) => alpha(String(a.category || ''), String(b.category || '')) || Number(a.rankOrder || 0) - Number(b.rankOrder || 0) || alpha(String(a.name || ''), String(b.name || ''))),
      categories, ranks, credits
    };
    const files: Record<string, unknown> = { [`${DATA_ROOT}/catalogue.json`]: catalogue };
    if (Array.isArray(payload.team)) files[`${DATA_ROOT}/team.json`] = payload.team;
    else files[`${DATA_ROOT}/team.json`] = currentTeam;
    files[`${DATA_ROOT}/seo.json`] = payload.seo ?? currentSeo;
    const sha = await atomicCommit(token, branch, files);
    revalidateTag('catalogue');
    for (const path of ['/', '/character/', '/artworks/', '/about/', '/sitemap.xml', '/image-sitemap.xml']) revalidatePath(path);
    return Response.json({ ok: true, commit: sha, branch, by: admin.login, deployedByGit: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const message = error?.message || 'Không thể publish metadata lên GitHub.';
    const status = /github_pat_|Token|GitHub 401|GitHub 403|quyền/.test(message) ? 401 : /409|422/.test(message) ? 409 : 500;
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
