import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const manifest=JSON.parse(await readFile('scripts/r2-migration-manifest.json','utf8'));
const base=String(process.env.MEDIA_BASE||'').replace(/\/$/,'');
const tmp='/tmp/hyu-r2-object.bin';

if(!base)throw new Error('MEDIA_BASE is required');

let skipped=0;
let uploaded=0;
let totalBytes=0;

const mediaUrl=(key)=>base+'/media/'+key.split('/').map(encodeURIComponent).join('/');

for(const [index,item] of manifest.entries()){
  const target=mediaUrl(item.key);
  let head=null;
  try{head=await fetch(target,{method:'HEAD',redirect:'follow'});}catch{}
  const existing=head?.ok?Number(head.headers.get('content-length')||0):0;

  if(head?.ok&&(!item.size||existing===Number(item.size))){
    skipped+=1;
    console.log(`[${index+1}/${manifest.length}] exists ${item.key} (${existing} bytes)`);
    continue;
  }

  const response=await fetch(item.source,{redirect:'follow'});
  if(!response.ok)throw new Error(`source fetch failed ${response.status} ${item.source}`);

  const body=new Uint8Array(await response.arrayBuffer());
  if(!body.byteLength)throw new Error(`empty source ${item.source}`);
  if(item.kind==='supabase'&&item.size&&body.byteLength!==Number(item.size)){
    throw new Error(`source size mismatch ${item.source}: ${body.byteLength} != ${item.size}`);
  }

  await writeFile(tmp,body);
  const args=[
    'r2','object','put',`hyu-premium-media/${item.key}`,
    '--file',tmp,
    '--content-type',item.mime||'application/octet-stream',
    '--cache-control','public, max-age=31536000, immutable',
    '--remote',
    '--force'
  ];
  const run=spawnSync('wrangler',args,{stdio:'inherit',env:process.env});
  if(run.status!==0)throw new Error(`wrangler upload failed for ${item.key}`);

  const verify=await fetch(target,{method:'HEAD',redirect:'follow'});
  if(!verify.ok)throw new Error(`target verify failed ${verify.status} ${target}`);
  const actual=Number(verify.headers.get('content-length')||0);
  if(actual!==body.byteLength){
    throw new Error(`target size mismatch ${item.key}: ${actual} != ${body.byteLength}`);
  }

  uploaded+=1;
  totalBytes+=body.byteLength;
  console.log(`[${index+1}/${manifest.length}] uploaded ${item.key} (${body.byteLength} bytes)`);
}

try{await unlink(tmp)}catch{}
console.log(JSON.stringify({ok:true,total:manifest.length,uploaded,skipped,totalBytes}));
