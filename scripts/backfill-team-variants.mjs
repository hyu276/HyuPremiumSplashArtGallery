import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const TEAM_PATH='data/backend/team.json';
const STORAGE_PATH='data/backend/storage.json';
const OUT_DIR='.tmp/team-variants';
const WIDTHS=[320,640];

const team=JSON.parse(await readFile(TEAM_PATH,'utf8'));
const storage=JSON.parse(await readFile(STORAGE_PATH,'utf8'));
const base=String(storage.publicBaseUrl||'').replace(/\/$/,'');
if(!base||!storage.ready)throw new Error('R2 storage metadata is not ready.');
await mkdir(OUT_DIR,{recursive:true});

function keyFor(member,source,width){
  const safe=String(member.id||'member').toLowerCase().replace(/[^a-z0-9]+/g,'-')||'member';
  const hash=createHash('sha1').update(source).digest('hex').slice(0,12);
  return `team/variants/${safe}-${hash}-${width}.webp`;
}
function publicUrl(key){return `${base}/media/${key.split('/').map(encodeURIComponent).join('/')}`;}

const uploads=[];
for(const member of team){
  const source=String(member.image||'');
  if(!source)throw new Error(`Team member ${member.id} has no image.`);
  const response=await fetch(source,{headers:{Accept:'image/*'},cache:'no-store'});
  if(!response.ok)throw new Error(`Failed to fetch team image ${member.id}: ${response.status}`);
  const input=Buffer.from(await response.arrayBuffer());
  const meta=await sharp(input,{animated:false}).metadata();
  const variants={...(member.variants||{})};
  for(const width of WIDTHS){
    const {data,info}=await sharp(input,{animated:false}).rotate().resize({width,withoutEnlargement:true}).webp({quality:width===320?76:80,effort:4}).toBuffer({resolveWithObject:true});
    const key=keyFor(member,source,width);
    const file=join(OUT_DIR,`${member.id}-${width}.webp`);
    await writeFile(file,data);
    variants[String(width)]={url:publicUrl(key),width:info.width,height:info.height,bytes:data.length,mimeType:'image/webp'};
    uploads.push({key,file,bytes:data.length});
  }
  member.variants=variants;
  member.media={...(member.media||{}),original:{url:source,width:Number(meta.width)||0,height:Number(meta.height)||0,bytes:input.length,mimeType:String(response.headers.get('content-type')||meta.format||'application/octet-stream').split(';')[0]}};
}

await writeFile(TEAM_PATH,JSON.stringify(team,null,2)+'\n');
await writeFile('.tmp/team-uploads.json',JSON.stringify(uploads,null,2)+'\n');
console.log(`Prepared ${uploads.length} team derivatives for ${team.length} members.`);
