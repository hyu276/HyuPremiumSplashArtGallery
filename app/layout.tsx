import type { Metadata } from 'next';
import { Noto_Serif, Roboto } from 'next/font/google';
import { getSeoGlobalSettings } from '@/lib/seo';
import ArtworkTitleFitter from '@/components/ArtworkTitleFitter';
import './globals.css';
import '../assets/css/typography.css';
import '../assets/css/desktop-gallery.css';
import './mobile-artwork-type.css';
import './mobile-gallery-filters.css';
import './motion.css';
import './title-fit-motion-compat.css';

const hyuSans = Roboto({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-hyu-sans'
});

const hyuSerif = Noto_Serif({
  subsets: ['latin', 'vietnamese'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-hyu-serif'
});

export async function generateMetadata():Promise<Metadata>{
  const seo=await getSeoGlobalSettings();
  return {
    metadataBase:new URL(seo.site_url),
    applicationName:seo.site_name,
    title:{default:seo.default_title,template:seo.title_template},
    description:seo.default_description,
    robots:{index:true,follow:true},
    verification:{google:seo.google_site_verification||undefined},
    openGraph:{siteName:seo.site_name,type:'website',locale:seo.default_locale,...(seo.default_og_image?{images:[seo.default_og_image]}:{})},
    twitter:{card:'summary_large_image',...(seo.default_og_image?{images:[seo.default_og_image]}:{})},
    icons:{icon:[{url:'/icon.svg',type:'image/svg+xml'}],apple:'/icon.svg'},
    appleWebApp:{title:seo.site_name,statusBarStyle:'black-translucent'}
  };
}

export default async function RootLayout({children}:{children:React.ReactNode}){
  const seo=await getSeoGlobalSettings();
  const baseUrl=seo.site_url.replace(/\/$/,'');
  const websiteJsonLd={
    '@context':'https://schema.org',
    '@type':'WebSite',
    '@id':`${baseUrl}/#website`,
    url:`${baseUrl}/`,
    name:seo.site_name,
    alternateName:['HYU PREMIUM','Hyu Premium AOV Gallery'],
    inLanguage:'vi-VN'
  };
  return <html lang="vi" className={`${hyuSans.variable} ${hyuSerif.variable}`}><body>{children}<ArtworkTitleFitter/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(websiteJsonLd).replace(/</g,'\\u003c')}}/></body></html>;
}
