import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
export const metadata:Metadata={title:'About us',description:'About HYU PREMIUM and its owner-curated gaming splash art archive.',alternates:{canonical:'https://hyupremium.vercel.app/about/'}};
export default function About(){return <div className="simple-page"><SiteHeader/><main className="simple-main"><p className="eyebrow">HYU PREMIUM / ABOUT</p><h1>About us.</h1><p>HYU PREMIUM is an owner-curated digital splash-art archive focused on searchable character collections, skin rankings, image credits and permanent artwork pages.</p><p>The archive is designed to keep each artwork discoverable while preserving a gallery-first browsing experience.</p></main><SiteFooter/></div>}
