export type Artwork = {
  id: string;
  name: string;
  description: string;
  image: string;
  thumbnail: string;
  tags: string[];
  category: string;
  rank: string;
  rankOrder: number;
  credit: string;
  isVietnameseSkin: boolean;
  updatedAt?: string;
};

export type Catalogue = {
  items: Artwork[];
  categories: string[];
  ranks: string[];
  credits: string[];
};

type CatalogueSource = {
  id: 'owner' | 'huy9vnd';
  url: string;
  key: string;
};

type SourceCatalogue = {
  items: Artwork[];
  categories: string[];
  ranks: { name: string; sortOrder: number }[];
  credits: string[];
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');
const OWNER_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkrhwqgmynbbmoktokdq.supabase.co';
const OWNER_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq';
const HUY_SUPABASE_URL = process.env.NEXT_PUBLIC_HUY9VND_SUPABASE_URL || 'https://unggkruzjmsjscdiukfr.supabase.co';
const HUY_SUPABASE_KEY = process.env.NEXT_PUBLIC_HUY9VND_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UQXSQcKH_81clodAPnceYg_1UUYz7bc';

const CATALOGUE_SOURCES: CatalogueSource[] = [
  { id: 'owner', url: OWNER_SUPABASE_URL, key: OWNER_SUPABASE_KEY },
  { id: 'huy9vnd', url: HUY_SUPABASE_URL, key: HUY_SUPABASE_KEY }
];

export const siteUrl = SITE_URL;

export function slug(value: string) {
  return String(value ?? '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function absoluteImageUrl(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return new URL(raw.replace(/^\.\//, ''), `${SITE_URL}/`).href;
}

const alpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort(alpha);

async function rest<T>(source: CatalogueSource, path: string): Promise<T> {
  const response = await fetch(`${source.url}/rest/v1/${path}`, {
    headers: { apikey: source.key, Authorization: `Bearer ${source.key}` },
    next: { revalidate: 300, tags: ['catalogue'] }
  });
  if (!response.ok) throw new Error(`${source.id} Supabase REST ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function loadSource(source: CatalogueSource): Promise<SourceCatalogue> {
  const select = 'id,name,description,image,thumbnail,tags,hidden,updated_at,is_vietnamese_skin,category:categories(name),rank:ranks(name,sort_order),credit:image_credits(name)';
  const [rows, categories, ranks, credits] = await Promise.all([
    rest<any[]>(source, `artworks?select=${encodeURIComponent(select)}&hidden=eq.false`),
    rest<any[]>(source, 'categories?select=name&order=name.asc'),
    rest<any[]>(source, 'ranks?select=name,sort_order&order=sort_order.asc'),
    rest<any[]>(source, 'image_credits?select=name&order=name.asc')
  ]);

  return {
    items: rows.map(row => ({
      id: source.id === 'owner' ? String(row.id) : `${source.id}:${String(row.id)}`,
      name: String(row.name || 'Untitled artwork').trim(),
      description: String(row.description || '').trim(),
      image: absoluteImageUrl(row.image),
      thumbnail: absoluteImageUrl(row.thumbnail || row.image),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      category: String(row.category?.name || 'Uncategorized'),
      rank: String(row.rank?.name || 'Unranked'),
      rankOrder: Number(row.rank?.sort_order) || 0,
      credit: String(row.credit?.name || 'Uncredited'),
      isVietnameseSkin: Boolean(row.is_vietnamese_skin),
      updatedAt: row.updated_at || undefined
    })),
    categories: categories.map(x => String(x.name)),
    ranks: ranks.map(x => ({ name: String(x.name), sortOrder: Number(x.sort_order) || 0 })),
    credits: credits.map(x => String(x.name))
  };
}

export async function getCatalogue(): Promise<Catalogue> {
  const settled = await Promise.allSettled(CATALOGUE_SOURCES.map(loadSource));
  const loaded = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  if (!loaded.length) {
    const reasons = settled.flatMap(result => result.status === 'rejected' ? [String(result.reason)] : []);
    throw new Error(`Unable to load any Supabase catalogue source. ${reasons.join(' | ')}`);
  }

  const items = loaded
    .flatMap(source => source.items)
    .sort((a, b) => alpha(a.category, b.category) || a.rankOrder - b.rankOrder || alpha(a.name, b.name));

  const rankOrder = new Map<string, number>();
  for (const source of loaded) {
    for (const rank of source.ranks) {
      const current = rankOrder.get(rank.name);
      if (current === undefined || rank.sortOrder < current) rankOrder.set(rank.name, rank.sortOrder);
    }
  }

  return {
    items,
    categories: uniqueSorted(loaded.flatMap(source => source.categories)),
    ranks: [...rankOrder.entries()].sort((a, b) => a[1] - b[1] || alpha(a[0], b[0])).map(([name]) => name),
    credits: uniqueSorted(loaded.flatMap(source => source.credits))
  };
}

export function findArtwork(items: Artwork[], categorySlug?: string, artworkSlug?: string) {
  if (!categorySlug) return { category: null as string | null, artwork: null as Artwork | null };
  const category = items.find(item => slug(item.category) === categorySlug)?.category || null;
  if (!category || !artworkSlug) return { category, artwork: null };
  const artwork = items.find(item => item.category === category && slug(item.name || item.id) === artworkSlug) || null;
  return { category, artwork };
}

export function artworkPath(item: Artwork) {
  return `/character/${slug(item.category)}/${slug(item.name || item.id)}/`;
}

export function factualDescription(item: Artwork) {
  return item.description || `${item.name} is a ${item.category} gaming splash artwork in the HYU PREMIUM archive. Skin rank: ${item.rank}. Image credit: ${item.credit}.`;
}
