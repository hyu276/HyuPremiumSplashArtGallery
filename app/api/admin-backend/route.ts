import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { revalidatePath, revalidateTag } from 'next/cache';

const REPO='hyu276/HyuPremiumSplashArtGallery';
const OWNER='hyu276';
const API='https://api.github.com';
const DATA_ROOT='data/backend';
const VARIANT_WIDTHS=[640,960,1600] as const;
const TEAM_VARIANT_WIDTHS=[320,640] as const;
const TRANSIENT_STATUS=new Set([408,425,429,500,502,503,504]);

type GitHubUser={login?:string};
type GitHubRepo={permissions?:{push?:boolean;admin?:boolean}};
type GitHubContent={content?:string;encoding?:string};
type OwnerOptions={categories?:string[];ranks?:string[];credits?:string[]};
type MediaVariant={url:string;width:number;height:number;bytes:number;mimeType:string};
type Catalogue={schemaVersion?:number;generatedAt?:string;items:any[];categories:string[];ranks:string[];credits:string[];ownerOptions?:OwnerOptions};
type AdminPayload={ownerItems?:any[];categories?:string[];ranks?:string[];credits?:string[];team?:any[];seo?:any};
type CommitResult={sha:string;noop:boolean};

const ADMIN_ORIGIN='https://hyu276.github.io';
function corsHeaders(request:Request):Record<string,string>{const origin=request.headers.get('origin')||'';return origin===ADMIN_ORIGIN?{'Access-Control-Allow-Origin':ADMIN_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Expose-Headers':'X-Admin-Request-Id','Access-Control-Max-Age':'86400','Vary':'Origin'}:{}}
function responseHeaders(request:Request,requestId?:string):Record<string,string>{return {'Cache-Control':'no-store',...(requestId?{'X-Admin-Request-Id':requestId}:{}),...corsHeaders(request)}}
export async function OPTIONS(request:Request){return new Response(null,{status:204,headers:responseHeaders(request)})}

function tokenFrom(request:Request){const value=request.headers.get('authorization')||'';return value.toLowerCase().startsWith('bearer ')?value.slice(7).trim():''}
function dataBranch(){const explicit=String(process.env.GITHUB_DATA_BRANCH||'').trim();if(explicit)return explicit;const vercelRef=String(process.env.VERCEL_GIT_COMMIT_REF||'').trim();return vercelRef||'main'}
function ghHeaders(token:string){return {Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'HYU-PREMIUM-ADMIN'}}
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}
function retryDelay(response:Response,attempt:number){const raw=response.headers.get('retry-after')||'';const seconds=/^\d+$/.test(raw)?Number(raw):0;return seconds>0?Math.min(seconds*1000,1500):300+attempt*450}
async function resilientSmallGet(url:string,init:RequestInit,label:string){let lastError:unknown;for(let attempt=0;attempt<2;attempt+=1){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(url,{...init,method:'GET',signal:controller.signal,cache:'no-store'});if(attempt===0&&TRANSIENT_STATUS.has(response.status)){await sleep(retryDelay(response,attempt));continue}return response}catch(error){lastError=error;if(attempt===0){await sleep(300);continue}}finally{clearTimeout(timer)}}const timedOut=(lastError as any)?.name==='AbortError';throw new Error(`${label} tạm thời không phản hồi${timedOut?' (timeout)':''}. Hãy thử lại.`)}
async function gh<T>(token:string,pathname:string,init:RequestInit={}):Promise<T>{const url=`${API}${pathname}`;const method=String(init.method||'GET').toUpperCase();const options:RequestInit={...init,headers:{...ghHeaders(token),...(init.headers||{})},cache:'no-store'};const response=method==='GET'?await resilientSmallGet(url,options,'GitHub API'):await fetch(url,options);if(!response.ok){const body=await response.text();throw new Error(`GitHub ${response.status}: ${body.slice(0,500)}`)}return response.json() as Promise<T>}

async function verify(token:string){
  if(!token.startsWith('github_pat_'))throw new Error('Hãy sử dụng GitHub fine-grained personal access token bắt đầu bằng github_pat_.');
  const [user,repo]=await Promise.all([gh<GitHubUser>(token,'/user'),gh<GitHubRepo>(token,`/repos/${REPO}`)]);
  const login=String(user.login||'');
  if(login.toLowerCase()!==OWNER.toLowerCase())throw new Error(`Token phải thuộc tài khoản chủ repository @${OWNER}.`);
  if(!repo.permissions?.push&&!repo.permissions?.admin)throw new Error('Token cần quyền Contents: Read and write đối với repository này.');
  return {login};
}

