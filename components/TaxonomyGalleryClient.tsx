'use client';

import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import ArtworkTitleFitter from '@/components/ArtworkTitleFitter';
import type { Artwork, ArtworkTaxonomyGroup } from '@/lib/catalogue';
import { artworkPreview, artworkSrcSet } from '@/lib/catalogue';

const INITIAL_EAGER_COUNT=6;

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
type PreviewHold={width:number;height:number};

function titleFitBucket(value:string){const length=Array.from(String(value||'').trim()).length;return length>=52?'xxlong':length>=38?'xlong':length>=28?'long':length>=19?'medium':'short';}
function runMotionTransition(update:()=>void){update();}

const ExpandedArtwork=memo(function ExpandedArtwork({src,onReady}:{src:string;onReady:()=>void}){
  const [ready,setReady]=useState(false);
  return <img className={`full${ready?' ready':''}`} style={{transition:'none'}} src={src} alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" onLoad={()=>{setReady(true);onReady()}}/>;
});

const ArtworkCard=memo(function ArtworkCard({item,index,expanded,pending,onToggle,onReady}:{item:Artwork;index:number;expanded:boolean;pending:boolean;onToggle:(item:Artwork)=>void;onReady:(id:string)=>void}){
  const cardRef=useRef<HTMLButtonElement>(null);
  const [previewHold,setPreviewHold]=useState<PreviewHold|null>(null);
  const motionStyle={'--art-motion-delay':`${Math.min(index,12)*18}ms`} as CSSProperties;
  const holdStyle=previewHold&&expanded?({left:'50%',top:'50%',right:'auto',bottom:'auto',width:`min(${Math.max(1,Math.round(previewHold.width))}px, calc(100% - 24px))`,height:'auto',aspectRatio:`${Math.max(1,Math.round(previewHold.width))} / ${Math.max(1,Math.round(previewHold.height))}`,transform:'translate(-50%,-50%)',filter:'none',opacity:1,transition:'none',boxShadow:'0 18px 54px rgba(0,0,0,.28)'} as CSSProperties):undefined;
  const toggle=()=>{if(!expanded){const rect=cardRef.current?.getBoundingClientRect();if(rect?.width&&rect?.height)setPreviewHold({width:rect.width,height:rect.height})}onToggle(item)};
  return <button ref={cardRef} style={motionStyle} type="button" className={`art-card${expanded?' expanded':''}${pending?' pending-expand':''}`} data-taxonomy-art={item.id} aria-expanded={expanded} aria-busy={pending} aria-label={`${expanded?'Thu gọn':'Mở rộng'} ${item.name}`} onClick={toggle}>
    <span className="art-image-layer">
      <img className="preview" style={holdStyle} src={artworkPreview(item,960)} srcSet={artworkSrcSet(item)||undefined} sizes="(max-width:760px) 50vw,(max-width:1200px) 50vw,20vw" alt={`${item.name} — ${item.category}, splash art game, hạng skin ${item.rank}`} loading={index<INITIAL_EAGER_COUNT&&!expanded?'eager':'lazy'} decoding="async" fetchPriority={index<INITIAL_EAGER_COUNT&&!expanded?'high':'low'}/>
      {expanded?<ExpandedArtwork src={artworkPreview(item,1600)} onReady={()=>onReady(item.id)}/>:null}
    </span>
    <span className="shade" aria-hidden="true"/>
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[item.rank]||'var(--brand)'}}>{item.rank||'—'}</span>
    <span className="expand-mark" aria-hidden="true">{pending?'…':expanded?'−':'+'}</span>
    <span className="card-copy"><span className="card-meta">{item.category}</span><strong className="card-title" data-title-fit={titleFitBucket(item.name)}>{item.name}</strong>{item.description?<span className="card-description">{item.description}</span>:null}<span className="card-bottom"><span>CREDIT ẢNH · {item.credit}</span><span className="rank-label">{item.rank}</span></span></span>
  </button>;
});

