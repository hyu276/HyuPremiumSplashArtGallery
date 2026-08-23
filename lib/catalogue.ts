import { egressSafeMode, publicMediaUrl, supabaseUrl, toAbsoluteSiteUrl } from '@/lib/media';

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

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq';

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
  return toAbsoluteSiteUrl(value);
}

const alpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    next: { revalidate: 300, tags: ['catalogue'] }
  });
  if (!response.ok) throw new Error(`Supabase REST ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function getCatalogue(): Promise<Catalogue> {
  const select = 'id,name,description,image,thumbnail,tags,hidden,updated_at,is_vietnamese_skin,category:categories(name),rank:ranks(name,sort_order),credit:image_credits(name)';
  const [rows, categories, ranks, credits] = await Promise.all([
    rest<any[]>(`artworks?select=${encodeURIComponent(select)}&hidden=eq.false`),
    rest<any[]>('categories?select=name&order=name.asc'),
    rest<any[]>('ranks?select=name,sort_order&order=sort_order.asc'),
    rest<any[]>('image_credits?select=name&order=name.asc')
  ]);

  const items: Artwork[] = rows.map(row => {
    const original=publicMediaUrl(row.image);
    const thumbnail=publicMediaUrl(row.thumbnail || row.image);
    return {
      id: String(row.id),
      name: String(row.name || 'Untitled artwork').trim(),
      description: String(row.description || '').trim(),
      image: egressSafeMode ? thumbnail : original,
      thumbnail,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      category: String(row.category?.name || 'Uncategorized'),
      rank: String(row.rank?.name || 'Unranked'),
      rankOrder: Number(row.rank?.sort_order) || 0,
      credit: String(row.credit?.name || 'Uncredited'),
      isVietnameseSkin: Boolean(row.is_vietnamese_skin),
      updatedAt: row.updated_at || undefined
    };
  }).sort((a, b) => alpha(a.category, b.category) || a.rankOrder - b.rankOrder || alpha(a.name, b.name));

  return {
    items,
    categories: categories.map(x => String(x.name)),
    ranks: ranks.map(x => String(x.name)),
    credits: credits.map(x => String(x.name))
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
