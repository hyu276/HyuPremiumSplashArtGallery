import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');

function absoluteMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return new URL(raw.replace(/^\.\//, '').replace(/^\//, ''), `${SITE_URL}/`).href;
}

function mediaTypeFromUrl(url) {
  const pathname = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return String(url).toLowerCase(); } })();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parseImageDimensions(buffer) {
  if (!buffer || buffer.length < 10) return null;
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 26 && buffer.toString('ascii', 0, 2) === 'BM') {
    return { width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)) };
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: readUInt24LE(buffer, 24) + 1, height: readUInt24LE(buffer, 27) + 1 };
    if (chunk === 'VP8L' && buffer[20] === 0x2f) {
      const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
      return { width: 1 + (b1 | ((b2 & 0x3f) << 8)), height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)) };
    }
    if (chunk === 'VP8 ') {
      for (let i = 20; i + 9 < buffer.length; i += 1) {
        if (buffer[i] === 0x9d && buffer[i + 1] === 0x01 && buffer[i + 2] === 0x2a) {
          return { width: buffer.readUInt16LE(i + 3) & 0x3fff, height: buffer.readUInt16LE(i + 5) & 0x3fff };
        }
      }
    }
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      while (buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset++];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
      }
      offset += length;
    }
  }
  return null;
}

async function walkHtml(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === 'index.html') files.push(path);
    }
  }
  await walk(root);
  return files;
}

function injectMeta(html, property, value) {
  const pattern = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i');
  const tag = `<meta property="${property}" content="${value}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function patchJsonLd(html, absolute, dimensions, contentType) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, (full, raw) => {
    try {
      const data = JSON.parse(raw);
      const graph = Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
      for (const node of graph) {
        if (!node || typeof node !== 'object') continue;
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        if (types.includes('ImageObject') && node.representativeOfPage === true) {
          node.contentUrl = absolute;
          node.url = absolute;
          node.encodingFormat = contentType;
          if (dimensions?.width) node.width = dimensions.width;
          if (dimensions?.height) node.height = dimensions.height;
        }
      }
      data['@graph'] = graph;
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
    } catch {
      return full;
    }
  });
}

function patchContextImage(html, absolute, dimensions) {
  if (!dimensions?.width || !dimensions?.height) return html;
  const escaped = absolute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(<section class="seo-artwork-context"[\\s\\S]*?<img\\s+[^>]*src="${escaped}"[^>]*)(>)`, 'i');
  return html.replace(pattern, (full, start, end) => {
    let attrs = start.replace(/\swidth="[^"]*"/gi, '').replace(/\sheight="[^"]*"/gi, '');
    attrs += ` width="${dimensions.width}" height="${dimensions.height}"`;
    return `${attrs}${end}`;
  });
}

async function patchCanonicalPages() {
  const characterRoot = join(DIST, 'character');
  const files = await walkHtml(characterRoot);
  let localPages = 0;
  let dimensionPages = 0;

  for (const file of files) {
    let html = await readFile(file, 'utf8');
    if (!html.includes('data-artwork-seo-context=')) continue;
    const rawImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] || '';
    if (!rawImage || /^https?:\/\//i.test(rawImage)) continue;

    const absolute = absoluteMediaUrl(rawImage);
    const relative = rawImage.replace(/^\.\//, '').replace(/^\//, '');
    const localFile = join(DIST, relative);
    let dimensions = null;
    try { dimensions = parseImageDimensions(await readFile(localFile)); } catch {}

    html = html.split(rawImage).join(absolute);
    html = injectMeta(html, 'og:image', absolute);
    html = injectMeta(html, 'og:image:secure_url', absolute);
    html = injectMeta(html, 'og:image:type', mediaTypeFromUrl(absolute));
    if (dimensions?.width && dimensions?.height) {
      html = injectMeta(html, 'og:image:width', String(dimensions.width));
      html = injectMeta(html, 'og:image:height', String(dimensions.height));
      dimensionPages += 1;
    }
    html = patchJsonLd(html, absolute, dimensions, mediaTypeFromUrl(absolute));
    html = patchContextImage(html, absolute, dimensions);
    await writeFile(file, html);
    localPages += 1;
  }
  return { localPages, dimensionPages };
}

async function patchSitemapFile(filename) {
  const path = join(DIST, filename);
  let xml = await readFile(path, 'utf8');
  let replacements = 0;
  xml = xml.replace(/<image:loc>([^<]+)<\/image:loc>/g, (full, loc) => {
    if (/^https?:\/\//i.test(loc)) return full;
    replacements += 1;
    return `<image:loc>${absoluteMediaUrl(loc).replace(/&/g, '&amp;')}</image:loc>`;
  });
  await writeFile(path, xml);
  return replacements;
}

async function main() {
  const pages = await patchCanonicalPages();
  const sitemapFixes = (await patchSitemapFile('sitemap.xml')) + (await patchSitemapFile('image-sitemap.xml'));
  console.log(`Local image SEO finalized: ${pages.localPages} local originals canonicalized; ${pages.dimensionPages} local dimensions added; ${sitemapFixes} sitemap image URLs made absolute.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
