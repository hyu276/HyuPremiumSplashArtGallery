import { readFile, writeFile, readdir } from 'node:fs/promises';
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

async function listHtmlFiles(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.html')) files.push(path);
    }
  }
  await walk(root);
  return files;
}

async function patchGalleryRenders() {
  const oldImage = '<img src="${esc(imageSrc(item.image))}" alt="${esc(item.name)}" loading="lazy" decoding="async">';
  const newImage = '<img src="${esc(imageSrc(expanded?(item.originalImage||item.image):(item.thumbnail||item.image)))}" alt="${esc(item.name)}" loading="lazy" decoding="async">';
  let patchedFiles = 0;

  for (const file of await listHtmlFiles(DIST)) {
    let html = await readFile(file, 'utf8');
    if (!html.includes('function render(){') || !html.includes('imageSrc(item.image)')) continue;

    const next = html.split(oldImage).join(newImage);
    if (next === html) continue;
    await writeFile(file, next);
    patchedFiles += 1;
  }

  if (!patchedFiles) {
    throw new Error('Egress guard found no routed gallery HTML to patch.');
  }
  return patchedFiles;
}

async function main() {
  await patchSupabaseRuntime();
  const patchedFiles = await patchGalleryRenders();
  console.log(`Egress guard applied to ${patchedFiles} routed gallery pages: thumbnails by default, originals only when expanded.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
