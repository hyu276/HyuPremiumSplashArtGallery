import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/catalogue';

export default function robots():MetadataRoute.Robots{
  return {
    rules:[{userAgent:'*',allow:'/',disallow:['/admin/','/admin.html']}],
    sitemap:[`${siteUrl}/sitemap.xml`,`${siteUrl}/image-sitemap.xml`],
    host:siteUrl
  };
}
