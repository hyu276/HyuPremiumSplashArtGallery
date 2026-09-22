'use client';

import { memo, useRef, useState, type CSSProperties } from 'react';
import ArtworkTitleFitter from '@/components/ArtworkTitleFitter';
import TaxonomyMobileTextFitter from '@/components/TaxonomyMobileTextFitter';
import type { Artwork, ArtworkTaxonomyGroup } from '@/lib/catalogue';
import { artworkExpandedUrl, artworkPreview, artworkSrcSet } from '@/lib/catalogue';

const INITIAL_EAGER_COUNT=5;

const RANK_GRADIENTS:Record<string,string>={
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

type TaxonomyMode='skinlines'|'universes';

function titleFitBucket(value:string){const length=Array.from(String(value||'').trim()).length;return length>=52?'xxlong':length>=38?'xlong':length>=28?'long':length>=19?'medium':'short';}

const ArtworkCard=memo(function ArtworkCard({item,index,onExpand}:{item:Artwork;index:number;onExpand:()=>void}){
  const motionStyle={'--art-motion-delay':`${Math.min(index,12)*18}ms`} as CSSProperties;
  return <button type="button" style={motionStyle} className="art-card taxonomy-art-card" aria-label={`Mở rộng ${item.name}`} onClick={onExpand}>
    <span className="art-image-layer"><img className="preview" src={artworkPreview(item,640)} srcSet={artworkSrcSet(item)||undefined} sizes="(max-width:760px) 50vw,(max-width:1180px) 33vw,20vw" alt={`${item.name} — ${item.category}, splash art game, hạng skin ${item.rank}`} loading={index<INITIAL_EAGER_COUNT?'eager':'lazy'} decoding="async" fetchPriority={index<INITIAL_EAGER_COUNT?'high':'low'}/></span>
    <span className="shade" aria-hidden="true"/>
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[item.rank]||'var(--brand)'}}>{item.rank||'—'}</span>
    <span className="expand-mark" aria-hidden="true">+</span>
    <span className="card-copy"><span className="card-meta">{item.category}</span><strong className="card-title" data-title-fit={titleFitBucket(item.name)}>{item.name}</strong><span className="card-bottom"><span>CREDIT ẢNH · {item.credit}</span><span className="rank-label">{item.rank}</span></span></span>
  </button>;
});

function ExpandedStage({item,onClose}:{item:Artwork;onClose:()=>void}){
  return <div className="taxonomy-expanded-stage">
    <img src={artworkExpandedUrl(item)} alt={`${item.name} — ${item.category}`} loading="eager" decoding="async" fetchPriority="high"/>
    <span className="taxonomy-expanded-shade" aria-hidden="true"/>
    <span className="tier taxonomy-expanded-tier" style={{background:RANK_GRADIENTS[item.rank]||'var(--brand)'}}>{item.rank||'—'}</span>
    <div className="taxonomy-expanded-copy">
      <span className="card-meta">{item.category}</span>
      <strong className="taxonomy-expanded-title">{item.name}</strong>
      {item.description?<p>{item.description}</p>:null}
    </div>
    <button type="button" className="taxonomy-expanded-close" aria-label={`Thu gọn ${item.name}`} onClick={onClose}>−</button>
  </div>;
}

export default function TaxonomyGalleryClient({mode,groups}:{mode:TaxonomyMode;groups:ArtworkTaxonomyGroup[]}){
  const [openName,setOpenName]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<{group:string;item:Artwork}|null>(null);
  const tracks=useRef<Record<string,HTMLDivElement|null>>({});
  const label=mode==='skinlines'?'Trang phục theo bộ':'Dòng trang phục';

  function toggleGroup(name:string){
    const opening=openName!==name;
    setOpenName(opening?name:null);
    setExpanded(null);
    if(opening)requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector(`[data-taxonomy-group="${CSS.escape(name)}"]`)?.scrollIntoView({behavior:window.matchMedia?.('(max-width:760px)').matches?'auto':'smooth',block:'start'})));
  }

  function scrollGroup(name:string,direction:-1|1){
    const track=tracks.current[name];
    if(!track)return;
    track.scrollBy({left:track.clientWidth*.82*direction,behavior:'smooth'});
  }

  function expandArtwork(groupName:string,item:Artwork){
    setExpanded(current=>current?.group===groupName&&current.item.id===item.id?null:{group:groupName,item});
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector(`[data-taxonomy-expanded="${CSS.escape(groupName)}"]`)?.scrollIntoView({behavior:window.matchMedia?.('(max-width:760px)').matches?'auto':'smooth',block:'center'})));
  }

  if(!groups.length)return <section className="taxonomy-empty"><strong>Chưa có {label.toLowerCase()}.</strong><span>Taxonomy sẽ xuất hiện khi artwork được gán trong admin.</span></section>;

  return <main className="taxonomy-stack" id="catalog">
    <ArtworkTitleFitter/>
    <TaxonomyMobileTextFitter/>
    {groups.map((group,index)=>{
      const isOpen=openName===group.name;
      const representative=group.representative;
      const expandedItem=expanded?.group===group.name?expanded.item:null;
      return <section key={group.name} className={`taxonomy-group${isOpen?' is-open':''}`} data-taxonomy-group={group.name}>
        <button type="button" className="taxonomy-trigger" aria-expanded={isOpen} aria-controls={`taxonomy-drawer-${index}`} onClick={()=>toggleGroup(group.name)}>
          <span className="taxonomy-heading">
            <span className="taxonomy-index">{String(index+1).padStart(2,'0')}</span>
            <span className="taxonomy-name">{group.name}</span>
          </span>
          <span className="rep-preview" aria-hidden="true">
            <img className="rep-art" src={artworkPreview(representative,640)} srcSet={artworkSrcSet(representative)||undefined} sizes="(max-width:760px) 121px,153px" alt="" loading={index<INITIAL_EAGER_COUNT?'eager':'lazy'} decoding="async" fetchPriority={index<INITIAL_EAGER_COUNT?'high':'low'}/>
          </span>
          <span className="taxonomy-meta">
            <span><span className="taxonomy-count">{String(group.items.length).padStart(2,'0')}</span> artwork</span>
            <span className="taxonomy-toggle" aria-hidden="true">+</span>
          </span>
        </button>
        {isOpen?<div className="gallery-drawer" id={`taxonomy-drawer-${index}`}>
          <div className="carousel-shell">
            <div className="carousel-topline">
              <span className="carousel-label">Gallery carousel · <strong>{group.name}</strong></span>
              <span className="carousel-controls">
                <button type="button" className="carousel-arrow" aria-label={`Cuộn ${group.name} sang trái`} onClick={()=>scrollGroup(group.name,-1)}>←</button>
                <button type="button" className="carousel-arrow" aria-label={`Cuộn ${group.name} sang phải`} onClick={()=>scrollGroup(group.name,1)}>→</button>
              </span>
            </div>
            <div ref={node=>{tracks.current[group.name]=node;}} className="taxonomy-gallery-carousel" role="group" aria-label={`Artwork thuộc ${group.name}`}>
              {group.items.map((item,itemIndex)=><ArtworkCard key={item.id} item={item} index={itemIndex} onExpand={()=>expandArtwork(group.name,item)}/>)}
            </div>
            {expandedItem?<div data-taxonomy-expanded={group.name}><ExpandedStage item={expandedItem} onClose={()=>setExpanded(null)}/></div>:null}
          </div>
        </div>:null}
      </section>;
    })}
  </main>;
}
