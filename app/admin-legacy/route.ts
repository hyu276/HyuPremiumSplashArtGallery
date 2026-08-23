const LEGACY_ADMIN='https://raw.githubusercontent.com/hyu276/HyuPremiumSplashArtGallery/main/admin.html';
export const dynamic='force-dynamic';
export async function GET(){
  const response=await fetch(LEGACY_ADMIN,{cache:'no-store'});
  if(!response.ok)return new Response('Legacy owner dashboard unavailable',{status:502});
  let html=await response.text();
  html=html.replace('<head>','<head><base href="/">');
  html=html.replace('href="./index.html"','href="/character/"');
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive','referrer-policy':'no-referrer','x-frame-options':'DENY'}});
}
