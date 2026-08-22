(function(){
  'use strict';

  if(window.__HYU_SEO_RUNTIME__)return;
  window.__HYU_SEO_RUNTIME__=true;

  const safeSegment=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'artwork';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();

  function ensureArtworkIndexLink(){
    const links=document.querySelector('.footer-links');
    if(!links||links.querySelector('[data-seo-artwork-index]'))return;
    const anchor=document.createElement('a');
    anchor.href='/artworks/';
    anchor.textContent='Artwork index';
    anchor.dataset.seoArtworkIndex='true';
    anchor.title='Browse the crawlable HYU PREMIUM artwork index';
    links.prepend(anchor);
  }

  function enhance(){
    ensureArtworkIndexLink();
    let items=[];
    try{items=Array.isArray(state?.items)?state.items:[]}catch{}
    if(!items.length)return false;

    const byId=new Map(items.map(item=>[String(item.id),item]));
    document.querySelectorAll('#gallery .art-card').forEach((card,index)=>{
      const item=byId.get(String(card.dataset.id));
      if(!item)return;
      const name=clean(item.name)||'Artwork';
      const category=clean(item.category)||'Uncategorized';
      const rank=clean(item.rank)||'Unranked';
      const credit=clean(item.credit)||'Uncredited';
      const alt=`${name} — ${category} gaming splash art, skin rank ${rank}`;
      const img=card.querySelector('img');
      if(img){
        img.alt=alt;
        img.title=`${name} — ${category}; skin rank ${rank}; image credit ${credit}`;
        if(index<2)img.fetchPriority='high';
        else if(!img.getAttribute('loading'))img.loading='lazy';
        if(!img.getAttribute('decoding'))img.decoding='async';
      }
      card.setAttribute('aria-label',`${name}, ${category}, skin rank ${rank}, image credit ${credit}`);
      card.dataset.seoUrl=`/artwork/${safeSegment(item.id)}/`;
    });
    return true;
  }

  ensureArtworkIndexLink();
  const gallery=document.querySelector('#gallery');
  if(gallery){
    new MutationObserver(()=>requestAnimationFrame(enhance)).observe(gallery,{childList:true,subtree:true});
  }

  if(!enhance()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(enhance()||attempts>=240)clearInterval(timer);
    },25);
  }
})();
