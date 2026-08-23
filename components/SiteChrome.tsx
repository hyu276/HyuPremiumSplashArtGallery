'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/character/', label: 'Gallery', matches: ['/character', '/artworks'] },
  { href: '/about/', label: 'About us', matches: ['/about'] },
  { href: '/news/', label: 'News', matches: ['/news'] },
  { href: '/blog/', label: 'Blog', matches: ['/blog'] }
] as const;

function isActivePath(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(prefix => pathname === prefix || pathname === `${prefix}/` || pathname.startsWith(`${prefix}/`));
}

export function SiteHeader() {
  const pathname = usePathname() || '/';

  return <header className="site-header">
    <Link className="wordmark" href="/character/" aria-label="HYU PREMIUM home">
      <img className="brand-mark" src="/assets/brand/hyu-industries-logo.png" alt="" aria-hidden="true" />
      HYU <span>PREMIUM</span>
    </Link>
    <nav aria-label="Main navigation">
      {NAV_ITEMS.map(item => {
        const active = isActivePath(pathname, item.matches);
        return <Link
          key={item.href}
          className={active ? 'active' : undefined}
          href={item.href}
          aria-current={active ? 'page' : undefined}
        >{item.label}</Link>;
      })}
    </nav>
  </header>;
}

export function SiteFooter() {
  return <footer>
    <Link className="wordmark" href="/character/">HYU <span>PREMIUM</span></Link>
    <span>Owner-curated digital splash archive</span>
    <div className="footer-links"><Link href="/character/">Character</Link><Link href="/artworks/">Artwork Index</Link><a href="#top">Back to top ↑</a></div>
  </footer>;
}
