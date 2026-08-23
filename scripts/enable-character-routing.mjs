import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');

const safeSegment = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

const decodeHtml = value => String(value ?? '')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const escHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[char]));

const matchText = (html, pattern, fallback = '') => {
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? fallback).replace(/\s+/g, ' ').trim();
};

const replaceMeta = (html, pattern, replacement) => pattern.test(html) ? html.replace(pattern, replacement) : html;

async function collectRoutes() {
  const artworkRoot = join(DIST, 'artwork');
  const dirs = (await readdir(artworkRoot, { withFileTypes: true })).filter(entry => entry.isDirectory());
  const routes = [];

  for (const dir of dirs) {
    const sourceFile = join(artworkRoot, dir.name, 'index.html');
    const html = await readFile(sourceFile, 'utf8');
    const eyebrow = matchText(html, /<div class="eyebrow">([\s\S]*?)<\/div>/i);
    const [categoryRaw = 'Uncategorized'] = eyebrow.split(/\s+·\s+/);
    const category = categoryRaw || 'Uncategorized';
    const name = matchText(html, /<h1 class="title">([\s\S]*?)<\/h1>/i, dir.name);
    const image = matchText(html, /<figure><img src="([^"]+)"/i);
    const characterSlug = safeSegment(category);
    const artworkSlug = safeSegment(dir.name);
    const oldPath = `/artwork/${dir.name}/`;
    const newPath = `/character/${characterSlug}/${artworkSlug}/`;

    routes.push({
      id: dir.name,
      category,
      name,
      image,
      characterSlug,
      artworkSlug,
      sourceFile,
      sourceHtml: html,
      oldPath,
      oldUrl: `${SITE_URL}${oldPath}`,
      newPath,
      newUrl: `${SITE_URL}${newPath}`
    });
  }

  return routes;
}

function replaceRouteReferences(html, routes) {
  let out = html;
  for (const route of routes) {
    out = out.replaceAll(route.oldUrl, route.newUrl);
    out = out.replaceAll(`href="${route.oldPath}"`, `href="${route.newPath}"`);
  }
  return out;
}

function routeLayerScript(selectedCategory = '') {
  return `
<script id="hyuCharacterRouteLayer">
(() => {
  const selectedCategory = ${JSON.stringify(selectedCategory)};
  const slug = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

  const applyCategoryFromUrl = () => {
    if (!selectedCategory) return true;
    try {
      if (typeof state === 'undefined' || !Array.isArray(state.items) || !state.items.length) return false;
      if (typeof setupFilters !== 'function' || typeof render !== 'function') return false;
      const exact = state.items.find(item => String(item.category || 'Uncategorized') === selectedCategory);
      if (!exact) return false;
      state.category = selectedCategory;
      state.expanded = null;
      setupFilters();
      render();
      return true;
    } catch {
      return false;
    }
  };

  if (!applyCategoryFromUrl()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (applyCategoryFromUrl() || attempts >= 400) clearInterval(timer);
    }, 25);
  }

  document.addEventListener('click', event => {
    const chip = event.target.closest('#chips button[data-cat]');
    if (chip) {
      const category = chip.dataset.cat || 'all';
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(category === 'all' ? '/character/' : '/character/' + slug(category) + '/');
      return;
    }

    const card = event.target.closest('#gallery .art-card[data-id]');
    if (!card) return;

    let item = null;
    try {
      item = typeof state !== 'undefined'
        ? state.items.find(entry => String(entry.id) === String(card.dataset.id))
        : null;
    } catch {}
    if (!item) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign('/character/' + slug(item.category) + '/' + slug(item.id) + '/');
  }, true);
})();
</script>`;
}

function characterJsonLd(category, routes) {
  const canonical = `${SITE_URL}/character/${safeSegment(category)}/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category} Splash Art Archive`,
    url: canonical,
    description: `Browse ${routes.length} ${category} gaming splash artworks in the HYU PREMIUM archive.`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: routes.length,
      itemListElement: routes.map((route, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: route.newUrl,
        name: route.name,
        image: route.image || undefined
      }))
    }
  };
}

