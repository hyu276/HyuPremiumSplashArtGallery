import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CatalogueFreshnessGuard from '@/components/CatalogueFreshnessGuard';
import ChampionSkinsClient from '@/components/ChampionSkinsClient';
import { SiteHeader } from '@/components/SiteChrome';
import { artworkPreview, getCatalogue, siteUrl, slug } from '@/lib/catalogue';
import '../champions.css';

export const revalidate = 300;

type PageProps = { params: Promise<{ segments?: string[] }> };

function canonical(path: string) {
  const url = `${siteUrl}${path}`;
  return { canonical: url, languages: { vi: url, 'x-default': url } };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments = [] } = await params;
  const catalogue = await getCatalogue();
  if (segments.length > 1) return {};

  if (!segments[0]) {
    const path = '/champions/';
    const title = 'Tướng — HYU PREMIUM';
    const description = 'Khám phá tất cả nhân vật có splash art trong HYU PREMIUM và xem toàn bộ trang phục hiện có của từng tướng.';
    return { title, description, alternates: canonical(path), openGraph: { title, description, url: `${siteUrl}${path}`, type: 'website', locale: 'vi_VN' } };
  }

  const category = catalogue.categories.find(value => slug(value) === segments[0]);
  if (!category) return {};
  const path = `/champions/${slug(category)}/`;
  const title = `${category} — Trang phục hiện có`;
  const description = `Xem toàn bộ splash art và trang phục hiện có của ${category} trong HYU PREMIUM.`;
  return { title, description, alternates: canonical(path), openGraph: { title, description, url: `${siteUrl}${path}`, type: 'website', locale: 'vi_VN' } };
}

export default async function ChampionsPage({ params }: PageProps) {
  const { segments = [] } = await params;
  if (segments.length > 1) notFound();

  const catalogue = await getCatalogue();
  const categories = catalogue.categories.filter(category => catalogue.items.some(item => item.category === category));
  const requestedCategory = segments[0] ? categories.find(category => slug(category) === segments[0]) : null;
  if (segments[0] && !requestedCategory) notFound();

  if (requestedCategory) {
    const items = catalogue.items.filter(item => item.category === requestedCategory);
    return <>
      <SiteHeader />
      <CatalogueFreshnessGuard revision={catalogue.revision} />
      <main className="champions-page champions-detail-page">
        <ChampionSkinsClient category={requestedCategory} items={items} />
      </main>
    </>;
  }

  return <>
    <SiteHeader />
    <CatalogueFreshnessGuard revision={catalogue.revision} />
    <main className="champions-page champions-index-page">
      <section className="champions-index" aria-labelledby="champions-heading">
        <p className="champions-kicker">Character catalogue</p>
        <h1 id="champions-heading">Tướng</h1>
        <p className="champions-copy">Chọn một nhân vật để xem toàn bộ trang phục hiện có trong thư viện HYU PREMIUM.</p>
        <div className="champions-grid">
          {categories.map((category, index) => {
            const items = catalogue.items.filter(item => item.category === category);
            const representative = items[0];
            if (!representative) return null;
            return <Link key={category} className="champion-card" href={`/champions/${slug(category)}/`} prefetch={false}>
              <span className="champion-card-media">
                <img
                  src={artworkPreview(representative, 640)}
                  alt={`${category} — nhân vật trong HYU PREMIUM`}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={index === 0 ? 'high' : 'low'}
                />
              </span>
              <strong>{category}</strong>
              <span>{items.length} trang phục</span>
            </Link>;
          })}
        </div>
      </section>
    </main>
  </>;
}
