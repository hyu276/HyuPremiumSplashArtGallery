interface Env {
  MEDIA: R2Bucket;
  REPO_FULL_NAME: string;
  REPO_OWNER: string;
}

type GitHubRepo = { permissions?: { push?: boolean; admin?: boolean } };
type GitHubUser = { login?: string };
type AuthCacheEntry = { login: string; expiresAt: number };

class AdminHttpError extends Error {
  status:number;
  code:string;
  constructor(status:number,code:string,message:string){super(message);this.name='AdminHttpError';this.status=status;this.code=code}
}

const ONE_YEAR=31536000;
const MAX_FALLBACK_RANGE=8*1024*1024;
const MAX_ADMIN_UPLOAD_BYTES=10*1024*1024;
const AUTH_CACHE_TTL_MS=45_000;
const AUTH_CACHE_MAX=64;
const TRANSIENT_STATUS=new Set([408,425,429,500,502,503,504]);
const TRANSIENT_R2_CODES=new Set([10001,10043,10058]);
const authCache=new Map<string,AuthCacheEntry>();

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
    'Access-Control-Expose-Headers': 'content-length,content-range,etag,accept-ranges,cf-cache-status,x-hyu-media-origin,retry-after,x-hyu-r2-error-code,x-hyu-request-id',
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

function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}
function retryDelay(response:Response,attempt=0){const raw=response.headers.get('retry-after')||'';const seconds=/^\d+$/.test(raw)?Number(raw):0;return seconds>0?Math.min(seconds*1000,2000):300+attempt*500}
function r2RetryDelay(attempt:number){return Math.min(2000,250*(2**attempt)+Math.floor(Math.random()*150))}

async function resilientGitHubGet(url:string,headers:Record<string,string>){
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt+=1){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(url,{headers,signal:controller.signal});
      if(attempt<2&&TRANSIENT_STATUS.has(response.status)){await sleep(retryDelay(response,attempt));continue}
      return response;
    }catch(error){
      lastError=error;
      if(attempt<2){await sleep(300+attempt*500);continue}
    }finally{clearTimeout(timer)}
  }
  const timedOut=(lastError as any)?.name==='AbortError';
  throw new AdminHttpError(503,'GITHUB_UNAVAILABLE',`GitHub API temporarily unavailable${timedOut?' (timeout)':''}.`);
}

async function tokenFingerprint(token:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function cachedAdmin(fingerprint:string){
  const entry=authCache.get(fingerprint);
  if(!entry)return null;
  if(entry.expiresAt<=Date.now()){authCache.delete(fingerprint);return null}
  return {login:entry.login};
}

function cacheAdmin(fingerprint:string,login:string){
  const now=Date.now();
  for(const [key,entry] of authCache){if(entry.expiresAt<=now)authCache.delete(key)}
  if(authCache.size>=AUTH_CACHE_MAX){const oldest=authCache.keys().next().value;if(oldest)authCache.delete(oldest)}
  authCache.set(fingerprint,{login,expiresAt:now+AUTH_CACHE_TTL_MS});
}

async function githubAdmin(request: Request, env: Env) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) throw new AdminHttpError(401,'GITHUB_TOKEN_REQUIRED','GitHub token required.');
  const token = authorization.slice(7).trim();
  if (!token.startsWith('github_pat_')) throw new AdminHttpError(401,'GITHUB_TOKEN_INVALID','Use a GitHub fine-grained personal access token.');
  const fingerprint=await tokenFingerprint(token);
  const cached=cachedAdmin(fingerprint);
  if(cached)return cached;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'HYU-PREMIUM-R2'
  };
  const [userResponse, repoResponse] = await Promise.all([
    resilientGitHubGet('https://api.github.com/user', headers),
    resilientGitHubGet(`https://api.github.com/repos/${env.REPO_FULL_NAME}`, headers)
  ]);
  if (!userResponse.ok || !repoResponse.ok) {
    if(TRANSIENT_STATUS.has(userResponse.status)||TRANSIENT_STATUS.has(repoResponse.status))throw new AdminHttpError(503,'GITHUB_UNAVAILABLE','GitHub API temporarily unavailable.');
    throw new AdminHttpError(401,'GITHUB_AUTH_FAILED','GitHub authentication failed.');
  }
  const user = await userResponse.json<GitHubUser>();
  const repo = await repoResponse.json<GitHubRepo>();
  const login=String(user.login || '');
  if (login.toLowerCase() !== env.REPO_OWNER.toLowerCase()) throw new AdminHttpError(403,'GITHUB_OWNER_MISMATCH','Token does not belong to the repository owner.');
  if (!repo.permissions?.push && !repo.permissions?.admin) throw new AdminHttpError(403,'GITHUB_PERMISSION_REQUIRED','Token needs repository Contents: Read and write permission.');
  cacheAdmin(fingerprint,login);
  return { login };
}

