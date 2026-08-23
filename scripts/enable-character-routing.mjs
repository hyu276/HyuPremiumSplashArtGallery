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
    const title = matchText(html, /<title>([\s\S]*?)<\/title>/i, `${name} — ${category} Splash Art | HYU PREMIUM`);
    const description = matchText(html, /<meta name="description" content="([^"]*)"/i, `${name} — ${category} gaming splash artwork.`);
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] || '';
    const characterSlug = safeSegment(category);
    const artworkSlug = safeSegment(dir.name);
    const oldPath = `/artwork/${dir.name}/`;
    const newPath = `/character/${characterSlug}/${artworkSlug}/`;

    routes.push({
      id: dir.name,
      category,
      name,
      image,
      title,
      description,
      jsonLd,
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

function normalizeCharacterNavigation(html) {
  return html
    .replaceAll(`${SITE_URL}/characters/`, `${SITE_URL}/character/`)
    .replaceAll('href="/characters/"', 'href="/character/"')
    .replaceAll('>Characters</a>', '>Character</a>')
    .replaceAll('>Gallery</a>', '>Character</a>');
}

function routeLayerScript() {
  return `
<script id="hyuCharacterRouteLayer">
(() => {
  const slug = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

  const normalizeRuntimeNav = () => {
    const wordmark = document.querySelector('.site-header .wordmark');
    if (wordmark) wordmark.setAttribute('href', '/character/');

    const nav = document.querySelector('.site-header nav');
    if (!nav) return false;
    const first = nav.querySelector('a');
    if (!first) return false;
    first.textContent = 'Character';
    first.setAttribute('href', '/character/');
    first.classList.add('active');
    return true;
  };

  const routeFromLocation = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'character' || !parts[1]) return { category: 'all', artwork: null };

    let category = null;
    try {
      const match = state.items.find(item => slug(item.category || 'Uncategorized') === parts[1]);
      category = match?.category || null;
    } catch {}
    if (!category) return { category: 'all', artwork: null };

    let artwork = null;
    if (parts[2]) {
      try {
        const match = state.items.find(item =>
          String(item.category || 'Uncategorized') === category && slug(item.id) === parts[2]
        );
        artwork = match?.id || null;
      } catch {}
    }
    return { category, artwork };
  };

  const syncClientMeta = () => {
    const canonical = window.location.origin + window.location.pathname;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);

    try {
      const route = routeFromLocation();
      if (route.artwork) {
        const item = state.items.find(entry => String(entry.id) === String(route.artwork));
        if (item) document.title = (item.name || route.artwork) + ' — ' + (item.category || 'Character') + ' Splash Art | HYU PREMIUM';
      } else if (route.category !== 'all') {
        document.title = route.category + ' Splash Art Archive | HYU PREMIUM';
      } else {
        document.title = 'HYU PREMIUM — Gaming Splash Art Archive';
      }
    } catch {}
  };

  const applyRouteFromLocation = () => {
    try {
      if (typeof state === 'undefined' || !Array.isArray(state.items) || !state.items.length) return false;
      if (typeof setupFilters !== 'function' || typeof render !== 'function') return false;

      const route = routeFromLocation();
      state.category = route.category;
      state.expanded = route.artwork;
      setupFilters();
      render();
      normalizeRuntimeNav();
      syncClientMeta();

      if (route.artwork) {
        requestAnimationFrame(() => {
          const card = document.querySelector('[data-id="' + CSS.escape(String(route.artwork)) + '"]');
          card?.scrollIntoView({ behavior: 'auto', block: 'center' });
        });
      }
      return true;
    } catch {
      return false;
    }
  };

  const setPath = path => {
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
  };

  normalizeRuntimeNav();
  queueMicrotask(normalizeRuntimeNav);
  setTimeout(normalizeRuntimeNav, 0);

  if (!applyRouteFromLocation()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (applyRouteFromLocation() || attempts >= 400) clearInterval(timer);
    }, 25);
  }

  document.addEventListener('click', event => {
    const chip = event.target.closest('#chips button[data-cat]');
    if (chip) {
      const category = chip.dataset.cat || 'all';
      const resetsActiveCategory = category !== 'all' && chip.classList.contains('active');
      const path = category === 'all' || resetsActiveCategory
        ? '/character/'
        : '/character/' + slug(category) + '/';
      setPath(path);
      setTimeout(syncClientMeta, 0);
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

    const collapsing = card.classList.contains('expanded');
    let path;
    if (collapsing) {
      const currentCategory = typeof state !== 'undefined' ? state.category : 'all';
      path = currentCategory && currentCategory !== 'all'
        ? '/character/' + slug(currentCategory) + '/'
        : '/character/';
    } else {
      path = '/character/' + slug(item.category) + '/' + slug(item.id) + '/';
    }
    setPath(path);
    setTimeout(syncClientMeta, 0);
  }, true);

  window.addEventListener('popstate', () => {
    applyRouteFromLocation();
  });
})();
</script>`;
}

function collectionJsonLd(name, description, canonical, routes) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: canonical,
    description,
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

function migratedArtworkJsonLd(route, routes) {
  let json = route.jsonLd || '';
  if (!json) return '';
  json = replaceRouteReferences(json, routes);
  json = json.replaceAll(`${SITE_URL}/characters/`, `${SITE_URL}/character/`);
  return json;
}

function makeCharacterAppHtml(source, routes, selectedCategory = '', artworkRoute = null) {
  let html = source;
  const canonical = artworkRoute
    ? artworkRoute.newUrl
    : selectedCategory
      ? `${SITE_URL}/character/${safeSegment(selectedCategory)}/`
      : `${SITE_URL}/character/`;

  if (!/<base\s/i.test(html)) html = html.replace('<head>', '<head>\n  <base href="/">');

  html = replaceRouteReferences(html, routes);
  html = normalizeCharacterNavigation(html);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]+">/i, `<link rel="canonical" href="${canonical}">`);
  html = replaceMeta(html, /<meta property="og:url" content="[^"]+">/i, `<meta property="og:url" content="${canonical}">`);

  let title = 'HYU PREMIUM — Gaming Splash Art Archive';
  let description = 'A curated searchable archive of gaming splash art organized by character/category, skin rank and image credit.';
  let image = routes.find(route => route.image)?.image || '';
  let jsonLd = JSON.stringify(collectionJsonLd(
    'HYU PREMIUM Gaming Splash Art Archive',
    description,
    canonical,
    routes
  )).replace(/</g, '\\u003c');

  if (selectedCategory) {
    const group = routes.filter(route => route.category === selectedCategory);
    title = `${selectedCategory} Splash Art Archive | HYU PREMIUM`;
    description = `Browse ${group.length} ${selectedCategory} gaming splash artworks with the existing HYU PREMIUM search, rank and credit filters.`;
    image = group.find(route => route.image)?.image || image;
    jsonLd = JSON.stringify(collectionJsonLd(
      `${selectedCategory} Splash Art Archive`,
      `Browse ${group.length} ${selectedCategory} gaming splash artworks in the HYU PREMIUM archive.`,
      canonical,
      group
    )).replace(/</g, '\\u003c');
  }

  if (artworkRoute) {
    title = artworkRoute.title || `${artworkRoute.name} — ${artworkRoute.category} Splash Art | HYU PREMIUM`;
    description = artworkRoute.description;
    image = artworkRoute.image || image;
    jsonLd = migratedArtworkJsonLd(artworkRoute, routes) || jsonLd;
  }

  html = replaceMeta(html, /<title>[\s\S]*?<\/title>/i, `<title>${escHtml(title)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escHtml(description)}">`);
  html = replaceMeta(html, /<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${escHtml(title)}">`);
  html = replaceMeta(html, /<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${escHtml(description)}">`);
  html = replaceMeta(html, /<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${escHtml(title)}">`);
  html = replaceMeta(html, /<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${escHtml(description)}">`);
  if (image) {
    html = replaceMeta(html, /<meta property="og:image" content="[^"]*">/i, `<meta property="og:image" content="${escHtml(image)}">`);
    html = replaceMeta(html, /<meta name="twitter:image" content="[^"]*">/i, `<meta name="twitter:image" content="${escHtml(image)}">`);
  }
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json">${jsonLd}</script>`
  );

  return html.replace('</body>', `${routeLayerScript()}\n</body>`);
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

async function createNestedArtworkPages(rootHtml, routes) {
  for (const route of routes) {
    const targetDir = join(DIST, 'character', route.characterSlug, route.artworkSlug);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'index.html'), makeCharacterAppHtml(rootHtml, routes, route.category, route));
  }
}

async function migrateLegacyInternalLinks(routes) {
  const artworksIndex = join(DIST, 'artworks', 'index.html');
  try {
    let indexHtml = await readFile(artworksIndex, 'utf8');
    indexHtml = normalizeCharacterNavigation(replaceRouteReferences(indexHtml, routes));
    await writeFile(artworksIndex, indexHtml);
  } catch {}

  for (const route of routes) {
    let legacy = replaceRouteReferences(route.sourceHtml, routes);
    legacy = normalizeCharacterNavigation(legacy);
    legacy = replaceMeta(
      legacy,
      /<meta name="robots" content="[^"]+">/i,
      '<meta name="robots" content="noindex,follow,max-image-preview:large">'
    );
    legacy = replaceMeta(
      legacy,
      /<meta name="googlebot" content="[^"]+">/i,
      '<meta name="googlebot" content="noindex,follow,max-image-preview:large">'
    );
    await writeFile(route.sourceFile, legacy);
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
await createNestedArtworkPages(rootHtml, routes);
await migrateLegacyInternalLinks(routes);
await updateSitemaps(routes);

console.log(`Character routing enabled safely: ${routes.length} artworks across ${characterCount} character URLs; existing Supabase/gallery runtime and in-place artwork expansion preserved.`);
