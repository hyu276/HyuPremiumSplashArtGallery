import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';

const args=process.argv.slice(2);
const manifestIndex=args.indexOf('--manifest');
if(manifestIndex<0||!args[manifestIndex+1])throw new Error('Usage: node scripts/sync-drive-archive.mjs --manifest <path>');
const manifestPath=resolve(args[manifestIndex+1]);
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));

const remote=String(process.env.DRIVE_REMOTE||'gdrive').trim();
const config=String(process.env.RCLONE_CONFIG||'').trim();
const rootFolderId=String(process.env.DRIVE_ROOT_FOLDER_ID||manifest?.target?.rootFolderId||'').trim();
if(!config)throw new Error('RCLONE_CONFIG is required.');
if(!rootFolderId)throw new Error('DRIVE_ROOT_FOLDER_ID is required.');
if(!Array.isArray(manifest.objects)||!manifest.objects.length)throw new Error('Archive manifest has no objects.');

function rclone(args,{allowMissing=false}={}){
  const result=spawnSync('rclone',[...args,'--config',config,'--drive-root-folder-id',rootFolderId],{encoding:'utf8'});
  if(result.status!==0&&!allowMissing)throw new Error(`rclone failed: ${(result.stderr||result.stdout||'unknown error').trim()}`);
  return result;
}

function remoteSize(path){
  const result=rclone(['lsl',`${remote}:${path}`],{allowMissing:true});
  if(result.status!==0)return 0;
  const line=String(result.stdout||'').trim().split(/\r?\n/)[0]||'';
  const match=line.match(/^\s*(\d+)\s+/);
  return match?Number(match[1]):0;
}

async function sha256(path){
  const hash=createHash('sha256');
  await pipeline(createReadStream(path),hash);
  return hash.digest('hex');
}

async function download(url,path){
  const response=await fetch(url,{headers:{Accept:'application/octet-stream'},redirect:'follow'});
  if(!response.ok||!response.body)throw new Error(`Source download failed ${response.status}: ${url}`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(path));
}

const workdir=join(tmpdir(),`hyu-drive-archive-${process.pid}`);
await mkdir(workdir,{recursive:true});
const results=[];

try{
  for(let index=0;index<manifest.objects.length;index+=1){
    const item=manifest.objects[index];
    const key=String(item.key||'').replace(/^\/+/, '');
    if(!key||key.includes('..'))throw new Error(`Unsafe media key: ${item.key}`);
    const target=`media/${key}`;
    const expected=Number(item.expectedBytes)||0;
    const existing=remoteSize(target);
    if(existing>0&&expected>0&&existing===expected){
      console.log(`[${index+1}/${manifest.objects.length}] exists ${target} (${existing} bytes)`);
      results.push({...item,drivePath:target,verifiedBytes:existing,status:'already-present'});
      continue;
    }

    const tempPath=join(workdir,`${String(index).padStart(5,'0')}-${basename(key)}`);
    await download(String(item.url),tempPath);
    const local=(await stat(tempPath)).size;
    if(expected>0&&local!==expected)throw new Error(`Byte mismatch for ${key}: expected ${expected}, downloaded ${local}`);
    const checksum=await sha256(tempPath);

    console.log(`[${index+1}/${manifest.objects.length}] upload ${target} (${local} bytes)`);
    rclone(['copyto',tempPath,`${remote}:${target}`,'--transfers','1','--checkers','4','--retries','3','--low-level-retries','10']);
    const verified=remoteSize(target);
    if(verified!==local)throw new Error(`Drive verification failed for ${target}: local ${local}, remote ${verified}`);
    results.push({...item,drivePath:target,verifiedBytes:verified,sha256:checksum,status:'uploaded'});
    await rm(tempPath,{force:true});
  }

  const finishedAt=new Date().toISOString();
  const resultManifest={
    ...manifest,
    archivedAt:finishedAt,
    verifiedObjectCount:results.length,
    verifiedBytes:results.reduce((sum,item)=>sum+Number(item.verifiedBytes||0),0),
    objects:results
  };
  const resultPath=join(workdir,'archive-result.json');
  await writeFile(resultPath,JSON.stringify(resultManifest,null,2)+'\n');
  const stamp=finishedAt.replace(/[:.]/g,'-');
  const driveManifestPath=`manifests/archive-${stamp}.json`;
  rclone(['copyto',resultPath,`${remote}:${driveManifestPath}`,'--retries','3','--low-level-retries','10']);
  const published=remoteSize(driveManifestPath);
  if(published<=0)throw new Error('Drive manifest upload could not be verified.');

  const localResult=resolve(dirname(manifestPath),'drive-archive-result.json');
  await writeFile(localResult,JSON.stringify(resultManifest,null,2)+'\n');
  console.log(`Drive cold archive verified: ${resultManifest.verifiedObjectCount} originals, ${resultManifest.verifiedBytes} bytes; manifest ${driveManifestPath}`);
}finally{
  await rm(workdir,{recursive:true,force:true});
}
