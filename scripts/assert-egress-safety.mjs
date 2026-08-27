import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT=process.cwd();
const SCAN_ROOTS=['app','components','lib','scripts'];
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
    const rel=relative(ROOT,file);
    if(rel==='scripts/assert-egress-safety.mjs')continue;
    const text=await readFile(file,'utf8');
    for(const [label,needle] of FORBIDDEN){if(text.includes(needle))failures.push(`${rel}: forbidden ${label}`);}
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
    if(!bytes)failures.push(`${id}: ${width}px derivative missing byte metadata`);
    else if(bytes>limit)failures.push(`${id}: ${width}px derivative ${bytes} bytes exceeds ${limit}`);
  }
}
if(publicItems.some(item=>!item.thumbnail))failures.push('public catalogue contains artwork without thumbnail');

const team=JSON.parse(await readFile(join(ROOT,'data/backend/team.json'),'utf8'));
for(const member of team){
  const id=`team:${member.id||member.name||'<unknown>'}`;
  if(String(member.image||'').toLowerCase().includes('supabase'))failures.push(`${id}: original references Supabase`);
  const limits={320:120*1024,640:220*1024};
  for(const [width,limit] of Object.entries(limits)){
    const v=member?.variants?.[width];
    if(!v?.url)failures.push(`${id}: missing ${width}px derivative`);
    else if(String(v.url).toLowerCase().includes('supabase'))failures.push(`${id}: ${width}px derivative references Supabase`);
    const bytes=Number(v?.bytes||0);
    if(!bytes)failures.push(`${id}: ${width}px derivative missing byte metadata`);
    else if(bytes>limit)failures.push(`${id}: ${width}px derivative ${bytes} bytes exceeds ${limit}`);
  }
}

const gallery=await readFile(join(ROOT,'components/GalleryClient.tsx'),'utf8');
if(!gallery.includes('const INITIAL_RANDOM_COUNT=6'))failures.push('gallery initial media budget must remain 6');
if(!gallery.includes('const SECOND_BATCH_COUNT=30'))failures.push('gallery second batch budget must remain 30');
if(gallery.includes('loader.src=item.image'))failures.push('gallery must not preload original artwork automatically');
if(!gallery.includes('srcSet='))failures.push('gallery must use responsive image srcSet');
if(!gallery.includes("artworkPreview(item,expanded?1600:960)"))failures.push('gallery expansion must use derivative, not original');

const admin=await readFile(join(ROOT,'components/GitHubAdminDashboard.tsx'),'utf8');
if(admin.includes('makeThumbnail(')||admin.includes('uploadThumbnail='))failures.push('admin must not generate duplicate client-side thumbnails');
if(!admin.includes('className="admin-thumb"')||!admin.includes('loading="lazy" decoding="async"'))failures.push('admin list images must lazy-load');

const worker=await readFile(join(ROOT,'cloudflare/r2-media-worker/src/index.ts'),'utf8');
if(worker.includes('caches.default'))failures.push('worker must use Workers Caching, not Cache API on workers.dev');
if(!worker.includes("'Cloudflare-CDN-Cache-Control'"))failures.push('worker must emit Cloudflare CDN cache control');
if(!worker.includes("cacheMode: 'workers-caching'"))failures.push('worker health must expose Workers Caching mode');
if(!worker.includes('MAX_FALLBACK_RANGE'))failures.push('worker must retain bounded Range fallback');

const wrangler=JSON.parse((await readFile(join(ROOT,'cloudflare/r2-media-worker/wrangler.jsonc'),'utf8')).replace(/^\s*\/\/.*$/gm,''));
if(wrangler?.cache?.enabled!==true)failures.push('wrangler cache.enabled must be true');

const pkg=JSON.parse(await readFile(join(ROOT,'package.json'),'utf8'));
if(pkg.scripts?.prebuild!=='node scripts/assert-egress-safety.mjs')failures.push('prebuild must enforce egress safety');
if(String(pkg.scripts?.build||'')!=='next build')failures.push('build must not probe remote media');

if(failures.length){
  console.error(`Egress safety gate failed with ${failures.length} issue(s):`);
  for(const failure of failures)console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Egress safety gate passed: ${catalogue.items.length} artworks, ${publicItems.length} public, ${team.length} team members, Workers Caching enabled, zero Supabase runtime paths.`);
