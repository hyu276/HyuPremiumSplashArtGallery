import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CatalogueFreshnessGuard from '@/components/CatalogueFreshnessGuard';
import ChampionSkinsClient from '@/components/ChampionSkinsClient';
import { SiteHeader } from '@/components/SiteChrome';
import { championCardImage, getCatalogue, siteUrl, slug } from '@/lib/catalogue';
import '../champions.css';
import '../champions-sort.css';

export const revalidate = 300;

type SortMode = 'az' | 'skins';
type SearchParams = { sort?: string | string[] };
type PageProps = {
  params: Promise<{ segments?: string[] }>;
  searchParams?: Promise<SearchParams>;
};

function canonical(path: string) {
  const url = `${siteUrl}${path}`;
  return { canonical: url, languages: { vi: url, 'x-default': url } };
}

function alpha(a: string, b: string) {
  return a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true });
}

function readSortMode(value: string | string[] | undefined): SortMode {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved === 'skins' ? 'skins' : 'az';
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

export default async function ChampionsPage({ params, searchParams }: PageProps) {
  const { segments = [] } = await params;
  if (segments.length > 1) notFound();

  const catalogue = await getCatalogue();
  const skinCounts = new Map<string, number>();
  for (const item of catalogue.items) {
    skinCounts.set(item.category, (skinCounts.get(item.category) || 0) + 1);
  }
  const categories = catalogue.categories.filter(category => (skinCounts.get(category) || 0) > 0);
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

  const query = await searchParams;
  const sortMode = readSortMode(query?.sort);
  const sortedCategories = [...categories].sort((a, b) => {
    if (sortMode === 'skins') {
      const countDifference = (skinCounts.get(b) || 0) - (skinCounts.get(a) || 0);
      if (countDifference !== 0) return countDifference;
    }
    return alpha(a, b);
  });

  return <>
    <SiteHeader />
    <CatalogueFreshnessGuard revision={catalogue.revision} />
    <main className="champions-page champions-index-page">
      <section className="champions-index" aria-labelledby="champions-heading">
        <p className="champions-kicker">Character catalogue</p>
        <h1 id="champions-heading">Tướng</h1>
        <p className="champions-copy">Chọn một nhân vật để xem toàn bộ trang phục hiện có trong thư viện HYU PREMIUM.</p>
        <nav className="champions-sortbar" aria-label="Sắp xếp danh sách tướng">
          <span className="champions-sort-label">Sắp xếp</span>
          <Link
            className={`champions-sort-option${sortMode === 'az' ? ' is-active' : ''}`}
            href="/champions/?sort=az"
            prefetch={false}
            aria-current={sortMode === 'az' ? 'page' : undefined}
          >A → Z</Link>
          <Link
            className={`champions-sort-option${sortMode === 'skins' ? ' is-active' : ''}`}
            href="/champions/?sort=skins"
            prefetch={false}
            aria-current={sortMode === 'skins' ? 'page' : undefined}
          >Nhiều trang phục nhất</Link>
        </nav>
        <div className="champions-grid">
          {sortedCategories.map((category, index) => {
            const itemCount = skinCounts.get(category) || 0;
            const cardImage = championCardImage(catalogue, category);
            if (!cardImage) return null;
            return <Link key={category} className="champion-card" href={`/champions/${slug(category)}/`} prefetch={false}>
              <span className="champion-card-media">
                <img
                  src={cardImage}
                  alt={`${category} — nhân vật trong HYU PREMIUM`}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={index === 0 ? 'high' : 'low'}
                />
              </span>
              <strong>{category}</strong>
              <span>{itemCount} trang phục</span>
            </Link>;
          })}
        </div>
      </section>
    </main>
  </>;
}
