import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');
const TITLE_LIMIT = 60;
const META_LIMIT = 155;

const canonicalSegment = value => String(value ?? '')
  .replace(/Đ/g, 'D')
  .replace(/đ/g, 'd')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

const stripDiacritics = value => String(value ?? '')
  .replace(/Đ/g, 'D')
  .replace(/đ/g, 'd')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const decodeHtml = value => String(value ?? '')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const escHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

const normalizeSpace = value => String(value ?? '').replace(/\s+/g, ' ').trim();

const matchText = (html, pattern, fallback = '') => {
  const match = html.match(pattern);
  return normalizeSpace(decodeHtml(match?.[1] ?? fallback));
};

const unique = values => [...new Set(values.map(normalizeSpace).filter(Boolean))];

function trimAtWord(value, max) {
  const text = normalizeSpace(value);
  if (text.length <= max) return text;
  const clipped = text.slice(0, Math.max(0, max - 1));
  const boundary = clipped.lastIndexOf(' ');
  const base = boundary > Math.floor(max * 0.65) ? clipped.slice(0, boundary) : clipped;
  return `${base.replace(/[\s,;:–—-]+$/g, '')}…`;
}

function firstWithin(candidates, max) {
  for (const candidate of candidates) {
    const text = normalizeSpace(candidate);
    if (text.length <= max) return text;
  }
  return trimAtWord(candidates[candidates.length - 1], max);
}

function replaceOrInjectMeta(html, selectorPattern, tag) {
  return selectorPattern.test(html)
    ? html.replace(selectorPattern, tag)
    : html.replace('</head>', `  ${tag}\n</head>`);
}

async function readSupabaseConfig() {
  const source = await readFile(join(ROOT, 'assets/js/supabase-config.js'), 'utf8');
  const url = source.match(/url:\s*['"]([^'"]+)['"]/i)?.[1];
  const key = source.match(/publishableKey:\s*['"]([^'"]+)['"]/i)?.[1];
  if (!url || !key) throw new Error('Unable to read Supabase browser configuration for SEO metadata.');
  return { url, key };
}

async function loadSeoFlags() {
  try {
    const { url, key } = await readSupabaseConfig();
    const select = 'id,is_vietnamese_skin,updated_at';
    const endpoint = `${url}/rest/v1/artworks?select=${encodeURIComponent(select)}&hidden=eq.false`;
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`Supabase SEO metadata HTTP ${response.status}`);
    const rows = await response.json();
    return new Map(rows.map(row => [String(row.id), {
      isVietnamese: Boolean(row.is_vietnamese_skin),
      updatedAt: row.updated_at || ''
    }]));
  } catch (error) {
    console.warn(`Artwork SEO metadata flags unavailable; continuing with generic fanmade intent only. ${error.message}`);
    return new Map();
  }
}

function titleFor(item) {
  const entity = `${item.category} ${item.name}`;
  const candidates = item.isVietnamese
    ? [
        `${entity} – Skin Việt Nam Liên Quân`,
        `${entity} – Skin Việt Nam`,
        `${entity} – Fanart Liên Quân`
      ]
    : [
        `${entity} – Skin Fanmade Liên Quân`,
        `${entity} – Fanart Liên Quân`,
        `${entity} – Fanmade AOV`
      ];
  return firstWithin(candidates, TITLE_LIMIT);
}

function h1For(item) {
  return item.isVietnamese
    ? `${item.category} ${item.name} – Skin Việt Nam Tự Làm Liên Quân`
    : `${item.category} ${item.name} – Skin Fanmade Liên Quân`;
}

