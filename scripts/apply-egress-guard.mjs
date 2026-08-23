import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

async function patchSupabaseRuntime() {
  const file = join(DIST, 'assets/js/supabase-data.js');
  let source = await readFile(file, 'utf8');

  const oldSelect = "client.from('artworks').select('id,name,description,image,tags,hidden,category:categories(name),rank:ranks(name,sort_order),credit:image_credits(name)').eq('hidden',false)";
  const newSelect = "client.from('artworks').select('id,name,description,image,thumbnail,tags,hidden,category:categories(name),rank:ranks(name,sort_order),credit:image_credits(name)').eq('hidden',false)";

  if (source.includes(oldSelect)) {
    source = source.replace(oldSelect, newSelect);
  } else if (!source.includes("description,image,thumbnail,tags")) {
    throw new Error('Egress guard could not patch artwork thumbnail query.');
  }

  const oldMapping = "      credit:x.credit?.name||'Uncredited',\n      image:x.image,\n      tags:Array.isArray(x.tags)?x.tags:[],";
  const newMapping = "      credit:x.credit?.name||'Uncredited',\n      originalImage:x.image,\n      thumbnail:x.thumbnail||'',\n      image:x.thumbnail||x.image,\n      tags:Array.isArray(x.tags)?x.tags:[],";

  if (source.includes(oldMapping)) {
    source = source.replace(oldMapping, newMapping);
  } else if (!source.includes("originalImage:x.image") || !source.includes("thumbnail:x.thumbnail||''")) {
    throw new Error('Egress guard could not patch artwork image mapping.');
  }

  await writeFile(file, source);
}

async function patchGalleryRender() {
  const file = join(DIST, 'index.html');
  let html = await readFile(file, 'utf8');

  const oldPrelude = "const expanded=state.expanded===item.id;return `<button class=\"art-card${expanded?' expanded':''}\"";
  const newPrelude = "const expanded=state.expanded===item.id;const displayImage=expanded?(item.originalImage||item.image):(item.thumbnail||item.image);return `<button class=\"art-card${expanded?' expanded':''}\"";

  if (html.includes(oldPrelude)) {
    html = html.replace(oldPrelude, newPrelude);
  } else if (!html.includes("const displayImage=expanded?(item.originalImage||item.image):(item.thumbnail||item.image)")) {
    throw new Error('Egress guard could not patch gallery display image selection.');
  }

  const oldImage = '<img src="${esc(imageSrc(item.image))}" alt="${esc(item.name)}" loading="lazy" decoding="async">';
  const newImage = '<img src="${esc(imageSrc(displayImage))}" alt="${esc(item.name)}" loading="lazy" decoding="async" fetchpriority="low">';

  if (html.includes(oldImage)) {
    html = html.replace(oldImage, newImage);
  } else if (!html.includes('imageSrc(displayImage)')) {
    throw new Error('Egress guard could not patch gallery image source.');
  }

  await writeFile(file, html);
}

async function main() {
  await patchSupabaseRuntime();
  await patchGalleryRender();
  console.log('Egress guard applied: gallery uses thumbnails by default and originals only for expanded artwork.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
