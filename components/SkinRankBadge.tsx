'use client';

import { useState } from 'react';

type BadgeEdge={top:number;right:number;scale:number};
const badgeAlphaCache=new Map<string,Promise<BadgeEdge|null>>();
const MAX_BADGE_ANALYSIS_PIXELS=1500000;

// Analyze alpha only once per public R2 URL, using the already loaded image bytes.
function inspectBadgeAlpha(image:HTMLImageElement):BadgeEdge|null{
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height||width*height>MAX_BADGE_ANALYSIS_PIXELS)return null;
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return null;
    ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,width,height).data;
    let minX=width,minY=height,maxX=-1;
    for(let offset=3;offset<pixels.length;offset+=4){
      if(pixels[offset]===0)continue;
      const index=(offset-3)/4,x=index%width,y=Math.floor(index/width);
      if(x<minX)minX=x;
      if(y<minY)minY=y;
      if(x>maxX)maxX=x;
    }
    if(maxX<minX)return null;
    return {top:100*minY/height,right:100*(width-maxX-1)/width,scale:Math.min(2,width/(maxX-minX+1))};
  }catch{return null}
  finally{canvas.width=0;canvas.height=0}
}
function getBadgeAlpha(image:HTMLImageElement){
  const key=image.currentSrc||image.src;
  let pending=badgeAlphaCache.get(key);
  if(!pending){
    pending=Promise.resolve().then(()=>inspectBadgeAlpha(image));
    badgeAlphaCache.set(key,pending);
  }
  return pending;
}


const RANK_GRADIENTS: Record<string,string> = {
  A:'linear-gradient(180deg,#035365 0%,#045C6C 48%,#08929C 100%)',
  S:'linear-gradient(180deg,#60179E 0%,#4D128A 48%,#9244C0 100%)',
  'S+':'linear-gradient(180deg,#E07A38 0%,#D06331 45%,#C15429 100%)',
  SS:'linear-gradient(180deg,#D88D31 0%,#9E5F0F 48%,#EED76A 100%)',
  'SS+':'linear-gradient(180deg,#E6AF38 0%,#C48211 46%,#A86518 72%,#E06A27 100%)',
  SSS:'linear-gradient(180deg,#D82B22 0%,#941004 30%,#7E1008 62%,#F16132 100%)',
  'SSS+':'linear-gradient(120deg,#150F24 0%,#3A2289 18%,#4C30A7 34%,#6046B2 48%,#8069E0 63%,#A98FF1 75%,#C8B9F0 87%,#F9F8FB 100%)',
  'SSS+ Ultimate':'linear-gradient(120deg,#281141 0%,#624476 20%,#9F67B0 38%,#B282DE 52%,#F18DC0 67%,#F3AC9A 82%,#F9EFF8 100%)',
  'SSS+ Tối thượng':'linear-gradient(120deg,#281141 0%,#624476 20%,#9F67B0 38%,#B282DE 52%,#F18DC0 67%,#F3AC9A 82%,#F9EFF8 100%)'
};

type Props={rank:string;imageUrl?:string;className?:string};

export default function SkinRankBadge({rank,imageUrl,className=''}:Props){
  const [failedUrl,setFailedUrl]=useState('');
  const [alphaResult,setAlphaResult]=useState<{url:string;edge:BadgeEdge|null}|null>(null);
  const inspectable=Boolean(imageUrl&&!/\.(?:gif|webp)(?:$|[?#])/i.test(imageUrl));
  const edge=inspectable&&alphaResult&&alphaResult.url===imageUrl?alphaResult.edge:null;
  const imageTransform=edge?'scale('+edge.scale+') translate('+edge.right+'%, -'+edge.top+'%)':undefined;
  const showImage=Boolean(imageUrl&&imageUrl!==failedUrl);
  return <span
    className={['tier',showImage?'tier-image':'',className].filter(Boolean).join(' ')}
    style={showImage?undefined:{background:RANK_GRADIENTS[rank]||'var(--brand)'}}
    title={`Hạng skin: ${rank||'Chưa xếp hạng'}`}
  >
    {showImage?<img
      src={imageUrl}
      crossOrigin="anonymous"
      alt={'Hạng skin '+rank}
      loading="lazy"
      decoding="async"
      style={edge?{transform:imageTransform,transformOrigin:'top right'}:undefined}
      onLoad={event=>{
        if(!inspectable)return;
        const url=imageUrl||'';
        void getBadgeAlpha(event.currentTarget).then(result=>setAlphaResult({url,edge:result}));
      }}
      onError={()=>setFailedUrl(imageUrl||'')}
    />:rank||'-'}
  </span>;
}
