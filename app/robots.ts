import type { MetadataRoute } from 'next';
import { getSeoGlobalSettings } from '@/lib/seo';

export default async function robots():Promise<MetadataRoute.Robots>{
  const seo=await getSeoGlobalSettings();
  const base={userAgent:'*',allow:'/',disallow:['/admin/','/admin.html','/api/seo-manager/']} as const;
  const aiRules=Object.entries(seo.ai_crawlers||{}).map(([userAgent,allowed])=>({userAgent,allow:allowed?'/':undefined,disallow:allowed?undefined:'/'}));
  return {rules:[base,...aiRules],sitemap:[`${seo.site_url.replace(/\/$/,'')}/sitemap.xml`,`${seo.site_url.replace(/\/$/,'')}/image-sitemap.xml`],host:seo.site_url};
}