function decodeBase64(content:string){return Buffer.from(content.replace(/\s/g,''),'base64').toString('utf8')}
async function readJson<T>(token:string,file:string,branch=dataBranch()):Promise<T>{const result=await gh<GitHubContent>(token,`/repos/${REPO}/contents/${file}?ref=${encodeURIComponent(branch)}`);if(!result.content)throw new Error(`Không đọc được ${file} từ GitHub.`);return JSON.parse(result.encoding==='base64'?decodeBase64(result.content):result.content) as T}
function alpha(a:string,b:string){return String(a).localeCompare(String(b),undefined,{sensitivity:'base',numeric:true})}
function unique(values:string[]){return [...new Set(values.map(String).map(x=>x.trim()).filter(Boolean))].sort(alpha)}
function orderedUnique(values:string[]){const out:string[]=[];for(const raw of values){const name=String(raw).trim();if(name&&!out.includes(name))out.push(name)}return out}
function canonicalItem(item:any){const {source:_source,sourceId:_sourceId,sourceOptions:_sourceOptions,...rest}=item||{};return {...rest,id:String(rest.id||'')};}
function optionsFor(catalogue:Catalogue){return {categories:catalogue.ownerOptions?.categories||catalogue.categories||[],ranks:catalogue.ownerOptions?.ranks||catalogue.ranks||[],credits:catalogue.ownerOptions?.credits||catalogue.credits||[]}}
function mediaKey(id:string,source:string,width:number){const safe=String(id||'art').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'art';const hash=createHash('sha1').update(source).digest('hex').slice(0,12);return `artworks/variants/${safe}-${hash}-${width}.webp`}
function teamMediaKey(id:string|number,source:string,width:number){const safe=String(id||'member').toLowerCase().replace(/[^a-z0-9]+/g,'-')||'member';const hash=createHash('sha1').update(source).digest('hex').slice(0,12);return `team/variants/${safe}-${hash}-${width}.webp`}
function publicR2Url(base:string,key:string){return `${base.replace(/\/$/,'')}/media/${key.split('/').map(encodeURIComponent).join('/')}`}

async function putR2(base:string,token:string,key:string,buffer:Buffer){
  const url=`${base.replace(/\/$/,'')}/admin/media/${key.split('/').map(encodeURIComponent).join('/')}`;
  let lastError:unknown;
  for(let attempt=0;attempt<2;attempt+=1){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'image/webp'},body:new Uint8Array(buffer),cache:'no-store',signal:controller.signal});
      if(attempt===0&&TRANSIENT_STATUS.has(response.status)){await sleep(retryDelay(response,attempt));continue}
      if(!response.ok)throw new Error(`R2 derivative upload ${response.status}: ${(await response.text()).slice(0,300)}`);
      return publicR2Url(base,key);
    }catch(error){lastError=error;if(attempt===0){await sleep(350);continue}}
    finally{clearTimeout(timer)}
  }
  if(lastError instanceof Error)throw lastError;
  throw new Error('R2 derivative upload tạm thời không phản hồi.');
}

function completeVariants(item:any){return VARIANT_WIDTHS.every(width=>item?.variants?.[String(width)]?.url)}
async function enrichMedia(item:any,storageBase:string,token:string){
  const next=canonicalItem(item);
  if(!next.image)return next;
  if(completeVariants(next)&&next.media?.original?.url)return next;
  const response=await fetch(String(next.image),{cache:'no-store',headers:{Accept:'image/*'}});
  if(!response.ok)throw new Error(`Không tải được ảnh gốc của ${next.id} để tạo derivative (${response.status}).`);
  const input=Buffer.from(await response.arrayBuffer());
  const originalMeta=await sharp(input,{animated:false}).metadata();
  const variants:Record<string,MediaVariant>={...(next.variants||{})};
  for(const width of VARIANT_WIDTHS){
    if(variants[String(width)]?.url)continue;
    const {data,info}=await sharp(input,{animated:false}).rotate().resize({width,withoutEnlargement:true}).webp({quality:width===640?76:width===960?78:80,effort:4}).toBuffer({resolveWithObject:true});
    const key=mediaKey(next.id,String(next.image),width);
    const url=await putR2(storageBase,token,key,data);
    variants[String(width)]={url,width:info.width,height:info.height,bytes:data.length,mimeType:'image/webp'};
  }
  next.variants=variants;
  next.thumbnail=variants['1600']?.url||next.thumbnail||next.image;
  next.media={...(next.media||{}),original:{url:String(next.image),width:Number(originalMeta.width)||0,height:Number(originalMeta.height)||0,bytes:input.length,mimeType:String(response.headers.get('content-type')||originalMeta.format||'application/octet-stream').split(';')[0]}};
  return next;
}

