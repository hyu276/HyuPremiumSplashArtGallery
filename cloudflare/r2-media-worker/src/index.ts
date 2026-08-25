interface Env {
  MEDIA: R2Bucket;
  REPO_FULL_NAME: string;
  REPO_OWNER: string;
}

type GitHubRepo = { permissions?: { push?: boolean; admin?: boolean } };
type GitHubUser = { login?: string };

function allowedOrigin(origin: string) {
  if (!origin) return '';
  try {
    const url = new URL(origin);
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return origin;
    if (url.protocol !== 'https:') return '';
    if (url.hostname === 'hyupremium.vercel.app' || url.hostname.endsWith('.vercel.app') || url.hostname === 'hyu276.github.io') return origin;
  } catch {}
  return '';
}

function cors(request: Request) {
  const origin = allowedOrigin(request.headers.get('Origin') || '');
  return {
    'Access-Control-Allow-Origin': origin || 'https://hyupremium.vercel.app',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,range,if-none-match',
    'Access-Control-Expose-Headers': 'content-length,content-range,etag,accept-ranges,x-hyu-cache',
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

function objectHeaders(object: R2Object, request?: Request) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('CDN-Cache-Control', 'public, s-maxage=31536000, stale-while-revalidate=86400');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'content-length,content-range,etag,accept-ranges,x-hyu-cache');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-HYU-Media-Origin', 'cloudflare-r2');
  if (object.size >= 0) headers.set('Content-Length', String(object.size));
  if (request?.headers.get('Origin')) headers.set('Vary', 'Origin');
  return headers;
}

function variantLabel(key:string){
  const match=key.match(/-(640|960|1600)\.webp$/i);
  if(match)return `thumb${match[1]}`;
  if(key.includes('/thumbnails/'))return 'legacy-thumbnail';
  if(key.includes('/originals/')||key.includes('/uploads/'))return 'original';
  return 'other';
}

function logMedia(request:Request,key:string,status:string,bytes:number){
  const referrer=request.headers.get('Referer')||'';
  let refHost='';try{refHost=referrer?new URL(referrer).hostname:''}catch{}
  console.log(JSON.stringify({event:'media',path:key,variant:variantLabel(key),cache:status,bytes,userAgent:(request.headers.get('User-Agent')||'').slice(0,180),referrerHost:refHost,at:new Date().toISOString()}));
}

function canonicalCacheRequest(request:Request){
  const url=new URL(request.url);url.search='';url.hash='';
  return new Request(url.toString(),{method:'GET',headers:{Accept:request.headers.get('Accept')||'image/*'}});
}

async function publicMedia(request:Request,env:Env,key:string){
  if(request.method==='HEAD'){
    const object=await env.MEDIA.head(key);
    if(!object)return new Response('Not found',{status:404,headers:cors(request)});
    const headers=objectHeaders(object,request);headers.set('X-HYU-Cache','HEAD');logMedia(request,key,'HEAD',0);
    return new Response(null,{status:200,headers});
  }

  const rangeHeader=request.headers.get('Range');
  if(rangeHeader){
    const object=await env.MEDIA.get(key,{range:request.headers});
    if(!object)return new Response('Not found',{status:404,headers:cors(request)});
    const headers=objectHeaders(object,request);headers.delete('Content-Length');headers.set('X-HYU-Cache','RANGE');
    const range=object.range;
    if(range&&'offset' in range&&'length' in range){const start=range.offset;const end=start+range.length-1;headers.set('Content-Range',`bytes ${start}-${end}/${object.size}`);headers.set('Content-Length',String(range.length));}
    logMedia(request,key,'RANGE',range&&'length' in range?range.length:0);
    return new Response(object.body,{status:206,headers});
  }

  const cache=caches.default;const cacheRequest=canonicalCacheRequest(request);const cached=await cache.match(cacheRequest);
  if(cached){const headers=new Headers(cached.headers);headers.set('X-HYU-Cache','HIT');const bytes=Number(headers.get('Content-Length')||0);logMedia(request,key,'HIT',bytes);return new Response(cached.body,{status:cached.status,headers});}

  const object=await env.MEDIA.get(key);
  if(!object)return new Response('Not found',{status:404,headers:cors(request)});
  const headers=objectHeaders(object,request);headers.set('X-HYU-Cache','MISS');const response=new Response(object.body,{status:200,headers});
  await cache.put(cacheRequest,response.clone());logMedia(request,key,'MISS',object.size);
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, storage: 'cloudflare-r2', edgeCache: true, range: true }, { headers: { ...cors(request), 'Cache-Control': 'no-store' } });

    const publicKey = mediaKey(url);
    if (publicKey && (request.method === 'GET' || request.method === 'HEAD')) return publicMedia(request,env,publicKey);

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
