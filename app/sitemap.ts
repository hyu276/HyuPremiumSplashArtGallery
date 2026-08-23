import type { MetadataRoute } from 'next';
import { artworkPath, getCatalogue, siteUrl, slug } from '@/lib/catalogue';

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const {items,categories}=await getCatalogue();
  const now=new Date();
  return [
    {url:`${siteUrl}/character/`,lastModified:now,changeFrequency:'daily',priority:1},
    {url:`${siteUrl}/artworks/`,lastModified:now,changeFrequency:'daily',priority:.9},
    {url:`${siteUrl}/about/`,lastModified:now,changeFrequency:'monthly',priority:.5},
    {url:`${siteUrl}/news/`,lastModified:now,changeFrequency:'weekly',priority:.5},
    {url:`${siteUrl}/blog/`,lastModified:now,changeFrequency:'weekly',priority:.5},
    ...categories.map(category=>({url:`${siteUrl}/character/${slug(category)}/`,lastModified:now,changeFrequency:'daily' as const,priority:.8})),
    ...items.map(item=>({url:`${siteUrl}${artworkPath(item)}`,lastModified:item.updatedAt?new Date(item.updatedAt):now,changeFrequency:'weekly' as const,priority:.85,images:[item.image]}))
  ];
}