function r2ErrorCode(error:unknown){
  const message=error instanceof Error?error.message:String(error||'');
  const match=message.match(/\((\d{5})\)\s*$/);
  return match?Number(match[1]):0;
}

function isTransientR2Error(error:unknown){
  const code=r2ErrorCode(error);
  if(TRANSIENT_R2_CODES.has(code))return true;
  const message=error instanceof Error?error.message:String(error||'');
  return /service unavailable|temporarily unavailable|internal error|too many requests/i.test(message);
}

function r2FailureStatus(error:unknown){
  const code=r2ErrorCode(error);
  if(code===10058)return 429;
  if(code===10043||code===10001)return 503;
  return 502;
}

function r2FailureMessage(error:unknown){
  const code=r2ErrorCode(error);
  if(code===10043)return 'Cloudflare R2 tạm thời không khả dụng (10043). Hệ thống đã tự thử lại; vui lòng thử lại sau vài giây.';
  if(code===10058)return 'Cloudflare R2 đang giới hạn tần suất ghi (10058). Hệ thống đã tự thử lại; vui lòng thử lại sau vài giây.';
  if(code===10001)return 'Cloudflare R2 gặp lỗi nội bộ tạm thời (10001). Hệ thống đã tự thử lại; vui lòng thử lại sau vài giây.';
  return 'Cloudflare R2 không thể hoàn tất thao tác lưu trữ. Hệ thống đã tự thử lại; vui lòng thử lại sau vài giây.';
}

