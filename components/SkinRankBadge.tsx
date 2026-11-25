'use client';

import { useState } from 'react';

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
  const showImage=Boolean(imageUrl&&imageUrl!==failedUrl);
  return <span
    className={['tier',showImage?'tier-image':'',className].filter(Boolean).join(' ')}
    style={showImage?undefined:{background:RANK_GRADIENTS[rank]||'var(--brand)'}}
    title={`Hạng skin: ${rank||'Chưa xếp hạng'}`}
  >
    {showImage?<img src={imageUrl} alt={`Hạng skin ${rank}`} loading="lazy" decoding="async" onError={()=>setFailedUrl(imageUrl||'')}/>:rank||'-'}
  </span>;
}
