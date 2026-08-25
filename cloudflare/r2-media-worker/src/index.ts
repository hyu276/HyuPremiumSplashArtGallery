interface Env {
  MEDIA: R2Bucket;
  REPO_FULL_NAME: string;
  REPO_OWNER: string;
  MIGRATION_KEY?: string;
}

type GitHubRepo = { permissions?: { push?: boolean; admin?: boolean } };
type GitHubUser = { login?: string };

const ALLOWED_ORIGINS = new Set([
  'https://hyupremium.vercel.app',
  'https://hyu276.github.io'
]);

function cors(request: Request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://hyupremium.vercel.app',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,x-hyu-migration-key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function cleanKey(raw: string) {
  const parts = raw.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  if (!parts.length || parts.some(part => part === '.' || part === '..' || part.includes('\\'))) return '';
  return parts.join('/');
}

function mediaKey(url: URL) {
  if (!url.pathname.startsWith('/media/')) return '';
  return cleanKey(url.pathname.slice('/media/'.length));
}

function adminKey(url: URL) {
  if (!url.pathname.startsWith('/admin/media/')) return '';
  return cleanKey(url.pathname.slice('/admin/media/'.length));
}

async function githubAdmin(request: Request, env: Env) {
  const migrationKey = request.headers.get('x-hyu-migration-key') || '';
  if (env.MIGRATION_KEY && migrationKey && migrationKey === env.MIGRATION_KEY) return { login: 'migration' };

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) throw new Error('GitHub token required.');
  const token = authorization.slice(7).trim();
  if (!token.startsWith('github_pat_')) throw new Error('Use a GitHub fine-grained personal access token.');
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'HYU-PREMIUM-R2'
  };
  const [userResponse, repoResponse] = await Promise.all([
    fetch('https://api.github.com/user', { headers }),
    fetch(`https://api.github.com/repos/${env.REPO_FULL_NAME}`, { headers })
  ]);
  if (!userResponse.ok || !repoResponse.ok) throw new Error('GitHub authentication failed.');
  const user = await userResponse.json<GitHubUser>();
  const repo = await repoResponse.json<GitHubRepo>();
  if (String(user.login || '').toLowerCase() !== env.REPO_OWNER.toLowerCase()) throw new Error('Token does not belong to the repository owner.');
  if (!repo.permissions?.push && !repo.permissions?.admin) throw new Error('Token needs repository Contents: Read and write permission.');
  return { login: String(user.login) };
}

function objectHeaders(object: R2Object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-HYU-Media-Origin', 'cloudflare-r2');
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, storage: 'cloudflare-r2' }, { headers: { ...cors(request), 'Cache-Control': 'no-store' } });

    const publicKey = mediaKey(url);
    if (publicKey && (request.method === 'GET' || request.method === 'HEAD')) {
      const object = await env.MEDIA.get(publicKey);
      if (!object) return new Response('Not found', { status: 404, headers: cors(request) });
      return new Response(request.method === 'HEAD' ? null : object.body, { headers: objectHeaders(object) });
    }

    const key = adminKey(url);
    if (key && (request.method === 'PUT' || request.method === 'DELETE')) {
      try {
        const admin = await githubAdmin(request, env);
        if (request.method === 'DELETE') {
          await env.MEDIA.delete(key);
          return Response.json({ ok: true, deleted: key, by: admin.login }, { headers: cors(request) });
        }
        const contentType = request.headers.get('content-type') || 'application/octet-stream';
        await env.MEDIA.put(key, request.body, {
          httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
          customMetadata: { uploadedBy: admin.login, uploadedAt: new Date().toISOString() }
        });
        const publicUrl = new URL(`/media/${key.split('/').map(encodeURIComponent).join('/')}`, url.origin).href;
        return Response.json({ ok: true, key, url: publicUrl }, { headers: cors(request) });
      } catch (error: any) {
        return Response.json({ error: error?.message || 'Unauthorized.' }, { status: 401, headers: cors(request) });
      }
    }

    return new Response('Not found', { status: 404, headers: cors(request) });
  }
};
