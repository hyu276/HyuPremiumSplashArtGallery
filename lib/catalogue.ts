import { publicMediaUrl, toAbsoluteSiteUrl } from '@/lib/media';
import backendCatalogue from '@/data/backend/catalogue.json';

export type MediaVariant = {
  url: string;
  width: number;
  height: number;
  bytes?: number;
  mimeType?: string;
};

export type Artwork = {
  id: string;
  name: string;
  description: string;
  image: string;
  thumbnail: string;
  variants?: Record<string, MediaVariant>;
  media?: { original?: MediaVariant };
  tags: string[];
  category: string;
  rank: string;
  rankOrder: number;
  credit: string;
  isVietnameseSkin: boolean;
  updatedAt?: string;
};

export type Catalogue = {
  revision: string;
  items: Artwork[];
  categories: string[];
  ranks: string[];
  credits: string[];
};

type BackendCatalogue = {
  ready?: boolean;
  generatedAt?: string;
  items?: any[];
  categories?: string[];
  ranks?: string[];
  credits?: string[];
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hyupremium.vercel.app').replace(/\/$/, '');
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

export function absoluteImageUrl(value: string) { return toAbsoluteSiteUrl(value); }
const alpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort(alpha);
const localizeCredit = (value: string) => value.trim().toLowerCase() === 'uncredited' ? 'Chưa có credit' : value;

function normalizedVariant(value:any):MediaVariant|undefined{
  if(!value?.url)return undefined;
  return {url:publicMediaUrl(String(value.url)),width:Number(value.width)||0,height:Number(value.height)||0,bytes:Number(value.bytes)||undefined,mimeType:value.mimeType?String(value.mimeType):undefined};
}

function normalizedVariants(value:any){
  const result:Record<string,MediaVariant>={};
  if(!value||typeof value!=='object')return result;
  for(const [key,variant] of Object.entries(value)){const normalized=normalizedVariant(variant);if(normalized)result[String(key)]=normalized;}
  return result;
}

function authoritativeCatalogue(): Catalogue {
  const source = backendCatalogue as BackendCatalogue;
  if (source.ready !== true || !Array.isArray(source.items)) {
    throw new Error('GitHub backend catalogue is not ready. Revert the migration or restore data/backend/catalogue.json.');
  }
  const items: Artwork[] = source.items
    .filter(row => !row?.hidden)
    .map(row => {
      const variants=normalizedVariants(row.variants);
      const original=normalizedVariant(row.media?.original);
      return {
        id: String(row.id),
        name: String(row.name || 'Tác phẩm chưa đặt tên').trim(),
        description: String(row.description || '').trim(),
        image: publicMediaUrl(String(row.image || '')),
        thumbnail: publicMediaUrl(String(row.thumbnail || variants['1600']?.url || row.image || '')),
        variants,
        media: original?{original}:undefined,
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        category: String(row.category || 'Chưa phân loại'),
        rank: String(row.rank || 'Chưa xếp hạng'),
        rankOrder: Number(row.rankOrder) || 0,
        credit: localizeCredit(String(row.credit || 'Chưa có credit')),
        isVietnameseSkin: Boolean(row.isVietnameseSkin),
        updatedAt: row.updatedAt || undefined
      };
    })
    .sort((a,b)=>alpha(a.category,b.category)||a.rankOrder-b.rankOrder||alpha(a.name,b.name));

  return {
    revision: String(source.generatedAt || ''),
    items,
    categories: uniqueSorted((source.categories || []).map(String)),
    ranks: (source.ranks || []).map(String),
    credits: uniqueSorted((source.credits || []).map(value=>localizeCredit(String(value))))
  };
}

export async function getCatalogue(): Promise<Catalogue> { return authoritativeCatalogue(); }

export function artworkVariant(item:Artwork,width:640|960|1600){return item.variants?.[String(width)];}
export function artworkPreview(item:Artwork,width:640|960|1600=1600){return artworkVariant(item,width)?.url||item.thumbnail||item.image;}
export function artworkSrcSet(item:Artwork){return ([640,960,1600] as const).map(width=>artworkVariant(item,width)).filter((variant):variant is MediaVariant=>Boolean(variant?.url&&variant.width)).map(variant=>`${variant.url} ${variant.width}w`).join(', ');}
export function artworkSocialImage(item:Artwork){return artworkPreview(item,1600);}

export function findArtwork(items: Artwork[], categorySlug?: string, artworkSlug?: string) {
  if (!categorySlug) return { category: null as string | null, artwork: null as Artwork | null };
  const category=items.find(item=>slug(item.category)===categorySlug)?.category||null;
  if(!category||!artworkSlug)return{category,artwork:null as Artwork|null};
  const artwork=items.find(item=>item.category===category&&slug(item.name||item.id)===artworkSlug)||null;
  return{category,artwork};
}

export function artworkPath(item: Artwork) { return `/character/${slug(item.category)}/${slug(item.name || item.id)}/`; }
export function factualDescription(item: Artwork) { return item.description || `${item.name} là splash art của ${item.category} trong thư viện HYU PREMIUM. Hạng skin: ${item.rank}. Credit ảnh: ${item.credit}.`; }
