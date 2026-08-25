import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { metadataForPath } from '@/lib/seo';
export async function generateMetadata():Promise<Metadata>{return metadataForPath('/blog/',{title:'Bài viết',description:'Các bài viết chuyên sâu về thư viện, tuyển chọn artwork và cách trình bày splash art kỹ thuật số tại HYU PREMIUM.',alternates:{canonical:'https://hyupremium.vercel.app/blog/'}})}
export default function Blog(){return <div className="simple-page"><SiteHeader/><main className="simple-main"><p className="eyebrow">HYU PREMIUM / BÀI VIẾT</p><h1>Bài viết.</h1><p>Các bài viết dài về bộ sưu tập, quá trình tuyển chọn artwork và cách trình bày splash art kỹ thuật số sẽ được đăng tại đây.</p></main><SiteFooter/></div>}
