'use client';

import { useEffect } from 'react';

function setTitleSize(title:HTMLElement,px:number){
  const rounded=Math.max(7,Math.round(px*10)/10);
  title.style.fontSize=`${rounded}px`;
}

function fitArtworkTitle(title:HTMLElement){
  const card=title.closest<HTMLElement>('.art-card');
  const copy=title.closest<HTMLElement>('.card-copy');
  if(!card||!copy)return;

  const normalized=(title.textContent||'').normalize('NFC');
  if(title.textContent!==normalized)title.textContent=normalized;

  title.style.removeProperty('font-size');
  title.style.removeProperty('letter-spacing');

  if(window.innerWidth<=760)return;

  title.style.display='block';
  title.style.width='100%';
  title.style.maxWidth='100%';
  title.style.whiteSpace='nowrap';
  title.style.overflow='visible';
  title.style.textOverflow='clip';

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
  root.querySelectorAll<HTMLElement>('.card-copy strong').forEach(fitArtworkTitle);
}

export default function ArtworkTitleFitter(){
  useEffect(()=>{
    let frame=0;
    let observer:MutationObserver|null=null;
    let catalog:HTMLElement|null=null;
    let cancelled=false;

    const schedule=(root:ParentNode=document)=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        if(!cancelled)fitArtworkTitles(root);
      });
    };

    const attach=()=>{
      if(cancelled)return;
      catalog=document.querySelector<HTMLElement>('#catalog');
      if(!catalog){
        frame=requestAnimationFrame(attach);
        return;
      }

      schedule(catalog);
      observer=new MutationObserver(()=>schedule(catalog||document));
      observer.observe(catalog,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      window.addEventListener('resize',()=>schedule(catalog||document),{passive:true});

      if(document.fonts?.ready){
        document.fonts.ready.then(()=>schedule(catalog||document));
        document.fonts.addEventListener?.('loadingdone',()=>schedule(catalog||document));
      }
    };

    attach();
    return()=>{
      cancelled=true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  },[]);

  return null;
}
