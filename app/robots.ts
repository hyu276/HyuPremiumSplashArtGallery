import type { MetadataRoute } from 'next';
import { getSeoGlobalSettings } from '@/lib/seo';

export default async function robots():Promise<MetadataRoute.Robots>{
  const seo=await getSeoGlobalSettings();
  const rules:NonNullable<MetadataRoute.Robots['rules']>=[
    {userAgent:'*',allow:'/',disallow:['/admin/','/admin.html','/api/seo-manager/']},
    ...Object.entries(seo.ai_crawlers||{}).map(([userAgent,allowed])=>allowed?{userAgent,allow:'/'}:{userAgent,disallow:'/'})
  ];
  return {rules,sitemap:[`${seo.site_url.replace(/\/$/,'')}/sitemap.xml`,`${seo.site_url.replace(/\/$/,'')}/image-sitemap.xml`],host:seo.site_url};
}
