import { readFile, readdir, stat } from 'node:fs/promises';
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
function percentile(values,p){if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];}
function average(values){return values.length?Math.round(values.reduce((sum,n)=>sum+n,0)/values.length):0;}
function stringList(value){return Array.isArray(value)?value.map(String):[];}

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
if(!String(catalogue.generatedAt||''))failures.push('data/backend/catalogue.json: generatedAt revision missing');
if(!Array.isArray(catalogue.items)||!catalogue.items.length)failures.push('data/backend/catalogue.json: items missing');
const publicItems=(catalogue.items||[]).filter(item=>!item.hidden);
const taxonomy={categories:stringList(catalogue.categories),credits:stringList(catalogue.credits),ranks:stringList(catalogue.ranks)};
for(const [kind,values] of Object.entries(taxonomy)){
  if(values.length!==new Set(values).size)failures.push(`catalogue ${kind} contains duplicate values`);
  const ownerValues=stringList(catalogue.ownerOptions?.[kind]);
  if(JSON.stringify(values)!==JSON.stringify(ownerValues))failures.push(`catalogue ${kind} must exactly match ownerOptions.${kind}`);
}
for(const item of catalogue.items||[]){
  const id=String(item.id||'<unknown>');
  if(item.category&&!taxonomy.categories.includes(String(item.category)))failures.push(`${id}: category references missing taxonomy value ${item.category}`);
  if(item.credit&&!taxonomy.credits.includes(String(item.credit)))failures.push(`${id}: credit references missing taxonomy value ${item.credit}`);
  if(item.rank&&!taxonomy.ranks.includes(String(item.rank)))failures.push(`${id}: rank references missing taxonomy value ${item.rank}`);
}

const derivativeBytes={'640':[],'960':[],'1600':[]};
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
    if(variant?.mimeType!=='image/webp')failures.push(`${id}: ${width}px derivative must be image/webp`);
  }
  const limits={640:220*1024,960:360*1024,1600:650*1024};
  for(const [width,limit] of Object.entries(limits)){
    const bytes=Number(variants[width]?.bytes||0);
    if(!bytes)failures.push(`${id}: ${width}px derivative missing byte metadata`);
    else {
      derivativeBytes[width].push(bytes);
      if(bytes>limit)failures.push(`${id}: ${width}px derivative ${bytes} bytes exceeds ${limit}`);
    }
  }
}
if(publicItems.some(item=>!item.thumbnail))failures.push('public catalogue contains artwork without thumbnail');

const aggregateBudgets={
  '640':{avg:150*1024,p95:210*1024},
  '960':{avg:250*1024,p95:340*1024},
  '1600':{avg:450*1024,p95:620*1024}
};
for(const [width,budget] of Object.entries(aggregateBudgets)){
  const values=derivativeBytes[width];const avg=average(values),p95=percentile(values,0.95);
  if(avg>budget.avg)failures.push(`${width}px derivative average ${avg} exceeds aggregate budget ${budget.avg}`);
  if(p95>budget.p95)failures.push(`${width}px derivative p95 ${p95} exceeds aggregate budget ${budget.p95}`);
}