async function enrichTeamMember(member:any,storageBase:string,token:string){
  const next={...(member||{})};if(!next.image)return next;
  const complete=TEAM_VARIANT_WIDTHS.every(width=>next?.variants?.[String(width)]?.url);if(complete&&next.media?.original?.url)return next;
  const response=await fetch(String(next.image),{cache:'no-store',headers:{Accept:'image/*'}});if(!response.ok)throw new Error(`Không tải được ảnh đội ngũ ${next.id} (${response.status}).`);
  const input=Buffer.from(await response.arrayBuffer());const originalMeta=await sharp(input,{animated:false}).metadata();const variants:Record<string,MediaVariant>={...(next.variants||{})};
  for(const width of TEAM_VARIANT_WIDTHS){if(variants[String(width)]?.url)continue;const {data,info}=await sharp(input,{animated:false}).rotate().resize({width,withoutEnlargement:true}).webp({quality:width===320?76:80,effort:4}).toBuffer({resolveWithObject:true});const key=teamMediaKey(next.id,String(next.image),width);const url=await putR2(storageBase,token,key,data);variants[String(width)]={url,width:info.width,height:info.height,bytes:data.length,mimeType:'image/webp'};}
  next.variants=variants;next.media={...(next.media||{}),original:{url:String(next.image),width:Number(originalMeta.width)||0,height:Number(originalMeta.height)||0,bytes:input.length,mimeType:String(response.headers.get('content-type')||originalMeta.format||'application/octet-stream').split(';')[0]}};return next;
}

async function createBlob(token:string,content:string){return gh<{sha:string}>(token,`/repos/${REPO}/git/blobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,encoding:'utf-8'})})}
function comparableFile(file:string,value:unknown){if(file.endsWith('/catalogue.json')&&value&&typeof value==='object'&&!Array.isArray(value)){const {generatedAt:_generatedAt,...rest}=value as Record<string,unknown>;return rest}return value}
function sameFile(file:string,a:unknown,b:unknown){return JSON.stringify(comparableFile(file,a))===JSON.stringify(comparableFile(file,b))}
function isNonFastForward(error:unknown){return error instanceof Error&&/GitHub 422:.*Update is not a fast forward/i.test(error.message)}

async function atomicCommit(token:string,branch:string,files:Record<string,unknown>,baselines:Record<string,unknown>):Promise<CommitResult>{
  const allPaths=Object.keys(files);if(!allPaths.length)throw new Error('Không có metadata nào cần cập nhật.');
  const refPart=branch.split('/').map(encodeURIComponent).join('/');
  const blobs:Record<string,string>={};
  for(const [file,value] of Object.entries(files)){const blob=await createBlob(token,JSON.stringify(value,null,2)+'\n');blobs[file]=blob.sha}
  let pendingPaths=[...allPaths];
  let ref=await gh<{object:{sha:string}}>(token,`/repos/${REPO}/git/ref/heads/${refPart}`);
  let parent=ref.object.sha;
  for(let attempt=0;attempt<3;attempt+=1){
    const commit=await gh<{tree:{sha:string}}>(token,`/repos/${REPO}/git/commits/${parent}`);
    const tree=pendingPaths.map(path=>({path,mode:'100644' as const,type:'blob' as const,sha:blobs[path]}));
    const newTree=await gh<{sha:string}>(token,`/repos/${REPO}/git/trees`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:commit.tree.sha,tree})});
    const next=await gh<{sha:string}>(token,`/repos/${REPO}/git/commits`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'content(admin): cập nhật backend GitHub từ dashboard',tree:newTree.sha,parents:[parent]})});
    try{
      await gh(token,`/repos/${REPO}/git/refs/heads/${refPart}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:next.sha,force:false})});
      return {sha:next.sha,noop:false};
    }catch(error){
      if(!isNonFastForward(error)||attempt===2)throw error;
      ref=await gh<{object:{sha:string}}>(token,`/repos/${REPO}/git/ref/heads/${refPart}`);parent=ref.object.sha;
      const safe:string[]=[];
      for(const path of allPaths){
        const fresh=await readJson<unknown>(token,path,branch);
        if(sameFile(path,fresh,files[path]))continue;
        if(sameFile(path,fresh,baselines[path])){safe.push(path);continue}
        throw new Error(`GitHub 409: ${path} đã thay đổi bởi một thao tác quản trị khác. Hãy tải lại dashboard trước khi ghi đè.`);
      }
      if(!safe.length)return {sha:parent,noop:true};
      pendingPaths=safe;
    }
  }
  throw new Error('GitHub 409: Không thể hoàn tất cập nhật metadata do có nhiều thao tác đồng thời.');
}

