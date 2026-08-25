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

export function isManagedMediaUrl(value:string){
  try{return new URL(value).origin===new URL(MEDIA_BASE_URL).origin}catch{return false}
}
