const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://hyupremium.vercel.app').replace(/\/$/,'');
export const MEDIA_BASE_URL=(process.env.NEXT_PUBLIC_MEDIA_BASE_URL||'https://hyu-premium-media.csquocnguyen.workers.dev').replace(/\/$/,'');

export function toAbsoluteSiteUrl(value:string){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^https?:\/\//i.test(raw))return raw;
  return new URL(raw.replace(/^\.\//,''),`${SITE_URL}/`).href;
}

export function publicMediaUrl(value:string){
  return toAbsoluteSiteUrl(value);
}

function encodePath(value:string){
  return String(value||'')
    .split('/')
    .filter(Boolean)
    .map(segment=>encodeURIComponent(decodeURIComponent(segment)))
    .join('/');
}

export function legacyMediaRedirectUrl(segments:string[]){
  const [sourceId,...objectSegments]=segments||[];
  if(!sourceId||!['owner','huy9vnd'].includes(sourceId))return '';
  const clean=objectSegments.map(segment=>decodeURIComponent(segment)).filter(Boolean);
  if(!clean.length||clean.some(segment=>segment==='.'||segment==='..'||segment.includes('\\')))return '';
  if(!['uploads','thumbnails'].includes(clean[0]))return '';
  return `${MEDIA_BASE_URL}/media/legacy/${encodeURIComponent(sourceId)}/artworks/${encodePath(clean.join('/'))}`;
}

export function isManagedMediaUrl(value:string){
  try{return new URL(value).origin===new URL(MEDIA_BASE_URL).origin}catch{return false}
}
