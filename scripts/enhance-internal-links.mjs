import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT=process.cwd();
const DIST=join(ROOT,'dist');
const SITE_URL=(process.env.SITE_URL||'https://hyupremium.vercel.app').replace(/\/$/,'');

const escHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const escXml=value=>String(value??'').replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
const safeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const safeSegment=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'character';
const decodeHtml=value=>String(value??'')
  .replace(/&quot;/g,'"')
  .replace(/&#039;/g,"'")
  .replace(/&apos;/g,"'")
  .replace(/&lt;/g,'<')
  .replace(/&gt;/g,'>')
  .replace(/&amp;/g,'&');

function matchText(html,pattern,fallback=''){
  const match=html.match(pattern);
  return decodeHtml(match?.[1]??fallback).replace(/\s+/g,' ').trim();
}

async function readGeneratedArtworks(){
  const artworkRoot=join(DIST,'artwork');
  const dirs=(await readdir(artworkRoot,{withFileTypes:true})).filter(entry=>entry.isDirectory());
  const items=[];
  for(const dir of dirs){
    const file=join(artworkRoot,dir.name,'index.html');
    const html=await readFile(file,'utf8');
    const eyebrow=matchText(html,/<div class="eyebrow">([\s\S]*?)<\/div>/i);
    const [categoryRaw='',rankRaw='']=eyebrow.split(/\s+·\s+/);
    const url=matchText(html,/<link rel="canonical" href="([^"]+)"/i,`${SITE_URL}/artwork/${dir.name}/`);
    const image=matchText(html,/<figure><img src="([^"]+)"/i);
    const thumbnail=matchText(html,/"thumbnailUrl":"([^"]+)"/i,image);
    const name=matchText(html,/<h1 class="title">([\s\S]*?)<\/h1>/i,dir.name);
    const description=matchText(html,/<p class="description">([\s\S]*?)<\/p>/i);
    const credit=matchText(html,/<b>Image credit<\/b><span>([\s\S]*?)<\/span>/i,'Uncredited');
    const category=categoryRaw||'Uncategorized';
    const rank=rankRaw||'Unranked';
    items.push({
      id:dir.name,
      file,
      url,
      path:new URL(url,SITE_URL).pathname,
      image,
      thumbnail:thumbnail||image,
      name,
      description,
      credit,
      category,
      rank
    });
  }
  return items.sort((a,b)=>a.category.localeCompare(b.category,undefined,{sensitivity:'base'})||a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}));
}

