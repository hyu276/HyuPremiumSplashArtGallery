import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');
const MAIN_PATH = '/character/';
const MAIN_URL = `${SITE_URL}${MAIN_PATH}`;

const escHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const escXml = value => String(value ?? '').replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
const safeJson = value => JSON.stringify(value).replace(/</g, '\u003c');
const safeSegment = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
const decodeHtml = value => String(value ?? '')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

function matchText(html, pattern, fallback = '') {
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? fallback).replace(/\s+/g, ' ').trim();
}

async function readGeneratedArtworks() {
  const artworkRoot = join(DIST, 'artwork');
  const dirs = (await readdir(artworkRoot, { withFileTypes: true })).filter(entry => entry.isDirectory());
  const items = [];
  for (const dir of dirs) {
    const file = join(artworkRoot, dir.name, 'index.html');
    const html = await readFile(file, 'utf8');
    const eyebrow = matchText(html, /<div class="eyebrow">([\s\S]*?)<\/div>/i);
    const [categoryRaw = '', rankRaw = ''] = eyebrow.split(/\s+·\s+/);
    const image = matchText(html, /<figure><img src="([^"]+)"/i);
    const thumbnail = matchText(html, /"thumbnailUrl":"([^"]+)"/i, image);
    const name = matchText(html, /<h1 class="title">([\s\S]*?)<\/h1>/i, dir.name);
    const description = matchText(html, /<p class="description">([\s\S]*?)<\/p>/i);
    const credit = matchText(html, /<b>Image credit<\/b><span>([\s\S]*?)<\/span>/i, 'Uncredited');
    const category = categoryRaw || 'Uncategorized';
    const rank = rankRaw || 'Unranked';
    const oldPath = `/artwork/${dir.name}/`;
    items.push({
      id: dir.name,
      file,
      sourceHtml: html,
      oldPath,
      oldUrl: `${SITE_URL}${oldPath}`,
      image,
      thumbnail: thumbnail || image,
      name,
      description,
      credit,
      category,
      rank,
      lastmod: ''
    });
  }
  return items.sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

function makeCharacterGroups(artworks) {
  const grouped = new Map();
  for (const item of artworks) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category).push(item);
  }

  const groups = [...grouped.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const used = new Set();
  for (const group of groups) {
    const base = safeSegment(group.name);
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    used.add(slug);
    group.slug = slug;
    group.path = `/character/${slug}/`;
    group.url = `${SITE_URL}${group.path}`;
    for (const item of group.items) {
      item.group = group;
      item.path = `${group.path}${safeSegment(item.id)}/`;
      item.url = `${SITE_URL}${item.path}`;
    }
  }
  return groups;
}

async function applyExistingLastmods(artworks) {
  let sitemap = '';
  try {
    sitemap = await readFile(join(DIST, 'sitemap.xml'), 'utf8');
  } catch {
    return;
  }
  for (const item of artworks) {
    const marker = `<loc>${escXml(item.oldUrl)}</loc>`;
    const markerIndex = sitemap.indexOf(marker);
    if (markerIndex < 0) continue;
    const blockStart = sitemap.lastIndexOf('<url>', markerIndex);
    const blockEnd = sitemap.indexOf('</url>', markerIndex);
    if (blockStart < 0 || blockEnd < 0) continue;
    const block = sitemap.slice(blockStart, blockEnd + 6);
    item.lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || '';
  }
}

function commonMeta({ title, description, url, image = '' }) {
  const imageMeta = image ? `<meta property="og:image" content="${escHtml(image)}"><meta property="og:image:alt" content="${escHtml(title)}"><meta name="twitter:image" content="${escHtml(image)}">` : '';
  return `<link rel="canonical" href="${escHtml(url)}"><link rel="sitemap" type="application/xml" href="${SITE_URL}/sitemap.xml"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"><meta property="og:site_name" content="HYU PREMIUM"><meta property="og:type" content="website"><meta property="og:title" content="${escHtml(title)}"><meta property="og:description" content="${escHtml(description)}"><meta property="og:url" content="${escHtml(url)}">${imageMeta}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escHtml(title)}"><meta name="twitter:description" content="${escHtml(description)}">`;
}

