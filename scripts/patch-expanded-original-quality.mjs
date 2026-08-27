import { readFile, writeFile } from 'node:fs/promises';

function replaceExact(text, from, to, label){
  if(!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from,to);
}

const galleryPath='components/GalleryClient.tsx';
let gallery=await readFile(galleryPath,'utf8');
gallery=replaceExact(
  gallery,
  "  const src=artworkPreview(item,expanded?1600:960);\n  const srcSet=artworkSrcSet(item);",
  "  // Collapsed cards stay responsive; an expanded card loads the exact uploaded original.\n  // Do not attach the derivative srcSet while expanded: browsers may otherwise select 1600px WebP instead of the original.\n  const src=expanded?(item.media?.original?.url||item.image):artworkPreview(item,960);\n  const srcSet=expanded?'':artworkSrcSet(item);",
  'Gallery expanded media source'
);
await writeFile(galleryPath,gallery);

const guardPath='scripts/assert-egress-safety.mjs';
let guard=await readFile(guardPath,'utf8');
guard=replaceExact(
  guard,
  "if(!gallery.includes(\"artworkPreview(item,expanded?1600:960)\"))failures.push('expanded artwork must remain at the existing 1600px derivative quality');",
  "if(!gallery.includes(\"const src=expanded?(item.media?.original?.url||item.image):artworkPreview(item,960)\"))failures.push('expanded artwork must load the exact uploaded original');\nif(!gallery.includes(\"const srcSet=expanded?'':artworkSrcSet(item)\"))failures.push('expanded artwork must disable derivative srcSet so browsers cannot down-select it');",
  'expanded quality safety invariant'
);
guard=replaceExact(
  guard,
  "console.log(`Egress safety gate passed: ${catalogue.items.length} artworks, ${publicItems.length} public, ${team.length} team members; 1600px expanded quality preserved; SEO uses derivatives; aggregate media budgets healthy.`);",
  "console.log(`Egress safety gate passed: ${catalogue.items.length} artworks, ${publicItems.length} public, ${team.length} team members; expanded artwork uses exact uploaded originals; SEO/listing traffic still uses derivatives; aggregate media budgets healthy.`);",
  'egress success message'
);
await writeFile(guardPath,guard);

console.log('Expanded artwork now uses exact uploaded originals; listing/crawler derivatives remain unchanged.');