function makeCharacterGroups(artworks){
  const map=new Map();
  for(const item of artworks){
    if(!map.has(item.category))map.set(item.category,[]);
    map.get(item.category).push(item);
  }
  const groups=[...map.entries()].map(([name,items])=>({name,items})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
  const used=new Set();
  for(const group of groups){
    const base=safeSegment(group.name);
    let slug=base;
    let suffix=2;
    while(used.has(slug))slug=`${base}-${suffix++}`;
    used.add(slug);
    group.slug=slug;
    group.path=`/character/${slug}/`;
    group.url=`${SITE_URL}${group.path}`;
  }
  return groups;
}

function commonMeta({title,description,url,image=''}){
  const imageMeta=image?`<meta property="og:image" content="${escHtml(image)}"><meta property="og:image:alt" content="${escHtml(title)}"><meta name="twitter:image" content="${escHtml(image)}">`:'';
  return `<link rel="canonical" href="${escHtml(url)}"><link rel="sitemap" type="application/xml" href="${SITE_URL}/sitemap.xml"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><meta property="og:site_name" content="HYU PREMIUM"><meta property="og:type" content="website"><meta property="og:title" content="${escHtml(title)}"><meta property="og:description" content="${escHtml(description)}"><meta property="og:url" content="${escHtml(url)}">${imageMeta}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escHtml(title)}"><meta name="twitter:description" content="${escHtml(description)}">`;
}

function characterIndexJsonLd(groups){
  return {
    '@context':'https://schema.org',
    '@type':'CollectionPage',
    name:'HYU PREMIUM Character Splash Art Index',
    url:`${SITE_URL}/characters/`,
    description:'Browse gaming splash artwork by character or category in the HYU PREMIUM archive.',
    mainEntity:{
      '@type':'ItemList',
      numberOfItems:groups.length,
      itemListElement:groups.map((group,index)=>({
        '@type':'ListItem',
        position:index+1,
        url:group.url,
        name:group.name
      }))
    }
  };
}

function characterJsonLd(group){
  return {
    '@context':'https://schema.org',
    '@graph':[
      {
        '@type':'CollectionPage',
        '@id':`${group.url}#webpage`,
        url:group.url,
        name:`${group.name} Splash Art Archive`,
        description:`Browse ${group.items.length} ${group.name} gaming splash artworks in the HYU PREMIUM archive.`,
        primaryImageOfPage:group.items[0]?.image?{'@type':'ImageObject','contentUrl':group.items[0].image}:undefined,
        mainEntity:{
          '@type':'ItemList',
          numberOfItems:group.items.length,
          itemListElement:group.items.map((item,index)=>({
            '@type':'ListItem',
            position:index+1,
            url:item.url,
            name:item.name,
            image:item.image
          }))
        },
        breadcrumb:{'@id':`${group.url}#breadcrumb`}
      },
      {
        '@type':'BreadcrumbList',
        '@id':`${group.url}#breadcrumb`,
        itemListElement:[
          {'@type':'ListItem',position:1,name:'HYU PREMIUM',item:`${SITE_URL}/`},
          {'@type':'ListItem',position:2,name:'Characters',item:`${SITE_URL}/characters/`},
          {'@type':'ListItem',position:3,name:group.name,item:group.url}
        ]
      }
    ]
  };
}

const PAGE_STYLE=`:root{--ink:#080908;--paper:#f1f1ea;--brand:#43dcff;--muted:#92968e;--line:rgba(241,241,234,.14);--panel:#111311}*{box-sizing:border-box}html{background:var(--ink)}body{margin:0;background:var(--ink);color:var(--paper);font:14px/1.5 Arial,Helvetica,sans-serif}a{color:inherit;text-decoration:none}.top{min-height:68px;padding:0 4vw;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:1rem;position:sticky;top:0;background:rgba(8,9,8,.96);backdrop-filter:blur(16px);z-index:5}.brand{font-weight:900}.brand span{color:var(--brand)}.nav{display:flex;gap:1rem;color:var(--brand);font-size:.62rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.hero{padding:5rem 4vw 3rem;border-bottom:1px solid var(--line)}.kicker{color:var(--brand);font-size:.6rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.hero h1{max-width:1000px;margin:.8rem 0;font-size:clamp(3rem,8vw,8rem);line-height:.85;letter-spacing:-.07em;text-transform:uppercase}.hero p{max-width:720px;color:var(--muted);font-size:1rem}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px}.card{background:var(--panel);min-width:0}.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.card-copy{padding:.8rem}.card b{display:block;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card span{display:block;color:var(--muted);font-size:.62rem;margin-top:.35rem}.character-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;padding:1px;background:var(--line)}.character-card{min-height:150px;padding:1.4rem;background:var(--ink);display:flex;flex-direction:column;justify-content:space-between}.character-card strong{font-size:1.25rem;text-transform:uppercase}.character-card span{color:var(--muted);font-size:.65rem}.footer{padding:2rem 4vw;border-top:1px solid var(--line);color:var(--muted);display:flex;justify-content:space-between;gap:1rem}@media(max-width:900px){.grid,.character-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.hero{padding-top:3rem}.grid,.character-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.card-copy{padding:.55rem}.card b{font-size:.72rem}.card span{font-size:.54rem}.character-card{min-height:110px;padding:1rem}.character-card strong{font-size:.9rem}.nav{gap:.55rem;font-size:.52rem}}`;

function characterIndexPage(groups,artworks){
  const title='Character Splash Art Index | HYU PREMIUM';
  const description='Browse gaming splash artwork by character or category in the HYU PREMIUM archive.';
  const cards=groups.map(group=>`<a class="character-card" href="${group.path}"><strong>${escHtml(group.name)}</strong><span>${group.items.length} artwork${group.items.length===1?'':'s'} →</span></a>`).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080908"><title>${escHtml(title)}</title><meta name="description" content="${escHtml(description)}">${commonMeta({title,description,url:`${SITE_URL}/characters/`,image:artworks[0]?.image||''})}<script type="application/ld+json">${safeJson(characterIndexJsonLd(groups))}</script><style>${PAGE_STYLE}</style></head><body><header class="top"><a class="brand" href="/">HYU <span>PREMIUM</span></a><nav class="nav"><a href="/artworks/">Artworks</a><a href="/">Gallery</a></nav></header><main><section class="hero"><div class="kicker">${groups.length} crawlable character pages</div><h1>Characters.</h1><p>Each character or category has a permanent landing page that links directly to every related artwork.</p></section><section class="character-grid">${cards}</section></main><footer class="footer"><span>HYU PREMIUM / Character index</span><a href="/artworks/">Browse all artworks →</a></footer></body></html>`;
}

function characterPage(group){
  const title=`${group.name} Splash Art Archive | HYU PREMIUM`;
  const description=`Browse ${group.items.length} ${group.name} gaming splash artworks with skin rank and image credit in the HYU PREMIUM archive.`;
  const cards=group.items.map(item=>`<a class="card" href="${item.path}"><img src="${escHtml(item.thumbnail||item.image)}" alt="${escHtml(`${item.name} — ${group.name} gaming splash art`)}" loading="lazy" decoding="async"><div class="card-copy"><b>${escHtml(item.name)}</b><span>${escHtml(item.rank)} · ${escHtml(item.credit)}</span></div></a>`).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080908"><title>${escHtml(title)}</title><meta name="description" content="${escHtml(description)}">${commonMeta({title,description,url:group.url,image:group.items[0]?.image||''})}<script type="application/ld+json">${safeJson(characterJsonLd(group))}</script><style>${PAGE_STYLE}</style></head><body><header class="top"><a class="brand" href="/">HYU <span>PREMIUM</span></a><nav class="nav"><a href="/characters/">Characters</a><a href="/artworks/">Artworks</a></nav></header><main><section class="hero"><div class="kicker">Character / category · ${group.items.length} artwork${group.items.length===1?'':'s'}</div><h1>${escHtml(group.name)}</h1><p>${escHtml(description)}</p></section><section class="grid">${cards}</section></main><footer class="footer"><span>HYU PREMIUM / ${escHtml(group.name)}</span><a href="/characters/">All characters →</a></footer></body></html>`;
}

async function generateCharacterPages(groups,artworks){
  await mkdir(join(DIST,'characters'),{recursive:true});
  await mkdir(join(DIST,'character'),{recursive:true});
  await writeFile(join(DIST,'characters','index.html'),characterIndexPage(groups,artworks));
  for(const group of groups){
    const dir=join(DIST,'character',group.slug);
    await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'index.html'),characterPage(group));
  }
}