function statusFor(message:string){if(/github_pat_|Token|GitHub 401|GitHub 403|quyền|chủ repository/.test(message))return 401;if(/Payload .* không hợp lệ/.test(message))return 400;if(/404|409|422/.test(message))return 409;if(/tạm thời không phản hồi|GitHub (408|425|429|500|502|503|504)|R2 derivative upload (408|425|429|500|502|503|504)/.test(message))return 503;return 500}
function logAdminFailure(requestId:string,method:string,message:string){console.error(`[admin-backend:${requestId}] ${method} failed: ${message.slice(0,1000)}`)}

export async function GET(request:Request){
  const requestId=randomUUID().slice(0,12);
  try{
    const token=tokenFrom(request);const admin=await verify(token);const branch=dataBranch();
    const [catalogue,team,seo,storage]=await Promise.all([readJson<Catalogue>(token,`${DATA_ROOT}/catalogue.json`,branch),readJson<any[]>(token,`${DATA_ROOT}/team.json`,branch),readJson<any>(token,`${DATA_ROOT}/seo.json`,branch),readJson<any>(token,`${DATA_ROOT}/storage.json`,branch)]);
    const items=(catalogue.items||[]).map(canonicalItem);const options=optionsFor(catalogue);
    return Response.json({ok:true,requestId,user:admin,branch,catalogue:{...catalogue,items,categories:options.categories||[],ranks:options.ranks||[],credits:options.credits||[]},team,seo,storage},{headers:responseHeaders(request,requestId)});
  }catch(error:any){const message=error?.message||'Không thể xác thực GitHub hoặc đọc backend metadata.';logAdminFailure(requestId,'GET',message);return Response.json({error:message,requestId},{status:statusFor(message),headers:responseHeaders(request,requestId)})}
}

