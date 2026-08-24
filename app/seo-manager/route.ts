const DASHBOARD_SOURCE='https://raw.githubusercontent.com/hyu276/HyuPremiumSplashArtGallery/db4a26a657fa9cbbe073961a3ad54afc9eac1e1f/seomanager.html';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const response=await fetch(DASHBOARD_SOURCE,{cache:'no-store'});
    if(!response.ok)throw new Error(`Dashboard source fetch failed (${response.status}).`);
    let html=await response.text();
    html=html.replace("const API='https://hyupremium.vercel.app/api/seo-manager'","const API='/api/seo-manager/'");
    html=html.replace('Đăng nhập bằng tài khoản owner/admin. Xác thực được proxy qua backend Vercel để tránh lỗi browser → Supabase trực tiếp.','Đăng nhập bằng tài khoản owner/admin. Dashboard đang chạy cùng origin Vercel với backend để loại bỏ lỗi CORS/fetch.');
    return new Response(html,{status:200,headers:{
      'Content-Type':'text/html; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'Content-Security-Policy':"frame-ancestors https://hyu276.github.io",
      'Referrer-Policy':'no-referrer',
      'X-Robots-Tag':'noindex, nofollow'
    }});
  }catch(error:any){
    const message=error?.message||'Unable to load SEO Manager.';
    return new Response(`<!doctype html><meta charset="utf-8"><title>SEO Manager error</title><body style="background:#070908;color:#fff;font:14px system-ui;padding:32px"><h1>HYU SEO Manager</h1><p>${message.replace(/[<>&]/g,'')}</p></body>`,{status:502,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
  }
}
