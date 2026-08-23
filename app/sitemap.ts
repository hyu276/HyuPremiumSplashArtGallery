import type { MetadataRoute } from 'next';
import { artworkPath, getCatalogue, siteUrl, slug } from '@/lib/catalogue';
import { getSeoOverrides } from '@/lib/seo';

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const [{items,categories},overrides]=await Promise.all([getCatalogue(),getSeoOverrides()]);const now=new Date();const map=new Map(overrides.map(x=>[x.path,x]));const include=(path:string)=>map.get(path)?.include_in_sitemap!==false;
  const rows:MetadataRoute.Sitemap=[];
  const core=[['/character/','daily',1],['/artworks/','daily',.9],['/about/','monthly',.5],['/news/','weekly',.5],['/blog/','weekly',.5]] as const;
  for(const [path,changeFrequency,priority] of core)if(include(path))rows.push({url:`${siteUrl}${path}`,lastModified:now,changeFrequency,priority});
  for(const category of categories){const path=`/character/${slug(category)}/`;if(include(path))rows.push({url:`${siteUrl}${path}`,lastModified:now,changeFrequency:'daily',priority:.8})}
  for(const item of items){const path=artworkPath(item),override=map.get(path);if(include(path))rows.push({url:override?.canonical_url||`${siteUrl}${path}`,lastModified:item.updatedAt?new Date(item.updatedAt):now,changeFrequency:'weekly',priority:.85,images:[override?.og_image||item.image]})}
  return rows;
}