async function enhanceHome(artworks,groups){
  const path=join(DIST,'index.html');
  let html=await readFile(path,'utf8');
  const persistentLinks=artworks.map(item=>`<a href="${item.path}">${escHtml(item.category)} — ${escHtml(item.name)}</a>`).join('');
  const hub=`<section class="seo-crawl-hub" aria-labelledby="seoCrawlHubTitle"><div class="seo-crawl-head"><div><span>Search index</span><h2 id="seoCrawlHubTitle">Crawlable artwork directory</h2></div><nav><a href="/characters/">Characters →</a><a href="/artworks/">All artworks →</a></nav></div><details><summary>Browse ${artworks.length} permanent artwork pages</summary><div class="seo-crawl-grid">${persistentLinks}</div></details></section>`;
  const css=`.seo-crawl-hub{border-top:1px solid var(--line);padding:2rem 3vw 2.5rem;background:var(--ink)}.seo-crawl-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1rem}.seo-crawl-head span{color:var(--brand);font-size:.52rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.seo-crawl-head h2{margin:.3rem 0 0;font-size:clamp(1.4rem,2.5vw,2.5rem);letter-spacing:-.04em;text-transform:uppercase}.seo-crawl-head nav{display:flex;gap:1rem;color:var(--brand);font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.seo-crawl-hub details{border-top:1px solid var(--line)}.seo-crawl-hub summary{cursor:pointer;padding:1rem 0;color:var(--muted);font-size:.62rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.seo-crawl-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line)}.seo-crawl-grid a{background:var(--ink);padding:.7rem .8rem;font-size:.62rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.seo-crawl-grid a:hover{color:var(--brand)}@media(max-width:900px){.seo-crawl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.seo-crawl-head{align-items:start;flex-direction:column}.seo-crawl-grid{grid-template-columns:1fr 1fr}.seo-crawl-grid a{font-size:.55rem;padding:.6rem}}`;
  if(!html.includes('seo-crawl-hub')){
    html=html.replace('</style>',`${css}</style>`);
    const galleryPattern=/(<div class="gallery-grid" id="gallery" aria-live="polite"><\/div>)/i;
    if(!galleryPattern.test(html))throw new Error('Could not find homepage gallery mount for static crawl hub.');
    html=html.replace(galleryPattern,`$1${hub}`);
    html=html.replace('<nav aria-label="Main navigation">','<nav aria-label="Main navigation"><a href="/characters/">Characters</a>');
    html=html.replace('<div class="footer-links">','<div class="footer-links"><a href="/characters/">Characters</a><a href="/artworks/">Artwork Index</a>');
  }
  await writeFile(path,html);
}

