(function(){
  'use strict';

  if(window.__HYU_RESPONSIVE_ARTWORK_IMAGES__)return;

  let installed=false;
  let thumbnailsLoaded=false;

  async function attachThumbnailMetadata(galleryState){
    if(thumbnailsLoaded)return;
    thumbnailsLoaded=true;
    const client=window.HYU_SUPABASE?.client;
    if(!client)return;
    try{
      const {data,error}=await client.from('artworks').select('id,image,thumbnail').eq('hidden',false);
      if(error)throw error;
      const byId=new Map((data||[]).map(row=>[String(row.id),row]));
      for(const item of galleryState.items||[]){
        const row=byId.get(String(item.id));
        if(!row)continue;
        item.originalImage=row.image||item.originalImage||item.image||'';
        item.thumbnail=row.thumbnail||'';
      }
      if(typeof render==='function')render();
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

    for(const item of galleryState.items||[]){
      if(!item.originalImage)item.originalImage=item.image||'';
      if(!item.thumbnail)item.thumbnail='';
    }

    function sourceFor(item){
      const original=item.originalImage||item.image||'';
      const expanded=String(galleryState.expanded||'')===String(item.id);
      return expanded?original:(item.thumbnail||original);
    }

    render=function(){
      const swaps=[];
      for(const item of galleryState.items||[]){
        if(!item.originalImage)item.originalImage=item.image||'';
        swaps.push([item,item.image]);
        item.image=sourceFor(item);
      }
      try{
        return baseRender();
      }finally{
        for(const [item,previous] of swaps)item.image=previous;
        requestAnimationFrame(()=>{
          document.querySelectorAll('#gallery .art-card').forEach(card=>{
            const item=(galleryState.items||[]).find(x=>String(x.id)===String(card.dataset.id));
            if(!item)return;
            const img=card.querySelector('img');
            if(!img)return;
            const original=item.originalImage||item.image||'';
            const thumb=item.thumbnail||'';
            img.dataset.hyuOriginalSrc=original;
            if(thumb)img.dataset.hyuThumbnailSrc=thumb;
            else delete img.dataset.hyuThumbnailSrc;
          });
        });
      }
    };

    attachThumbnailMetadata(galleryState);
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
