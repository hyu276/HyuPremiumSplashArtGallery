import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const args=process.argv.slice(2);
const manifestIndex=args.indexOf('--manifest');
const outputIndex=args.indexOf('--output-dir');
if(manifestIndex<0||!args[manifestIndex+1])throw new Error('Usage: node scripts/sync-drive-archive.mjs --manifest <path> [--output-dir <path>]');
const manifestPath=resolve(args[manifestIndex+1]);
const outputDir=resolve(outputIndex>=0&&args[outputIndex+1]?args[outputIndex+1]:'.artifacts/drive-cold-storage');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));

if(!Array.isArray(manifest.objects)||!manifest.objects.length)throw new Error('Archive manifest has no objects.');
if(manifest?.target?.provider!=='google-drive'||manifest?.target?.servesPublicTraffic!==false)throw new Error('Manifest target must be a non-serving Google Drive cold archive.');

function safeKey(raw){
  const key=String(raw||'').replace(/^\/+/, '');
  if(!key||key.includes('..')||key.includes('\\'))throw new Error(`Unsafe media key: ${raw}`);
  return key;
}

async function sha256(path){
  const hash=createHash('sha256');
  await pipeline(createReadStream(path),hash);
  return hash.digest('hex');
}

async function download(url,path){
  const response=await fetch(url,{headers:{Accept:'application/octet-stream'},redirect:'follow'});
  if(!response.ok||!response.body)throw new Error(`Source download failed ${response.status}: ${url}`);
  await mkdir(dirname(path),{recursive:true});
  await pipeline(Readable.fromWeb(response.body),createWriteStream(path));
  return response;
}

const results=[];
for(let index=0;index<manifest.objects.length;index+=1){
  const item=manifest.objects[index];
  const key=safeKey(item.key);
  const target=join(outputDir,'media',...key.split('/'));
  const response=await download(String(item.url),target);
  const local=(await stat(target)).size;
  const expected=Number(item.expectedBytes)||0;
  if(expected>0&&local!==expected)throw new Error(`Byte mismatch for ${key}: expected ${expected}, downloaded ${local}`);
  const checksum=await sha256(target);
  const contentType=String(response.headers.get('content-type')||item.mimeType||'application/octet-stream').split(';')[0];
  results.push({...item,archivePath:`media/${key}`,verifiedBytes:local,sha256:checksum,contentType,status:'verified'});
  console.log(`[${index+1}/${manifest.objects.length}] verified media/${key} (${local} bytes)`);
}

const finishedAt=new Date().toISOString();
const resultManifest={
  ...manifest,
  archivedAt:finishedAt,
  verifiedObjectCount:results.length,
  verifiedBytes:results.reduce((sum,item)=>sum+Number(item.verifiedBytes||0),0),
  objects:results
};
const resultPath=join(outputDir,'manifests','archive-result.json');
await mkdir(dirname(resultPath),{recursive:true});
await writeFile(resultPath,JSON.stringify(resultManifest,null,2)+'\n');
console.log(`Drive snapshot staging verified: ${resultManifest.verifiedObjectCount} originals, ${resultManifest.verifiedBytes} bytes -> ${outputDir}`);
