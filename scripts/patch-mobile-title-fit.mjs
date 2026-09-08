import { readFile, writeFile } from 'node:fs/promises';

function mustReplace(text,from,to,label){
  if(!text.includes(from))throw new Error(`Missing patch target: ${label}`);
  return text.replace(from,to);
}

const galleryPath='components/GalleryClient.tsx';
let gallery=await readFile(galleryPath,'utf8');
gallery=mustReplace(
  gallery,
  "function shuffledIds(items:Artwork[]){",
  "function titleFitBucket(value:string){const length=Array.from(String(value||'').trim()).length;return length>=52?'xxlong':length>=38?'xlong':length>=28?'long':length>=19?'medium':'short'}\n\nfunction shuffledIds(items:Artwork[]){",
  'title fit helper'
);
gallery=mustReplace(
  gallery,
  "<span className=\"card-copy\"><span className=\"card-meta\">{item.category}</span><strong>{item.name}</strong>{item.description?",
  "<span className=\"card-copy\"><span className=\"card-meta\">{item.category}</span><strong className=\"card-title\" data-title-fit={titleFitBucket(item.name)}>{item.name}</strong>{item.description?",
  'card title markup'
);
await writeFile(galleryPath,gallery);

const cssPath='app/globals.css';
let css=await readFile(cssPath,'utf8');
css=mustReplace(
  css,
  ".card-copy strong{font-size:clamp(1.15rem,1.65vw,2rem);line-height:.95;letter-spacing:-.045em;text-transform:uppercase}",
  ".card-copy strong{font-size:clamp(1.15rem,1.65vw,2rem);line-height:.95;letter-spacing:-.045em;text-transform:uppercase}.card-title{max-width:100%;min-width:0;transition:none!important;animation:none!important;transform:none!important}",
  'base card title rule'
);
css=mustReplace(
  css,
  ".art-card:not(.expanded) .card-copy strong{font-size:clamp(.72rem,2.5vw,1rem);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-bottom",
  ".art-card:not(.expanded) .card-copy strong{font-size:clamp(.72rem,2.5vw,1rem);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.art-card:not(.expanded) .card-title[data-title-fit=medium]{font-size:clamp(.66rem,2.25vw,.88rem)}.art-card:not(.expanded) .card-title[data-title-fit=long]{font-size:clamp(.59rem,2.02vw,.78rem);white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;line-height:.92;text-overflow:clip}.art-card:not(.expanded) .card-title[data-title-fit=xlong]{font-size:clamp(.53rem,1.82vw,.70rem);white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;line-height:.91;text-overflow:clip}.art-card:not(.expanded) .card-title[data-title-fit=xxlong]{font-size:clamp(.47rem,1.62vw,.62rem);white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;line-height:.90;letter-spacing:-.055em;text-overflow:clip}.card-bottom",
  'mobile thumbnail title rules'
);
css=mustReplace(
  css,
  ".art-card.expanded .card-copy strong{font-size:clamp(1.2rem,7vw,2.5rem);white-space:nowrap}.art-card.expanded .card-bottom",
  ".art-card.expanded .card-copy strong{font-size:clamp(1.2rem,7vw,2.5rem);white-space:nowrap;overflow:hidden;text-overflow:clip}.art-card.expanded .card-title[data-title-fit=medium]{font-size:clamp(1.08rem,5.8vw,2.1rem)}.art-card.expanded .card-title[data-title-fit=long]{font-size:clamp(.96rem,4.8vw,1.8rem)}.art-card.expanded .card-title[data-title-fit=xlong]{font-size:clamp(.84rem,4vw,1.55rem);white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;line-height:.92}.art-card.expanded .card-title[data-title-fit=xxlong]{font-size:clamp(.74rem,3.45vw,1.32rem);white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;line-height:.90;letter-spacing:-.055em}.art-card.expanded .card-bottom",
  'mobile expanded title rules'
);
await writeFile(cssPath,css);

const guardPath='scripts/assert-egress-safety.mjs';
let guard=await readFile(guardPath,'utf8');
const marker="if(!gallery.includes('srcSet='))failures.push('gallery must use responsive image srcSet');";
if(!guard.includes(marker))throw new Error('Missing egress guard marker');
guard=guard.replace(marker,marker+"\nif(!gallery.includes(\"const previewSrc=artworkPreview(item,960)\"))failures.push('mobile title changes must not alter listing media resolution');\nif(!gallery.includes(\"const originalSrc=item.media?.original?.url||item.image\"))failures.push('mobile title changes must not alter exact-original expanded media');\nif(!gallery.includes('data-title-fit={titleFitBucket(item.name)}'))failures.push('gallery titles must use deterministic length buckets');\nif(gallery.includes('ResizeObserver'))failures.push('title fitting must not use ResizeObserver or frame-by-frame font measurement');");
await writeFile(guardPath,guard);

console.log('Mobile adaptive title fitting applied without changing media requests.');