async function enhanceArtworkIndex(groups){
  const path=join(DIST,'artworks','index.html');
  let html=await readFile(path,'utf8');
  const characterCards=groups.map(group=>`<a href="${group.path}"><b>${escHtml(group.name)}</b><span>${group.items.length} artwork${group.items.length===1?'':'s'}</span></a>`).join('');
  const section=`<section class="character-hubs"><div class="character-hubs-head"><div><span>Internal index</span><h2>Browse by character</h2></div><a href="/characters/">Full character index →</a></div><div class="character-hubs-grid">${characterCards}</div></section>`;
  const css=`.character-hubs{padding:2rem 4vw 3rem;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.character-hubs-head{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1rem}.character-hubs-head span{color:var(--brand);font-size:.52rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.character-hubs-head h2{margin:.3rem 0 0;font-size:2rem;text-transform:uppercase;letter-spacing:-.04em}.character-hubs-head>a{color:var(--brand);font-size:.58rem;font-weight:900;text-transform:uppercase}.character-hubs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line)}.character-hubs-grid a{background:var(--ink);padding:.8rem;min-width:0}.character-hubs-grid b{display:block;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.character-hubs-grid span{display:block;color:var(--muted);font-size:.58rem;margin-top:.25rem}@media(max-width:900px){.character-hubs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  if(!html.includes('character-hubs')){
    html=html.replace('</style>',`${css}</style>`);
    html=html.replace('</section><section class="grid">',`</section>${section}<section class="grid">`);
    html=html.replace('<a href="/">Gallery →</a>','<nav style="display:flex;gap:1rem"><a href="/characters/">Characters →</a><a href="/">Gallery →</a></nav>');
  }
  await writeFile(path,html);
}

function updateArtworkBreadcrumb(html,item,group){
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,(full,raw)=>{
    try{
      const data=JSON.parse(raw);
      const graph=Array.isArray(data?.['@graph'])?data['@graph']:[];
      const breadcrumb=graph.find(node=>node?.['@type']==='BreadcrumbList');
      if(breadcrumb){
        breadcrumb.itemListElement=[
          {'@type':'ListItem',position:1,name:'HYU PREMIUM',item:`${SITE_URL}/`},
          {'@type':'ListItem',position:2,name:'Characters',item:`${SITE_URL}/characters/`},
          {'@type':'ListItem',position:3,name:group.name,item:group.url},
          {'@type':'ListItem',position:4,name:item.name,item:item.url}
        ];
      }
      return `<script type="application/ld+json">${safeJson(data)}</script>`;
    }catch{
      return full;
    }
  });
}

async function enhanceArtworkPages(artworks,groups){
  const groupByCategory=new Map(groups.map(group=>[group.name,group]));
  for(const item of artworks){
    const group=groupByCategory.get(item.category);
    if(!group)continue;
    let html=await readFile(item.file,'utf8');
    const categoryFact=/<div class="fact"><b>Category<\/b><span>[\s\S]*?<\/span><\/div>/i;
    html=html.replace(categoryFact,`<div class="fact"><b>Category</b><span><a href="${group.path}">${escHtml(group.name)}</a></span></div>`);
    html=html.replace('<a class="back" href="/artworks/">Artwork index →</a>',`<nav class="seo-art-nav"><a class="back" href="${group.path}">${escHtml(group.name)} →</a><a class="back" href="/artworks/">Artwork index →</a></nav>`);
    html=html.replace('</style>',`.seo-art-nav{display:flex;gap:1rem;align-items:center}.fact a{color:var(--brand)}@media(max-width:520px){.seo-art-nav{gap:.55rem}.seo-art-nav .back{font-size:.5rem}}</style>`);
    html=html.replace('<footer class="footer"><span>HYU PREMIUM / Digital art archive</span>','<footer class="footer"><span>HYU PREMIUM / Digital art archive · <a href="/characters/">Character index</a></span>');
    html=updateArtworkBreadcrumb(html,item,group);
    await writeFile(item.file,html);
  }
}

async function enhanceSitemaps(groups){
  const sitemapPath=join(DIST,'sitemap.xml');
  let sitemap=await readFile(sitemapPath,'utf8');
  const characterEntries=[`<url><loc>${escXml(`${SITE_URL}/characters/`)}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`,...groups.map(group=>`<url><loc>${escXml(group.url)}</loc><changefreq>weekly</changefreq><priority>0.85</priority></url>`)].join('');
  sitemap=sitemap.replace('</urlset>',`${characterEntries}</urlset>`);
  await writeFile(sitemapPath,sitemap);

  const imageSitemapPath=join(DIST,'image-sitemap.xml');
  let imageSitemap=await readFile(imageSitemapPath,'utf8');
  const characterImageEntries=groups.map(group=>`<url><loc>${escXml(group.url)}</loc>${group.items.map(item=>`<image:image><image:loc>${escXml(item.image)}</image:loc><image:title>${escXml(`${group.name} — ${item.name}`)}</image:title><image:caption>${escXml(`${item.name} — ${group.name} gaming splash art. Skin rank ${item.rank}. Image credit ${item.credit}.`)}</image:caption></image:image>`).join('')}</url>`).join('');
  imageSitemap=imageSitemap.replace('</urlset>',`${characterImageEntries}</urlset>`);
  await writeFile(imageSitemapPath,imageSitemap);
}

async function main(){
  const artworks=await readGeneratedArtworks();
  if(!artworks.length)throw new Error('No generated artwork pages were found for internal-link enhancement.');
  const groups=makeCharacterGroups(artworks);
  await generateCharacterPages(groups,artworks);
  await enhanceHome(artworks,groups);
  await enhanceArtworkIndex(groups);
  await enhanceArtworkPages(artworks,groups);
  await enhanceSitemaps(groups);
  console.log(`Internal-link enhancement complete: ${artworks.length} artworks across ${groups.length} character pages.`);
}

main().catch(error=>{console.error(error);process.exit(1)});
