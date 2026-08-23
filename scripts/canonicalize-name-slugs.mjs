import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');

// Historical slugger used by the current routing layer. Kept only to locate legacy URLs.
const legacySegment = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

// Canonical SEO slugger: preserve Vietnamese đ/Đ as d and normalize punctuation to hyphens.
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

const matchText = (html, pattern, fallback = '') => {
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? fallback).replace(/\s+/g, ' ').trim();
};

async function collectRoutes() {
  const artworkRoot = join(DIST, 'artwork');
  const dirs = (await readdir(artworkRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const routes = [];
  for (const dir of dirs) {
    const sourceFile = join(artworkRoot, dir.name, 'index.html');
    const html = await readFile(sourceFile, 'utf8');
    const eyebrow = matchText(html, /<div class="eyebrow">([\s\S]*?)<\/div>/i);
    const [categoryRaw = 'Uncategorized'] = eyebrow.split(/\s+·\s+/);
    const category = categoryRaw || 'Uncategorized';
    const name = matchText(html, /<h1 class="title">([\s\S]*?)<\/h1>/i, dir.name);

    routes.push({
      id: dir.name,
      category,
      name,
      oldCharacterSlug: legacySegment(category),
      characterSlug: canonicalSegment(category),
      oldArtworkSlug: legacySegment(dir.name),
      baseArtworkSlug: canonicalSegment(name),
      artworkSlug: null
    });
  }

  // A character is already a namespace, so global ID suffixes are unnecessary.
  // Only add -2/-3 when two artworks inside the same character truly share the same name slug.
  const groups = new Map();
  for (const route of routes) {
    const key = `${route.characterSlug}/${route.baseArtworkSlug}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(route);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id));
    group.forEach((route, index) => {
      route.artworkSlug = index === 0 ? route.baseArtworkSlug : `${route.baseArtworkSlug}-${index + 1}`;
    });
  }

  for (const route of routes) {
    route.legacyNestedPath = `/character/${route.oldCharacterSlug}/${route.oldArtworkSlug}/`;
    route.newPath = `/character/${route.characterSlug}/${route.artworkSlug}/`;
    route.legacyArtworkPath = `/artwork/${route.id}/`;
    route.newUrl = `${SITE_URL}${route.newPath}`;
  }
  return routes;
}

function buildReplacements(routes) {
  const replacements = [];
  const categoryPairs = new Map();

  for (const route of routes) {
    replacements.push([route.legacyArtworkPath, route.newPath]);
    replacements.push([`${SITE_URL}${route.legacyArtworkPath}`, route.newUrl]);
    if (route.legacyNestedPath !== route.newPath) {
      replacements.push([route.legacyNestedPath, route.newPath]);
      replacements.push([`${SITE_URL}${route.legacyNestedPath}`, route.newUrl]);
    }
    if (route.oldCharacterSlug !== route.characterSlug) {
      categoryPairs.set(`/character/${route.oldCharacterSlug}/`, `/character/${route.characterSlug}/`);
    }
  }

  for (const [oldPath, newPath] of categoryPairs) {
    replacements.push([oldPath, newPath]);
    replacements.push([`${SITE_URL}${oldPath}`, `${SITE_URL}${newPath}`]);
  }

  // Longest strings first, and placeholders prevent replacement cascades when a new clean slug
  // happens to equal another artwork's old technical slug.
  const unique = [...new Map(replacements.filter(([a, b]) => a !== b).map(pair => [pair[0], pair])).values()]
    .sort((a, b) => b[0].length - a[0].length);
  return unique;
}

function replaceMapped(text, replacements) {
  let output = text;
  const tokens = [];
  replacements.forEach(([from, to], index) => {
    const token = `__HYU_CANONICAL_ROUTE_${index}__`;
    if (output.includes(from)) {
      output = output.split(from).join(token);
      tokens.push([token, to]);
    }
  });
  for (const [token, to] of tokens) output = output.split(token).join(to);
  return output;
}

function patchRuntimeRouting(html) {
  const legacySlugBlock = `const slug = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';`;

  const canonicalSlugBlock = `const slug = value => String(value ?? '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';`;

  let output = html.split(legacySlugBlock).join(canonicalSlugBlock);
  output = output.split("slug(item.id) === parts[2]").join("slug(item.name || item.id) === parts[2]");
  output = output.split("slug(item.category) + '/' + slug(item.id) + '/'").join("slug(item.category) + '/' + slug(item.name || item.id) + '/'");
  return output;
}

async function walkFiles(root) {
  const results = [];
  async function walk(path) {
    let info;
    try { info = await stat(path); } catch { return; }
    if (info.isFile()) {
      results.push(path);
      return;
    }
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await walk(child);
      else results.push(child);
    }
  }
  await walk(root);
  return results;
}

function redirectHtml(destination) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,follow">
<meta name="googlebot" content="noindex,follow">
<link rel="canonical" href="${escHtml(`${SITE_URL}${destination}`)}">
<meta http-equiv="refresh" content="0;url=${escHtml(destination)}">
<title>Moved | HYU PREMIUM</title>
<script>location.replace(${JSON.stringify(destination)});</script>
</head>
<body><p>This URL has moved to <a href="${escHtml(destination)}">${escHtml(destination)}</a>.</p></body>
</html>`;
}

async function main() {
  const routes = await collectRoutes();
  const replacements = buildReplacements(routes);

  const changedArtworkRoutes = routes.filter(route => route.legacyNestedPath !== route.newPath);
  const changedCharacters = [...new Map(
    routes
      .filter(route => route.oldCharacterSlug !== route.characterSlug)
      .map(route => [route.oldCharacterSlug, route])
  ).values()];

  // Snapshot the currently generated route pages before any legacy location is overwritten.
  for (const route of routes) {
    const oldFile = join(DIST, route.legacyNestedPath.replace(/^\//, ''), 'index.html');
    route.routeHtml = await readFile(oldFile, 'utf8');
  }
  for (const route of changedCharacters) {
    const oldFile = join(DIST, 'character', route.oldCharacterSlug, 'index.html');
    route.characterHtml = await readFile(oldFile, 'utf8');
  }

  // Patch all existing HTML/XML references without touching the application's source modules.
  const files = await walkFiles(DIST);
  for (const file of files) {
    if (!/\.(html|xml)$/i.test(file)) continue;
    let content = await readFile(file, 'utf8');
    content = replaceMapped(content, replacements);
    if (/\.html$/i.test(file)) content = patchRuntimeRouting(content);
    await writeFile(file, content);
  }

  // Write canonical character pages where the old slugger dropped Vietnamese đ/Đ.
  for (const route of changedCharacters) {
    const canonicalDir = join(DIST, 'character', route.characterSlug);
    await mkdir(canonicalDir, { recursive: true });
    let html = replaceMapped(route.characterHtml, replacements);
    html = patchRuntimeRouting(html);
    await writeFile(join(canonicalDir, 'index.html'), html);
  }

  // Write canonical artwork pages at clean name-derived URLs.
  for (const route of routes) {
    const canonicalDir = join(DIST, route.newPath.replace(/^\//, ''));
    await mkdir(canonicalDir, { recursive: true });
    let html = replaceMapped(route.routeHtml, replacements);
    html = patchRuntimeRouting(html);
    await writeFile(join(canonicalDir, 'index.html'), html);
  }

  const canonicalPaths = new Set(routes.map(route => route.newPath));
  const characterCanonicalPaths = new Set(routes.map(route => `/character/${route.characterSlug}/`));
  let redirectCount = 0;
  let conflictCount = 0;

  // Preserve legacy nested URLs when they do not now belong to another clean canonical route.
  for (const route of changedArtworkRoutes) {
    if (canonicalPaths.has(route.legacyNestedPath)) {
      conflictCount += 1;
      continue;
    }
    const legacyDir = join(DIST, route.legacyNestedPath.replace(/^\//, ''));
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, 'index.html'), redirectHtml(route.newPath));
    redirectCount += 1;
  }

  for (const route of changedCharacters) {
    const oldPath = `/character/${route.oldCharacterSlug}/`;
    if (characterCanonicalPaths.has(oldPath)) continue;
    const legacyDir = join(DIST, 'character', route.oldCharacterSlug);
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, 'index.html'), redirectHtml(`/character/${route.characterSlug}/`));
    redirectCount += 1;
  }

  console.log(
    `Canonical slug audit complete: ${routes.length} artwork routes; ` +
    `${changedArtworkRoutes.length} artwork URLs corrected; ` +
    `${changedCharacters.length} character URLs corrected; ` +
    `${redirectCount} legacy redirects emitted; ${conflictCount} legacy-path collision retained as a canonical route.`
  );
}

await main();
