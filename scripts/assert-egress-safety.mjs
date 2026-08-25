import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT=process.cwd();
const SCAN_ROOTS=['app','components','lib'];
const FORBIDDEN=[
  ['supabase origin helper',['supabase','ArtworkOrigin'].join('')],
  ['owner Supabase env',['NEXT_PUBLIC','SUPABASE','URL'].join('_')],
  ['collaborator Supabase env',['NEXT_PUBLIC','HUY9VND','SUPABASE','URL'].join('_')],
  ['Supabase public storage path',['storage','v1','object','public'].join('/')],
  ['cache-busting retry',['_hyu','retry'].join('_')]
];

async function filesUnder(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory())out.push(...await filesUnder(full));
    else if(/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name))out.push(full);
  }
  return out;
}

const failures=[];
for(const root of SCAN_ROOTS){
  for(const file of await filesUnder(join(ROOT,root))){
    const text=await readFile(file,'utf8');
    for(const [label,needle] of FORBIDDEN){
      if(text.includes(needle))failures.push(`${relative(ROOT,file)}: forbidden ${label}`);
    }
  }
}

const catalogue=JSON.parse(await readFile(join(ROOT,'data/backend/catalogue.json'),'utf8'));
if(catalogue.ready!==true)failures.push('data/backend/catalogue.json: ready must be true');
if(!Array.isArray(catalogue.items)||!catalogue.items.length)failures.push('data/backend/catalogue.json: items missing');
const publicItems=(catalogue.items||[]).filter(item=>!item.hidden);
for(const item of catalogue.items||[]){
  const id=String(item.id||'<unknown>');
  for(const key of ['source','sourceId','sourceOptions'])if(Object.hasOwn(item,key))failures.push(`${id}: obsolete collaborator field ${key}`);
  for(const field of ['image','thumbnail']){
    const value=String(item[field]||'');
    if(!value)failures.push(`${id}: missing ${field}`);
    if(value.toLowerCase().includes('supabase'))failures.push(`${id}: ${field} still references Supabase`);
  }
  const variants=item.variants||{};
  for(const width of ['640','960','1600']){
    const variant=variants[width];
    if(!variant?.url)failures.push(`${id}: missing ${width}px derivative`);
    else if(String(variant.url).toLowerCase().includes('supabase'))failures.push(`${id}: ${width}px derivative references Supabase`);
  }
  const limits={640:220*1024,960:360*1024,1600:650*1024};
  for(const [width,limit] of Object.entries(limits)){
    const bytes=Number(variants[width]?.bytes||0);
    if(bytes>limit)failures.push(`${id}: ${width}px derivative ${bytes} bytes exceeds ${limit}`);
  }
}
if(publicItems.some(item=>!item.thumbnail))failures.push('public catalogue contains artwork without thumbnail');

const gallery=await readFile(join(ROOT,'components/GalleryClient.tsx'),'utf8');
if(!gallery.includes('const INITIAL_RANDOM_COUNT=6'))failures.push('gallery initial media budget must remain 6');
if(gallery.includes('loader.src=item.image'))failures.push('gallery must not preload original artwork automatically');
if(!gallery.includes('srcSet='))failures.push('gallery must use responsive image srcSet');

if(failures.length){
  console.error(`Egress safety gate failed with ${failures.length} issue(s):`);
  for(const failure of failures)console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Egress safety gate passed: ${catalogue.items.length} artworks, ${publicItems.length} public, zero Supabase runtime paths.`);
