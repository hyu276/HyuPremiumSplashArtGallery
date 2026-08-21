(function(){
  'use strict';

  if(window.__HYU_RESPONSIVE_ARTWORK_IMAGES__)return;

  let installed=false;
  let metadataRequested=false;
  const metadataById=new Map();
  const mobileQuery=window.matchMedia('(max-width: 760px)');

  function hydrateItem(item){
    if(!item)return;
    const row=metadataById.get(String(item.id));
    if(row){
      item.originalImage=row.image||item.originalImage||item.image||'';
      item.thumbnail=row.thumbnail||item.thumbnail||'';
      return;
    }
    if(!item.originalImage)item.originalImage=item.image||'';
    if(!item.thumbnail)item.thumbnail='';
  }

  async function loadThumbnailMetadata(){
    if(metadataRequested)return;
    metadataRequested=true;
    const client=window.HYU_SUPABASE?.client;
    if(!client)return;
    try{
      const {data,error}=await client.from('artworks').select('id,image,thumbnail').eq('hidden',false);
      if(error)throw error;
      metadataById.clear();
      for(const row of data||[])metadataById.set(String(row.id),row);
      try{
        if(typeof state!=='undefined')for(const item of state.items||[])hydrateItem(item);
        if(typeof render==='function')render();
      }catch{}
    }catch(error){
      console.warn('Optimized artwork thumbnails unavailable; falling back to originals.',error);
    }
  }

  function install(){
    let galleryState,baseRender;
    try{
      if(typeof state==='undefined'||typeof render!=='function')return false;
      galleryState=state;
      baseRender=render;
    }catch{return false}
    if(installed)return true;
    installed=true;
    window.__HYU_RESPONSIVE_ARTWORK_IMAGES__=true;

    function sourceFor(item){
      hydrateItem(item);
      const original=item.originalImage||item.image||'';
      const expanded=String(galleryState.expanded||'')===String(item.id);
      return expanded?original:(item.thumbnail||original);
    }

    render=function(){
      const swaps=[];
      for(const item of galleryState.items||[]){
        hydrateItem(item);
        swaps.push([item,item.image]);
        item.image=sourceFor(item);
      }
      try{
        return baseRender();
      }finally{
        for(const [item,previous] of swaps)item.image=previous;
        requestAnimationFrame(()=>{
          const byId=new Map((galleryState.items||[]).map(item=>[String(item.id),item]));
          document.querySelectorAll('#gallery .art-card').forEach(card=>{
            const item=byId.get(String(card.dataset.id));
            if(!item)return;
            hydrateItem(item);
            const img=card.querySelector('img');
            if(!img)return;
            const original=item.originalImage||item.image||'';
            const thumb=item.thumbnail||'';
            img.dataset.hyuOriginalSrc=original;
            if(thumb)img.dataset.hyuThumbnailSrc=thumb;
            else delete img.dataset.hyuThumbnailSrc;

            // Desktop uses the optimized thumbnail directly. If that derivative is ever missing
            // or corrupt, fall back to the original source rather than leaving a blank card.
            if(!mobileQuery.matches&&thumb&&original&&!img.dataset.hyuDesktopFallbackBound){
              img.dataset.hyuDesktopFallbackBound='1';
              img.addEventListener('error',()=>{
                if(img.dataset.hyuDesktopFallbackUsed==='1')return;
                img.dataset.hyuDesktopFallbackUsed='1';
                img.src=original;
              });
            }
          });
        });
      }
    };

    loadThumbnailMetadata();
    window.dispatchEvent(new CustomEvent('hyu:responsive-artwork-images-ready'));
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(install()||attempts>200)clearInterval(timer);
    },25);
  }
})();