function characterJsonLd(group) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${group.url}#webpage`,
        url: group.url,
        name: `${group.name} Splash Art Archive`,
        description: `Browse ${group.items.length} ${group.name} gaming splash artworks in the HYU PREMIUM archive.`,
        primaryImageOfPage: group.items[0]?.image ? { '@type': 'ImageObject', contentUrl: group.items[0].image } : undefined,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: group.items.length,
          itemListElement: group.items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: item.url,
            name: item.name,
            image: item.image
          }))
        },
        breadcrumb: { '@id': `${group.url}#breadcrumb` }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${group.url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Character', item: MAIN_URL },
          { '@type': 'ListItem', position: 2, name: group.name, item: group.url }
        ]
      }
    ]
  };
}

const PAGE_STYLE = `:root{--ink:#080908;--paper:#f1f1ea;--brand:#43dcff;--muted:#92968e;--line:rgba(241,241,234,.14);--panel:#111311}*{box-sizing:border-box}html{background:var(--ink)}body{margin:0;background:var(--ink);color:var(--paper);font:14px/1.5 Arial,Helvetica,sans-serif}a{color:inherit;text-decoration:none}.top{min-height:68px;padding:0 4vw;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:1rem;position:sticky;top:0;background:rgba(8,9,8,.96);backdrop-filter:blur(16px);z-index:5}.brand{font-weight:900}.brand span{color:var(--brand)}.nav{display:flex;gap:1rem;color:var(--brand);font-size:.62rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.hero{padding:5rem 4vw 3rem;border-bottom:1px solid var(--line)}.kicker{color:var(--brand);font-size:.6rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.hero h1{max-width:1000px;margin:.8rem 0;font-size:clamp(3rem,8vw,8rem);line-height:.85;letter-spacing:-.07em;text-transform:uppercase}.hero p{max-width:720px;color:var(--muted);font-size:1rem}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px}.card{background:var(--panel);min-width:0;display:block}.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.card-copy{padding:.8rem}.card b{display:block;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card span{display:block;color:var(--muted);font-size:.62rem;margin-top:.35rem}.footer{padding:2rem 4vw;border-top:1px solid var(--line);color:var(--muted);display:flex;justify-content:space-between;gap:1rem}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.hero{padding-top:3rem}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.card-copy{padding:.55rem}.card b{font-size:.72rem}.card span{font-size:.54rem}.nav{gap:.55rem;font-size:.52rem}}`;

function characterPage(group) {
  const title = `${group.name} Splash Art Archive | HYU PREMIUM`;
  const description = `Browse ${group.items.length} ${group.name} gaming splash artworks with skin rank and image credit in the HYU PREMIUM archive.`;
  const cards = group.items.map(item => `<a class="card" href="${item.path}"><img src="${escHtml(item.thumbnail || item.image)}" alt="${escHtml(`${item.name} — ${group.name} gaming splash art`)}" loading="lazy" decoding="async"><div class="card-copy"><b>${escHtml(item.name)}</b><span>${escHtml(item.rank)} · ${escHtml(item.credit)}</span></div></a>`).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080908"><title>${escHtml(title)}</title><meta name="description" content="${escHtml(description)}">${commonMeta({ title, description, url: group.url, image: group.items[0]?.image || '' })}<script type="application/ld+json">${safeJson(characterJsonLd(group))}</script><style>${PAGE_STYLE}</style></head><body><header class="top"><a class="brand" href="/character/">HYU <span>PREMIUM</span></a><nav class="nav"><a href="/character/">Character</a><a href="/artworks/">Artwork Index</a></nav></header><main><section class="hero"><div class="kicker">Character · ${group.items.length} artwork${group.items.length === 1 ? '' : 's'}</div><h1>${escHtml(group.name)}</h1><p>${escHtml(description)}</p></section><section class="grid">${cards}</section></main><footer class="footer"><span>HYU PREMIUM / ${escHtml(group.name)}</span><a href="/character/">All characters →</a></footer></body></html>`;
}

