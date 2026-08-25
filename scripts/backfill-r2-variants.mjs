import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const exec=promisify(execFile);
const ROOT=process.cwd();
const cataloguePath=join(ROOT,'data/backend/catalogue.json');
const storagePath=join(ROOT,'data/backend/storage.json');
const widths=[640,960,1600];
const CONCURRENCY=4;
const workdir=join(tmpdir(),`hyu-r2-variants-${process.pid}`);

const catalogue=JSON.parse(await readFile(cataloguePath,'utf8'));
const storage=JSON.parse(await readFile(storagePath,'utf8'));
const base=String(storage.publicBaseUrl||'').replace(/\/$/,'');
const bucket=String(storage.bucket||'');
if(!base||!bucket)throw new Error('R2 storage metadata is incomplete.');
if(!process.env.CLOUDFLARE_ACCOUNT_ID||!process.env.CLOUDFLARE_API_TOKEN)throw new Error('Cloudflare credentials are required.');
await mkdir(workdir,{recursive:true});

function safeId(id){return String(id||'art').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'art'}
function keyFor(item,width){const hash=createHash('sha1').update(String(item.image)).digest('hex').slice(0,12);return `artworks/variants/${safeId(item.id)}-${hash}-${width}.webp`}
function publicUrl(key){return `${base}/media/${key.split('/').map(encodeURIComponent).join('/')}`}
function complete(item){return widths.every(width=>item?.variants?.[String(width)]?.url)&&item?.media?.original?.url}

async function upload(key,file){
  await exec('npx',['--yes','wrangler@latest','r2','object','put',`${bucket}/${key}`,'--file',file,'--content-type','image/webp','--cache-control','public, max-age=31536000, immutable','--remote','--force'],{cwd:ROOT,env:process.env,maxBuffer:4*1024*1024});
}

async function processItem(item,index){
  if(complete(item)){console.log(`[${index+1}/${catalogue.items.length}] ${item.id}: already complete`);return false;}
  console.log(`[${index+1}/${catalogue.items.length}] ${item.id}: fetching original`);
  const response=await fetch(String(item.image),{headers:{Accept:'image/*'}});
  if(!response.ok)throw new Error(`${item.id}: original HTTP ${response.status}`);
  const input=Buffer.from(await response.arrayBuffer());
  const meta=await sharp(input,{animated:false}).metadata();
  item.variants={...(item.variants||{})};
  const outputs=await Promise.all(widths.map(async width=>{
    if(item.variants[String(width)]?.url)return null;
    const {data,info}=await sharp(input,{animated:false}).rotate().resize({width,withoutEnlargement:true}).webp({quality:width===640?76:width===960?78:80,effort:4}).toBuffer({resolveWithObject:true});
    const key=keyFor(item,width);const file=join(workdir,`${index}-${safeId(item.id)}-${width}.webp`);await writeFile(file,data);await upload(key,file);
    return {width,variant:{url:publicUrl(key),width:info.width,height:info.height,bytes:data.length,mimeType:'image/webp'}};
  }));
  for(const output of outputs)if(output){item.variants[String(output.width)]=output.variant;console.log(`[${index+1}/${catalogue.items.length}] ${item.id} ${output.width}px -> ${(output.variant.bytes/1024).toFixed(1)} KiB`);}
  item.thumbnail=item.variants['1600']?.url||item.thumbnail||item.image;
  item.media={...(item.media||{}),original:{url:String(item.image),width:Number(meta.width)||0,height:Number(meta.height)||0,bytes:input.length,mimeType:String(response.headers.get('content-type')||meta.format||'application/octet-stream').split(';')[0]}};
  return true;
}

async function mapLimit(items,limit,worker){
  let cursor=0,changed=0;
  async function run(){
    while(true){const index=cursor++;if(index>=items.length)return;if(await worker(items[index],index))changed+=1;}
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>run()));
  return changed;
}

try{
  const changed=await mapLimit(catalogue.items,CONCURRENCY,processItem);
  catalogue.schemaVersion=2;catalogue.generatedAt=new Date().toISOString();
  await writeFile(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');
  console.log(`Backfill complete. Updated ${changed}/${catalogue.items.length} artwork records with concurrency ${CONCURRENCY}.`);
}finally{
  await rm(workdir,{recursive:true,force:true});
}
