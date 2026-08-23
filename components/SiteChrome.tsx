import Link from 'next/link';

export function SiteHeader() {
  return <header className="site-header">
    <Link className="wordmark" href="/character/" aria-label="HYU PREMIUM home">
      <img className="brand-mark" src="/assets/brand/hyu-industries-logo.png" alt="" aria-hidden="true" />
      HYU <span>PREMIUM</span>
    </Link>
    <nav aria-label="Main navigation">
      <Link className="active" href="/character/">Gallery</Link>
      <Link href="/about/">About us</Link>
      <Link href="/news/">News</Link>
      <Link href="/blog/">Blog</Link>
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