function metaDescriptionFor(item) {
  const entity = `${item.category} ${item.name}`;
  const candidates = item.isVietnamese
    ? [
        `Skin Việt Nam tự làm ${entity} cho Liên Quân Mobile. Xem fanart splash art, hạng ${item.rank}, credit ${item.credit} và các artwork liên quan.`,
        `Skin Việt Nam tự làm ${entity} cho Liên Quân Mobile. Xem fanart splash art, hạng ${item.rank} và credit ${item.credit}.`,
        `Fanart ${entity}, skin Việt Nam tự làm cho Liên Quân Mobile. Hạng ${item.rank}, credit ${item.credit}.`
      ]
    : [
        `Fanart skin fanmade ${entity} trong Liên Quân Mobile. Xem splash art, hạng ${item.rank}, credit ${item.credit} và các artwork liên quan.`,
        `Fanart skin fanmade ${entity} trong Liên Quân Mobile. Xem splash art, hạng ${item.rank} và credit ${item.credit}.`,
        `Fanart ${entity}, concept skin fanmade Liên Quân Mobile. Hạng ${item.rank}, credit ${item.credit}.`
      ];
  return firstWithin(candidates, META_LIMIT);
}

function bodyDescriptionFor(item) {
  if (item.isVietnamese) {
    return `${item.name} là concept skin Việt Nam tự làm dành cho ${item.category} trong Liên Quân Mobile (Arena of Valor), được lưu trữ trong HYU PREMIUM như một fanart/splash art fanmade. Artwork có skin rank ${item.rank} và image credit ${item.credit}. Trang này cung cấp ảnh gốc cùng các fanart ${item.category} liên quan trong bộ sưu tập.`;
  }
  return `${item.name} là concept skin fanmade dành cho ${item.category} trong Liên Quân Mobile (Arena of Valor), được lưu trữ trong HYU PREMIUM như một tác phẩm fanart/splash art. Artwork có skin rank ${item.rank} và image credit ${item.credit}. Trang này cung cấp ảnh gốc cùng các fanart ${item.category} liên quan trong cùng bộ sưu tập.`;
}

function imageAltFor(item) {
  return item.isVietnamese
    ? `Splash art skin Việt Nam tự làm ${item.name} của ${item.category} trong Liên Quân Mobile`
    : `Splash art fanmade ${item.name} của ${item.category} trong Liên Quân Mobile`;
}

function aliasesFor(item) {
  const exact = `${item.category} ${item.name}`;
  const reverse = `${item.name} ${item.category}`;
  const ascii = stripDiacritics(exact);
  const colon = `${item.category}: ${item.name}`;
  return unique([exact, reverse, ascii, colon]).slice(0, 4);
}

function keywordsFor(item) {
  const pageSpecific = [
    `${item.category} ${item.name}`,
    `skin ${item.category} ${item.name}`,
    `fanart ${item.category}`,
    `skin fanmade ${item.category}`,
    `fanart Liên Quân Mobile`,
    `skin fanmade Liên Quân`,
    `skin tự chế Liên Quân`,
    `skin tự làm Liên Quân`,
    `splash art Liên Quân`,
    `Arena of Valor fanart`
  ];
  if (item.isVietnamese) {
    pageSpecific.push(
      `skin Việt Nam Liên Quân`,
      `skin Việt Nam tự làm`,
      `fanmade skin Việt Nam`,
      `fanart Việt Nam Liên Quân`
    );
  }
  return unique(pageSpecific);
}

