'use client';

import { useEffect } from 'react';

const DESKTOP_MIN_WIDTH=761;
const TITLE_SELECTOR='.art-card .card-copy strong';
const FIT_GAP_PX=.75;

function setTitleSize(title:HTMLElement,size:number){
  title.style.fontSize=`${Math.max(1,size).toFixed(3)}px`;
}

function clearDesktopTitleStyles(title:HTMLElement){
  for(const property of ['font-size','display','width','max-width','white-space','overflow','text-overflow','line-height','letter-spacing','padding-block']){
    title.style.removeProperty(property);
  }
}

function measureIntrinsicTitleWidth(title:HTMLElement){
  const previousWidth=title.style.width;
  const previousMaxWidth=title.style.maxWidth;

  // Measure the actual rendered element in its current browser/font engine,
  // including text-transform, kerning, letter-spacing and Vietnamese glyphs.
  // The card copy is absolutely positioned, so max-content measurement does
  // not alter the card or parent width.
  title.style.width='max-content';
  title.style.maxWidth='none';
  const width=title.getBoundingClientRect().width;
  title.style.width=previousWidth;
  title.style.maxWidth=previousMaxWidth;
  return width;
}

function fitArtworkTitle(title:HTMLElement){
  const copy=title.closest<HTMLElement>('.card-copy');
  if(!copy)return;

  // Every pass starts from the stylesheet size. There is no persistent
  // reduced size and no minimum-size tier: titles are resized only if their
  // default rendered width actually exceeds the available title area.
  title.style.removeProperty('font-size');

  if(window.innerWidth<DESKTOP_MIN_WIDTH){
    clearDesktopTitleStyles(title);
    return;
  }

  const normalized=(title.textContent||'').normalize('NFC');
  if(title.textContent!==normalized)title.textContent=normalized;

  title.style.display='block';
  title.style.width='100%';
  title.style.maxWidth='100%';
  title.style.whiteSpace='nowrap';
  title.style.overflow='visible';
  title.style.textOverflow='clip';
  title.style.lineHeight='1.14';
  title.style.letterSpacing='-.025em';
  title.style.paddingBlock='.08em .06em';

  const available=Math.max(0,copy.getBoundingClientRect().width-FIT_GAP_PX);
  if(available<=0)return;

  const defaultSize=parseFloat(getComputedStyle(title).fontSize)||24;
  const defaultWidth=measureIntrinsicTitleWidth(title);

  // Most titles stop here and keep the exact CSS-defined desktop font size.
  if(defaultWidth<=available){
    title.style.removeProperty('font-size');
    return;
  }

  // Overflow only: scale by the exact width ratio. Because font size and the
  // em-based letter spacing scale together, this lands very close to the
  // maximum size that fits on one line.
  let fittedSize=defaultSize*(available/defaultWidth);
  setTitleSize(title,fittedSize);

  // Correct browser font-hinting/sub-pixel differences in both directions.
  // This can increase as well as decrease the fitted size, so the final text
  // remains as large as possible while staying inside the boundary.
  for(let i=0;i<3;i++){
    const measured=measureIntrinsicTitleWidth(title);
    if(measured<=0)break;
    const correction=available/measured;
    if(Math.abs(1-correction)<0.0008)break;
    fittedSize=Math.min(defaultSize,fittedSize*correction);
    setTitleSize(title,fittedSize);
  }

  // One final overflow guard; never shrink further when the title already fits.
  const finalWidth=measureIntrinsicTitleWidth(title);
  if(finalWidth>available&&finalWidth>0){
    fittedSize*=available/finalWidth;
    setTitleSize(title,fittedSize);
  }
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