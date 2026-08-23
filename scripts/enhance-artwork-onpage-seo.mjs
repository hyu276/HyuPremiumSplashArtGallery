import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');

const canonicalSegment = value => String(value ?? '')
  .replace(/Đ/g, 'D')
  .replace(/đ/g, 'd')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

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

function replaceOrInjectMeta(html, selectorPattern, tag) {
  return selectorPattern.test(html)
    ? html.replace(selectorPattern, tag)
    : html.replace('</head>', `  ${tag}\n</head>`);
}

function priorityDescription(item) {
  const key = `${item.category}::${item.name}`;
  const descriptions = new Map([
    ['Marja::Cô nàng Thanh Hóa', 'Cô nàng Thanh Hóa — splash art skin Marja trong HYU PREMIUM. Hạng SS, image credit Hyu; artwork được đánh dấu là skin Việt Nam. Xem ảnh gốc và các artwork Marja liên quan.'],
    ['Marja::WAVE', 'WAVE — splash art skin Marja trong HYU PREMIUM. Hạng SS, image credit Hyu. Xem ảnh gốc và các artwork Marja liên quan trong gallery.'],
    ['Enzo::Ma thuật đen', 'Ma thuật đen — splash art skin Enzo trong HYU PREMIUM. Hạng S+, image credit Hyu. Xem ảnh gốc và các artwork Enzo liên quan trong gallery.']
  ]);
  return descriptions.get(key) || '';
}

function seoDescription(item) {
  return priorityDescription(item) ||
    `${item.name} — splash art skin ${item.category} trong HYU PREMIUM. Hạng ${item.rank}, image credit ${item.credit}. Xem ảnh gốc và các artwork ${item.category} liên quan trong gallery.`;
}

function imageAlt(item) {
  return `${item.name} — skin ${item.category} splash art, hạng ${item.rank}, image credit ${item.credit}`;
}

function seoTitle(item) {
  return `${item.name} — ${item.category} Splash Art | HYU PREMIUM`;
}

async function collectItems() {
  const artworkRoot = join(DIST, 'artwork');
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

    items.push({
      id: dir.name,
      name,
      category,
      rank,
      credit,
      image,
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

function patchJsonLd(html, item, description) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, (full, raw) => {
    try {
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const type = node['@type'];
        if (type === 'WebPage' || type === 'CreativeWork') {
          node.description = description;
          node.inLanguage = 'vi-VN';
        }
        if (type === 'CreativeWork') {
          node.name = item.name;
          node.genre = 'Gaming splash art';
          node.keywords = [item.name, item.category, `${item.category} splash art`, item.rank, item.credit]
            .filter(Boolean)
            .join(', ');
        }
        if (type === 'ImageObject') {
          node.name = item.name;
          node.caption = `${item.name} — ${item.category} skin splash art`;
          node.creditText = item.credit;
          node.representativeOfPage = true;
        }
      }
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
    } catch {
      return full;
    }
  });
}

function contextMarkup(item, description) {
  const characterPath = `/character/${item.characterSlug}/`;
  const imageMarkup = item.image
    ? `<a class="seo-artwork-thumb" href="${escHtml(item.image)}" target="_blank" rel="noopener" aria-label="Mở ảnh gốc ${escHtml(item.name)}"><img src="${escHtml(item.image)}" alt="${escHtml(imageAlt(item))}" loading="lazy" decoding="async"></a>`
    : '';

  return `<section class="seo-artwork-context" aria-labelledby="seoArtworkTitle" data-artwork-seo-context="${escHtml(item.id)}">
  ${imageMarkup}
  <div class="seo-artwork-copy">
    <p class="seo-artwork-kicker">${escHtml(item.category)} · Skin rank ${escHtml(item.rank)} · Image credit ${escHtml(item.credit)}</p>
    <h2 id="seoArtworkTitle">${escHtml(item.name)} — ${escHtml(item.category)} Splash Art</h2>
    <p>${escHtml(description)}</p>
    <nav aria-label="Artwork context links"><a href="${escHtml(characterPath)}">Xem thêm ${escHtml(item.category)}</a><a href="/artworks/">Toàn bộ artwork</a></nav>
  </div>
</section>`;
}

const contextStyle = `<style id="hyuArtworkOnPageSeoStyle">
.seo-artwork-context{border-top:1px solid var(--line);padding:2.2rem 3vw;display:grid;grid-template-columns:minmax(180px,280px) minmax(0,1fr);gap:clamp(1.4rem,3vw,3rem);align-items:center;background:#0b0c0b}.seo-artwork-thumb{display:block;overflow:hidden;background:#111;aspect-ratio:16/9}.seo-artwork-thumb img{display:block;width:100%;height:100%;object-fit:cover}.seo-artwork-copy{max-width:900px}.seo-artwork-kicker{margin:0 0 .65rem;color:var(--brand);font-size:.55rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.seo-artwork-copy h2{margin:0 0 .8rem;font-size:clamp(1.65rem,3.2vw,3.4rem);line-height:.95;letter-spacing:-.045em;text-transform:uppercase}.seo-artwork-copy>p:not(.seo-artwork-kicker){margin:0;color:#c5c9c2;max-width:760px;line-height:1.65}.seo-artwork-copy nav{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem}.seo-artwork-copy nav a{color:var(--brand);font-size:.58rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.seo-artwork-copy nav a:hover{text-decoration:underline}@media(max-width:760px){.seo-artwork-context{grid-template-columns:1fr;padding:1.5rem 4vw}.seo-artwork-thumb{max-width:320px}.seo-artwork-copy h2{font-size:clamp(1.45rem,7vw,2.3rem)}}
</style>`;

function patchArtworkPage(html, item) {
  const title = seoTitle(item);
  const description = seoDescription(item);
  const alt = imageAlt(item);

  let output = html;
  output = output.replace(/<html\s+lang="[^"]*">/i, '<html lang="vi">');
  output = output.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escHtml(title)}</title>`);
  output = replaceOrInjectMeta(output, /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escHtml(description)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:title"\s+content="[^"]*"\s*>/i, `<meta property="og:title" content="${escHtml(title)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:description"\s+content="[^"]*"\s*>/i, `<meta property="og:description" content="${escHtml(description)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*>/i, `<meta name="twitter:title" content="${escHtml(title)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*>/i, `<meta name="twitter:description" content="${escHtml(description)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*>/i, `<meta property="og:image:alt" content="${escHtml(alt)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*>/i, `<meta name="twitter:image:alt" content="${escHtml(alt)}">`);
  output = patchJsonLd(output, item, description);

  if (!output.includes('id="hyuArtworkOnPageSeoStyle"')) {
    output = output.replace('</head>', `${contextStyle}\n</head>`);
  }
  if (!output.includes('data-artwork-seo-context=')) {
    const markup = contextMarkup(item, description);
    if (output.includes('<section class="manifesto"')) {
      output = output.replace('<section class="manifesto"', `${markup}\n\n<section class="manifesto"`);
    } else {
      output = output.replace('</body>', `${markup}\n</body>`);
    }
  }

  return output;
}

async function main() {
  const items = await collectItems();
  let patched = 0;
  let priority = 0;

  for (const item of items) {
    const file = join(DIST, item.path.replace(/^\//, ''), 'index.html');
    let html = await readFile(file, 'utf8');
    html = patchArtworkPage(html, item);
    await writeFile(file, html);
    patched += 1;
    if (priorityDescription(item)) priority += 1;
  }

  console.log(`Artwork on-page SEO enhanced: ${patched} canonical artwork pages; ${priority} priority descriptions; runtime and Supabase data unchanged.`);
}

await main();