function redirectPage(destination, label = 'Character archive') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moved | HYU PREMIUM</title><link rel="canonical" href="${escHtml(destination)}"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=${escHtml(destination)}"><script>location.replace(${JSON.stringify(destination)});</script></head><body><p>This page moved to <a href="${escHtml(destination)}">${escHtml(label)}</a>.</p></body></html>`;
}

function updateArtworkJsonLd(html, item) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) return html;
  try {
    const data = JSON.parse(match[1]);
    const graph = Array.isArray(data['@graph']) ? data['@graph'] : [];
    for (const node of graph) {
      if (node['@type'] === 'WebPage') {
        node['@id'] = `${item.url}#webpage`;
        node.url = item.url;
        node.isPartOf = { '@type': 'WebSite', '@id': `${MAIN_URL}#website`, url: MAIN_URL, name: 'HYU PREMIUM' };
        node.primaryImageOfPage = { '@id': `${item.url}#image` };
        node.breadcrumb = { '@id': `${item.url}#breadcrumb` };
      } else if (node['@type'] === 'ImageObject') {
        node['@id'] = `${item.url}#image`;
      } else if (node['@type'] === 'CreativeWork') {
        node['@id'] = `${item.url}#artwork`;
        node.url = item.url;
        node.image = { '@id': `${item.url}#image` };
      } else if (node['@type'] === 'BreadcrumbList') {
        node['@id'] = `${item.url}#breadcrumb`;
        node.itemListElement = [
          { '@type': 'ListItem', position: 1, name: 'Character', item: MAIN_URL },
          { '@type': 'ListItem', position: 2, name: item.group.name, item: item.group.url },
          { '@type': 'ListItem', position: 3, name: item.name, item: item.url }
        ];
      }
    }
    const replacement = `<script type="application/ld+json">${safeJson(data)}</script>`;
    return html.replace(match[0], replacement);
  } catch {
    return html;
  }
}

function nestedArtworkPage(item) {
  let html = item.sourceHtml;
  html = html.replaceAll(item.oldUrl, item.url);
  for (const related of item.group.items) {
    html = html.replaceAll(related.oldUrl, related.url);
    html = html.replaceAll(`href="${related.oldPath}"`, `href="${related.path}"`);
  }
  html = updateArtworkJsonLd(html, item);
  html = html.replace(/<header class="top">[\s\S]*?<\/header>/i, `<header class="top"><a class="brand" href="/character/">HYU <span>PREMIUM</span></a><nav class="nested-art-nav"><a class="back" href="${item.group.path}">${escHtml(item.group.name)} →</a><a class="back" href="/character/">Character →</a></nav></header>`);
  html = html.replace(/<div class="fact"><b>Category<\/b><span>[\s\S]*?<\/span><\/div>/i, `<div class="fact"><b>Category</b><span><a href="${item.group.path}">${escHtml(item.group.name)}</a></span></div>`);
  html = html.replace(/<footer class="footer">[\s\S]*?<\/footer>/i, `<footer class="footer"><span>HYU PREMIUM / ${escHtml(item.group.name)}</span><a href="/character/">Return to Character →</a></footer>`);
  html = html.replace('</style>', `.nested-art-nav{display:flex;gap:1rem;align-items:center}.fact a{color:var(--brand)}@media(max-width:520px){.nested-art-nav{gap:.55rem}.nested-art-nav .back{font-size:.5rem}}</style>`);
  return html;
}

async function generateCharacterRoutes(artworks, groups) {
  const characterRoot = join(DIST, 'character');
  await mkdir(characterRoot, { recursive: true });

  for (const group of groups) {
    const groupDir = join(characterRoot, group.slug);
    await mkdir(groupDir, { recursive: true });
    await writeFile(join(groupDir, 'index.html'), characterPage(group));
    for (const item of group.items) {
      const itemDir = join(groupDir, safeSegment(item.id));
      await mkdir(itemDir, { recursive: true });
      await writeFile(join(itemDir, 'index.html'), nestedArtworkPage(item));
      await writeFile(item.file, redirectPage(item.url, `${item.group.name} — ${item.name}`));
    }
  }

  await mkdir(join(DIST, 'characters'), { recursive: true });
  await writeFile(join(DIST, 'characters', 'index.html'), redirectPage(MAIN_URL, 'Character'));
}

