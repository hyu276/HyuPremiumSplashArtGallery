import { readFile, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT=process.cwd();
const DIST=join(ROOT,'dist');
const SITE_URL=(process.env.SITE_URL||'https://hyupremium.vercel.app').replace(/\/$/,'');

const escHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const escXml=value=>String(value??'').replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
const safeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const normalizeSpace=value=>String(value??'').replace(/\s+/g,' ').trim();
const safeSegment=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'artwork';
const absoluteUrl=value=>{
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^https?:\/\//i.test(raw))return raw;
  return new URL(raw.replace(/^\.\//,''),`${SITE_URL}/`).href;
};
const artPath=item=>`/artwork/${safeSegment(item.id)}/`;
const artUrl=item=>`${SITE_URL}${artPath(item)}`;

async function readSupabaseConfig(){
  const source=await readFile(join(ROOT,'assets/js/supabase-config.js'),'utf8');
  const url=source.match(/url:\s*['"]([^'"]+)['"]/i)?.[1];
  const key=source.match(/publishableKey:\s*['"]([^'"]+)['"]/i)?.[1];
  if(!url||!key)throw new Error('Unable to read Supabase browser configuration for SEO build.');
  return {url,key};
}

async function fetchWithRetry(url,options={},attempts=3){
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response;
    }catch(error){
      lastError=error;
      if(attempt<attempts)await new Promise(resolve=>setTimeout(resolve,700*attempt));
    }
  }
  throw lastError;
}

async function loadArtworks(){
  const {url,key}=await readSupabaseConfig();
  const select='id,name,description,image,thumbnail,tags,hidden,updated_at,category:categories(name),rank:ranks(name,sort_order),credit:image_credits(name)';
  const endpoint=`${url}/rest/v1/artworks?select=${encodeURIComponent(select)}&hidden=eq.false`;
  const response=await fetchWithRetry(endpoint,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  const rows=await response.json();
  return rows.map(row=>({
    id:row.id,
    name:normalizeSpace(row.name)||'Untitled artwork',
    description:normalizeSpace(row.description),
    image:absoluteUrl(row.image),
    thumbnail:absoluteUrl(row.thumbnail)||absoluteUrl(row.image),
    tags:Array.isArray(row.tags)?row.tags.map(normalizeSpace).filter(Boolean):[],
    updated_at:row.updated_at||'',
    category:normalizeSpace(row.category?.name)||'Uncategorized',
    rank:normalizeSpace(row.rank?.name)||'Unranked',
    rank_order:Number(row.rank?.sort_order)||0,
    credit:normalizeSpace(row.credit?.name)||'Uncredited'
  })).sort((a,b)=>a.category.localeCompare(b.category,undefined,{sensitivity:'base'})||a.rank_order-b.rank_order||a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}));
}

function factualDescription(item){
  if(item.description)return item.description;
  return `${item.name} is a ${item.category} gaming splash artwork in the HYU PREMIUM archive. Skin rank: ${item.rank}. Image credit: ${item.credit}.`;
}

function imageAlt(item){
  return `${item.name} — ${item.category} gaming splash art, skin rank ${item.rank}`;
}

function commonMeta({title,description,url,image,type='website'}){
  const imageTags=image?`\n<meta property="og:image" content="${escHtml(image)}">\n<meta property="og:image:alt" content="${escHtml(title)}">\n<meta name="twitter:image" content="${escHtml(image)}">`:'';
  return `
<link rel="canonical" href="${escHtml(url)}">
<link rel="sitemap" type="application/xml" href="${SITE_URL}/sitemap.xml">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta property="og:site_name" content="HYU PREMIUM">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:url" content="${escHtml(url)}">${imageTags}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">`;
}

