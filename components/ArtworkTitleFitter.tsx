'use client';

import { useEffect } from 'react';

const DESKTOP_MIN_WIDTH=761;
const ABSOLUTE_MIN_FONT_SIZE=7;
const FIT_SAFETY_PX=2;
const TITLE_SELECTOR='.art-card .card-copy strong';

function setTitleSize(title:HTMLElement,size:number){
  const rounded=Math.max(ABSOLUTE_MIN_FONT_SIZE,Math.round(size*10)/10);
  title.style.fontSize=`${rounded}px`;
}

function clearDesktopTitleStyles(title:HTMLElement){
  for(const property of ['font-size','display','width','max-width','white-space','overflow','text-overflow','line-height','letter-spacing','padding-block']){
    title.style.removeProperty(property);
  }
}

function measureRenderedTextWidth(title:HTMLElement){
  const range=document.createRange();
  range.selectNodeContents(title);
  const width=range.getBoundingClientRect().width;
  range.detach?.();
  return width;
}

function fitArtworkTitle(title:HTMLElement){
  const copy=title.closest<HTMLElement>('.card-copy');
  if(!copy)return;

  title.style.removeProperty('font-size');

  if(window.innerWidth<DESKTOP_MIN_WIDTH){
    clearDesktopTitleStyles(title);
    return;
  }

  const normalized=(title.textContent||'').normalize('NFC');
  if(title.textContent!==normalized)title.textContent=normalized;

  // Keep the desktop title on one line while allowing Vietnamese diacritics
  // to render outside the glyph box instead of being vertically clipped.
  title.style.display='block';
  title.style.width='100%';
  title.style.maxWidth='100%';
  title.style.whiteSpace='nowrap';
  title.style.overflow='visible';
  title.style.textOverflow='clip';
  title.style.lineHeight='1.14';
  title.style.letterSpacing='-.025em';
  title.style.paddingBlock='.08em .06em';

  const available=Math.max(0,copy.getBoundingClientRect().width-FIT_SAFETY_PX);
  if(available<=0)return;

  // Always start from the stylesheet's intended desktop size. If it already
  // fits, leave font-size unset so short/medium titles retain their full size.
  const maxSize=parseFloat(getComputedStyle(title).fontSize)||24;
  setTitleSize(title,maxSize);

  let measured=measureRenderedTextWidth(title);
  if(measured<=available){
    title.style.removeProperty('font-size');
    return;
  }

  // Fit from the intrinsic rendered glyph width rather than element
  // scrollWidth. The latter is distorted by width:100% in the current flex /
  // absolute card layout and was causing mildly-long titles to collapse near
  // the old minimum size.
  let fittedSize=maxSize*(available/measured);

  // A few ratio corrections handle font hinting / sub-pixel rounding without
  // a wide binary search that can overshoot downward.
  for(let i=0;i<4;i++){
    setTitleSize(title,fittedSize);
    measured=measureRenderedTextWidth(title);
    if(measured<=0)break;

    const correction=available/measured;
    if(Math.abs(1-correction)<0.0025)break;
    fittedSize=Math.min(maxSize,fittedSize*correction);
  }

  setTitleSize(title,fittedSize*.997);
}

function fitArtworkTitles(root:ParentNode=document){
  root.querySelectorAll<HTMLElement>(TITLE_SELECTOR).forEach(fitArtworkTitle);
}

export default function ArtworkTitleFitter(){
  useEffect(()=>{
    let frame=0;
    let observer:MutationObserver|null=null;
    let sizeObserver:ResizeObserver|null=null;
    let catalog:HTMLElement|null=null;
    let cancelled=false;

    const schedule=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        if(!cancelled)fitArtworkTitles(catalog||document);
      });
    };

    const attach=()=>{
      if(cancelled)return;
      catalog=document.querySelector<HTMLElement>('#catalog');
      if(!catalog){
        frame=requestAnimationFrame(attach);
        return;
      }

      schedule();
      observer=new MutationObserver(schedule);
      observer.observe(catalog,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});

      if(typeof ResizeObserver!=='undefined'){
        sizeObserver=new ResizeObserver(schedule);
        sizeObserver.observe(catalog);
      }

      window.addEventListener('resize',schedule,{passive:true});
      document.fonts?.ready.then(()=>{if(!cancelled)schedule()});
    };

    attach();
    return()=>{
      cancelled=true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      sizeObserver?.disconnect();
      window.removeEventListener('resize',schedule);
    };
  },[]);

  return null;
}