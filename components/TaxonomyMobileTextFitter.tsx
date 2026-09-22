'use client';

import { useEffect } from 'react';

type FitOptions={max:number;min:number;maxLines:number};

function clearInlineFit(element:HTMLElement){
  element.style.removeProperty('font-size');
  element.style.removeProperty('line-height');
  element.style.removeProperty('white-space');
  element.style.removeProperty('display');
  element.style.removeProperty('overflow');
}

function fitText(element:HTMLElement,{max,min,maxLines}:FitOptions){
  if(window.innerWidth>760){
    clearInlineFit(element);
    return;
  }
  const normalized=(element.textContent||'').normalize('NFC');
  if(element.textContent!==normalized)element.textContent=normalized;

  const width=element.clientWidth;
  if(width<=0)return;

  element.style.whiteSpace=maxLines===1?'nowrap':'normal';
  element.style.display='block';
  element.style.overflow='hidden';

  let chosen=Math.floor(min);
  for(let size=Math.floor(max);size>=Math.floor(min);size--){
    element.style.fontSize=`${size}px`;
    const lineHeight=Math.ceil(size*1.10);
    element.style.lineHeight=`${lineHeight}px`;
    const widthOK=element.scrollWidth<=element.clientWidth+1;
    const heightOK=element.scrollHeight<=lineHeight*maxLines+1;
    if(widthOK&&heightOK){
      chosen=size;
      break;
    }
  }

  element.style.fontSize=`${Math.floor(chosen)}px`;
  element.style.lineHeight=`${Math.ceil(chosen*1.10)}px`;
}

function fitAll(root:ParentNode=document){
  root.querySelectorAll<HTMLElement>('.taxonomy-name').forEach(element=>fitText(element,{max:38,min:16,maxLines:2}));
  root.querySelectorAll<HTMLElement>('.taxonomy-expanded-title').forEach(element=>fitText(element,{max:42,min:16,maxLines:1}));
}

export default function TaxonomyMobileTextFitter(){
  useEffect(()=>{
    let frame=0;
    let observer:MutationObserver|null=null;
    let root:HTMLElement|null=null;
    let cancelled=false;

    const schedule=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{if(!cancelled)fitAll(root||document)});
    };

    const attach=()=>{
      if(cancelled)return;
      root=document.querySelector<HTMLElement>('#catalog');
      if(!root){
        frame=requestAnimationFrame(attach);
        return;
      }
      schedule();
      observer=new MutationObserver(schedule);
      observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      window.addEventListener('resize',schedule,{passive:true});
      if(document.fonts?.ready){
        document.fonts.ready.then(schedule);
        document.fonts.addEventListener?.('loadingdone',schedule);
      }
    };

    attach();
    return()=>{
      cancelled=true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize',schedule);
      document.fonts?.removeEventListener?.('loadingdone',schedule);
    };
  },[]);

  return null;
}
