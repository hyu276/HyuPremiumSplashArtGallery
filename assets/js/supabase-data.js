(function(){
  if(!document.querySelector('link[data-hyu-desktop-gallery]')){
    const layout=document.createElement('link');
    layout.rel='stylesheet';
    layout.href='./assets/css/desktop-gallery.css';
    layout.dataset.hyuDesktopGallery='true';
    document.head.appendChild(layout);
  }

  const BRAND_MARK='./assets/brand/hyu-premium-mark.svg';
  if(!document.querySelector('link[data-hyu-favicon]')){
    const favicon=document.createElement('link');
    favicon.rel='icon';
    favicon.type='image/svg+xml';
    favicon.href=BRAND_MARK;
    favicon.dataset.hyuFavicon='true';
    document.head.appendChild(favicon);

    const shortcut=document.createElement('link');
    shortcut.rel='shortcut icon';
    shortcut.href=BRAND_MARK;
    shortcut.dataset.hyuFavicon='true';
    document.head.appendChild(shortcut);
  }

  if(!document.querySelector('style[data-hyu-brand-mark]')){
    const style=document.createElement('style');
    style.dataset.hyuBrandMark='true';
    style.textContent='.site-header .wordmark{display:inline-flex;align-items:center;gap:.55rem}.site-header .wordmark .brand-mark{display:block;width:24px;height:24px;flex:0 0 24px;border-radius:6px;filter:drop-shadow(0 0 9px rgba(67,220,255,.18))}@media(max-width:760px){.site-header .wordmark .brand-mark{width:21px;height:21px;flex-basis:21px}.site-header .wordmark{gap:.45rem}}';
    document.head.appendChild(style);
  }

  const headerWordmark=document.querySelector('.site-header .wordmark');
  if(headerWordmark&&!headerWordmark.querySelector('.brand-mark')){
    const mark=document.createElement('img');
    mark.className='brand-mark';
    mark.src=BRAND_MARK;
    mark.alt='';
    mark.setAttribute('aria-hidden','true');
    headerWordmark.prepend(mark);
  }

  const cfg=window.HYU_SUPABASE_CONFIG||{};
  const sdk=window.supabase;
  const ready=Boolean(cfg.enabled&&cfg.url&&cfg.publishableKey&&sdk?.createClient);
  if(!ready){
    window.HYU_SUPABASE={enabled:false};
    return;
  }

  const client=sdk.createClient(cfg.url,cfg.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  async function loadPublicCatalogue(){
    const [artworksRes,categoriesRes,creditsRes,ranksRes]=await Promise.all([
      client.from('artworks').select('id,name,description,image,tags,hidden,category:categories(name),rank:ranks(name,sort_order),credit:image_credits(name)').eq('hidden',false),
      client.from('categories').select('name').order('name',{ascending:true}),
      client.from('image_credits').select('name').order('name',{ascending:true}),
      client.from('ranks').select('name,sort_order').order('sort_order',{ascending:true})
    ]);
    const error=artworksRes.error||categoriesRes.error||creditsRes.error||ranksRes.error;
    if(error)throw error;
    const items=(artworksRes.data||[]).map(x=>({
      id:x.id,
      name:x.name,
      description:x.description||'',
      category:x.category?.name||'Uncategorized',
      rank:x.rank?.name||'Unranked',
      credit:x.credit?.name||'Uncredited',
      image:x.image,
      tags:Array.isArray(x.tags)?x.tags:[],
      hidden:false
    }));
    return {
      items,
      options:{
        categories:(categoriesRes.data||[]).map(x=>x.name),
        credits:(creditsRes.data||[]).map(x=>x.name),
        ranks:(ranksRes.data||[]).map(x=>x.name)
      }
    };
  }

  window.HYU_SUPABASE={enabled:true,client,loadPublicCatalogue};
})();
