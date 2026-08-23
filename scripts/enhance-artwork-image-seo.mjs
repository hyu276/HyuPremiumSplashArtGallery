import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');
const MAX_PROBE_BYTES = 384 * 1024;
const PROBE_CONCURRENCY = 10;

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

const escXml = value => String(value ?? '').replace(/[<>&"']/g, char => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
}[char]));

const normalizeSpace = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const unique = values => [...new Set(values.filter(Boolean))];

const matchText = (html, pattern, fallback = '') => {
  const match = html.match(pattern);
  return normalizeSpace(decodeHtml(match?.[1] ?? fallback));
};

function mediaTypeFromUrl(url) {
  const pathname = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.bmp')) return 'image/bmp';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function byteSizeLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${bytes} bytes`;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parseImageDimensions(buffer, contentType = '') {
  if (!buffer || buffer.length < 10) return null;

  // PNG
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'image/png' };
  }

  // GIF
  if (buffer.length >= 10 && (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8), format: 'image/gif' };
  }

  // BMP
  if (buffer.length >= 26 && buffer.toString('ascii', 0, 2) === 'BM') {
    return { width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)), format: 'image/bmp' };
  }

  // WebP
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return {
        width: readUInt24LE(buffer, 24) + 1,
        height: readUInt24LE(buffer, 27) + 1,
        format: 'image/webp'
      };
    }
    if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
      return {
        width: 1 + (b1 | ((b2 & 0x3f) << 8)),
        height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
        format: 'image/webp'
      };
    }
    if (chunk === 'VP8 ') {
      for (let i = 20; i + 9 < buffer.length; i += 1) {
        if (buffer[i] === 0x9d && buffer[i + 1] === 0x01 && buffer[i + 2] === 0x2a) {
          return {
            width: buffer.readUInt16LE(i + 3) & 0x3fff,
            height: buffer.readUInt16LE(i + 5) & 0x3fff,
            format: 'image/webp'
          };
        }
      }
    }
  }

  // JPEG: scan SOF markers. A range probe is normally enough even with EXIF/ICC metadata.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      while (buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset++];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      const isSof = [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
      if (isSof && offset + 7 < buffer.length) {
        return {
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5),
          format: 'image/jpeg'
        };
      }
      offset += segmentLength;
    }
  }

  return contentType ? { width: 0, height: 0, format: contentType } : null;
}

async function readPrefix(response, limit = MAX_PROBE_BYTES) {
  if (!response.body?.getReader) {
    const array = await response.arrayBuffer();
    return Buffer.from(array).subarray(0, limit);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      const remaining = limit - total;
      chunks.push(chunk.length > remaining ? chunk.subarray(0, remaining) : chunk);
      total += Math.min(chunk.length, remaining);
      if (chunk.length > remaining) break;
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
  return Buffer.concat(chunks, total);
}

async function probeImage(url) {
  if (!url) return { url, width: 0, height: 0, contentType: '', bytes: 0 };
  let contentType = mediaTypeFromUrl(url);
  let bytes = 0;

  try {
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    if (head.ok) {
      contentType = (head.headers.get('content-type') || contentType).split(';')[0].trim();
      bytes = Number(head.headers.get('content-length')) || 0;
    }
  } catch {}

  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${MAX_PROBE_BYTES - 1}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);
    contentType = (response.headers.get('content-type') || contentType).split(';')[0].trim();
    if (!bytes) {
      const range = response.headers.get('content-range') || '';
      bytes = Number(range.match(/\/(\d+)$/)?.[1]) || Number(response.headers.get('content-length')) || 0;
    }
    const prefix = await readPrefix(response);
    const parsed = parseImageDimensions(prefix, contentType);
    return {
      url,
      width: Number(parsed?.width) || 0,
      height: Number(parsed?.height) || 0,
      contentType: parsed?.format || contentType || mediaTypeFromUrl(url),
      bytes
    };
  } catch (error) {
    console.warn(`Image probe skipped for ${url}: ${error.message}`);
    return { url, width: 0, height: 0, contentType, bytes };
  }
}

async function mapConcurrent(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return results;
}

async function readSupabaseConfig() {
  const source = await readFile(join(ROOT, 'assets/js/supabase-config.js'), 'utf8');
  const url = source.match(/url:\s*['"]([^'"]+)['"]/i)?.[1];
  const key = source.match(/publishableKey:\s*['"]([^'"]+)['"]/i)?.[1];
  if (!url || !key) throw new Error('Unable to read Supabase browser configuration for image SEO.');
  return { url, key };
}

