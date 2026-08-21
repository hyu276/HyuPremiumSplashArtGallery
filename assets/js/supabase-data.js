(function(){
  if(!document.querySelector('link[data-hyu-typography]')){
    const typography=document.createElement('link');
    typography.rel='stylesheet';
    typography.href='./assets/css/typography.css';
    typography.dataset.hyuTypography='true';
    document.head.appendChild(typography);
  }

  if(!document.querySelector('link[data-hyu-desktop-gallery]')){
    const layout=document.createElement('link');
    layout.rel='stylesheet';
    layout.href='./assets/css/desktop-gallery.css';
    layout.dataset.hyuDesktopGallery='true';
    document.head.appendChild(layout);
  }

  const BRAND_MARK='./assets/brand/hyu-industries-logo.png';
  if(!document.querySelector('link[data-hyu-favicon]')){
    const favicon=document.createElement('link');
    favicon.rel='icon';
    favicon.type='image/png';
    favicon.sizes='64x64';
    favicon.href=BRAND_MARK;
    favicon.dataset.hyuFavicon='true';
    document.head.appendChild(favicon);

    const shortcut=document.createElement('link');
    shortcut.rel='shortcut icon';
    shortcut.type='image/png';
    shortcut.href=BRAND_MARK;
    shortcut.dataset.hyuFavicon='true';
    document.head.appendChild(shortcut);

    const apple=document.createElement('link');
    apple.rel='apple-touch-icon';
    apple.href=BRAND_MARK;
    apple.dataset.hyuFavicon='true';
    document.head.appendChild(apple);
  }

  if(!document.querySelector('style[data-hyu-brand-mark]')){
    const style=document.createElement('style');
    style.dataset.hyuBrandMark='true';
    style.textContent='.site-header .wordmark{display:inline-flex;align-items:center;gap:.6rem}.site-header .wordmark .brand-mark{display:block;width:32px;height:32px;flex:0 0 32px;border-radius:50%;object-fit:cover;background:#eef3f5;box-shadow:0 0 0 1px rgba(67,220,255,.2),0 0 12px rgba(67,220,255,.12)}@media(max-width:760px){.site-header .wordmark .brand-mark{width:28px;height:28px;flex-basis:28px}.site-header .wordmark{gap:.48rem}}';
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
  if(headerWordmark)headerWordmark.href='./';

  if(!document.querySelector('style[data-hyu-site-nav]')){
    const navStyle=document.createElement('style');
    navStyle.dataset.hyuSiteNav='true';
    navStyle.textContent='.site-header nav a{position:relative}.site-header nav a.active{color:var(--brand)}.site-header nav a.active:after{content:"";position:absolute;left:.1rem;right:.1rem;bottom:-.62rem;height:2px;background:var(--brand);box-shadow:0 0 10px rgba(67,220,255,.45)}@media(max-width:760px){.site-header{height:auto!important;min-height:62px!important;grid-template-columns:1fr!important;padding:10px 4vw 0!important}.site-header nav{display:flex!important;width:100%;justify-content:flex-start;gap:.32rem;overflow-x:auto;padding:9px 0 10px;margin-top:9px;border-top:1px solid rgba(241,241,234,.14);scrollbar-width:none}.site-header nav::-webkit-scrollbar{display:none}.site-header nav a{flex:none;padding:.4rem .55rem;font-size:.58rem!important;white-space:nowrap}.site-header nav a.active:after{bottom:-.48rem}}';
    document.head.appendChild(navStyle);
  }

  const mainNav=document.querySelector('.site-header nav');
  if(mainNav){
    mainNav.innerHTML='<a class="active" href="./">Gallery</a><a href="./about.html">About us</a><a href="./news.html">News</a><a href="./blog.html">Blog</a>';
  }
  document.querySelector('.header-actions')?.remove();
  document.querySelector('.edition')?.remove();

  const RANK_BADGE_GRADIENTS={
    'A':'linear-gradient(180deg, #035365 0%, #045C6C 48%, #08929C 100%)',
    'S':'linear-gradient(180deg, #60179E 0%, #4D128A 48%, #9244C0 100%)',
    'S+':'linear-gradient(180deg, #E07A38 0%, #D06331 45%, #C15429 100%)',
    'SS':'linear-gradient(180deg, #D88D31 0%, #9E5F0F 48%, #EED76A 100%)',
    'SS+':'linear-gradient(180deg, #E6AF38 0%, #C48211 46%, #A86518 72%, #E06A27 100%)',
    'SSS':'linear-gradient(180deg, #D82B22 0%, #941004 30%, #7E1008 62%, #F16132 100%)',
    'SSS+':'linear-gradient(120deg, #150F24 0%, #3A2289 18%, #4C30A7 34%, #6046B2 48%, #8069E0 63%, #A98FF1 75%, #C8B9F0 87%, #F9F8FB 100%)',
    'SSS+ Ultimate':'linear-gradient(120deg, #281141 0%, #624476 20%, #9F67B0 38%, #B282DE 52%, #F18DC0 67%, #F3AC9A 82%, #F9EFF8 100%)',
    'SSS+ Tối thượng':'linear-gradient(120deg, #281141 0%, #624476 20%, #9F67B0 38%, #B282DE 52%, #F18DC0 67%, #F3AC9A 82%, #F9EFF8 100%)'
  };

  function styleRankBadges(root=document){
    if(!root?.querySelectorAll)return;
    root.querySelectorAll('.tier').forEach(badge=>{
      const rank=(badge.textContent||'').trim();
      badge.style.color='#fff';
      badge.style.textShadow='0 1px 2px rgba(0,0,0,.45)';
      badge.style.background=RANK_BADGE_GRADIENTS[rank]||'var(--brand)';
      badge.style.boxShadow=RANK_BADGE_GRADIENTS[rank]
        ? '0 0 0 1px rgba(255,255,255,.12),0 3px 14px rgba(0,0,0,.28)'
        : '0 0 18px rgba(67,220,255,.24)';
    });
  }

  function fitArtworkTitle(title){
    const card=title.closest('.art-card');
    const copy=title.closest('.card-copy');
    if(!card||!copy)return;

    title.style.removeProperty('font-size');
    title.style.removeProperty('letter-spacing');

    if(window.innerWidth<=760)return;

    title.style.display='block';
    title.style.width='100%';
    title.style.maxWidth='100%';
    title.style.whiteSpace='nowrap';
    title.style.overflow='hidden';
    title.style.textOverflow='clip';

    const available=Math.floor(copy.clientWidth);
    if(available<=0)return;

    const maxSize=parseFloat(getComputedStyle(title).fontSize)||24;
    const minSize=Math.min(maxSize,card.classList.contains('expanded')?24:11);

    title.style.fontSize=`${maxSize}px`;
    if(title.scrollWidth<=available+1)return;

    title.style.fontSize=`${minSize}px`;
    if(title.scrollWidth>available+1){
      const ratio=available/title.scrollWidth;
      title.style.fontSize=`${Math.max(7,minSize*ratio*.985)}px`;
      return;
    }

    let low=minSize;
    let high=maxSize;
    for(let i=0;i<9;i++){
      const mid=(low+high)/2;
      title.style.fontSize=`${mid}px`;
      if(title.scrollWidth<=available+1)low=mid;
      else high=mid;
    }
    title.style.fontSize=`${Math.max(7,low-.15)}px`;
  }

  function fitArtworkTitles(root=document){
    if(!root?.querySelectorAll)return;
    root.querySelectorAll('.card-copy strong').forEach(fitArtworkTitle);
  }

  let galleryPolishFrame=0;
  function scheduleGalleryPolish(root=document){
    cancelAnimationFrame(galleryPolishFrame);
    galleryPolishFrame=requestAnimationFrame(()=>{
      styleRankBadges(root);
      fitArtworkTitles(root);
    });
  }

  function observeGalleryPolish(){
    const gallery=document.querySelector('#gallery');
    if(!gallery){requestAnimationFrame(observeGalleryPolish);return;}
    scheduleGalleryPolish(gallery);
    new MutationObserver(()=>scheduleGalleryPolish(gallery)).observe(gallery,{childList:true,subtree:true});
    window.addEventListener('resize',()=>scheduleGalleryPolish(gallery),{passive:true});
    if(document.fonts?.ready){
      document.fonts.ready.then(()=>scheduleGalleryPolish(gallery));
      document.fonts.addEventListener?.('loadingdone',()=>scheduleGalleryPolish(gallery));
    }
  }
  observeGalleryPolish();

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
