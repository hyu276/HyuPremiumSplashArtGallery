const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://hyupremium.vercel.app').replace(/\/$/,'');
const SUPABASE_URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://zkrhwqgmynbbmoktokdq.supabase.co').replace(/\/$/,'');
const STORAGE_PREFIX='/storage/v1/object/public/artworks/';

export const egressSafeMode=(process.env.NEXT_PUBLIC_HYU_EGRESS_SAFE_MODE??'true').toLowerCase()!=='false';
export const supabaseUrl=SUPABASE_URL;

export function toAbsoluteSiteUrl(value:string){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^https?:\/\//i.test(raw))return raw;
  return new URL(raw.replace(/^\.\//,''),`${SITE_URL}/`).href;
}

export function publicMediaUrl(value:string){
  const absolute=toAbsoluteSiteUrl(value);
  if(!absolute)return '';
  try{
    const url=new URL(absolute);
    const supabase=new URL(SUPABASE_URL);
    if(url.origin!==supabase.origin||!url.pathname.startsWith(STORAGE_PREFIX))return absolute;
    const objectPath=url.pathname.slice(STORAGE_PREFIX.length).split('/').map(segment=>encodeURIComponent(decodeURIComponent(segment))).join('/');
    return `${SITE_URL}/media/${objectPath}`;
  }catch{return absolute;}
}

export function supabaseArtworkOrigin(objectPath:string){
  const clean=String(objectPath||'').split('/').filter(Boolean);
  if(!clean.length||clean.some(segment=>segment==='.'||segment==='..'||segment.includes('\\')))return null;
  if(!['uploads','thumbnails'].includes(clean[0]))return null;
  const encoded=clean.map(segment=>encodeURIComponent(decodeURIComponent(segment))).join('/');
  return `${SUPABASE_URL}${STORAGE_PREFIX}${encoded}`;
}
