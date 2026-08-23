import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
export const metadata:Metadata={title:'Blog',description:'Editorial notes from the HYU PREMIUM gaming splash art archive.',alternates:{canonical:'https://hyupremium.vercel.app/blog/'}};
export default function Blog(){return <div className="simple-page"><SiteHeader/><main className="simple-main"><p className="eyebrow">HYU PREMIUM / BLOG</p><h1>Blog.</h1><p>Long-form notes about the archive, artwork curation and digital splash-art presentation will appear here.</p></main><SiteFooter/></div>}
