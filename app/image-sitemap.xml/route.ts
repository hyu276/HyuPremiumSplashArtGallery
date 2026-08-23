import { artworkPath, getCatalogue, siteUrl } from '@/lib/catalogue';
import { getSeoOverrides } from '@/lib/seo';

const XML_ENTITIES:Record<string,string>={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'};
const xml=(value:string)=>String(value).replace(/[<>&"']/g,ch=>XML_ENTITIES[ch]||ch);

export async function GET(){
  const [{items},overrides]=await Promise.all([getCatalogue(),getSeoOverrides()]);const map=new Map(overrides.map(x=>[x.path,x]));
  const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${items.map(item=>{const path=artworkPath(item),override=map.get(path);if(override?.include_in_sitemap===false)return '';const loc=override?.canonical_url||`${siteUrl}${path}`,image=override?.og_image||item.image,title=override?.title||item.name,caption=override?.image_alt||`${item.name} — ${item.category} gaming splash art`;return `\n<url><loc>${xml(loc)}</loc><image:image><image:loc>${xml(image)}</image:loc><image:title>${xml(title)}</image:title><image:caption>${xml(caption)}</image:caption></image:image></url>`}).join('')}\n</urlset>`;
  return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=0, s-maxage=3600'}});
}
