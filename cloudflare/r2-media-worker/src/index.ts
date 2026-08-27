interface Env {
  MEDIA: R2Bucket;
  REPO_FULL_NAME: string;
  REPO_OWNER: string;
}

type GitHubRepo = { permissions?: { push?: boolean; admin?: boolean } };
type GitHubUser = { login?: string };

const ONE_YEAR=31536000;
const MAX_FALLBACK_RANGE=8*1024*1024;

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

function adminCors(request: Request) {
  const origin = allowedOrigin(request.headers.get('Origin') || '');
  return {
    'Access-Control-Allow-Origin': origin || 'https://hyupremium.vercel.app',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,range,if-none-match',
    'Access-Control-Expose-Headers': 'content-length,content-range,etag,accept-ranges,cf-cache-status,x-hyu-media-origin',
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

function objectHeaders(object: R2Object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
  headers.set('Cloudflare-CDN-Cache-Control', `public, max-age=${ONE_YEAR}, stale-if-error=604800`);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'content-length,content-range,etag,accept-ranges,cf-cache-status,x-hyu-media-origin');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-HYU-Media-Origin', 'cloudflare-r2');
  headers.set('Cache-Tag','hyu-media');
  if (object.size >= 0) headers.set('Content-Length', String(object.size));
  return headers;
}

function variantLabel(key:string){
  const match=key.match(/-(320|640|960|1600)\.webp$/i);
  if(match)return `thumb${match[1]}`;
  if(key.includes('/thumbnails/'))return 'legacy-thumbnail';
  if(key.includes('/originals/')||key.includes('/uploads/')||key.includes('/members/'))return 'original';
  return 'other';
}

function logOrigin(request:Request,key:string,bytes:number,status='ORIGIN'){
  const referrer=request.headers.get('Referer')||'';
  let refHost='';try{refHost=referrer?new URL(referrer).hostname:''}catch{}
  const cf=(request as any).cf||{};
  console.log(JSON.stringify({event:'media-origin',path:key,variant:variantLabel(key),status,bytes,method:request.method,colo:String(cf.colo||''),userAgent:(request.headers.get('User-Agent')||'').slice(0,180),referrerHost:refHost,at:new Date().toISOString()}));
}

function parseSingleRange(value:string,size:number){
  if(!/^bytes=\d*-\d*$/.test(value)||value.includes(','))return null;
  const [a,b]=value.slice(6).split('-');
  let start=a?Number(a):NaN,end=b?Number(b):NaN;
  if(Number.isNaN(start)){
    const suffix=end;
    if(!Number.isFinite(suffix)||suffix<=0)return null;
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    if(Number.isNaN(end))end=size-1;
    if(start<0||end<start||start>=size)return null;
    end=Math.min(end,size-1);
  }
  const length=end-start+1;
  if(length>MAX_FALLBACK_RANGE)return null;
  return {offset:start,length,start,end};
}

async function publicMedia(request:Request,env:Env,key:string){
  if(request.method==='HEAD'){
    const object=await env.MEDIA.head(key);
    if(!object)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
    const headers=objectHeaders(object);logOrigin(request,key,0,'HEAD');
    return new Response(null,{status:200,headers});
  }

  // Workers Caching strips Range before invoking the Worker and serves byte slices
  // from the cached full response. This fallback only runs if caching is bypassed.
  const rangeHeader=request.headers.get('Range');
  if(rangeHeader&&!/-(320|640|960|1600)\.webp$/i.test(key)){
    const head=await env.MEDIA.head(key);
    if(!head)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
    const parsed=parseSingleRange(rangeHeader,head.size);
    if(!parsed)return new Response('Range not satisfiable',{status:416,headers:{'Cache-Control':'no-store','Content-Range':`bytes */${head.size}`}});
    const object=await env.MEDIA.get(key,{range:{offset:parsed.offset,length:parsed.length}});
    if(!object)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
    const headers=objectHeaders(object);headers.set('Content-Range',`bytes ${parsed.start}-${parsed.end}/${head.size}`);headers.set('Content-Length',String(parsed.length));
    logOrigin(request,key,parsed.length,'RANGE-FALLBACK');
    return new Response(object.body,{status:206,headers});
  }

  const object=await env.MEDIA.get(key);
  if(!object)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  const headers=objectHeaders(object);logOrigin(request,key,object.size);
  return new Response(object.body,{status:200,headers});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: adminCors(request) });
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, storage: 'cloudflare-r2', cacheMode: 'workers-caching', range: 'edge-sliced' }, { headers: { ...adminCors(request), 'Cache-Control': 'no-store' } });

    const publicKey = mediaKey(url);
    if(publicKey&&(request.method==='GET'||request.method==='HEAD')){
      if(url.search){
        const clean=new URL(url);clean.search='';clean.hash='';
        return Response.redirect(clean.toString(),308);
      }
      return publicMedia(request,env,publicKey);
    }

    const key = adminKey(url);
    if (key && (request.method === 'PUT' || request.method === 'DELETE')) {
      try {
        const admin = await githubAdmin(request, env);
        if (request.method === 'DELETE') {
          await env.MEDIA.delete(key);
          return Response.json({ ok: true, deleted: key, by: admin.login }, { headers: { ...adminCors(request), 'Cache-Control':'no-store' } });
        }
        const contentType = request.headers.get('content-type') || 'application/octet-stream';
        await env.MEDIA.put(key, request.body, {
          httpMetadata: { contentType, cacheControl: `public, max-age=${ONE_YEAR}, immutable` },
          customMetadata: { uploadedBy: admin.login, uploadedAt: new Date().toISOString() }
        });
        const publicUrl = new URL(`/media/${key.split('/').map(encodeURIComponent).join('/')}`, url.origin).href;
        return Response.json({ ok: true, key, url: publicUrl }, { headers: { ...adminCors(request), 'Cache-Control':'no-store' } });
      } catch (error: any) {
        return Response.json({ error: error?.message || 'Unauthorized.' }, { status: 401, headers: { ...adminCors(request), 'Cache-Control':'no-store' } });
      }
    }

    return new Response('Not found', { status: 404, headers: { ...adminCors(request), 'Cache-Control':'no-store' } });
  }
};