function mainGalleryRouteScript(groups) {
  const categoryRoutes = Object.fromEntries(groups.map(group => [group.name, group.path]));
  return `<script id="characterRouteNavigation">(() => {\n  const categoryRoutes=${safeJson(categoryRoutes)};\n  const safeSegment=value=>String(value??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'item';\n  const chips=document.getElementById('chips');\n  if(chips)chips.addEventListener('click',event=>{const target=event.target.closest('[data-cat]');if(!target)return;event.preventDefault();event.stopImmediatePropagation();const category=target.dataset.cat;window.location.assign(category==='all'?'/character/':(categoryRoutes[category]||('/character/'+safeSegment(category)+'/')));},true);\n  const gallery=document.getElementById('gallery');\n  if(gallery)gallery.addEventListener('click',event=>{const card=event.target.closest('.art-card[data-id]');if(!card)return;let item=null;try{item=typeof state!=='undefined'?state.items.find(entry=>String(entry.id)===String(card.dataset.id)):null;}catch{}if(!item)return;event.preventDefault();event.stopImmediatePropagation();const groupPath=categoryRoutes[item.category]||('/character/'+safeSegment(item.category)+'/');window.location.assign(groupPath+safeSegment(item.id)+'/');},true);\n})();</script>`;
}

async function buildMainCharacterPage(artworks, groups) {
  const sourcePath = join(DIST, 'index.html');
  let html = await readFile(sourcePath, 'utf8');

  for (const item of artworks) {
    html = html.replaceAll(item.oldUrl, item.url);
    html = html.replaceAll(`href="${item.oldPath}"`, `href="${item.path}"`);
  }

  html = html.replace(/<html lang="[^"]+">/i, '<html lang="vi">');
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>HYU PREMIUM — Character Splash Art Archive</title>');
  html = html.replace(`<link rel="canonical" href="${SITE_URL}/">`, `<link rel="canonical" href="${MAIN_URL}">`);
  html = html.replace(`<meta property="og:url" content="${SITE_URL}/">`, `<meta property="og:url" content="${MAIN_URL}">`);
  html = html.replaceAll(`"url":"${SITE_URL}/"`, `"url":"${MAIN_URL}"`);
  html = html.replace(/<nav aria-label="Main navigation">[\s\S]*?<\/nav>/i, '<nav aria-label="Main navigation"><a href="/character/">Character</a><a href="#catalog">Browse</a><a href="#ranking">Ranking</a><a href="#about">About</a></nav>');

  const persistentLinks = artworks.map(item => `<a href="${item.path}">${escHtml(item.category)} — ${escHtml(item.name)}</a>`).join('');
  const hub = `<section class="seo-crawl-hub" aria-labelledby="seoCrawlHubTitle"><div class="seo-crawl-head"><div><span>Character index</span><h2 id="seoCrawlHubTitle">Permanent artwork routes</h2></div><nav><a href="/artworks/">Artwork Index →</a></nav></div><details><summary>Browse ${artworks.length} character artwork pages</summary><div class="seo-crawl-grid">${persistentLinks}</div></details></section>`;
  const css = `.seo-crawl-hub{border-top:1px solid var(--line);padding:2rem 3vw 2.5rem;background:var(--ink)}.seo-crawl-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1rem}.seo-crawl-head span{color:var(--brand);font-size:.52rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.seo-crawl-head h2{margin:.3rem 0 0;font-size:clamp(1.4rem,2.5vw,2.5rem);letter-spacing:-.04em;text-transform:uppercase}.seo-crawl-head nav{display:flex;gap:1rem;color:var(--brand);font-size:.58rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.seo-crawl-hub details{border-top:1px solid var(--line)}.seo-crawl-hub summary{cursor:pointer;padding:1rem 0;color:var(--muted);font-size:.62rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.seo-crawl-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line)}.seo-crawl-grid a{background:var(--ink);padding:.7rem .8rem;font-size:.62rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.seo-crawl-grid a:hover{color:var(--brand)}.art-card{cursor:pointer!important}.expand-mark{display:none!important}.card-copy{right:1rem!important}@media(max-width:900px){.seo-crawl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.seo-crawl-head{align-items:start;flex-direction:column}.seo-crawl-grid{grid-template-columns:1fr 1fr}.seo-crawl-grid a{font-size:.55rem;padding:.6rem}}`;

  html = html.replace('</style>', `${css}</style>`);
  html = html.replace(/(<div class="gallery-grid" id="gallery"[^>]*><\/div>)/i, `$1${hub}`);
  html = html.replace('</body>', `${mainGalleryRouteScript(groups)}</body>`);

  const characterRoot = join(DIST, 'character');
  await mkdir(characterRoot, { recursive: true });
  await writeFile(join(characterRoot, 'index.html'), html);
  await writeFile(sourcePath, html);
}

