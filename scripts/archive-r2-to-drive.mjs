import { createHash, createSign, randomUUID } from 'node:crypto';

const DRIVE_SCOPE='https://www.googleapis.com/auth/drive';
const GOOGLE_TOKEN_URL='https://oauth2.googleapis.com/token';
const DRIVE_API='https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API='https://www.googleapis.com/upload/drive/v3';
const CF_API='https://api.cloudflare.com/client/v4';
const DEFAULT_BUCKET='hyu-premium-media';
const DEFAULT_CONCURRENCY=3;

function requiredEnv(name,fallback=''){const value=String(process.env[name]??fallback).trim();if(!value)throw new Error(`Missing required environment variable: ${name}`);return value}
function b64url(input){return Buffer.from(input).toString('base64url')}
function escapeDriveQuery(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
function encodeR2KeyForRest(key){return String(key).split('/').map(segment=>encodeURIComponent(segment)).join('/')}
function normalizeEtag(value){return String(value||'').replace(/^W\//,'').replace(/^"|"$/g,'')}
function splitKey(key){const parts=String(key).split('/').filter(Boolean);if(!parts.length)throw new Error(`Invalid R2 object key: ${key}`);return {folders:parts.slice(0,-1),name:parts.at(-1)}}
function serviceAccountFromEnv(){let raw=requiredEnv('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');try{return JSON.parse(raw)}catch{try{return JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}catch{throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON must be raw JSON or base64-encoded JSON.')}}}

async function googleAccessToken(serviceAccount){
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=b64url(JSON.stringify({iss:serviceAccount.client_email,scope:DRIVE_SCOPE,aud:GOOGLE_TOKEN_URL,iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`;
  const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${signer.sign(serviceAccount.private_key).toString('base64url')}`;
  const response=await fetch(GOOGLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  if(!response.ok)throw new Error(`Google OAuth failed (${response.status}): ${(await response.text()).slice(0,500)}`);
  const data=await response.json();if(!data.access_token)throw new Error('Google OAuth response did not include access_token.');return data.access_token;
}

async function driveJson(token,path,options={}){
  const response=await fetch(`${DRIVE_API}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...(options.headers||{})}});
  if(!response.ok)throw new Error(`Drive API ${options.method||'GET'} ${path} failed (${response.status}): ${(await response.text()).slice(0,600)}`);
  return response.status===204?null:response.json();
}

async function findDriveFileByName(token,parentId,name){
  const q=[`'${escapeDriveQuery(parentId)}' in parents`,`name='${escapeDriveQuery(name)}'`,'trashed=false'].join(' and ');
  const params=new URLSearchParams({q,spaces:'drive',fields:'files(id,name,mimeType,size,appProperties)',pageSize:'10'});
  const data=await driveJson(token,`/files?${params}`);
  return data.files?.find(file=>file.mimeType!=='application/vnd.google-apps.folder')||null;
}

async function findFolder(token,parentId,name){
  const q=[`'${escapeDriveQuery(parentId)}' in parents`,`name='${escapeDriveQuery(name)}'`,`mimeType='application/vnd.google-apps.folder'`,'trashed=false'].join(' and ');
  const params=new URLSearchParams({q,spaces:'drive',fields:'files(id,name,mimeType)',pageSize:'10'});
  const data=await driveJson(token,`/files?${params}`);
  return data.files?.[0]||null;
}

async function ensureFolder(token,parentId,name,cache){
  const cacheKey=`${parentId}/${name}`;if(cache.has(cacheKey))return cache.get(cacheKey);
  const existing=await findFolder(token,parentId,name);if(existing){cache.set(cacheKey,existing.id);return existing.id}
  const created=await driveJson(token,'/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]})});
  cache.set(cacheKey,created.id);return created.id;
}

async function ensurePath(token,rootId,folders,cache){let parent=rootId;for(const folder of folders)parent=await ensureFolder(token,parent,folder,cache);return parent}

async function listR2Objects(accountId,apiToken,bucket){
  const objects=[];let cursor='';
  do{
    const params=new URLSearchParams();if(cursor)params.set('cursor',cursor);
    const url=`${CF_API}/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/objects${params.size?`?${params}`:''}`;
    const response=await fetch(url,{headers:{Authorization:`Bearer ${apiToken}`}});
    if(!response.ok)throw new Error(`Cloudflare R2 list failed (${response.status}): ${(await response.text()).slice(0,600)}`);
    const data=await response.json();if(data.success===false)throw new Error(`Cloudflare R2 list failed: ${JSON.stringify(data.errors||[]).slice(0,600)}`);
    const page=Array.isArray(data.result)?data.result:Array.isArray(data.objects)?data.objects:[];objects.push(...page);
    cursor=String(data.result_info?.cursor||data.resultInfo?.cursor||data.cursor||'');
  }while(cursor);
  return objects;
}

async function getR2Object(accountId,apiToken,bucket,key){
  const url=`${CF_API}/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodeR2KeyForRest(key)}`;
  const response=await fetch(url,{headers:{Authorization:`Bearer ${apiToken}`}});
  if(!response.ok)throw new Error(`Cloudflare R2 get failed for ${key} (${response.status}): ${(await response.text()).slice(0,300)}`);
  return {body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')||'application/octet-stream',etag:normalizeEtag(response.headers.get('etag'))};
}

async function uploadDriveFile(token,parentId,name,mimeType,buffer,appProperties,existingId=''){
  const metadata={name,appProperties};if(!existingId)metadata.parents=[parentId];
  const boundary=`hyu-${randomUUID()}`;
  const prefix=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const suffix=Buffer.from(`\r\n--${boundary}--`);
  const body=Buffer.concat([prefix,buffer,suffix]);
  const method=existingId?'PATCH':'POST';const target=existingId?`/files/${encodeURIComponent(existingId)}`:'/files';
  const response=await fetch(`${DRIVE_UPLOAD_API}${target}?uploadType=multipart&fields=id,name,size,appProperties`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`,'Content-Length':String(body.length)},body});
  if(!response.ok)throw new Error(`Drive upload failed for ${name} (${response.status}): ${(await response.text()).slice(0,600)}`);
  return response.json();
}

async function syncObject(context,object){
  const key=String(object.key||object.name||'');if(!key)throw new Error(`R2 list returned an object without a key: ${JSON.stringify(object).slice(0,300)}`);
  const listedEtag=normalizeEtag(object.etag);const {folders,name}=splitKey(key);
  const parentId=await ensurePath(context.driveToken,context.rootId,folders,context.folderCache);
  const existing=await findDriveFileByName(context.driveToken,parentId,name);
  if(existing?.appProperties?.r2Etag&&listedEtag&&normalizeEtag(existing.appProperties.r2Etag)===listedEtag){
    return {key,status:'skipped',driveId:existing.id,etag:listedEtag,size:Number(existing.size||object.size||0),sha256:existing.appProperties.sha256||''};
  }
  const downloaded=await getR2Object(context.accountId,context.cfToken,context.bucket,key);
  const etag=downloaded.etag||listedEtag;const sha256=createHash('sha256').update(downloaded.body).digest('hex');
  const uploaded=await uploadDriveFile(context.driveToken,parentId,name,downloaded.contentType,downloaded.body,{r2Key:key,r2Etag:etag,sha256,r2Bucket:context.bucket},existing?.id||'');
  return {key,status:existing?'updated':'uploaded',driveId:uploaded.id,etag,size:downloaded.body.length,sha256};
}

async function runPool(items,limit,worker){
  const results=new Array(items.length);let next=0;
  async function runner(){while(true){const index=next++;if(index>=items.length)return;results[index]=await worker(items[index],index)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length||1)},()=>runner()));return results;
}

async function writeManifest(token,manifestsFolderId,manifest){
  const name='r2-manifest.json';const existing=await findDriveFileByName(token,manifestsFolderId,name);
  return uploadDriveFile(token,manifestsFolderId,name,'application/json',Buffer.from(`${JSON.stringify(manifest,null,2)}\n`),{kind:'hyupremium-r2-manifest',generatedAt:manifest.generatedAt},existing?.id||'');
}

function selfTest(){
  const cases=[['artworks/originals/a b.jpg','artworks/originals/a%20b.jpg'],['legacy/repo/assets/a#b.png','legacy/repo/assets/a%23b.png'],['x/đẹp.webp','x/%C4%91%E1%BA%B9p.webp']];
  for(const [input,expected] of cases){const actual=encodeR2KeyForRest(input);if(actual!==expected)throw new Error(`encode self-test failed: ${input} -> ${actual}`)}
  const split=splitKey('artworks/originals/example.jpg');if(split.name!=='example.jpg'||split.folders.join('/')!=='artworks/originals')throw new Error('splitKey self-test failed');
  if(normalizeEtag('"abc"')!=='abc')throw new Error('etag self-test failed');
  console.log('archive-r2-to-drive self-test passed');
}

async function main(){
  if(process.argv.includes('--self-test'))return selfTest();
  const serviceAccount=serviceAccountFromEnv();const driveToken=await googleAccessToken(serviceAccount);
  const accountId=requiredEnv('CLOUDFLARE_ACCOUNT_ID');const cfToken=requiredEnv('CLOUDFLARE_API_TOKEN');
  const bucket=String(process.env.R2_BUCKET||DEFAULT_BUCKET).trim();const rootId=requiredEnv('GOOGLE_DRIVE_ARCHIVE_ROOT_ID');const manifestsFolderId=requiredEnv('GOOGLE_DRIVE_MANIFESTS_FOLDER_ID');
  const objects=await listR2Objects(accountId,cfToken,bucket);const startedAt=new Date().toISOString();console.log(`Found ${objects.length} R2 object(s) in ${bucket}.`);
  const context={driveToken,accountId,cfToken,bucket,rootId,folderCache:new Map()};
  const concurrency=Math.max(1,Math.min(8,Number(process.env.ARCHIVE_CONCURRENCY||DEFAULT_CONCURRENCY)||DEFAULT_CONCURRENCY));
  const results=await runPool(objects,concurrency,async(object,index)=>{const result=await syncObject(context,object);console.log(`[${index+1}/${objects.length}] ${result.status}: ${result.key}`);return result});
  const manifest={schemaVersion:1,source:'cloudflare-r2',bucket,generatedAt:new Date().toISOString(),startedAt,objectCount:results.length,totalBytes:results.reduce((sum,item)=>sum+Number(item.size||0),0),counts:results.reduce((acc,item)=>({...acc,[item.status]:(acc[item.status]||0)+1}),{}),objects:results};
  const manifestFile=await writeManifest(driveToken,manifestsFolderId,manifest);console.log(`Manifest updated: ${manifestFile.id}`);
}

main().catch(error=>{console.error(error instanceof Error?error.stack||error.message:error);process.exit(1)});
