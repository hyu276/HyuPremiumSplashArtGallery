(function(){
  'use strict';

  if(window.__HYU_MOBILE_IMAGE_STABILITY__)return;
  window.__HYU_MOBILE_IMAGE_STABILITY__=true;

  const mobileQuery=window.matchMedia('(max-width: 760px)');
  const PLACEHOLDER='data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const MAX_CONCURRENT=2;
  const PRELOAD_MARGIN='120% 0px 120% 0px';
  const UNLOAD_DELAY=1800;
  const MAX_RETRIES=2;

  let gallery=null;
  let observer=null;
  let mutationObserver=null;
  let activeLoads=0;
  let queue=[];
  const unloadTimers=new WeakMap();

  function isManaged(img){return img?.dataset?.hyuManaged==='1'}

  function realSource(img){
    return img.dataset.hyuRealSrc||'';
  }

  function priorityFor(img){
    const rect=img.getBoundingClientRect();
    const center=rect.top+(rect.height/2);
    return Math.abs(center-(window.innerHeight/2));
  }

  function clearUnload(img){
    const timer=unloadTimers.get(img);
    if(timer){clearTimeout(timer);unloadTimers.delete(img)}
  }

  function unload(img){
    if(!img.isConnected||!isManaged(img))return;
    if(img.dataset.hyuState!=='loaded')return;
    img.dataset.hyuState='idle';
    img.removeAttribute('fetchpriority');
    img.src=PLACEHOLDER;
  }

  function scheduleUnload(img){
    clearUnload(img);
    if(img.dataset.hyuState!=='loaded')return;
    const timer=setTimeout(()=>{
      unloadTimers.delete(img);
      unload(img);
    },UNLOAD_DELAY);
    unloadTimers.set(img,timer);
  }

  function withRetryToken(url,retry){
    if(!retry)return url;
    try{
      const parsed=new URL(url,window.location.href);
      parsed.searchParams.set('_hyu_retry',`${retry}-${Date.now()}`);
      return parsed.href;
    }catch{
      return url+(url.includes('?')?'&':'?')+`_hyu_retry=${retry}-${Date.now()}`;
    }
  }

  function finishLoad(img,ok){
    activeLoads=Math.max(0,activeLoads-1);
    img.onload=null;
    img.onerror=null;
    if(!img.isConnected){pump();return}

    if(ok){
      img.dataset.hyuState='loaded';
      img.dataset.hyuRetry='0';
      img.classList.add('hyu-img-ready');
    }else{
      const retry=(Number(img.dataset.hyuRetry)||0)+1;
      img.dataset.hyuRetry=String(retry);
      img.dataset.hyuState='idle';
      if(retry<=MAX_RETRIES){
        setTimeout(()=>enqueue(img),450*retry);
      }else{
        img.dataset.hyuState='error';
      }
    }
    pump();
  }

  function startLoad(img){
    if(!img.isConnected||!isManaged(img)||img.dataset.hyuState==='loaded'||img.dataset.hyuState==='loading')return;
    const source=realSource(img);
    if(!source)return;

    clearUnload(img);
    img.dataset.hyuState='loading';
    img.loading='eager';
    img.decoding='auto';
    img.setAttribute('fetchpriority',priorityFor(img)<window.innerHeight?'high':'low');
    activeLoads+=1;

    img.onload=()=>finishLoad(img,true);
    img.onerror=()=>finishLoad(img,false);
    const retry=Number(img.dataset.hyuRetry)||0;
    img.src=withRetryToken(source,retry);
  }

  function pump(){
    queue=queue.filter(img=>img.isConnected&&isManaged(img)&&img.dataset.hyuState==='queued');
    queue.sort((a,b)=>priorityFor(a)-priorityFor(b));
    while(activeLoads<MAX_CONCURRENT&&queue.length){
      const img=queue.shift();
      if(!img||!img.isConnected)continue;
      img.dataset.hyuState='idle';
      startLoad(img);
    }
  }

  function enqueue(img){
    if(!img?.isConnected||!isManaged(img))return;
    const state=img.dataset.hyuState;
    if(state==='loaded'||state==='loading'||state==='queued'||state==='error')return;
    clearUnload(img);
    img.dataset.hyuState='queued';
    queue.push(img);
    pump();
  }

  function prepareImage(img){
    if(!mobileQuery.matches||!img||isManaged(img))return;
    const src=img.currentSrc||img.getAttribute('src')||'';
    if(!src||src.startsWith('data:'))return;

    img.dataset.hyuManaged='1';
    img.dataset.hyuRealSrc=src;
    img.dataset.hyuState='idle';
    img.dataset.hyuRetry='0';
    img.loading='eager';
    img.decoding='auto';
    img.removeAttribute('fetchpriority');

    // Cancel native lazy/decode work as early as possible. Our observer below controls when
    // the real source is attached so mobile Safari never holds dozens of large decoded images.
    img.src=PLACEHOLDER;
    observer?.observe(img);
  }

  function prepareGallery(){
    if(!gallery||!mobileQuery.matches)return;
    gallery.querySelectorAll('.art-card img').forEach(prepareImage);
  }

  function installObserver(){
    observer?.disconnect();
    observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        const img=entry.target;
        if(entry.isIntersecting){
          clearUnload(img);
          if(img.dataset.hyuState==='error'){
            img.dataset.hyuRetry='0';
            img.dataset.hyuState='idle';
          }
          enqueue(img);
        }else{
          scheduleUnload(img);
        }
      }
    },{root:null,rootMargin:PRELOAD_MARGIN,threshold:0.01});
  }

  function resetDesktop(){
    observer?.disconnect();
    queue=[];
    activeLoads=0;
    if(!gallery)return;
    gallery.querySelectorAll('.art-card img[data-hyu-managed="1"]').forEach(img=>{
      clearUnload(img);
      const src=realSource(img);
      img.removeAttribute('data-hyu-managed');
      img.removeAttribute('data-hyu-real-src');
      img.removeAttribute('data-hyu-state');
      img.removeAttribute('data-hyu-retry');
      img.removeAttribute('fetchpriority');
      img.classList.remove('hyu-img-ready');
      img.loading='lazy';
      img.decoding='async';
      if(src)img.src=src;
    });
  }

  function handleModeChange(){
    if(mobileQuery.matches){
      installObserver();
      prepareGallery();
    }else{
      resetDesktop();
    }
  }

  function install(){
    gallery=document.querySelector('#gallery');
    if(!gallery){requestAnimationFrame(install);return}

    if(!document.querySelector('style[data-hyu-mobile-image-stability]')){
      const style=document.createElement('style');
      style.dataset.hyuMobileImageStability='true';
      style.textContent='@media(max-width:760px){.art-card img[data-hyu-managed="1"]{background:#0b0d0c}.art-card img.hyu-img-ready{background:transparent}}';
      document.head.appendChild(style);
    }

    installObserver();
    mutationObserver=new MutationObserver(()=>prepareGallery());
    mutationObserver.observe(gallery,{childList:true,subtree:true});
    prepareGallery();

    if(typeof mobileQuery.addEventListener==='function')mobileQuery.addEventListener('change',handleModeChange);
    else mobileQuery.addListener?.(handleModeChange);

    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'&&mobileQuery.matches){
        prepareGallery();
        pump();
      }
    });
  }

  install();
})();