function makeCharacterAppHtml(source, routes, selectedCategory = '') {
  let html = source;
  const canonical = selectedCategory
    ? `${SITE_URL}/character/${safeSegment(selectedCategory)}/`
    : `${SITE_URL}/character/`;

  if (!/<base\s/i.test(html)) html = html.replace('<head>', '<head>\n  <base href="/">');

  html = replaceRouteReferences(html, routes);
  html = html.replaceAll(`${SITE_URL}/characters/`, `${SITE_URL}/character/`);
  html = html.replaceAll('href="/characters/"', 'href="/character/"');
  html = html.replaceAll('>Characters</a>', '>Character</a>');
  html = html.replaceAll('>Gallery</a>', '>Character</a>');

  html = replaceMeta(html, /<link rel="canonical" href="[^"]+">/i, `<link rel="canonical" href="${canonical}">`);
  html = replaceMeta(html, /<meta property="og:url" content="[^"]+">/i, `<meta property="og:url" content="${canonical}">`);

  if (selectedCategory) {
    const group = routes.filter(route => route.category === selectedCategory);
    const title = `${selectedCategory} Splash Art Archive | HYU PREMIUM`;
    const description = `Browse ${group.length} ${selectedCategory} gaming splash artworks with the existing HYU PREMIUM search, rank and credit filters.`;
    const firstImage = group.find(route => route.image)?.image || '';

    html = replaceMeta(html, /<title>[\s\S]*?<\/title>/i, `<title>${escHtml(title)}</title>`);
    html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escHtml(description)}">`);
    html = replaceMeta(html, /<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${escHtml(title)}">`);
    html = replaceMeta(html, /<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${escHtml(description)}">`);
    html = replaceMeta(html, /<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${escHtml(title)}">`);
    html = replaceMeta(html, /<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${escHtml(description)}">`);
    if (firstImage) {
      html = replaceMeta(html, /<meta property="og:image" content="[^"]*">/i, `<meta property="og:image" content="${escHtml(firstImage)}">`);
      html = replaceMeta(html, /<meta name="twitter:image" content="[^"]*">/i, `<meta name="twitter:image" content="${escHtml(firstImage)}">`);
    }
    html = html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script type="application/ld+json">${JSON.stringify(characterJsonLd(selectedCategory, group)).replace(/</g, '\\u003c')}</script>`
    );
  }

  return html.replace('</body>', `${routeLayerScript(selectedCategory)}\n</body>`);
}

async function createCharacterAppPages(rootHtml, routes) {
  const characterRoot = join(DIST, 'character');
  await mkdir(characterRoot, { recursive: true });
  await writeFile(join(characterRoot, 'index.html'), makeCharacterAppHtml(rootHtml, routes));

  const categories = [...new Set(routes.map(route => route.category))];
  for (const category of categories) {
    const targetDir = join(characterRoot, safeSegment(category));
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'index.html'), makeCharacterAppHtml(rootHtml, routes, category));
  }

  return categories.length;
}

async function createNestedArtworkPages(routes) {
  for (const route of routes) {
    let html = replaceRouteReferences(route.sourceHtml, routes);
    html = html.replaceAll(`${SITE_URL}/characters/`, `${SITE_URL}/character/`);
    html = html.replaceAll('href="/characters/"', 'href="/character/"');
    html = html.replaceAll('>Characters</a>', '>Character</a>');
    html = html.replaceAll('>Gallery</a>', '>Character</a>');

    const categoryPath = `/character/${route.characterSlug}/`;
    html = html.replace(/<a class="back" href="[^"]+">[^<]*→<\/a>/i, `<a class="back" href="${categoryPath}">${escHtml(route.category)} →</a>`);

    const targetDir = join(DIST, 'character', route.characterSlug, route.artworkSlug);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'index.html'), html);
  }
}

function removeUrlBlock(xml, loc) {
  const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return xml.replace(new RegExp(`<url><loc>${escaped}<\\/loc>[\\s\\S]*?<\\/url>`), '');
}

async function updateSitemaps(routes) {
  for (const fileName of ['sitemap.xml', 'image-sitemap.xml']) {
    const file = join(DIST, fileName);
    let xml = await readFile(file, 'utf8');
    xml = removeUrlBlock(xml, `${SITE_URL}/characters/`);
    xml = xml.replace(`<loc>${SITE_URL}/</loc>`, `<loc>${SITE_URL}/character/</loc>`);
    for (const route of routes) xml = xml.replaceAll(route.oldUrl, route.newUrl);
    await writeFile(file, xml);
  }
}

const routes = await collectRoutes();
const rootHtml = await readFile(join(DIST, 'index.html'), 'utf8');
const characterCount = await createCharacterAppPages(rootHtml, routes);
await createNestedArtworkPages(routes);
await updateSitemaps(routes);

console.log(`Character routing enabled safely: ${routes.length} artworks across ${characterCount} character URLs; existing Supabase/gallery runtime preserved.`);
