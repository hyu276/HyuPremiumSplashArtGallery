import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ROOT=resolve(new URL('..',import.meta.url).pathname);
const args=process.argv.slice(2);
const outputIndex=args.indexOf('--output');
const output=resolve(ROOT,outputIndex>=0&&args[outputIndex+1]?args[outputIndex+1]:'.artifacts/drive-archive-manifest.json');

const catalogue=JSON.parse(await readFile(resolve(ROOT,'data/backend/catalogue.json'),'utf8'));
const team=JSON.parse(await readFile(resolve(ROOT,'data/backend/team.json'),'utf8'));
const storage=JSON.parse(await readFile(resolve(ROOT,'data/backend/storage.json'),'utf8'));

if(storage?.provider!=='cloudflare-r2'||storage?.ready!==true)throw new Error('Active media storage must remain ready Cloudflare R2.');
if(storage?.coldArchive?.provider!=='google-drive')throw new Error('Google Drive cold archive is not configured.');
if(storage?.coldArchive?.servesPublicTraffic!==false)throw new Error('Google Drive cold archive must never serve public traffic.');

const mediaOrigin=new URL(String(storage.publicBaseUrl)).origin;
const objects=new Map();

function mediaKey(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  if(raw.toLowerCase().includes('supabase'))throw new Error(`Supabase media reference is forbidden: ${raw}`);
  const url=new URL(raw);
  if(url.origin!==mediaOrigin)throw new Error(`Original is outside the managed R2 Worker origin: ${raw}`);
  if(!url.pathname.startsWith('/media/'))throw new Error(`Managed media URL must use /media/: ${raw}`);
  return decodeURIComponent(url.pathname.slice('/media/'.length));
}

function addOriginal({url,bytes=0,mimeType='application/octet-stream',source}){
  const key=mediaKey(url);
  if(!key)return;
  const expectedBytes=Number(bytes)||0;
  const current=objects.get(key);
  if(current){
    if(current.url!==url)throw new Error(`Conflicting URLs for media key ${key}`);
    if(current.expectedBytes&&expectedBytes&&current.expectedBytes!==expectedBytes)throw new Error(`Conflicting byte metadata for media key ${key}`);
    current.sources.push(source);
    if(!current.expectedBytes&&expectedBytes)current.expectedBytes=expectedBytes;
    return;
  }
  objects.set(key,{key,url,expectedBytes,mimeType:String(mimeType||'application/octet-stream'),sources:[source]});
}

for(const item of catalogue.items||[]){
  const original=item?.media?.original||{};
  addOriginal({
    url:original.url||item.image,
    bytes:original.bytes,
    mimeType:original.mimeType,
    source:`catalogue:${item.id||'<unknown>'}`
  });
}

for(const [category,choice] of Object.entries(catalogue.championThumbnails||{})){
  if(choice?.mode!=='custom')continue;
  const original=choice?.media?.original||{};
  addOriginal({
    url:original.url||choice.image,
    bytes:original.bytes,
    mimeType:original.mimeType,
    source:`champion-thumbnail:${category}`
  });
}

for(const member of team||[]){
  const original=member?.media?.original||{};
  addOriginal({
    url:original.url||member.image,
    bytes:original.bytes,
    mimeType:original.mimeType,
    source:`team:${member.id||member.name||'<unknown>'}`
  });
}

const entries=[...objects.values()].sort((a,b)=>a.key.localeCompare(b.key));
const manifest={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  source:{
    provider:'cloudflare-r2',
    bucket:String(storage.bucket||''),
    publicBaseUrl:String(storage.publicBaseUrl||'')
  },
  target:{
    provider:'google-drive',
    mode:String(storage.coldArchive.mode||'originals-only'),
    rootFolderId:String(storage.coldArchive.rootFolderId||''),
    mediaPrefix:'media',
    manifestsPrefix:'manifests',
    servesPublicTraffic:false
  },
  objectCount:entries.length,
  totalExpectedBytes:entries.reduce((sum,item)=>sum+item.expectedBytes,0),
  objects:entries
};

if(!manifest.target.rootFolderId)throw new Error('Google Drive rootFolderId is missing.');
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(manifest,null,2)+'\n');
console.log(`Drive archive manifest: ${manifest.objectCount} originals, ${manifest.totalExpectedBytes} expected bytes -> ${output}`);