async function collectItems() {
  const artworkRoot = join(DIST, 'artwork');
  const seoFlags = await loadSeoFlags();
  const dirs = (await readdir(artworkRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const items = [];
  for (const dir of dirs) {
    const html = await readFile(join(artworkRoot, dir.name, 'index.html'), 'utf8');
    const eyebrow = matchText(html, /<div class="eyebrow">([\s\S]*?)<\/div>/i);
    const eyebrowParts = eyebrow.split(/\s+·\s+/);
    const category = eyebrowParts[0] || 'Uncategorized';
    const rank = eyebrowParts[1] || matchText(html, /<b>Skin rank<\/b><span>([\s\S]*?)<\/span>/i, 'Unranked');
    const name = matchText(html, /<h1 class="title">([\s\S]*?)<\/h1>/i, dir.name);
    const credit = matchText(html, /<b>Image credit<\/b><span>([\s\S]*?)<\/span>/i, 'Uncredited');
    const image = matchText(html, /<figure><img src="([^"]+)"/i);
    const flags = seoFlags.get(String(dir.name)) || {};

    items.push({
      id: dir.name,
      name,
      category,
      rank,
      credit,
      image,
      isVietnamese: Boolean(flags.isVietnamese),
      updatedAt: flags.updatedAt || '',
      characterSlug: canonicalSegment(category),
      baseArtworkSlug: canonicalSegment(name),
      artworkSlug: null
    });
  }

  const groups = new Map();
  for (const item of items) {
    const key = `${item.characterSlug}/${item.baseArtworkSlug}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id));
    group.forEach((item, index) => {
      item.artworkSlug = index === 0 ? item.baseArtworkSlug : `${item.baseArtworkSlug}-${index + 1}`;
    });
  }

  for (const item of items) {
    item.path = `/character/${item.characterSlug}/${item.artworkSlug}/`;
    item.url = `${SITE_URL}${item.path}`;
  }
  return items;
}

function gameEntity() {
  return {
    '@type': 'VideoGame',
    name: 'Liên Quân Mobile',
    alternateName: 'Arena of Valor'
  };
}

function patchJsonLd(html, item, metaDescription, bodyDescription) {
  const aliases = aliasesFor(item);
  const keywords = keywordsFor(item);
  const artworkId = `${item.url}#artwork`;
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, (full, raw) => {
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];

        if (types.includes('WebPage')) {
          node.name = titleFor(item);
          node.description = metaDescription;
          node.inLanguage = 'vi-VN';
          node.mainEntity = { '@id': artworkId };
          node.about = gameEntity();
          node.keywords = keywords.join(', ');
          if (item.updatedAt) node.dateModified = item.updatedAt;
        }

        if (types.includes('CreativeWork') || types.includes('VisualArtwork')) {
          node['@type'] = ['VisualArtwork', 'CreativeWork'];
          node.name = item.name;
          node.headline = h1For(item);
          node.alternateName = aliases;
          node.description = bodyDescription;
          node.artform = 'Fan art / fanmade game skin concept';
          node.artMedium = 'Digital illustration';
          node.genre = item.isVietnamese
            ? ['Fan art', 'Fanmade game skin', 'Skin Việt Nam tự làm', 'Splash art']
            : ['Fan art', 'Fanmade game skin', 'Splash art'];
          node.about = gameEntity();
          node.keywords = keywords.join(', ');
          node.inLanguage = 'vi-VN';
          if (item.updatedAt) node.dateModified = item.updatedAt;
        }

        if (types.includes('ImageObject')) {
          node.name = `${item.name} — ${item.category}`;
          node.description = imageAltFor(item);
          node.caption = h1For(item);
          node.creditText = item.credit;
          node.about = gameEntity();
          node.inLanguage = 'vi-VN';
          node.representativeOfPage = true;
        }
      }
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
    } catch {
      return full;
    }
  });
}

