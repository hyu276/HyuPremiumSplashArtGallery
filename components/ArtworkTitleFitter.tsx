'use client';

import { useEffect } from 'react';

const DESKTOP_MIN_WIDTH=761;
const ABSOLUTE_MIN_FONT_SIZE=7;
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

function fitArtworkTitle(title:HTMLElement){
  const card=title.closest<HTMLElement>('.art-card');
  const copy=title.closest<HTMLElement>('.card-copy');
  if(!card||!copy)return;

  title.style.removeProperty('font-size');

  if(window.innerWidth<DESKTOP_MIN_WIDTH){
    clearDesktopTitleStyles(title);
    return;
  }

  // Preserve the one-line desktop treatment from the pre-Next.js gallery while
  // leaving overflow visible so Vietnamese glyph accents are not vertically clipped.
  title.style.display='block';
  title.style.width='100%';
  title.style.maxWidth='100%';
  title.style.whiteSpace='nowrap';
  title.style.overflow='visible';
  title.style.textOverflow='clip';
  title.style.lineHeight='1.14';
  title.style.letterSpacing='-.025em';
  title.style.paddingBlock='.08em .06em';

  const available=Math.floor(copy.clientWidth);
  if(available<=0)return;

  const maxSize=parseFloat(getComputedStyle(title).fontSize)||24;
  const minSize=Math.min(maxSize,card.classList.contains('expanded')?24:11);

  setTitleSize(title,maxSize);
  if(title.scrollWidth<=available+1)return;

  setTitleSize(title,minSize);
  if(title.scrollWidth>available+1){
    const ratio=available/title.scrollWidth;
    setTitleSize(title,minSize*ratio*.985);
    return;
  }

  let low=minSize;
  let high=maxSize;
  for(let i=0;i<9;i++){
    const mid=(low+high)/2;
    setTitleSize(title,mid);
    if(title.scrollWidth<=available+1)low=mid;
    else high=mid;
  }
  setTitleSize(title,low-.15);
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
