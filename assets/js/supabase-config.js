// HYU PREMIUM Supabase browser configuration.
// The project URL and publishable/anon key are intentionally public browser values when RLS is enabled.
// NEVER put a service_role key, secret key, database password, admin password, or long-lived private token here.
window.HYU_SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://zkrhwqgmynbbmoktokdq.supabase.co',
  publishableKey: 'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq'
};

(function hardenSupabaseBrowserAuth(){
  const cfg=window.HYU_SUPABASE_CONFIG||{};
  const isAdmin=/\/admin\.html$/i.test(window.location.pathname);
  let projectRef='';
  try{projectRef=new URL(cfg.url).hostname.split('.')[0]||''}catch{}
  const authStorageKey=projectRef?`sb-${projectRef}-auth-token`:'';

  const clearLegacyAuthStorage=()=>{
    if(!authStorageKey)return;
    let stores=[];
    try{stores.push(window.localStorage)}catch{}
    try{stores.push(window.sessionStorage)}catch{}
    for(const storage of stores){
      try{
        for(let i=storage.length-1;i>=0;i--){
          const key=storage.key(i)||'';
          if(key===authStorageKey||key.startsWith(`${authStorageKey}-`))storage.removeItem(key);
        }
      }catch{}
    }
  };

  clearLegacyAuthStorage();
  window.HYU_CLEAR_LEGACY_SUPABASE_AUTH=clearLegacyAuthStorage;

  if(window.supabase?.createClient&&!window.supabase.__hyuAuthHardened){
    const originalCreateClient=window.supabase.createClient.bind(window.supabase);
    window.supabase.createClient=(url,key,options={})=>originalCreateClient(url,key,{
      ...options,
      auth:{
        ...(options.auth||{}),
        persistSession:false,
        autoRefreshToken:isAdmin,
        detectSessionInUrl:false
      }
    });
    try{Object.defineProperty(window.supabase,'__hyuAuthHardened',{value:true,configurable:false})}catch{}
  }

  const loadPublicGalleryEnhancements=()=>{
    if(isAdmin||!document.querySelector('#catalog'))return;

    if(!document.querySelector('link[data-hyu-mobile-compact-ui]')){
      const compactCss=document.createElement('link');
      compactCss.rel='stylesheet';
      compactCss.href='./assets/css/mobile-compact-ui.css?v=1';
      compactCss.dataset.hyuMobileCompactUi='true';
      document.head.appendChild(compactCss);
    }

    if(!document.querySelector('link[data-hyu-mobile-gallery-stability]')){
      const stabilityCss=document.createElement('link');
      stabilityCss.rel='stylesheet';
      stabilityCss.href='./assets/css/mobile-gallery-stability.css';
      stabilityCss.dataset.hyuMobileGalleryStability='true';
      document.head.appendChild(stabilityCss);
    }

    const loadMainCreditFilter=()=>{
      if(!document.querySelector('script[data-hyu-main-credit-filter]')){
        const script=document.createElement('script');
        script.src='./assets/js/main-credit-filter.js';
        script.dataset.hyuMainCreditFilter='true';
        document.body.appendChild(script);
      }
      if(!document.querySelector('script[data-hyu-progressive-gallery-ux]')){
        const progressiveUx=document.createElement('script');
        progressiveUx.src='./assets/js/progressive-gallery-ux.js?v=1';
        progressiveUx.dataset.hyuProgressiveGalleryUx='true';
        document.body.appendChild(progressiveUx);
      }
    };

    const loadSearchLayer=()=>{
      if(window.__HYU_MULTI_PROPERTY_SEARCH_READY__){
        loadMainCreditFilter();
        return;
      }
      window.addEventListener('hyu:multi-property-search-ready',loadMainCreditFilter,{once:true});
      if(!document.querySelector('script[data-hyu-multi-property-search]')){
        const search=document.createElement('script');
        search.src='./assets/js/multi-property-search.js';
        search.dataset.hyuMultiPropertySearch='true';
        document.body.appendChild(search);
      }
    };

    const loadAfterResponsiveImages=()=>{
      if(!document.querySelector('script[data-hyu-mobile-image-stability]')){
        const stability=document.createElement('script');
        stability.src='./assets/js/mobile-image-stability.js';
        stability.dataset.hyuMobileImageStability='true';
        document.body.appendChild(stability);
      }
      loadSearchLayer();
    };

    if(window.__HYU_RESPONSIVE_ARTWORK_IMAGES__){
      loadAfterResponsiveImages();
    }else{
      window.addEventListener('hyu:responsive-artwork-images-ready',loadAfterResponsiveImages,{once:true});
      if(!document.querySelector('script[data-hyu-responsive-artwork-images]')){
        const responsive=document.createElement('script');
        responsive.src='./assets/js/responsive-artwork-images.js';
        responsive.dataset.hyuResponsiveArtworkImages='true';
        document.body.appendChild(responsive);
      }
    }
  };

  if(!isAdmin){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadPublicGalleryEnhancements,{once:true});
    else loadPublicGalleryEnhancements();
    return;
  }

  const addMeta=(attrs)=>{
    const meta=document.createElement('meta');
    for(const [key,value] of Object.entries(attrs))meta.setAttribute(key,value);
    document.head.appendChild(meta);
  };
  if(!document.querySelector('meta[name="referrer"]'))addMeta({name:'referrer',content:'no-referrer'});
  addMeta({'http-equiv':'Cache-Control',content:'no-store, no-cache, must-revalidate, max-age=0'});
  addMeta({'http-equiv':'Pragma',content:'no-cache'});
  addMeta({'http-equiv':'Expires',content:'0'});
  if(!document.querySelector('meta[http-equiv="Content-Security-Policy"]')){
    addMeta({
      'http-equiv':'Content-Security-Policy',
      content:[
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' https://zkrhwqgmynbbmoktokdq.supabase.co wss://zkrhwqgmynbbmoktokdq.supabase.co",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-src 'none'",
        "form-action 'self'",
        "upgrade-insecure-requests"
      ].join('; ')
    });
  }

  if(window.top!==window.self){
    try{window.top.location.replace(window.self.location.href)}catch{document.documentElement.style.display='none'}
  }

  const loadAdminUi=()=>{
    if(document.querySelector('script[data-hyu-admin-ui]'))return;
    const ui=document.createElement('script');
    ui.src='./assets/js/admin-ui.js';
    ui.dataset.hyuAdminUi='true';
    document.body.appendChild(ui);
  };

  const loadArtworkThumbnailAdmin=()=>{
    const existing=document.querySelector('script[data-hyu-admin-artwork-thumbnails]');
    if(existing){
      if(existing.dataset.loaded==='true')loadAdminUi();
      else existing.addEventListener('load',loadAdminUi,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='./assets/js/admin-artwork-thumbnails.js';
    script.dataset.hyuAdminArtworkThumbnails='true';
    script.addEventListener('load',()=>{
      script.dataset.loaded='true';
      loadAdminUi();
    },{once:true});
    document.body.appendChild(script);
  };

  const loadAdminEnhancements=()=>{
    const existing=document.querySelector('script[data-hyu-admin-enhancements]');
    if(existing){
      if(existing.dataset.loaded==='true')loadArtworkThumbnailAdmin();
      else existing.addEventListener('load',loadArtworkThumbnailAdmin,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='./assets/js/admin-enhancements.js';
    script.dataset.hyuAdminEnhancements='true';
    script.addEventListener('load',()=>{
      script.dataset.loaded='true';
      loadArtworkThumbnailAdmin();
    },{once:true});
    document.body.appendChild(script);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAdminEnhancements,{once:true});
  else loadAdminEnhancements();
})();