export async function POST(request:Request){
  const requestId=randomUUID().slice(0,12);
  try{
    const token=tokenFrom(request);const admin=await verify(token);const payload=await request.json() as AdminPayload;const branch=dataBranch();
    const catalogueRequested=payload.ownerItems!==undefined||payload.categories!==undefined||payload.ranks!==undefined||payload.credits!==undefined;
    const teamRequested=payload.team!==undefined;
    const seoRequested=payload.seo!==undefined;
    if(teamRequested&&!Array.isArray(payload.team))throw new Error('Payload team không hợp lệ.');
    if(!catalogueRequested&&!teamRequested&&!seoRequested)throw new Error('Payload admin không hợp lệ.');

    const [current,currentTeam,currentSeo,storage]=await Promise.all([readJson<Catalogue>(token,`${DATA_ROOT}/catalogue.json`,branch),readJson<any[]>(token,`${DATA_ROOT}/team.json`,branch),readJson<any>(token,`${DATA_ROOT}/seo.json`,branch),readJson<any>(token,`${DATA_ROOT}/storage.json`,branch)]);
    const storageBase=String(storage?.publicBaseUrl||'').replace(/\/$/,'');
    if((catalogueRequested||teamRequested)&&!storageBase)throw new Error('Cloudflare R2 publicBaseUrl chưa được cấu hình.');

    const files:Record<string,unknown>={};
    const baselines:Record<string,unknown>={};

    if(catalogueRequested){
      const previous=optionsFor(current);
      const preferredCategories=unique((Array.isArray(payload.categories)?payload.categories:previous.categories).map(String));
      const preferredCredits=unique((Array.isArray(payload.credits)?payload.credits:previous.credits).map(String));
      const preferredRanks=orderedUnique((Array.isArray(payload.ranks)?payload.ranks:previous.ranks).map(String));
      const requested=(Array.isArray(payload.ownerItems)?payload.ownerItems:current.items||[]).map(canonicalItem);
      const invalidCategories=unique(requested.map(x=>String(x?.category||'').trim()).filter(value=>Boolean(value)&&!preferredCategories.includes(value)));
      const invalidCredits=unique(requested.map(x=>String(x?.credit||'').trim()).filter(value=>Boolean(value)&&!preferredCredits.includes(value)));
      const invalidRanks=unique(requested.map(x=>String(x?.rank||'').trim()).filter(value=>Boolean(value)&&!preferredRanks.includes(value)));
      if(invalidCategories.length||invalidCredits.length||invalidRanks.length){
        return Response.json({error:'Taxonomy không hợp lệ: tác phẩm đang tham chiếu tùy chọn không còn tồn tại. Hãy cập nhật tác phẩm trước khi publish.',requestId,invalid:{categories:invalidCategories,credits:invalidCredits,ranks:invalidRanks}},{status:409,headers:responseHeaders(request,requestId)});
      }
      const enriched=[];for(const item of requested)enriched.push(await enrichMedia(item,storageBase,token));
      const items=enriched.map(canonicalItem).sort((a,b)=>alpha(String(a.category||''),String(b.category||''))||Number(a.rankOrder||0)-Number(b.rankOrder||0)||alpha(String(a.name||''),String(b.name||'')));
      const categories=preferredCategories;const credits=preferredCredits;const ranks=preferredRanks;const ownerOptions={categories,ranks,credits};
      const catalogue:Catalogue={...current,schemaVersion:2,generatedAt:new Date().toISOString(),items,categories,ranks,credits,ownerOptions};
      const path=`${DATA_ROOT}/catalogue.json`;files[path]=catalogue;baselines[path]=current;
    }

    if(teamRequested){
      const requestedTeam=payload.team as any[];const enrichedTeam=[];for(const member of requestedTeam)enrichedTeam.push(await enrichTeamMember(member,storageBase,token));
      const path=`${DATA_ROOT}/team.json`;
      if(!sameFile(path,enrichedTeam,currentTeam)){files[path]=enrichedTeam;baselines[path]=currentTeam}
    }

    if(seoRequested){
      const path=`${DATA_ROOT}/seo.json`;
      if(!sameFile(path,payload.seo,currentSeo)){files[path]=payload.seo;baselines[path]=currentSeo}
    }

    let result:CommitResult;
    if(Object.keys(files).length){result=await atomicCommit(token,branch,files,baselines)}
    else{
      const refPart=branch.split('/').map(encodeURIComponent).join('/');const ref=await gh<{object:{sha:string}}>(token,`/repos/${REPO}/git/ref/heads/${refPart}`);result={sha:ref.object.sha,noop:true};
    }

    if(!result.noop){
      const paths=new Set<string>();
      if(catalogueRequested){revalidateTag('catalogue');for(const path of ['/','/character/','/artworks/','/sitemap.xml','/image-sitemap.xml'])paths.add(path)}
      if(teamRequested)paths.add('/about/');
      if(seoRequested)for(const path of ['/','/character/','/artworks/','/about/','/sitemap.xml','/image-sitemap.xml'])paths.add(path);
      for(const path of paths)revalidatePath(path);
    }
    return Response.json({ok:true,requestId,commit:result.sha,branch,by:admin.login,deployedByGit:!result.noop,noop:result.noop},{headers:responseHeaders(request,requestId)});
  }catch(error:any){const message=error?.message||'Không thể publish metadata lên GitHub.';logAdminFailure(requestId,'POST',message);return Response.json({error:message,requestId},{status:statusFor(message),headers:responseHeaders(request,requestId)})}
}