async function resilientR2Put(bucket:R2Bucket,key:string,body:ArrayBuffer,contentType:string,login:string,requestId:string){
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt+=1){
    try{
      await bucket.put(key,body,{
        httpMetadata:{contentType,cacheControl:`public, max-age=${ONE_YEAR}, immutable`},
        customMetadata:{uploadedBy:login,uploadedAt:new Date().toISOString()}
      });
      return;
    }catch(error){
      lastError=error;
      const code=r2ErrorCode(error);
      if(attempt<2&&isTransientR2Error(error)){
        console.warn(JSON.stringify({event:'admin-r2-retry',requestId,operation:'put',code:code||'unknown',attempt:attempt+1}));
        await sleep(r2RetryDelay(attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function resilientR2Delete(bucket:R2Bucket,key:string,requestId:string){
  let lastError:unknown;
  for(let attempt=0;attempt<3;attempt+=1){
    try{await bucket.delete(key);return}
    catch(error){
      lastError=error;
      const code=r2ErrorCode(error);
      if(attempt<2&&isTransientR2Error(error)){
        console.warn(JSON.stringify({event:'admin-r2-retry',requestId,operation:'delete',code:code||'unknown',attempt:attempt+1}));
        await sleep(r2RetryDelay(attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function adminFailureResponse(request:Request,error:unknown,requestId:string){
  const message=error instanceof Error?error.message:'Unauthorized.';
  const status=error instanceof AdminHttpError?error.status:/temporarily unavailable|timeout/i.test(message)?503:401;
  const code=error instanceof AdminHttpError?error.code:'ADMIN_AUTH_FAILED';
  console.error(JSON.stringify({event:'admin-media-failure',requestId,service:'github-auth',status,code}));
  return Response.json({error:message,requestId,service:'github-auth',code},{status,headers:{...adminCors(request),'Cache-Control':'no-store','X-HYU-Request-Id':requestId}});
}

function r2FailureResponse(request:Request,error:unknown,requestId:string,operation:'put'|'delete'){
  const status=r2FailureStatus(error);
  const numericCode=r2ErrorCode(error);
  const code=numericCode?String(numericCode):'R2_UPSTREAM';
  const retryAfter=status===429?'2':'1';
  console.error(JSON.stringify({event:'admin-media-failure',requestId,service:'cloudflare-r2',operation,status,code}));
  return Response.json({error:r2FailureMessage(error),requestId,service:'cloudflare-r2',code,retryable:true},{status,headers:{...adminCors(request),'Cache-Control':'no-store','Retry-After':retryAfter,'X-HYU-R2-Error-Code':code,'X-HYU-Request-Id':requestId}});
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
      const requestId=crypto.randomUUID().slice(0,12);
      let admin:{login:string};
      try{admin=await githubAdmin(request,env)}
      catch(error){return adminFailureResponse(request,error,requestId)}

      if(request.method==='DELETE'){
        try{
          await resilientR2Delete(env.MEDIA,key,requestId);
          return Response.json({ok:true,deleted:key,by:admin.login,requestId},{headers:{...adminCors(request),'Cache-Control':'no-store','X-HYU-Request-Id':requestId}});
        }catch(error){return r2FailureResponse(request,error,requestId,'delete')}
      }

      const declared=Number(request.headers.get('content-length')||0);
      if(Number.isFinite(declared)&&declared>MAX_ADMIN_UPLOAD_BYTES){
        return Response.json({error:'Tệp tải lên vượt quá giới hạn 10 MB.',requestId,service:'worker',code:'UPLOAD_TOO_LARGE'},{status:413,headers:{...adminCors(request),'Cache-Control':'no-store','X-HYU-Request-Id':requestId}});
      }
      let body:ArrayBuffer;
      try{body=await request.arrayBuffer()}
      catch{
        return Response.json({error:'Không đọc được nội dung tệp tải lên. Vui lòng chọn lại tệp và thử lại.',requestId,service:'worker',code:'UPLOAD_BODY_UNREADABLE'},{status:400,headers:{...adminCors(request),'Cache-Control':'no-store','X-HYU-Request-Id':requestId}});
      }
      if(body.byteLength>MAX_ADMIN_UPLOAD_BYTES){
        return Response.json({error:'Tệp tải lên vượt quá giới hạn 10 MB.',requestId,service:'worker',code:'UPLOAD_TOO_LARGE'},{status:413,headers:{...adminCors(request),'Cache-Control':'no-store','X-HYU-Request-Id':requestId}});
      }
      if(body.byteLength===0){
        return Response.json({error:'Tệp tải lên rỗng.',requestId,service:'worker',code:'UPLOAD_EMPTY'},{status:400,headers:{...adminCors(request),'Cache-Control':'no-store','X-HYU-Request-Id':requestId}});
      }
      const contentType=request.headers.get('content-type')||'application/octet-stream';
      try{
        await resilientR2Put(env.MEDIA,key,body,contentType,admin.login,requestId);
        const publicUrl=new URL(`/media/${key.split('/').map(encodeURIComponent).join('/')}`,url.origin).href;
        return Response.json({ok:true,key,url:publicUrl,requestId},{headers:{...adminCors(request),'Cache-Control':'no-store','X-HYU-Request-Id':requestId}});
      }catch(error){return r2FailureResponse(request,error,requestId,'put')}
    }

    return new Response('Not found', { status: 404, headers: { ...adminCors(request), 'Cache-Control':'no-store' } });
  }
};