async function loadImageRows() {
  const { url, key } = await readSupabaseConfig();
  const select = 'id,name,image,thumbnail,updated_at,category:categories(name)';
  const endpoint = `${url}/rest/v1/artworks?select=${encodeURIComponent(select)}&hidden=eq.false`;
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Supabase image SEO metadata HTTP ${response.status}`);
  const rows = await response.json();
  return rows.map(row => ({
    id: String(row.id),
    name: normalizeSpace(row.name),
    category: normalizeSpace(row.category?.name) || 'Uncategorized',
    image: normalizeSpace(row.image),
    thumbnail: normalizeSpace(row.thumbnail),
    updatedAt: row.updated_at || ''
  }));
}

function assignCanonicalRoutes(items) {
  for (const item of items) {
    item.characterSlug = canonicalSegment(item.category);
    item.baseArtworkSlug = canonicalSegment(item.name);
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

function replaceOrInjectMeta(html, pattern, markup) {
  return pattern.test(html) ? html.replace(pattern, markup) : html.replace('</head>', `  ${markup}\n</head>`);
}

function patchPreferredImageMeta(html, item) {
  const image = item.originalMeta;
  let output = html;
  output = replaceOrInjectMeta(output, /<meta\s+property="og:image"\s+content="[^"]*"\s*>/i, `<meta property="og:image" content="${escHtml(item.image)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*>/i, `<meta property="og:image:secure_url" content="${escHtml(item.image)}">`);
  output = replaceOrInjectMeta(output, /<meta\s+property="og:image:type"\s+content="[^"]*"\s*>/i, `<meta property="og:image:type" content="${escHtml(image.contentType || mediaTypeFromUrl(item.image))}">`);
  if (image.width && image.height) {
    output = replaceOrInjectMeta(output, /<meta\s+property="og:image:width"\s+content="[^"]*"\s*>/i, `<meta property="og:image:width" content="${image.width}">`);
    output = replaceOrInjectMeta(output, /<meta\s+property="og:image:height"\s+content="[^"]*"\s*>/i, `<meta property="og:image:height" content="${image.height}">`);
  }
  output = replaceOrInjectMeta(output, /<meta\s+name="twitter:image"\s+content="[^"]*"\s*>/i, `<meta name="twitter:image" content="${escHtml(item.image)}">`);
  return output;
}

function patchSemanticImageElement(html, item) {
  const contextPattern = /(<section class="seo-artwork-context"[\s\S]*?<a class="seo-artwork-thumb"[^>]*><img\s+)([^>]*)(>)/i;
  return html.replace(contextPattern, (full, prefix, attrs, suffix) => {
    let next = attrs;
    next = next.replace(/\swidth="[^"]*"/gi, '').replace(/\sheight="[^"]*"/gi, '').replace(/\sfetchpriority="[^"]*"/gi, '');
    if (item.originalMeta.width && item.originalMeta.height) {
      next += ` width="${item.originalMeta.width}" height="${item.originalMeta.height}"`;
    }
    next += ' fetchpriority="high"';
    return `${prefix}${next}${suffix}`;
  });
}