async function enhanceArtworkIndex(artworks) {
  const file = join(DIST, 'artworks', 'index.html');
  let html = await readFile(file, 'utf8');
  for (const item of artworks) {
    html = html.replaceAll(item.oldUrl, item.url);
    html = html.replaceAll(`href="${item.oldPath}"`, `href="${item.path}"`);
  }
  html = html.replace('href="/">HYU <span>PREMIUM</span>', 'href="/character/">HYU <span>PREMIUM</span>');
  html = html.replace('href="/">Gallery →</a>', 'href="/character/">Character →</a>');
  await writeFile(file, html);
}

function sitemapXml(artworks, groups) {
  const staticEntries = [
    { loc: MAIN_URL, priority: '1.0', changefreq: 'weekly' },
    { loc: `${SITE_URL}/artworks/`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/about`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${SITE_URL}/news`, priority: '0.5', changefreq: 'weekly' },
    { loc: `${SITE_URL}/blog`, priority: '0.5', changefreq: 'weekly' }
  ].map(entry => `<url><loc>${escXml(entry.loc)}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`).join('');

  const groupEntries = groups.map(group => `<url><loc>${escXml(group.url)}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`).join('');
  const artworkEntries = artworks.map(item => `<url><loc>${escXml(item.url)}</loc>${item.lastmod ? `<lastmod>${escXml(item.lastmod)}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.8</priority><image:image><image:loc>${escXml(item.image)}</image:loc><image:title>${escXml(item.name)}</image:title><image:caption>${escXml(`${item.name} — ${item.category} splash art. Skin rank ${item.rank}. Image credit ${item.credit}.`)}</image:caption></image:image></url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${staticEntries}${groupEntries}${artworkEntries}</urlset>`;
}

function imageSitemapXml(artworks) {
  const entries = artworks.map(item => `<url><loc>${escXml(item.url)}</loc><image:image><image:loc>${escXml(item.image)}</image:loc><image:title>${escXml(item.name)}</image:title><image:caption>${escXml(`${item.name} — ${item.category} gaming splash art. Skin rank ${item.rank}. Image credit ${item.credit}.`)}</image:caption></image:image></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries}</urlset>`;
}

async function main() {
  const artworks = await readGeneratedArtworks();
  if (!artworks.length) throw new Error('No generated artwork pages found for character routing.');
  await applyExistingLastmods(artworks);
  const groups = makeCharacterGroups(artworks);
  await generateCharacterRoutes(artworks, groups);
  await buildMainCharacterPage(artworks, groups);
  await enhanceArtworkIndex(artworks);
  await writeFile(join(DIST, 'sitemap.xml'), sitemapXml(artworks, groups));
  await writeFile(join(DIST, 'image-sitemap.xml'), imageSitemapXml(artworks));
  console.log(`Character URL architecture complete: ${artworks.length} artworks across ${groups.length} characters. Main route: ${MAIN_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
