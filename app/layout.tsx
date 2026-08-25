import type { Metadata } from 'next';
import { getSeoGlobalSettings } from '@/lib/seo';
import './globals.css';
import './mobile-artwork-type.css';
import './mobile-gallery-filters.css';
import './motion.css';

export async function generateMetadata():Promise<Metadata>{
  const seo=await getSeoGlobalSettings();
  return {
    metadataBase:new URL(seo.site_url),
    title:{default:seo.default_title,template:seo.title_template},
    description:seo.default_description,
    robots:{index:true,follow:true},
    verification:{google:seo.google_site_verification||undefined},
    openGraph:{siteName:seo.site_name,type:'website',locale:seo.default_locale,...(seo.default_og_image?{images:[seo.default_og_image]}:{})},
    twitter:{card:'summary_large_image',...(seo.default_og_image?{images:[seo.default_og_image]}:{})},
    icons:{icon:'/assets/brand/hyu-industries-logo.png',apple:'/assets/brand/hyu-industries-logo.png'}
  };
}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="vi"><body>{children}</body></html>;
}