function patchJsonLd(html, item) {
  const original = item.originalMeta;
  const thumb = item.thumbnailMeta;
  const mainImageId = `${item.url}#image`;
  const thumbId = `${item.url}#thumbnail`;

  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, (full, raw) => {
    try {
      const data = JSON.parse(raw);
      const graph = Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      const filtered = graph.filter(node => node?.['@id'] !== thumbId);
      let mainImage = null;

      for (const node of filtered) {
        if (!node || typeof node !== 'object') continue;
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];

        if (types.includes('WebPage')) {
          node.primaryImageOfPage = { '@id': mainImageId };
          node.image = { '@id': mainImageId };
        }

        if (types.includes('CreativeWork') || types.includes('VisualArtwork')) {
          node.image = { '@id': mainImageId };
          node.associatedMedia = { '@id': mainImageId };
          if (item.thumbnail) node.thumbnailUrl = item.thumbnail;
        }

        if (types.includes('ImageObject') && node['@id'] === mainImageId) {
          mainImage = node;
          node.contentUrl = item.image;
          node.url = item.image;
          node.thumbnailUrl = item.thumbnail || undefined;
          node.encodingFormat = original.contentType || mediaTypeFromUrl(item.image);
          if (original.width) node.width = original.width;
          if (original.height) node.height = original.height;
          if (original.bytes) node.contentSize = byteSizeLabel(original.bytes);
          node.representativeOfPage = true;
          node.mainEntityOfPage = { '@id': `${item.url}#webpage` };
          if (item.thumbnail) node.thumbnail = { '@id': thumbId };
          if (item.updatedAt) node.dateModified = item.updatedAt;
        }
      }

      if (!mainImage) {
        mainImage = {
          '@type': 'ImageObject',
          '@id': mainImageId,
          contentUrl: item.image,
          url: item.image,
          representativeOfPage: true,
          mainEntityOfPage: { '@id': `${item.url}#webpage` },
          encodingFormat: original.contentType || mediaTypeFromUrl(item.image)
        };
        if (original.width) mainImage.width = original.width;
        if (original.height) mainImage.height = original.height;
        if (original.bytes) mainImage.contentSize = byteSizeLabel(original.bytes);
        if (item.thumbnail) mainImage.thumbnailUrl = item.thumbnail;
        filtered.splice(1, 0, mainImage);
      }

      if (item.thumbnail) {
        const thumbnailNode = {
          '@type': 'ImageObject',
          '@id': thumbId,
          contentUrl: item.thumbnail,
          url: item.thumbnail,
          representativeOfPage: false,
          encodingFormat: thumb.contentType || mediaTypeFromUrl(item.thumbnail),
          isPartOf: { '@id': mainImageId }
        };
        if (thumb.width) thumbnailNode.width = thumb.width;
        if (thumb.height) thumbnailNode.height = thumb.height;
        if (thumb.bytes) thumbnailNode.contentSize = byteSizeLabel(thumb.bytes);
        filtered.push(thumbnailNode);
      }

      data['@graph'] = filtered;
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
    } catch {
      return full;
    }
  });
}

function cleanImageBlocks(xml) {
  return xml.replace(/<image:image>[\s\S]*?<\/image:image>/g, block => {
    const loc = block.match(/<image:loc>([\s\S]*?)<\/image:loc>/)?.[1];
    return loc ? `<image:image><image:loc>${loc}</image:loc></image:image>` : block;
  });
}

function buildImageSitemap(items) {
  const entries = items.map(item => `<url><loc>${escXml(item.url)}</loc>${item.updatedAt ? `<lastmod>${escXml(new Date(item.updatedAt).toISOString())}</lastmod>` : ''}<image:image><image:loc>${escXml(item.image)}</image:loc></image:image></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries}</urlset>`;
}

async function patchSitemaps(items) {
  const imageSitemap = buildImageSitemap(items);
  await writeFile(join(DIST, 'image-sitemap.xml'), imageSitemap);

  const sitemapPath = join(DIST, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');
  sitemap = cleanImageBlocks(sitemap);
  await writeFile(sitemapPath, sitemap);
}

async function main() {
  const items = assignCanonicalRoutes(await loadImageRows());
  if (!items.length) throw new Error('Deep image SEO found no visible artwork rows.');

  const urls = unique(items.flatMap(item => [item.image, item.thumbnail]));
  const probes = await mapConcurrent(urls, PROBE_CONCURRENCY, probeImage);
  const probeMap = new Map(probes.map(result => [result.url, result]));

  let originalDimensions = 0;
  let thumbnailDimensions = 0;
  let patched = 0;

  for (const item of items) {
    item.originalMeta = probeMap.get(item.image) || { width: 0, height: 0, contentType: mediaTypeFromUrl(item.image), bytes: 0 };
    item.thumbnailMeta = probeMap.get(item.thumbnail) || { width: 0, height: 0, contentType: mediaTypeFromUrl(item.thumbnail), bytes: 0 };
    if (item.originalMeta.width && item.originalMeta.height) originalDimensions += 1;
    if (item.thumbnail && item.thumbnailMeta.width && item.thumbnailMeta.height) thumbnailDimensions += 1;

    const file = join(DIST, item.path.replace(/^\//, ''), 'index.html');
    let html = await readFile(file, 'utf8');
    html = patchPreferredImageMeta(html, item);
    html = patchSemanticImageElement(html, item);
    html = patchJsonLd(html, item);
    await writeFile(file, html);
    patched += 1;
  }

  await patchSitemaps(items);

  const missingThumbs = items.filter(item => !item.thumbnail).length;
  console.log(
    `Deep image SEO complete: ${patched} canonical artwork pages; ` +
    `${originalDimensions}/${items.length} original dimensions; ` +
    `${thumbnailDimensions}/${items.length - missingThumbs} thumbnail dimensions; ` +
    `${missingThumbs} missing thumbnails; preferred-image metadata and clean image sitemap emitted.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