function contextMarkup(item, bodyDescription) {
  const characterPath = `/character/${item.characterSlug}/`;
  const typeLabel = item.isVietnamese ? 'Skin Việt Nam tự làm · Fanart Liên Quân' : 'Skin fanmade · Fanart Liên Quân';
  const aliases = aliasesFor(item).slice(0, 3);
  const imageMarkup = item.image
    ? `<a class="seo-artwork-thumb" href="${escHtml(item.image)}" target="_blank" rel="noopener" aria-label="Mở ảnh gốc ${escHtml(item.name)}"><img src="${escHtml(item.image)}" alt="${escHtml(imageAltFor(item))}" loading="lazy" decoding="async"></a>`
    : '';

  return `<section class="seo-artwork-context" aria-labelledby="seoArtworkTitle" data-artwork-seo-context="${escHtml(item.id)}" data-seo-page-path="${escHtml(item.path)}">
  ${imageMarkup}
  <div class="seo-artwork-copy">
    <p class="seo-artwork-kicker">${escHtml(typeLabel)} · ${escHtml(item.rank)} · ${escHtml(item.credit)}</p>
    <h1 id="seoArtworkTitle">${escHtml(h1For(item))}</h1>
    <p class="seo-artwork-answer">${escHtml(bodyDescription)}</p>
    <dl class="seo-artwork-facts">
      <div><dt>Game</dt><dd>Liên Quân Mobile / Arena of Valor</dd></div>
      <div><dt>Nhân vật</dt><dd>${escHtml(item.category)}</dd></div>
      <div><dt>Loại</dt><dd>${escHtml(item.isVietnamese ? 'Skin Việt Nam tự làm / fanmade' : 'Skin fanmade / fanart')}</dd></div>
      <div><dt>Skin rank</dt><dd>${escHtml(item.rank)}</dd></div>
      <div><dt>Image credit</dt><dd>${escHtml(item.credit)}</dd></div>
    </dl>
    <p class="seo-artwork-aliases"><strong>Tên tìm kiếm:</strong> ${aliases.map(escHtml).join(' · ')}</p>
    <nav aria-label="Artwork context links"><a href="${escHtml(characterPath)}">Xem thêm fanart ${escHtml(item.category)}</a><a href="/artworks/">Toàn bộ artwork</a></nav>
  </div>
</section>`;
}

const contextStyle = `<style id="hyuArtworkOnPageSeoStyle">
.hero .hero-display-title{margin:auto 0;position:relative;z-index:1;font-size:clamp(5rem,12.8vw,12.8rem);font-weight:900;line-height:.73;letter-spacing:-.09em;text-transform:uppercase}.hero .hero-display-title em{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-style:italic;color:var(--brand2);text-shadow:0 0 22px rgba(25,191,255,.18);text-transform:none}.seo-artwork-context{border-top:1px solid var(--line);padding:2.2rem 3vw;display:grid;grid-template-columns:minmax(180px,280px) minmax(0,1fr);gap:clamp(1.4rem,3vw,3rem);align-items:center;background:#0b0c0b}.seo-artwork-thumb{display:block;overflow:hidden;background:#111;aspect-ratio:16/9}.seo-artwork-thumb img{display:block;width:100%;height:100%;object-fit:cover}.seo-artwork-copy{max-width:980px}.seo-artwork-kicker{margin:0 0 .65rem;color:var(--brand);font-size:.55rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.seo-artwork-copy h1{margin:0 0 .8rem;font-size:clamp(1.65rem,3.2vw,3.4rem);line-height:.98;letter-spacing:-.045em;text-transform:uppercase}.seo-artwork-answer{margin:0;color:#c5c9c2;max-width:860px;line-height:1.68}.seo-artwork-facts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:1.2rem 0 0;border:1px solid var(--line)}.seo-artwork-facts>div{padding:.75rem;border-right:1px solid var(--line);min-width:0}.seo-artwork-facts>div:last-child{border-right:0}.seo-artwork-facts dt{color:var(--muted);font-size:.48rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.seo-artwork-facts dd{margin:.25rem 0 0;font-size:.68rem;font-weight:800;overflow-wrap:anywhere}.seo-artwork-aliases{margin:.85rem 0 0;color:#8f948d;font-size:.62rem;line-height:1.45}.seo-artwork-aliases strong{color:#c5c9c2}.seo-artwork-copy nav{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem}.seo-artwork-copy nav a{color:var(--brand);font-size:.58rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.seo-artwork-copy nav a:hover{text-decoration:underline}@media(max-width:900px){.seo-artwork-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.seo-artwork-facts>div{border-bottom:1px solid var(--line)}.seo-artwork-facts>div:nth-child(2n){border-right:0}}@media(max-width:760px){.hero .hero-display-title{font-size:clamp(4.2rem,22vw,7.8rem)}.seo-artwork-context{grid-template-columns:1fr;padding:1.5rem 4vw}.seo-artwork-thumb{max-width:320px}.seo-artwork-copy h1{font-size:clamp(1.45rem,7vw,2.3rem)}}@media(max-width:520px){.hero .hero-display-title{font-size:21vw}.seo-artwork-facts{grid-template-columns:1fr}.seo-artwork-facts>div{border-right:0}}
</style>`;

