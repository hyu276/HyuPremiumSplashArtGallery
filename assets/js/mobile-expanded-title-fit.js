(function(){
  'use strict';

  if(window.__HYU_MOBILE_EXPANDED_TITLE_FIT__)return;
  window.__HYU_MOBILE_EXPANDED_TITLE_FIT__=true;

  const MOBILE_QUERY=window.matchMedia('(max-width: 760px)');
  let frame=0;

  function setSize(title,px){
    title.style.fontSize=`${Math.max(9,Math.round(px*10)/10)}px`;
  }

  function clearManaged(root=document){
    root.querySelectorAll?.('[data-hyu-mobile-expanded-title]').forEach(title=>{
      title.style.removeProperty('font-size');
      title.style.removeProperty('white-space');
      title.style.removeProperty('overflow');
      title.style.removeProperty('text-overflow');
      title.style.removeProperty('display');
      title.style.removeProperty('width');
      title.style.removeProperty('max-width');
      delete title.dataset.hyuMobileExpandedTitle;
    });
  }

  function fitTitle(title){
    const card=title.closest('.art-card.expanded');
    const copy=title.closest('.card-copy');
    if(!card||!copy)return;

    const normalized=(title.textContent||'').normalize('NFC');
    if(title.textContent!==normalized)title.textContent=normalized;

    title.dataset.hyuMobileExpandedTitle='true';
    title.style.display='block';
    title.style.width='100%';
    title.style.maxWidth='100%';
    title.style.whiteSpace='nowrap';
    title.style.overflow='visible';
    title.style.textOverflow='clip';
    title.style.removeProperty('font-size');

    const available=Math.floor(copy.clientWidth);
    if(available<=0)return;

    const maxSize=parseFloat(getComputedStyle(title).fontSize)||26.4;
    const minSize=Math.min(maxSize,10.5);

    setSize(title,maxSize);
    if(title.scrollWidth<=available+1)return;

    setSize(title,minSize);
    if(title.scrollWidth>available+1){
      const ratio=available/title.scrollWidth;
      setSize(title,minSize*ratio*.985);
      return;
    }

    let low=minSize;
    let high=maxSize;
    for(let i=0;i<10;i++){
      const mid=(low+high)/2;
      setSize(title,mid);
      if(title.scrollWidth<=available+1)low=mid;
      else high=mid;
    }
    setSize(title,low-.15);
  }

  function fitAll(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const gallery=document.querySelector('#gallery');
      if(!gallery)return;
      if(!MOBILE_QUERY.matches){
        clearManaged(gallery);
        return;
      }
      gallery.querySelectorAll('.art-card.expanded .card-copy strong').forEach(fitTitle);
    });
  }

  function init(){
    const gallery=document.querySelector('#gallery');
    if(!gallery){
      requestAnimationFrame(init);
      return;
    }

    new MutationObserver(fitAll).observe(gallery,{childList:true,subtree:true});
    window.addEventListener('resize',fitAll,{passive:true});
    MOBILE_QUERY.addEventListener?.('change',fitAll);
    document.fonts?.ready?.then(fitAll);
    document.fonts?.addEventListener?.('loadingdone',fitAll);
    fitAll();
  }

  init();
})();
