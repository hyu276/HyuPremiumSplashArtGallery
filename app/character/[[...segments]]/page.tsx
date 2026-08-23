import type { Metadata } from 'next';
import GalleryClient from '@/components/GalleryClient';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { artworkPath, factualDescription, findArtwork, getCatalogue, siteUrl } from '@/lib/catalogue';

export const revalidate = 300;

type PageProps = { params: Promise<{ segments?: string[] }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments = [] } = await params;
  const catalogue = await getCatalogue();
  const { category, artwork } = findArtwork(catalogue.items, segments[0], segments[1]);
  if (artwork) {
    const url = `${siteUrl}${artworkPath(artwork)}`;
    const description = factualDescription(artwork);
    const title = `${artwork.name} — ${artwork.category} Splash Art`;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, type: 'article', images: [{ url: artwork.image, alt: `${artwork.name} — ${artwork.category} gaming splash art` }] },
      twitter: { card: 'summary_large_image', title, description, images: [artwork.image] }
    };
  }
  if (category) {
    const url = `${siteUrl}/character/${segments[0]}/`;
    const title = `${category} Splash Art Archive`;
    const description = `Browse ${category} gaming splash art in the HYU PREMIUM archive.`;
    return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: 'website' } };
  }
  return {
    title: 'HYU PREMIUM — Gaming Splash Art Archive',
    description: 'A curated searchable archive of gaming splash art organized by character/category, skin rank and image credit.',
    alternates: { canonical: `${siteUrl}/character/` }
  };
}

export default async function CharacterGalleryPage({ params }: PageProps) {
  const { segments = [] } = await params;
  const catalogue = await getCatalogue();
  const route = findArtwork(catalogue.items, segments[0], segments[1]);
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: route.category ? `${route.category} Splash Art Archive` : 'HYU PREMIUM Gaming Splash Art Archive',
    url: `${siteUrl}${route.category ? `/character/${segments[0]}/` : '/character/'}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: catalogue.items.length,
      itemListElement: catalogue.items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}${artworkPath(item)}`, name: item.name, image: item.image }))
    }
  };
  const artworkJsonLd = route.artwork ? {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', url: `${siteUrl}${artworkPath(route.artwork)}`, name: `${route.artwork.name} — ${route.artwork.category} Splash Art`, description: factualDescription(route.artwork), primaryImageOfPage: { '@id': `${siteUrl}${artworkPath(route.artwork)}#image` } },
      { '@type': 'ImageObject', '@id': `${siteUrl}${artworkPath(route.artwork)}#image`, contentUrl: route.artwork.image, thumbnailUrl: route.artwork.thumbnail, name: route.artwork.name, caption: `${route.artwork.name} — ${route.artwork.category} splash art`, creditText: route.artwork.credit, representativeOfPage: true }
    ]
  } : null;

  return <>
    <SiteHeader />
    <section className="hero" id="top">
      <div className="hero-kicker"><i></i> Owner-curated game art index</div>
      <h1>The art<br />of the <em>game.</em></h1>
      <div className="hero-foot"><p>A living archive ordered by category, then by its owner-defined skin tier system.</p><span>Scroll to explore ↓</span></div>
    </section>
    <GalleryClient catalogue={catalogue} initialCategory={route.category} initialArtworkId={route.artwork?.id || null} />
    <section className="crawl-links" aria-labelledby="crawl-title">
      <h2 id="crawl-title">Crawlable artwork directory</h2>
      <details><summary>Browse {catalogue.items.length} permanent artwork pages</summary><div className="crawl-grid">{catalogue.items.map(item => <a key={item.id} href={artworkPath(item)}>{item.category} — {item.name}</a>)}</div></details>
    </section>
    <section className="manifesto"><p className="eyebrow">HYU PREMIUM / ARCHIVE</p><h2>Every frame is<br />a world <em>waiting.</em></h2><div className="manifesto-copy"><p>An owner-managed splash-art archive designed around a strict 16:9 presentation and a deterministic category/rank order.</p><p>The catalogue is backed by Supabase while SEO routes render server-side.</p></div></section>
    <SiteFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, '\\u003c') }} />
    {artworkJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(artworkJsonLd).replace(/</g, '\\u003c') }} /> : null}
  </>;
}
