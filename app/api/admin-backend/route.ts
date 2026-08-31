import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { revalidatePath, revalidateTag } from 'next/cache';

const REPO='hyu276/HyuPremiumSplashArtGallery';
const OWNER='hyu276';
const API='https://api.github.com';
const DATA_ROOT='data/backend';
const VARIANT_WIDTHS=[640,960,1600] as const;
const TEAM_VARIANT_WIDTHS=[320,640] as const;

type GitHubUser={login?:string};
type GitHubRepo={permissions?:{push?:boolean;admin?:boolean}};
type GitHubContent={content?:string;encoding?:string};
type OwnerOptions={categories?:string[];ranks?:string[];credits?:string[]};
type MediaVariant={url:string;width:number;height:number;bytes:number;mimeType:string};
type Catalogue={schemaVersion?:number;generatedAt?:string;items:any[];categories:string[];ranks:string[];credits:string[];ownerOptions?:OwnerOptions};
type AdminPayload={ownerItems?:any[];categories?:string[];ranks?:string[];credits?:string[];team?:any[];seo?:any};

const ADMIN_ORIGIN='https://hyu276.github.io';
function corsHeaders(request:Request):Record<string,string>{const origin=request.headers.get('origin')||'';return origin===ADMIN_ORIGIN?{'Access-Control-Allow-Origin':ADMIN_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'}:{}}
function responseHeaders(request:Request):Record<string,string>{return {'Cache-Control':'no-store',...corsHeaders(request)}}
export async function OPTIONS(request:Request){return new Response(null,{status:204,headers:responseHeaders(request)})}

function tokenFrom(request:Request){const value=request.headers.get('authorization')||'';return value.toLowerCase().startsWith('bearer ')?value.slice(7).trim():''}
function dataBranch(){const explicit=String(process.env.GITHUB_DATA_BRANCH||'').trim();if(explicit)return explicit;const vercelRef=String(process.env.VERCEL_GIT_COMMIT_REF||'').trim();return vercelRef||'main'}
function ghHeaders(token:string){return {Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'HYU-PREMIUM-ADMIN'}}
async function gh<T>(token:string,pathname:string,init:RequestInit={}):Promise<T>{const response=await fetch(`${API}${pathname}`,{...init,headers:{...ghHeaders(token),...(init.headers||{})},cache:'no-store'});if(!response.ok){const body=await response.text();throw new Error(`GitHub ${response.status}: ${body.slice(0,500)}`)}return response.json() as Promise<T>}

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
  const response=await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'image/webp'},body:new Uint8Array(buffer),cache:'no-store'});
  if(!response.ok)throw new Error(`R2 derivative upload ${response.status}: ${(await response.text()).slice(0,300)}`);
  return publicR2Url(base,key);
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
async function atomicCommit(token:string,branch:string,files:Record<string,unknown>){const refPart=branch.split('/').map(encodeURIComponent).join('/');const ref=await gh<{object:{sha:string}}>(token,`/repos/${REPO}/git/ref/heads/${refPart}`);const parent=ref.object.sha;const commit=await gh<{tree:{sha:string}}>(token,`/repos/${REPO}/git/commits/${parent}`);const tree:Array<{path:string;mode:'100644';type:'blob';sha:string}>=[];for(const [file,value] of Object.entries(files)){const blob=await createBlob(token,JSON.stringify(value,null,2)+'\n');tree.push({path:file,mode:'100644',type:'blob',sha:blob.sha})}const newTree=await gh<{sha:string}>(token,`/repos/${REPO}/git/trees`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:commit.tree.sha,tree})});const next=await gh<{sha:string}>(token,`/repos/${REPO}/git/commits`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'content(admin): cập nhật backend GitHub từ dashboard',tree:newTree.sha,parents:[parent]})});await gh(token,`/repos/${REPO}/git/refs/heads/${refPart}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:next.sha,force:false})});return next.sha}

export async function GET(request:Request){
  try{
    const token=tokenFrom(request);const admin=await verify(token);const branch=dataBranch();
    const [catalogue,team,seo,storage]=await Promise.all([readJson<Catalogue>(token,`${DATA_ROOT}/catalogue.json`,branch),readJson<any[]>(token,`${DATA_ROOT}/team.json`,branch),readJson<any>(token,`${DATA_ROOT}/seo.json`,branch),readJson<any>(token,`${DATA_ROOT}/storage.json`,branch)]);
    const items=(catalogue.items||[]).map(canonicalItem);const options=optionsFor(catalogue);
    return Response.json({ok:true,user:admin,branch,catalogue:{...catalogue,items,categories:options.categories||[],ranks:options.ranks||[],credits:options.credits||[]},team,seo,storage},{headers:responseHeaders(request)});
  }catch(error:any){const message=error?.message||'Không thể xác thực GitHub hoặc đọc backend metadata.';const status=/github_pat_|Token|GitHub 401|GitHub 403|quyền|chủ repository/.test(message)?401:/404/.test(message)?409:500;return Response.json({error:message},{status,headers:responseHeaders(request)})}
}

export async function POST(request:Request){
  try{
    const token=tokenFrom(request);const admin=await verify(token);const payload=await request.json() as AdminPayload;const branch=dataBranch();
    const [current,currentTeam,currentSeo,storage]=await Promise.all([readJson<Catalogue>(token,`${DATA_ROOT}/catalogue.json`,branch),readJson<any[]>(token,`${DATA_ROOT}/team.json`,branch),readJson<any>(token,`${DATA_ROOT}/seo.json`,branch),readJson<any>(token,`${DATA_ROOT}/storage.json`,branch)]);
    const storageBase=String(storage?.publicBaseUrl||'').replace(/\/$/,'');if(!storageBase)throw new Error('Cloudflare R2 publicBaseUrl chưa được cấu hình.');
    const previous=optionsFor(current);
    const preferredCategories=unique((Array.isArray(payload.categories)?payload.categories:previous.categories).map(String));
    const preferredCredits=unique((Array.isArray(payload.credits)?payload.credits:previous.credits).map(String));
    const preferredRanks=orderedUnique((Array.isArray(payload.ranks)?payload.ranks:previous.ranks).map(String));
    const requested=(Array.isArray(payload.ownerItems)?payload.ownerItems:current.items||[]).map(canonicalItem);
    const invalidCategories=unique(requested.map(x=>String(x?.category||'').trim()).filter(value=>Boolean(value)&&!preferredCategories.includes(value)));
    const invalidCredits=unique(requested.map(x=>String(x?.credit||'').trim()).filter(value=>Boolean(value)&&!preferredCredits.includes(value)));
    const invalidRanks=unique(requested.map(x=>String(x?.rank||'').trim()).filter(value=>Boolean(value)&&!preferredRanks.includes(value)));
    if(invalidCategories.length||invalidCredits.length||invalidRanks.length){
      return Response.json({error:'Taxonomy không hợp lệ: tác phẩm đang tham chiếu tùy chọn không còn tồn tại. Hãy cập nhật tác phẩm trước khi publish.',invalid:{categories:invalidCategories,credits:invalidCredits,ranks:invalidRanks}},{status:409,headers:responseHeaders(request)});
    }
    const enriched=[];for(const item of requested)enriched.push(await enrichMedia(item,storageBase,token));
    const items=enriched.map(canonicalItem).sort((a,b)=>alpha(String(a.category||''),String(b.category||''))||Number(a.rankOrder||0)-Number(b.rankOrder||0)||alpha(String(a.name||''),String(b.name||'')));
    const categories=preferredCategories;
    const credits=preferredCredits;
    const ranks=preferredRanks;
    const ownerOptions={categories,ranks,credits};
    const catalogue:Catalogue={...current,schemaVersion:2,generatedAt:new Date().toISOString(),items,categories,ranks,credits,ownerOptions};
    const requestedTeam=Array.isArray(payload.team)?payload.team:currentTeam;const enrichedTeam=[];for(const member of requestedTeam)enrichedTeam.push(await enrichTeamMember(member,storageBase,token));
    const files:Record<string,unknown>={[`${DATA_ROOT}/catalogue.json`]:catalogue,[`${DATA_ROOT}/team.json`]:enrichedTeam,[`${DATA_ROOT}/seo.json`]:payload.seo!==undefined?payload.seo:currentSeo};
    const sha=await atomicCommit(token,branch,files);revalidateTag('catalogue');for(const path of ['/','/character/','/artworks/','/about/','/sitemap.xml','/image-sitemap.xml'])revalidatePath(path);
    return Response.json({ok:true,commit:sha,branch,by:admin.login,deployedByGit:true},{headers:responseHeaders(request)});
  }catch(error:any){const message=error?.message||'Không thể publish metadata lên GitHub.';const status=/github_pat_|Token|GitHub 401|GitHub 403|quyền|chủ repository/.test(message)?401:/409|422/.test(message)?409:500;return Response.json({error:message},{status,headers:responseHeaders(request)})}
}
