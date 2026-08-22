(function(){
  'use strict';

  if(window.__HYU_PROGRESSIVE_GALLERY_UX__)return;
  window.__HYU_PROGRESSIVE_GALLERY_UX__=true;

  let desiredLevel=0;
  let restoring=false;
  let restoreFrame=0;

  function injectStyle(){
    if(document.querySelector('style[data-hyu-view-all-motion]'))return;
    const style=document.createElement('style');
    style.dataset.hyuViewAllMotion='true';
    style.textContent=`
      .gallery-view-all{
        position:relative;
        isolation:isolate;
        overflow:hidden;
        box-shadow:0 0 0 0 rgba(67,220,255,.18),0 0 18px rgba(67,220,255,.08);
        animation:hyuViewAllPulse 2.4s ease-in-out infinite;
      }
      .gallery-view-all::before{
        content:"";
        position:absolute;
        z-index:-1;
        top:-40%;
        bottom:-40%;
        left:-42%;
        width:28%;
        transform:skewX(-20deg);
        background:linear-gradient(90deg,transparent,rgba(67,220,255,.24),transparent);
        animation:hyuViewAllSheen 3.2s ease-in-out infinite;
        pointer-events:none;
      }
      .gallery-view-all::after{
        content:"↓";
        display:inline-block;
        margin-left:.72em;
        font-size:.92em;
        transform:translateY(-1px);
        animation:hyuViewAllArrow 1.25s ease-in-out infinite;
      }
      .gallery-view-all:hover,.gallery-view-all:focus-visible{
        animation-play-state:paused;
        box-shadow:0 0 0 1px rgba(67,220,255,.28),0 0 25px rgba(67,220,255,.22);
      }
      @keyframes hyuViewAllPulse{
        0%,100%{box-shadow:0 0 0 0 rgba(67,220,255,.10),0 0 14px rgba(67,220,255,.06)}
        50%{box-shadow:0 0 0 5px rgba(67,220,255,.055),0 0 26px rgba(67,220,255,.19)}
      }
      @keyframes hyuViewAllSheen{
        0%,22%{left:-42%;opacity:0}
        36%{opacity:1}
        58%{left:118%;opacity:0}
        100%{left:118%;opacity:0}
      }
      @keyframes hyuViewAllArrow{
        0%,100%{transform:translateY(-2px)}
        50%{transform:translateY(2px)}
      }
      @media(prefers-reduced-motion:reduce){
        .gallery-view-all,.gallery-view-all::before,.gallery-view-all::after{animation:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function stageFromUi(){
    const controls=document.querySelector('.gallery-progressive-controls');
    const note=controls?.querySelector('.gallery-progressive-note');
    if(!controls||controls.hidden)return 2;
    const text=(note?.textContent||'').trim().toLowerCase();
    if(text.startsWith('show '))return 0;
    if(text.startsWith('open full gallery'))return 1;
    return 0;
  }

  function scheduleRestore(){
    if(desiredLevel===0||restoring)return;
    cancelAnimationFrame(restoreFrame);
    restoreFrame=requestAnimationFrame(restoreDesiredLevel);
  }

  function restoreDesiredLevel(){
    if(restoring||desiredLevel===0)return;
    const controls=document.querySelector('.gallery-progressive-controls');
    const button=controls?.querySelector('.gallery-view-all');
    if(!controls||!button||controls.hidden)return;

    let current=stageFromUi();
    if(current>=desiredLevel)return;

    restoring=true;
    const clickNext=()=>{
      const liveControls=document.querySelector('.gallery-progressive-controls');
      const liveButton=liveControls?.querySelector('.gallery-view-all');
      if(!liveControls||!liveButton||liveControls.hidden){
        restoring=false;
        return;
      }
      current=stageFromUi();
      if(current>=desiredLevel){
        restoring=false;
        return;
      }
      liveButton.click();
      requestAnimationFrame(clickNext);
    };
    clickNext();
  }

  function install(){
    const gallery=document.querySelector('#gallery');
    const controls=document.querySelector('.gallery-progressive-controls');
    const button=controls?.querySelector('.gallery-view-all');
    if(!gallery||!controls||!button)return false;

    injectStyle();

    button.addEventListener('click',event=>{
      if(!event.isTrusted)return;
      const before=stageFromUi();
      if(before===0)desiredLevel=Math.max(desiredLevel,1);
      else if(before===1)desiredLevel=2;
    },true);

    const observer=new MutationObserver(()=>scheduleRestore());
    observer.observe(gallery,{childList:true,subtree:true});
    observer.observe(controls,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});

    const filterDeck=document.querySelector('.filter-deck');
    filterDeck?.addEventListener('input',()=>scheduleRestore(),true);
    filterDeck?.addEventListener('change',()=>scheduleRestore(),true);
    filterDeck?.addEventListener('click',event=>{
      if(event.target.closest('button[data-cat],.gallery-filter-option'))scheduleRestore();
    },true);

    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(install()||attempts>160)clearInterval(timer);
    },50);
  }
})();
