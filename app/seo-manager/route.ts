const DASHBOARD_SOURCE='https://raw.githubusercontent.com/hyu276/HyuPremiumSplashArtGallery/db4a26a657fa9cbbe073961a3ad54afc9eac1e1f/seomanager.html';

export const dynamic='force-dynamic';

function patchGithubPatAuth(input:string){
  let html=input;
  html=html.replace("const API='https://hyupremium.vercel.app/api/seo-manager'","const API='/api/seo-manager/'");
  html=html.replace(
    'Đăng nhập bằng tài khoản owner/admin. Xác thực được proxy qua backend Vercel để tránh lỗi browser → Supabase trực tiếp.',
    'Đăng nhập bằng GitHub fine-grained personal access token của chủ repository. Token chỉ được giữ trong bộ nhớ của tab này và không được lưu vào localStorage hoặc repository.'
  );
  html=html.replace(
    '<div class="field"><label>Email</label><input id="email" type="email" autocomplete="username"></div>\n  <div class="field"><label>Password</label><input id="password" type="password" autocomplete="current-password"></div>',
    '<div class="field"><label>GitHub fine-grained PAT</label><input id="email" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_..."></div>\n  <input id="password" type="hidden" value="">'
  );
  html=html.replace(
    "function loadSession(){try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{session=null}}\nfunction saveSession(value){session=value;if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value));else localStorage.removeItem(SESSION_KEY)}",
    "function loadSession(){session=null}\nfunction saveSession(value){session=value}"
  );
  html=html.replace(
    "async function refreshAuth(){if(!session?.refresh_token)throw new Error('Signed out.');const data=await publicPost({action:'refresh-session',refresh_token:session.refresh_token});saveSession(data.session);return session}\nasync function ensureAuth(){if(!session)throw new Error('Signed out.');const now=Math.floor(Date.now()/1000);if(!session.expires_at||session.expires_at<now+90)await refreshAuth();return session}",
    "async function refreshAuth(){if(!session?.access_token)throw new Error('Chưa đăng nhập.');return session}\nasync function ensureAuth(){if(!session?.access_token)throw new Error('Chưa đăng nhập.');return session}"
  );
  html=html.replace(
    "$('signin').onclick=async()=>{const email=$('email').value.trim(),password=$('password').value;$('loginStatus').textContent='Signing in through Vercel…';try{const data=await publicPost({action:'login',email,password});$('password').value='';saveSession(data.session);showApp();await bootstrap()}catch(e){$('password').value='';$('loginStatus').textContent=e.message}}",
    "$('signin').onclick=async()=>{const token=$('email').value.trim();$('loginStatus').textContent='Đang xác minh GitHub PAT…';try{if(!token.startsWith('github_pat_'))throw new Error('Token phải là GitHub fine-grained PAT bắt đầu bằng github_pat_.');const data=await publicPost({action:'login',token});$('email').value='';saveSession(data.session);showApp();await bootstrap()}catch(e){$('loginStatus').textContent=e.message}}"
  );
  html=html.replace('Sign in</button>','Đăng nhập bằng GitHub PAT</button>');
  html=html.replace('Sign out</button>','Đăng xuất</button>');
  html=html.replace('50 thay đổi SEO gần nhất từ Supabase.','50 thay đổi SEO gần nhất từ metadata GitHub.');
  return html;
}

export async function GET(){
  try{
    const response=await fetch(DASHBOARD_SOURCE,{cache:'no-store'});
    if(!response.ok)throw new Error(`Không thể tải giao diện SEO Manager (${response.status}).`);
    const html=patchGithubPatAuth(await response.text());
    return new Response(html,{status:200,headers:{
      'Content-Type':'text/html; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'Content-Security-Policy':"frame-ancestors https://hyu276.github.io",
      'Referrer-Policy':'no-referrer',
      'X-Robots-Tag':'noindex, nofollow'
    }});
  }catch(error:any){
    const message=error?.message||'Không thể tải SEO Manager.';
    return new Response(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>Lỗi SEO Manager</title><body style="background:#070908;color:#fff;font:14px system-ui;padding:32px"><h1>HYU SEO Manager</h1><p>${message.replace(/[<>&]/g,'')}</p></body></html>`,{status:502,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
  }
}