function patchRuntimeTitle(output) {
  const oldLine = "if (item) document.title = (item.name || route.artwork) + ' — ' + (item.category || 'Character') + ' Splash Art | HYU PREMIUM';";
  const replacement = `if (item) {\n        const serverContext = document.querySelector('[data-artwork-seo-context][data-seo-page-path]');\n        if (!serverContext || serverContext.dataset.seoPagePath !== window.location.pathname) {\n          const dynamicTitle = (item.category || 'Character') + ' ' + (item.name || route.artwork) + ' – Fanart Liên Quân';\n          document.title = dynamicTitle.length <= 60 ? dynamicTitle : dynamicTitle.slice(0, 59).replace(/\\s+\\S*$/, '') + '…';\n        }\n      }`;
  return output.includes(oldLine) ? output.replace(oldLine, replacement) : output;
}

function patchArtworkPage(html, item) {
  const title = titleFor(item);
  const metaDescription = metaDescriptionFor(item);
  const bodyDescription = bodyDescriptionFor(item);
  const alt = imageAltFor(item);

  let output = html;
  output = output.replace(/<html\s+lang="[^"]*">/i, '<html lang="vi">');
  output = output.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escHtml(title)}</title>`);
  output = replaceOrInjectMeta(output, /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escHtml(metaDescription)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:title"\s+content="[^"]*"\s*>/i, `<meta property="og:title" content="${escHtml(title)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:description"\s+content="[^"]*"\s*>/i, `<meta property="og:description" content="${escHtml(metaDescription)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*>/i, `<meta name="twitter:title" content="${escHtml(title)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*>/i, `<meta name="twitter:description" content="${escHtml(metaDescription)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*>/i, `<meta property="og:image:alt" content="${escHtml(alt)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*>/i, `<meta name="twitter:image:alt" content="${escHtml(alt)}">`);
  output = patchJsonLd(output, item, metaDescription, bodyDescription);

  output = output.replace(/<h1>The art<br>of the <em>game\.<\/em><\/h1>/i, '<div class="hero-display-title" aria-hidden="true">The art<br>of the <em>game.</em></div>');

  if (!output.includes('id="hyuArtworkOnPageSeoStyle"')) {
    output = output.replace('</head>', `${contextStyle}\n</head>`);
  }
  if (!output.includes('data-artwork-seo-context=')) {
    const markup = contextMarkup(item, bodyDescription);
    if (output.includes('<section class="manifesto"')) {
      output = output.replace('<section class="manifesto"', `${markup}\n\n<section class="manifesto"`);
    } else {
      output = output.replace('</body>', `${markup}\n</body>`);
    }
  }

  output = patchRuntimeTitle(output);
  return output;
}

async function main() {
  const items = await collectItems();
  let patched = 0;
  let vietnamese = 0;
  let maxTitle = 0;
  let maxMeta = 0;

  for (const item of items) {
    const file = join(DIST, item.path.replace(/^\//, ''), 'index.html');
    let html = await readFile(file, 'utf8');
    html = patchArtworkPage(html, item);
    await writeFile(file, html);
    patched += 1;
    if (item.isVietnamese) vietnamese += 1;
    maxTitle = Math.max(maxTitle, titleFor(item).length);
    maxMeta = Math.max(maxMeta, metaDescriptionFor(item).length);
  }

  if (maxTitle > TITLE_LIMIT || maxMeta > META_LIMIT) {
    throw new Error(`SEO metadata limit failed: max title ${maxTitle}/${TITLE_LIMIT}; max description ${maxMeta}/${META_LIMIT}`);
  }

  console.log(`Artwork relevance SEO enhanced: ${patched} canonical pages; ${vietnamese} Vietnamese-skin pages; title max ${maxTitle}/${TITLE_LIMIT}; description max ${maxMeta}/${META_LIMIT}; runtime/Supabase data unchanged.`);
}

await main();