const team=JSON.parse(await readFile(join(ROOT,'data/backend/team.json'),'utf8'));
for(const member of team){
  const id=`team:${member.id||member.name||'<unknown>'}`;
  if(String(member.image||'').toLowerCase().includes('supabase'))failures.push(`${id}: original references Supabase`);
  const limits={320:120*1024,640:220*1024};
  for(const [width,limit] of Object.entries(limits)){
    const v=member?.variants?.[width];
    if(!v?.url)failures.push(`${id}: missing ${width}px derivative`);
    else if(String(v.url).toLowerCase().includes('supabase'))failures.push(`${id}: ${width}px derivative references Supabase`);
    if(v?.mimeType!=='image/webp')failures.push(`${id}: ${width}px derivative must be image/webp`);
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
if(!gallery.includes("const src=expanded?(item.media?.original?.url||item.image):artworkPreview(item,960)"))failures.push('expanded artwork must load the exact uploaded original');
if(!gallery.includes("const srcSet=expanded?'':artworkSrcSet(item)"))failures.push('expanded artwork must disable derivative srcSet so browsers cannot down-select it');

const imageSitemap=await readFile(join(ROOT,'app/image-sitemap.xml/route.ts'),'utf8');
if(!imageSitemap.includes('image=artworkPreview(item,1600)'))failures.push('image sitemap must publish the 1600px derivative');
if(imageSitemap.includes('override?.og_image||item.image')||imageSitemap.includes('image=item.image'))failures.push('image sitemap must not publish artwork originals');

const characterPage=await readFile(join(ROOT,'app/character/[[...segments]]/page.tsx'),'utf8');
if(characterPage.includes('contentUrl:artwork.image'))failures.push('artwork JSON-LD must not advertise original media to crawlers');
if(!characterPage.includes("contentUrl:crawlerImage?.url||artworkPreview(artwork,1600)"))failures.push('artwork JSON-LD must publish the 1600px derivative');
if(!characterPage.includes('<CatalogueFreshnessGuard revision={catalogue.revision}/>'))failures.push('gallery page must mount the catalogue revision freshness guard');

const freshnessGuard=await readFile(join(ROOT,'components/CatalogueFreshnessGuard.tsx'),'utf8');
if(!freshnessGuard.includes("fetch('/api/catalogue-revision'"))failures.push('catalogue freshness guard must use the fixed revision endpoint');
if(freshnessGuard.includes('/api/catalogue-revision?'))failures.push('catalogue freshness guard must not cache-bust the revision endpoint');
if(!freshnessGuard.includes('router.refresh()'))failures.push('catalogue freshness guard must refresh only when the deployed revision changes');
if(!freshnessGuard.includes("window.addEventListener('focus'"))failures.push('catalogue freshness guard must check again when a stale tab regains focus');
if(freshnessGuard.includes('setInterval('))failures.push('catalogue freshness guard must not continuously poll');

const revisionRoute=await readFile(join(ROOT,'app/api/catalogue-revision/route.ts'),'utf8');
if(!revisionRoute.includes('s-maxage=15'))failures.push('catalogue revision endpoint must use short CDN caching');
if(/publicMediaUrl|MEDIA_BASE_URL|artworkPreview|\.image\b/.test(revisionRoute))failures.push('catalogue revision endpoint must remain metadata-only and never expose/fetch media');

const adminBackend=await readFile(join(ROOT,'app/api/admin-backend/route.ts'),'utf8');
if(!adminBackend.includes("const categories=preferredCategories;"))failures.push('admin backend must keep taxonomy authoritative instead of rebuilding deleted choices from items');
if(!adminBackend.includes('invalidCredits')||!adminBackend.includes('invalidRanks')||!adminBackend.includes('invalidCategories'))failures.push('admin backend must reject dangling taxonomy references before publish');
if(adminBackend.includes("unique([...preferredCredits"))failures.push('admin backend must not resurrect deleted credits from item values');

const admin=await readFile(join(ROOT,'components/GitHubAdminDashboard.tsx'),'utf8');
if(admin.includes('makeThumbnail(')||admin.includes('uploadThumbnail='))failures.push('admin must not generate duplicate client-side thumbnails');
if(!admin.includes('className="admin-thumb"')||!admin.includes('loading="lazy" decoding="async"'))failures.push('admin list images must lazy-load');
if(!admin.includes('queueUnusedArtworkMedia'))failures.push('admin must garbage collect artwork originals/thumbnails/derivatives');
if(!admin.includes('deleteUnusedTeamMedia'))failures.push('admin must garbage collect team originals/derivatives');
if(!admin.includes('variants:imageChanged?undefined:old?.variants'))failures.push('metadata-only artwork edits must preserve derivatives and avoid reprocessing originals');

const layout=await readFile(join(ROOT,'app/layout.tsx'),'utf8');
const chrome=await readFile(join(ROOT,'components/SiteChrome.tsx'),'utf8');
const iconPath=join(ROOT,'app/icon.svg');
const iconText=await readFile(iconPath,'utf8');
const iconBytes=(await stat(iconPath)).size;
if(!layout.includes("url:'/icon.svg'"))failures.push('root metadata must point favicon to /icon.svg');
if(layout.includes('/assets/brand/hyu-industries-logo.png'))failures.push('root metadata must not point to non-public /assets brand files');
if(!chrome.includes('src="/icon.svg"'))failures.push('site header must use the cache-safe /icon.svg brand mark');
if(chrome.includes('/assets/brand/hyu-industries-logo.png'))failures.push('site header must not request the non-public legacy PNG');
if(!iconText.includes('<svg')||!iconText.includes('viewBox="0 0 64 64"'))failures.push('app/icon.svg must be a valid compact SVG mark');
if(iconBytes>4096)failures.push(`app/icon.svg ${iconBytes} bytes exceeds 4KB icon budget`);
const vercel=JSON.parse(await readFile(join(ROOT,'vercel.json'),'utf8'));
const iconHeader=(vercel.headers||[]).find(x=>x.source==='/icon.svg');
const iconCache=iconHeader?.headers?.find(x=>x.key==='Cache-Control')?.value||'';
if(!iconCache.includes('max-age=31536000')||!iconCache.includes('immutable'))failures.push('icon.svg must use a one-year immutable browser cache');
const faviconRedirect=(vercel.redirects||[]).find(x=>x.source==='/favicon.ico');
if(faviconRedirect?.destination!=='/icon.svg'||faviconRedirect?.permanent!==true)failures.push('/favicon.ico must permanently redirect to the tiny cache-safe /icon.svg');

const worker=await readFile(join(ROOT,'cloudflare/r2-media-worker/src/index.ts'),'utf8');
if(worker.includes('caches.default'))failures.push('worker must use Workers Caching, not Cache API on workers.dev');
if(!worker.includes("'Cloudflare-CDN-Cache-Control'"))failures.push('worker must emit Cloudflare CDN cache control');
if(!worker.includes("cacheMode: 'workers-caching'"))failures.push('worker health must expose Workers Caching mode');
if(!worker.includes('MAX_FALLBACK_RANGE'))failures.push('worker must retain bounded Range fallback');

const wrangler=JSON.parse((await readFile(join(ROOT,'cloudflare/r2-media-worker/wrangler.jsonc'),'utf8')).replace(/^\s*\/\/.*$/gm,''));
if(wrangler?.cache?.enabled!==true)failures.push('wrangler cache.enabled must be true');

const adminHtml=await readFile(join(ROOT,'admin.html'),'utf8');
if(adminHtml.includes('hyupremium.vercel.app/admin'))failures.push('GitHub Pages admin must not redirect to Vercel /admin');
if(!adminHtml.includes('admin-github.bundle.js'))failures.push('GitHub Pages admin must load the static dashboard bundle');
try{await readFile(join(ROOT,'app/admin/page.tsx'),'utf8');failures.push('Vercel /admin page route must not exist')}catch{}
const adminDashboard=await readFile(join(ROOT,'components/GitHubAdminDashboard.tsx'),'utf8');
if(!adminDashboard.includes("window.location.hostname==='hyu276.github.io'?'https://hyupremium.vercel.app/api/admin-backend':'/api/admin-backend'"))failures.push('GitHub Pages admin must use the Vercel API backend only as a cross-origin API');
const adminApi=await readFile(join(ROOT,'app/api/admin-backend/route.ts'),'utf8');
if(!adminApi.includes("const ADMIN_ORIGIN='https://hyu276.github.io'"))failures.push('admin API CORS must be restricted to the GitHub Pages origin');
if(!adminApi.includes('export async function OPTIONS'))failures.push('admin API must support CORS preflight for GitHub Pages');

const pkg=JSON.parse(await readFile(join(ROOT,'package.json'),'utf8'));
if(pkg.scripts?.prebuild!=='node scripts/assert-egress-safety.mjs')failures.push('prebuild must enforce egress safety');
if(String(pkg.scripts?.build||'')!=='next build')failures.push('build must not probe remote media');

if(failures.length){
  console.error(`Egress safety gate failed with ${failures.length} issue(s):`);
  for(const failure of failures)console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Egress safety gate passed: ${catalogue.items.length} artworks, ${publicItems.length} public, ${team.length} team members; taxonomy is referentially consistent; stale gallery tabs use a tiny CDN-cached revision check; expanded artwork uses exact uploaded originals; SEO/listing traffic still uses derivatives; icon is ${iconBytes} bytes with immutable cache.`);