function replaceDescription(html,description){
  const tag=`<meta name="description" content="${escHtml(description)}" />`;
  if(/<meta\s+name=["']description["'][^>]*>/i.test(html))return html.replace(/<meta\s+name=["']description["'][^>]*>/i,tag);
  return html.replace('</head>',`${tag}\n</head>`);
}

function injectHead(html,markup){
  return html.replace('</head>',`${markup}\n</head>`);
}

function itemListJsonLd(artworks){
  return {
    '@context':'https://schema.org',
    '@type':'CollectionPage',
    name:'HYU PREMIUM Gaming Splash Art Archive',
    url:`${SITE_URL}/`,
    description:'A curated searchable archive of gaming splash art organized by character/category, skin rank and image credit.',
    mainEntity:{
      '@type':'ItemList',
      numberOfItems:artworks.length,
      itemListElement:artworks.map((item,index)=>({
        '@type':'ListItem',
        position:index+1,
        url:artUrl(item),
        name:item.name,
        image:item.image
      }))
    }
  };
}

function artworkJsonLd(item){
  const description=factualDescription(item);
  return {
    '@context':'https://schema.org',
    '@graph':[
      {
        '@type':'WebPage',
        '@id':`${artUrl(item)}#webpage`,
        url:artUrl(item),
        name:`${item.name} — ${item.category} | HYU PREMIUM`,
        description,
        isPartOf:{'@type':'WebSite','@id':`${SITE_URL}/#website`,url:`${SITE_URL}/`,name:'HYU PREMIUM'},
        primaryImageOfPage:{'@id':`${artUrl(item)}#image`},
        breadcrumb:{'@id':`${artUrl(item)}#breadcrumb`}
      },
      {
        '@type':'ImageObject',
        '@id':`${artUrl(item)}#image`,
        contentUrl:item.image,
        thumbnailUrl:item.thumbnail,
        name:item.name,
        caption:`${item.name} — ${item.category} splash art`,
        creditText:item.credit,
        representativeOfPage:true
      },
      {
        '@type':'CreativeWork',
        '@id':`${artUrl(item)}#artwork`,
        url:artUrl(item),
        name:item.name,
        description,
        image:{'@id':`${artUrl(item)}#image`},
        genre:'Gaming splash art',
        keywords:[item.category,item.rank,item.credit,...item.tags].filter(Boolean).join(', ')
      },
      {
        '@type':'BreadcrumbList',
        '@id':`${artUrl(item)}#breadcrumb`,
        itemListElement:[
          {'@type':'ListItem',position:1,name:'HYU PREMIUM',item:`${SITE_URL}/`},
          {'@type':'ListItem',position:2,name:'Artwork Index',item:`${SITE_URL}/artworks/`},
          {'@type':'ListItem',position:3,name:item.name,item:artUrl(item)}
        ]
      }
    ]
  };
}

function artworkPage(item,related){
  const description=factualDescription(item);
  const title=`${item.name} — ${item.category} Splash Art | HYU PREMIUM`;
  const tags=[item.category,item.rank,item.credit,...item.tags].filter(Boolean);
  const relatedHtml=related.length?`<section class="related"><h2>Related artwork</h2><div class="related-grid">${related.map(other=>`<a href="${artPath(other)}"><img src="${escHtml(other.thumbnail)}" alt="${escHtml(imageAlt(other))}" loading="lazy" decoding="async"><span>${escHtml(other.name)}</span></a>`).join('')}</div></section>`:'';
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#080908">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
${commonMeta({title,description,url:artUrl(item),image:item.image,type:'article'})}
<meta property="article:section" content="Gaming splash art">
<meta name="keywords" content="${escHtml(tags.join(', '))}">
<script type="application/ld+json">${safeJson(artworkJsonLd(item))}</script>
<style>
:root{--ink:#080908;--paper:#f1f1ea;--brand:#43dcff;--muted:#92968e;--line:rgba(241,241,234,.14)}*{box-sizing:border-box}html{background:var(--ink)}body{margin:0;background:var(--ink);color:var(--paper);font:14px/1.55 Arial,Helvetica,sans-serif}a{color:inherit;text-decoration:none}.top{min-height:68px;padding:0 4vw;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.brand{font-size:1.05rem;font-weight:900}.brand span{color:var(--brand)}.back{color:var(--brand);font-size:.65rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hero{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.7fr);min-height:calc(100vh - 68px)}figure{margin:0;background:#050606;display:grid;place-items:center;min-width:0}figure img{display:block;width:100%;height:100%;max-height:calc(100vh - 68px);object-fit:contain}article{padding:clamp(2rem,5vw,5rem);display:flex;flex-direction:column;justify-content:center;border-left:1px solid var(--line)}.eyebrow{color:var(--brand);font-size:.6rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.title{font-size:clamp(2.5rem,5.7vw,6rem);line-height:.86;letter-spacing:-.065em;text-transform:uppercase;margin:1rem 0 1.4rem}.description{color:#c5c9c2;max-width:620px}.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:2rem;border:1px solid var(--line)}.fact{padding:1rem;border-right:1px solid var(--line)}.fact:last-child{border-right:0}.fact b{display:block;color:var(--muted);font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.35rem}.fact span{font-weight:800}.related{padding:4rem 4vw;border-top:1px solid var(--line)}.related h2{font-size:2rem;text-transform:uppercase;letter-spacing:-.04em}.related-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px}.related-grid a{background:#111}.related-grid img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.related-grid span{display:block;padding:.8rem;font-weight:800;text-transform:uppercase}.footer{padding:2rem 4vw;border-top:1px solid var(--line);color:var(--muted);display:flex;justify-content:space-between;gap:1rem}.footer a:hover{color:var(--brand)}@media(max-width:800px){.hero{grid-template-columns:1fr}.hero figure{min-height:45vh}.hero figure img{max-height:60vh}.hero article{border-left:0;border-top:1px solid var(--line)}.facts{grid-template-columns:1fr}.fact{border-right:0;border-bottom:1px solid var(--line)}.fact:last-child{border-bottom:0}.related-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body>
<header class="top"><a class="brand" href="/">HYU <span>PREMIUM</span></a><a class="back" href="/artworks/">Artwork index →</a></header>
<main>
<section class="hero">
<figure><img src="${escHtml(item.image)}" alt="${escHtml(imageAlt(item))}" fetchpriority="high" decoding="async"></figure>
<article>
<div class="eyebrow">${escHtml(item.category)} · ${escHtml(item.rank)}</div>
<h1 class="title">${escHtml(item.name)}</h1>
<p class="description">${escHtml(description)}</p>
<div class="facts"><div class="fact"><b>Category</b><span>${escHtml(item.category)}</span></div><div class="fact"><b>Skin rank</b><span>${escHtml(item.rank)}</span></div><div class="fact"><b>Image credit</b><span>${escHtml(item.credit)}</span></div></div>
</article>
</section>
${relatedHtml}
</main>
<footer class="footer"><span>HYU PREMIUM / Digital art archive</span><a href="/">Return to Gallery →</a></footer>
</body>
</html>`;
}

function indexPage(artworks){
  const title='Gaming Splash Art Archive — Artwork Index | HYU PREMIUM';
  const description='Browse the HYU PREMIUM gaming splash art archive by character/category, skin rank and image credit.';
  const cards=artworks.map(item=>`<a class="card" href="${artPath(item)}"><img src="${escHtml(item.thumbnail)}" alt="${escHtml(imageAlt(item))}" loading="lazy" decoding="async"><div><b>${escHtml(item.name)}</b><span>${escHtml(item.category)} · ${escHtml(item.rank)} · ${escHtml(item.credit)}</span></div></a>`).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080908"><title>${escHtml(title)}</title><meta name="description" content="${escHtml(description)}">${commonMeta({title,description,url:`${SITE_URL}/artworks/`,image:artworks[0]?.image||''})}<script type="application/ld+json">${safeJson(itemListJsonLd(artworks))}</script><style>:root{--ink:#080908;--paper:#f1f1ea;--brand:#43dcff;--muted:#92968e;--line:rgba(241,241,234,.14)}*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--paper);font:14px/1.5 Arial,Helvetica,sans-serif}a{color:inherit;text-decoration:none}.top{padding:1.2rem 4vw;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:rgba(8,9,8,.96);backdrop-filter:blur(16px);z-index:2}.brand{font-weight:900}.brand span{color:var(--brand)}.hero{padding:5rem 4vw 3rem}.hero p{color:var(--brand);font-size:.6rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.hero h1{max-width:950px;margin:.8rem 0;font-size:clamp(3rem,8vw,8rem);line-height:.85;letter-spacing:-.07em;text-transform:uppercase}.hero div{color:var(--muted);max-width:650px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px}.card{background:#101210;min-width:0}.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.card div{padding:.8rem}.card b{display:block;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card span{display:block;color:var(--muted);font-size:.62rem;margin-top:.35rem}.footer{padding:2rem 4vw;border-top:1px solid var(--line);color:var(--muted)}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.hero{padding-top:3rem}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.card div{padding:.55rem}.card b{font-size:.72rem}.card span{font-size:.54rem}}</style></head><body><header class="top"><a class="brand" href="/">HYU <span>PREMIUM</span></a><a href="/">Gallery →</a></header><main><section class="hero"><p>${artworks.length} indexed artworks</p><h1>Artwork index.</h1><div>Every visible artwork has a stable crawlable page with image metadata, category, skin rank and image credit.</div></section><section class="grid">${cards}</section></main><footer class="footer">HYU PREMIUM / Searchable gaming splash art archive</footer></body></html>`;
}

function sitemapXml(artworks){
  const staticUrls=[
    {loc:`${SITE_URL}/`,priority:'1.0'},
    {loc:`${SITE_URL}/artworks/`,priority:'0.9'},
    {loc:`${SITE_URL}/about`,priority:'0.6'},
    {loc:`${SITE_URL}/news`,priority:'0.5'},
    {loc:`${SITE_URL}/blog`,priority:'0.5'}
  ];
  const staticEntries=staticUrls.map(x=>`<url><loc>${escXml(x.loc)}</loc><changefreq>weekly</changefreq><priority>${x.priority}</priority></url>`).join('');
  const artEntries=artworks.map(item=>`<url><loc>${escXml(artUrl(item))}</loc>${item.updated_at?`<lastmod>${escXml(new Date(item.updated_at).toISOString())}</lastmod>`:''}<changefreq>monthly</changefreq><priority>0.8</priority><image:image><image:loc>${escXml(item.image)}</image:loc><image:title>${escXml(item.name)}</image:title><image:caption>${escXml(`${item.name} — ${item.category} splash art. Skin rank ${item.rank}. Image credit ${item.credit}.`)}</image:caption></image:image></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${staticEntries}${artEntries}</urlset>`;
}

function imageSitemapXml(artworks){
  const entries=artworks.map(item=>`<url><loc>${escXml(artUrl(item))}</loc><image:image><image:loc>${escXml(item.image)}</image:loc><image:title>${escXml(item.name)}</image:title><image:caption>${escXml(`${item.name} — ${item.category} gaming splash art. Skin rank ${item.rank}. Image credit ${item.credit}.`)}</image:caption></image:image></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries}</urlset>`;
}

async function copyPublicFiles(){
  await rm(DIST,{recursive:true,force:true});
  await mkdir(DIST,{recursive:true});
  for(const file of ['index.html','about.html','news.html','blog.html'])await cp(join(ROOT,file),join(DIST,file));
  for(const dir of ['about','news','blog','data','assets'])await cp(join(ROOT,dir),join(DIST,dir),{recursive:true});
}

async function decoratePages(artworks){
  const homePath=join(DIST,'index.html');
  let home=await readFile(homePath,'utf8');
  const homeTitle='HYU PREMIUM — Gaming Splash Art Archive';
  const homeDescription='A curated searchable archive of gaming splash art organized by character/category, skin rank and image credit.';
  home=home.replace(/<title>[\s\S]*?<\/title>/i,`<title>${escHtml(homeTitle)}</title>`);
  home=replaceDescription(home,homeDescription);
  home=injectHead(home,`${commonMeta({title:homeTitle,description:homeDescription,url:`${SITE_URL}/`,image:artworks[0]?.image||''})}\n<script type="application/ld+json">${safeJson(itemListJsonLd(artworks))}</script>`);
  await writeFile(homePath,home);

  const pageConfig=[
    ['about.html','About HYU PREMIUM — Gaming Splash Art Archive',`${SITE_URL}/about`],
    ['news.html','News — HYU PREMIUM Gaming Splash Art Archive',`${SITE_URL}/news`],
    ['blog.html','Blog — HYU PREMIUM Gaming Splash Art Archive',`${SITE_URL}/blog`],
    ['about/index.html','About HYU PREMIUM — Gaming Splash Art Archive',`${SITE_URL}/about`],
    ['news/index.html','News — HYU PREMIUM Gaming Splash Art Archive',`${SITE_URL}/news`],
    ['blog/index.html','Blog — HYU PREMIUM Gaming Splash Art Archive',`${SITE_URL}/blog`]
  ];
  for(const [file,title,url] of pageConfig){
    const path=join(DIST,file);
    let html=await readFile(path,'utf8');
    const description=html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1]||'HYU PREMIUM gaming splash art archive.';
    html=injectHead(html,commonMeta({title,description,url,image:artworks[0]?.image||''}));
    await writeFile(path,html);
  }
}

async function generateArtworkPages(artworks){
  await mkdir(join(DIST,'artwork'),{recursive:true});
  await mkdir(join(DIST,'artworks'),{recursive:true});
  await writeFile(join(DIST,'artworks','index.html'),indexPage(artworks));
  for(const item of artworks){
    const related=artworks.filter(other=>other.id!==item.id&&other.category===item.category).slice(0,8);
    const dir=join(DIST,'artwork',safeSegment(item.id));
    await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'index.html'),artworkPage(item,related));
  }
}

async function main(){
  const artworks=await loadArtworks();
  if(!artworks.length)throw new Error('SEO build found no visible artworks; refusing to publish empty search pages.');
  await copyPublicFiles();
  await decoratePages(artworks);
  await generateArtworkPages(artworks);
  await writeFile(join(DIST,'sitemap.xml'),sitemapXml(artworks));
  await writeFile(join(DIST,'image-sitemap.xml'),imageSitemapXml(artworks));
  await writeFile(join(DIST,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: ${SITE_URL}/sitemap.xml\nSitemap: ${SITE_URL}/image-sitemap.xml\n`);
  console.log(`SEO build complete: ${artworks.length} artwork pages generated for ${SITE_URL}`);
}

main().catch(error=>{console.error(error);process.exit(1)});
