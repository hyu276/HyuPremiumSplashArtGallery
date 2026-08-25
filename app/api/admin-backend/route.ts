import { revalidatePath, revalidateTag } from 'next/cache';

const REPO='hyu276/HyuPremiumSplashArtGallery';
const OWNER='hyu276';
const API='https://api.github.com';
const DATA_ROOT='data/backend';

type GitHubUser={login?:string};
type GitHubRepo={permissions?:{push?:boolean;admin?:boolean}};
type GitHubContent={content?:string;encoding?:string};
type OwnerOptions={categories?:string[];ranks?:string[];credits?:string[]};
type Catalogue={schemaVersion?:number;generatedAt?:string;items:any[];categories:string[];ranks:string[];credits:string[];ownerOptions?:OwnerOptions};
type AdminPayload={ownerItems?:any[];categories?:string[];ranks?:string[];credits?:string[];team?:any[];seo?:any};

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
function orderedRanks(items:any[],preferred:string[]=[]){const out:string[]=[];for(const name of preferred.map(String).map(x=>x.trim()).filter(Boolean))if(!out.includes(name))out.push(name);const missing=[...items].sort((a,b)=>Number(a?.rankOrder||0)-Number(b?.rankOrder||0)).map(x=>String(x?.rank||'').trim()).filter(Boolean);for(const name of missing)if(!out.includes(name))out.push(name);return out}
function canonicalItem(item:any){const {source:_source,sourceId:_sourceId,...rest}=item||{};return {...rest,id:String(rest.id||'')};}
function optionsFor(catalogue:Catalogue){return {categories:catalogue.ownerOptions?.categories||catalogue.categories||[],ranks:catalogue.ownerOptions?.ranks||catalogue.ranks||[],credits:catalogue.ownerOptions?.credits||catalogue.credits||[]}}

async function createBlob(token:string,content:string){return gh<{sha:string}>(token,`/repos/${REPO}/git/blobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,encoding:'utf-8'})})}
async function atomicCommit(token:string,branch:string,files:Record<string,unknown>){const refPart=branch.split('/').map(encodeURIComponent).join('/');const ref=await gh<{object:{sha:string}}>(token,`/repos/${REPO}/git/ref/heads/${refPart}`);const parent=ref.object.sha;const commit=await gh<{tree:{sha:string}}>(token,`/repos/${REPO}/git/commits/${parent}`);const tree:Array<{path:string;mode:'100644';type:'blob';sha:string}>=[];for(const [file,value] of Object.entries(files)){const blob=await createBlob(token,JSON.stringify(value,null,2)+'\n');tree.push({path:file,mode:'100644',type:'blob',sha:blob.sha})}const newTree=await gh<{sha:string}>(token,`/repos/${REPO}/git/trees`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:commit.tree.sha,tree})});const next=await gh<{sha:string}>(token,`/repos/${REPO}/git/commits`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'content(admin): cập nhật backend GitHub từ dashboard',tree:newTree.sha,parents:[parent]})});await gh(token,`/repos/${REPO}/git/refs/heads/${refPart}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:next.sha,force:false})});return next.sha}

export async function GET(request:Request){
  try{
    const token=tokenFrom(request);const admin=await verify(token);const branch=dataBranch();
    const [catalogue,team,seo,storage]=await Promise.all([readJson<Catalogue>(token,`${DATA_ROOT}/catalogue.json`,branch),readJson<any[]>(token,`${DATA_ROOT}/team.json`,branch),readJson<any>(token,`${DATA_ROOT}/seo.json`,branch),readJson<any>(token,`${DATA_ROOT}/storage.json`,branch)]);
    const items=(catalogue.items||[]).map(canonicalItem);const options=optionsFor(catalogue);
    return Response.json({ok:true,user:admin,branch,catalogue:{...catalogue,items,categories:options.categories||[],ranks:options.ranks||[],credits:options.credits||[]},team,seo,storage},{headers:{'Cache-Control':'no-store'}});
  }catch(error:any){const message=error?.message||'Không thể xác thực GitHub hoặc đọc backend metadata.';const status=/github_pat_|Token|GitHub 401|GitHub 403|quyền|chủ repository/.test(message)?401:/404/.test(message)?409:500;return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
}

export async function POST(request:Request){
  try{
    const token=tokenFrom(request);const admin=await verify(token);const payload=await request.json() as AdminPayload;const branch=dataBranch();
    const [current,currentTeam,currentSeo]=await Promise.all([readJson<Catalogue>(token,`${DATA_ROOT}/catalogue.json`,branch),readJson<any[]>(token,`${DATA_ROOT}/team.json`,branch),readJson<any>(token,`${DATA_ROOT}/seo.json`,branch)]);
    const previous=optionsFor(current);
    const items=(Array.isArray(payload.ownerItems)?payload.ownerItems:current.items||[]).map(canonicalItem).sort((a,b)=>alpha(String(a.category||''),String(b.category||''))||Number(a.rankOrder||0)-Number(b.rankOrder||0)||alpha(String(a.name||''),String(b.name||'')));
    const preferredCategories=Array.isArray(payload.categories)?payload.categories:previous.categories;
    const preferredCredits=Array.isArray(payload.credits)?payload.credits:previous.credits;
    const preferredRanks=Array.isArray(payload.ranks)?payload.ranks:previous.ranks;
    const categories=unique([...preferredCategories.map(String),...items.map(x=>String(x?.category||''))]);
    const credits=unique([...preferredCredits.map(String),...items.map(x=>String(x?.credit||''))]);
    const ranks=orderedRanks(items,preferredRanks.map(String));
    const ownerOptions={categories,ranks,credits};
    const catalogue:Catalogue={...current,schemaVersion:1,generatedAt:new Date().toISOString(),items,categories,ranks,credits,ownerOptions};
    const files:Record<string,unknown>={[`${DATA_ROOT}/catalogue.json`]:catalogue,[`${DATA_ROOT}/team.json`]:Array.isArray(payload.team)?payload.team:currentTeam,[`${DATA_ROOT}/seo.json`]:payload.seo!==undefined?payload.seo:currentSeo};
    const sha=await atomicCommit(token,branch,files);revalidateTag('catalogue');for(const path of ['/','/character/','/artworks/','/about/','/sitemap.xml','/image-sitemap.xml'])revalidatePath(path);
    return Response.json({ok:true,commit:sha,branch,by:admin.login,deployedByGit:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error:any){const message=error?.message||'Không thể publish metadata lên GitHub.';const status=/github_pat_|Token|GitHub 401|GitHub 403|quyền|chủ repository/.test(message)?401:/409|422/.test(message)?409:500;return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
}
