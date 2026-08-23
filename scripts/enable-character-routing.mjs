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

const matchText = (html, pattern, fallback = '') => {
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? fallback).replace(/\s+/g, ' ').trim();
};

function makeCharacterAppHtml(source) {
  let html = source;
  html = html.replaceAll('src="./assets/', 'src="/assets/');
  html = html.replaceAll('href="./assets/', 'href="/assets/');
  html = html.replaceAll("fetch(`./${path}", "fetch(`/${path}");
  html = html.replace(
    "state.revision?`${rawBase(state.revision)}${s}`:`./${s}`",
    "state.revision?`${rawBase(state.revision)}${s}`:`/${s}`"
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]+">/i,
    `<link rel="canonical" href="${SITE_URL}/character/">`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]+">/i,
    `<meta property="og:url" content="${SITE_URL}/character/">`
  );
  html = html.replaceAll(`${SITE_URL}/characters/`, `${SITE_URL}/character/`);
  html = html.replaceAll('href="/characters/">Characters</a>', 'href="/character/">Character</a>');
  html = html.replaceAll('href="/characters/">Characters →</a>', 'href="/character/">Character →</a>');

  const routingScript = `
<script id="hyuCharacterRouteLayer">
(() => {
  const slug = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

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

  return html.replace('</body>', `${routingScript}\n</body>`);
}

async function patchBuiltAssetPaths() {
  const configFile = join(DIST, 'assets', 'js', 'supabase-config.js');
  let config = await readFile(configFile, 'utf8');
  config = config.replaceAll('./assets/', '/assets/');
  await writeFile(configFile, config);
}

async function createCharacterEntry() {
  const rootHtml = await readFile(join(DIST, 'index.html'), 'utf8');
  const characterDir = join(DIST, 'character');
  await mkdir(characterDir, { recursive: true });
  await writeFile(join(characterDir, 'index.html'), makeCharacterAppHtml(rootHtml));
}

async function createNestedArtworkPages() {
  const artworkRoot = join(DIST, 'artwork');
  const dirs = (await readdir(artworkRoot, { withFileTypes: true })).filter(entry => entry.isDirectory());
  const routes = [];

  for (const dir of dirs) {
    const sourceFile = join(artworkRoot, dir.name, 'index.html');
    let html = await readFile(sourceFile, 'utf8');
    const eyebrow = matchText(html, /<div class="eyebrow">([\s\S]*?)<\/div>/i);
    const [categoryRaw = 'Uncategorized'] = eyebrow.split(/\s+·\s+/);
    const category = categoryRaw || 'Uncategorized';
    const characterSlug = safeSegment(category);
    const artworkSlug = safeSegment(dir.name);
    const oldUrl = `${SITE_URL}/artwork/${dir.name}/`;
    const newPath = `/character/${characterSlug}/${artworkSlug}/`;
    const newUrl = `${SITE_URL}${newPath}`;

    html = html.replaceAll(oldUrl, newUrl);
    html = html.replaceAll('href="/characters/"', 'href="/character/"');
    html = html.replaceAll('>Characters</a>', '>Character</a>');

    const targetDir = join(DIST, 'character', characterSlug, artworkSlug);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'index.html'), html);
    routes.push({ oldUrl, newUrl });
  }

  return routes;
}

async function updateSitemaps(routes) {
  for (const fileName of ['sitemap.xml', 'image-sitemap.xml']) {
    const file = join(DIST, fileName);
    let xml = await readFile(file, 'utf8');
    xml = xml.replace(`<loc>${SITE_URL}/</loc>`, `<loc>${SITE_URL}/character/</loc>`);
    xml = xml.replaceAll(`${SITE_URL}/characters/`, `${SITE_URL}/character/`);
    for (const route of routes) xml = xml.replaceAll(route.oldUrl, route.newUrl);
    await writeFile(file, xml);
  }
}

await patchBuiltAssetPaths();
await createCharacterEntry();
const routes = await createNestedArtworkPages();
await updateSitemaps(routes);

console.log(`Safe character routing enabled for ${routes.length} artworks without replacing gallery/Supabase runtime.`);
