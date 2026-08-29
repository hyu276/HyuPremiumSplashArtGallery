'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/character/', label: 'Thư viện', matches: ['/character', '/artworks'] },
  { href: '/about/', label: 'Giới thiệu', matches: ['/about'] },
  { href: '/news/', label: 'Tin tức', matches: ['/news'] },
  { href: '/blog/', label: 'Bài viết', matches: ['/blog'] }
] as const;

function isActivePath(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(prefix => pathname === prefix || pathname === `${prefix}/` || pathname.startsWith(`${prefix}/`));
}

export function SiteHeader() {
  const pathname = usePathname() || '/';

  return <header className="site-header">
    <Link className="wordmark" href="/character/" aria-label="Trang chủ HYU PREMIUM">
      <img className="brand-mark" src="/icon.svg" width="64" height="64" alt="" aria-hidden="true" decoding="async" />
      HYU <span>PREMIUM</span>
    </Link>
    <nav aria-label="Điều hướng chính">
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
    <span>Kho splash art được tuyển chọn và quản lý bởi chủ sở hữu</span>
    <div className="footer-links"><Link href="/character/">Thư viện</Link><Link href="/artworks/">Danh mục tác phẩm</Link><a href="#top">Lên đầu trang ↑</a></div>
  </footer>;
}
