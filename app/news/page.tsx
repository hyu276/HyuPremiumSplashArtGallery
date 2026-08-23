import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { metadataForPath } from '@/lib/seo';
export async function generateMetadata():Promise<Metadata>{return metadataForPath('/news/',{title:'News',description:'News and updates from the HYU PREMIUM gaming splash art archive.',alternates:{canonical:'https://hyupremium.vercel.app/news/'}})}
export default function News(){return <div className="simple-page"><SiteHeader/><main className="simple-main"><p className="eyebrow">HYU PREMIUM / NEWS</p><h1>News.</h1><p>Archive updates, collection changes and future feature announcements will appear here.</p></main><SiteFooter/></div>}
