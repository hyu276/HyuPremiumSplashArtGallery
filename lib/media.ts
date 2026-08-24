const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://hyupremium.vercel.app').replace(/\/$/,'');
const STORAGE_PREFIX='/storage/v1/object/public/artworks/';

type MediaSourceId='owner'|'huy9vnd';

const MEDIA_SOURCES:Record<MediaSourceId,string>={
  owner:(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://zkrhwqgmynbbmoktokdq.supabase.co').replace(/\/$/,''),
  huy9vnd:(process.env.NEXT_PUBLIC_HUY9VND_SUPABASE_URL||'https://unggkruzjmsjscdiukfr.supabase.co').replace(/\/$/,'')
};

export function toAbsoluteSiteUrl(value:string){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^https?:\/\//i.test(raw))return raw;
  return new URL(raw.replace(/^\.\//,''),`${SITE_URL}/`).href;
}

function encodeObjectPath(pathname:string){
  return pathname
    .slice(STORAGE_PREFIX.length)
    .split('/')
    .filter(Boolean)
    .map(segment=>encodeURIComponent(decodeURIComponent(segment)))
    .join('/');
}

export function publicMediaUrl(value:string){
  const absolute=toAbsoluteSiteUrl(value);
  if(!absolute)return '';
  try{
    const url=new URL(absolute);
    for(const [sourceId,origin] of Object.entries(MEDIA_SOURCES) as [MediaSourceId,string][]){
      const source=new URL(origin);
      if(url.origin!==source.origin||!url.pathname.startsWith(STORAGE_PREFIX))continue;
      const objectPath=encodeObjectPath(url.pathname);
      if(!objectPath)return absolute;
      return `${SITE_URL}/media/${sourceId}/${objectPath}`;
    }
    return absolute;
  }catch{return absolute;}
}

export function supabaseArtworkOrigin(sourceId:string,objectPath:string){
  if(!(sourceId in MEDIA_SOURCES))return null;
  const clean=String(objectPath||'').split('/').filter(Boolean);
  if(!clean.length||clean.some(segment=>segment==='.'||segment==='..'||segment.includes('\\')))return null;
  if(!['uploads','thumbnails'].includes(clean[0]))return null;
  const encoded=clean.map(segment=>encodeURIComponent(decodeURIComponent(segment))).join('/');
  return `${MEDIA_SOURCES[sourceId as MediaSourceId]}${STORAGE_PREFIX}${encoded}`;
}
