import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { metadataForPath } from '@/lib/seo';
export async function generateMetadata():Promise<Metadata>{return metadataForPath('/news/',{title:'Tin tức',description:'Tin tức và cập nhật mới từ thư viện splash art game HYU PREMIUM.',alternates:{canonical:'https://hyupremium.vercel.app/news/'}})}
export default function News(){return <div className="simple-page"><SiteHeader/><main className="simple-main"><p className="eyebrow">HYU PREMIUM / TIN TỨC</p><h1>Tin tức.</h1><p>Các cập nhật về thư viện, thay đổi bộ sưu tập và thông báo tính năng mới sẽ được đăng tại đây.</p></main><SiteFooter/></div>}