function TaxonomyCoverCard({group,index,mode,onOpen}:{group:ArtworkTaxonomyGroup;index:number;mode:TaxonomyMode;onOpen:()=>void}){
  const representative=group.representative;
  const label=mode==='skinlines'?'Trang phục theo bộ':'Dòng trang phục';
  return <button type="button" className="art-card taxonomy-cover-card" style={{'--art-motion-delay':`${Math.min(index,12)*18}ms`} as CSSProperties} aria-label={`Mở ${label} ${group.name}`} onClick={onOpen}>
    <span className="art-image-layer"><img className="preview" src={artworkPreview(representative,960)} srcSet={artworkSrcSet(representative)||undefined} sizes="(max-width:760px) 50vw,(max-width:1200px) 33vw,20vw" alt={`Artwork đại diện ${group.name}: ${representative.name}`} loading={index<INITIAL_EAGER_COUNT?'eager':'lazy'} decoding="async" fetchPriority={index<INITIAL_EAGER_COUNT?'high':'low'}/></span>
    <span className="shade" aria-hidden="true"/>
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[representative.rank]||'var(--brand)'}}>{representative.rank||'—'}</span>
    <span className="expand-mark taxonomy-cover-arrow" aria-hidden="true">→</span>
    <span className="card-copy"><span className="card-meta">{label}</span><strong className="card-title" data-title-fit={titleFitBucket(group.name)}>{group.name}</strong><span className="card-bottom"><span>{group.items.length} ARTWORK</span><span className="rank-label">ĐẠI DIỆN · {representative.name}</span></span></span>
  </button>;
}

export default function TaxonomyGalleryClient({mode,groups}:{mode:TaxonomyMode;groups:ArtworkTaxonomyGroup[]}){
  const [query,setQuery]=useState('');
  const [activeName,setActiveName]=useState('');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [pendingExpanded,setPendingExpanded]=useState<string|null>(null);
  const catalogRef=useRef<HTMLDivElement>(null);
  const label=mode==='skinlines'?'Trang phục theo bộ':'Dòng trang phục';
  const active=groups.find(group=>group.name===activeName)||null;
  const filteredGroups=useMemo(()=>{const needle=query.trim().toLowerCase();if(!needle)return groups;return groups.filter(group=>[group.name,group.representative.name,group.representative.category,group.representative.rank].join(' ').toLowerCase().includes(needle))},[groups,query]);

  const scrollCatalog=()=>requestAnimationFrame(()=>catalogRef.current?.scrollIntoView({behavior:window.matchMedia?.('(max-width:760px)').matches?'auto':'smooth',block:'start'}));
  const openGroup=(name:string)=>runMotionTransition(()=>{setActiveName(name);setExpanded(null);setPendingExpanded(null);scrollCatalog()});
  const closeGroup=()=>runMotionTransition(()=>{setActiveName('');setExpanded(null);setPendingExpanded(null);scrollCatalog()});
  const markReady=useCallback((id:string)=>setPendingExpanded(current=>current===id?null:current),[]);
  const toggleArtwork=useCallback((item:Artwork)=>{
    if(expanded===item.id){setExpanded(null);setPendingExpanded(null);return}
    setExpanded(item.id);setPendingExpanded(item.id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector(`[data-taxonomy-art="${CSS.escape(item.id)}"]`)?.scrollIntoView({behavior:window.matchMedia?.('(max-width:760px)').matches?'auto':'smooth',block:'center'})));
  },[expanded]);

  if(!groups.length)return <section className="taxonomy-empty"><strong>Chưa có {label.toLowerCase()}.</strong><span>Taxonomy sẽ xuất hiện khi artwork được gán trong admin.</span></section>;

  return <div className="taxonomy-gallery-browser" id="catalog" ref={catalogRef}>
    <ArtworkTitleFitter/>
    {!active?<>
      <div className="filter-deck taxonomy-filter-deck"><label className="search-wrap"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off" placeholder={`Tìm ${label.toLowerCase()}...`} aria-label={`Tìm ${label.toLowerCase()}`}/></label><div className="taxonomy-filter-note">Chọn một bộ để mở gallery</div></div>
      <div className="results-line"><p><b>{String(filteredGroups.length).padStart(2,'0')}</b> / {groups.length} {label.toLowerCase()}</p><span>Artwork đại diện cố định · không xoay tua</span></div>
      <div className="gallery-grid taxonomy-cover-grid">{filteredGroups.map((group,index)=><TaxonomyCoverCard key={group.name} group={group} index={index} mode={mode} onOpen={()=>openGroup(group.name)}/>)}</div>
      {!filteredGroups.length?<div className="empty-state">Không có kết quả phù hợp.</div>:null}
    </>:<>
      <div className="filter-deck taxonomy-active-deck"><button type="button" className="taxonomy-back" onClick={closeGroup}>← Tất cả {label.toLowerCase()}</button><div className="taxonomy-active-copy"><span>{label}</span><strong>{active.name}</strong></div></div>
      <div className="results-line"><p><b>{String(active.items.length).padStart(2,'0')}</b> artwork</p><span>Đại diện · {active.representative.name} · {active.representative.rank}</span></div>
      <div className="gallery-grid taxonomy-items-grid">{active.items.map((item,index)=><ArtworkCard key={item.id} item={item} index={index} expanded={expanded===item.id} pending={pendingExpanded===item.id} onToggle={toggleArtwork} onReady={markReady}/>)}</div>
    </>}
  </div>;
}
