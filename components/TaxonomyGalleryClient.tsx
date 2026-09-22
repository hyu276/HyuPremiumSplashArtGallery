'use client';

import { Fragment, memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import ArtworkTitleFitter from '@/components/ArtworkTitleFitter';
import type { Artwork, ArtworkTaxonomyGroup } from '@/lib/catalogue';
import { artworkPreview, artworkSrcSet } from '@/lib/catalogue';

const INITIAL_EAGER_COUNT=6;

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

type TaxonomyMode='skinlines'|'universes';
type PreviewHold={width:number;height:number};
type ExpandedArtwork={groupName:string;artworkId:string}|null;

function titleFitBucket(value:string){const length=Array.from(String(value||'').trim()).length;return length>=52?'xxlong':length>=38?'xlong':length>=28?'long':length>=19?'medium':'short';}

const ViewportPreview=memo(function ViewportPreview({item,alt,eager,suspendLoad,holdSize,sizes}:{item:Artwork;alt:string;eager:boolean;suspendLoad:boolean;holdSize:PreviewHold|null;sizes:string}){
  const node=useRef<HTMLImageElement>(null);
  const [armed,setArmed]=useState(eager);
  const src=artworkPreview(item,960);
  const srcSet=artworkSrcSet(item);
  const holdStyle=holdSize?({
    left:'50%',top:'50%',right:'auto',bottom:'auto',
    width:`min(${Math.max(1,Math.round(holdSize.width))}px, calc(100% - 24px))`,
    height:'auto',
    aspectRatio:`${Math.max(1,Math.round(holdSize.width))} / ${Math.max(1,Math.round(holdSize.height))}`,
    transform:'translate(-50%,-50%)',
    filter:'none',
    opacity:1,
    transition:'none',
    boxShadow:'0 18px 54px rgba(0,0,0,.28)'
  } as CSSProperties):undefined;

  useEffect(()=>{
    if(armed||suspendLoad)return;
    const image=node.current;if(!image)return;
    if(typeof IntersectionObserver==='undefined'){setArmed(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setArmed(true);observer.disconnect();}
    },{rootMargin:'320px 0px'});
    observer.observe(image);
    return()=>observer.disconnect();
  },[armed,suspendLoad]);

  useEffect(()=>{if(eager&&!armed&&!suspendLoad)setArmed(true)},[eager,armed,suspendLoad]);

  return <img ref={node} className="preview" style={holdStyle} src={armed?src:undefined} srcSet={armed&&srcSet?srcSet:undefined} sizes={armed?sizes:undefined} data-src={armed?undefined:src} alt={alt} loading={eager?'eager':'lazy'} decoding="async" fetchPriority={eager?'high':'low'} />;
});

const ExpandedImage=memo(function ExpandedImage({item,onReady}:{item:Artwork;onReady:()=>void}){
  const [ready,setReady]=useState(false);
  useEffect(()=>{setReady(false)},[item.id]);
  return <img className={`full${ready?' ready':''}`} style={{transition:'none'}} src={artworkPreview(item,1600)} alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" onLoad={()=>{setReady(true);onReady()}}/>;
});

const GroupCard=memo(function GroupCard({group,index,mode,expanded,pending,onToggle,onReady}:{group:ArtworkTaxonomyGroup;index:number;mode:TaxonomyMode;expanded:boolean;pending:boolean;onToggle:(group:ArtworkTaxonomyGroup)=>void;onReady:(name:string)=>void}){
  const node=useRef<HTMLButtonElement>(null);
  const [hold,setHold]=useState<PreviewHold|null>(null);
  const rep=group.representative;
  const toggle=()=>{
    if(!expanded){
      const rect=node.current?.getBoundingClientRect();
      if(rect&&rect.width>0&&rect.height>0)setHold({width:rect.width,height:rect.height});
    }
    onToggle(group);
  };
  const sourceLabel=group.representativeSource==='manual'?'được chỉ định thủ công':'tự động theo hạng skin cao nhất';
  return <button ref={node} type="button" className={`art-card taxonomy-group-card${expanded?' expanded':''}${pending?' pending-expand':''}`} data-taxonomy-group={group.name} aria-expanded={expanded} aria-busy={pending} aria-label={`${expanded?'Thu gọn':'Mở'} ${group.name}`} onClick={toggle}>
    <span className="art-image-layer">
      <ViewportPreview item={rep} alt={`${group.name} — đại diện bởi ${rep.name}`} eager={index<INITIAL_EAGER_COUNT&&!expanded} suspendLoad={expanded} holdSize={expanded?hold:null} sizes="(max-width:760px) 50vw,(max-width:1180px) 33vw,20vw"/>
      {expanded?<ExpandedImage item={rep} onReady={()=>onReady(group.name)}/>:null}
    </span>
    <span className="shade" aria-hidden="true"/>
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[rep.rank]||'var(--brand)'}}>{rep.rank||'—'}</span>
    <span className="expand-mark" aria-hidden="true">{pending?'…':expanded?'−':'+'}</span>
    <span className="card-copy">
      <span className="card-meta">{mode==='skinlines'?'Trang phục theo bộ':'Dòng trang phục'}</span>
      <strong className="card-title" data-title-fit={titleFitBucket(group.name)}>{group.name}</strong>
      <span className="card-description">{group.items.length} artwork · Ảnh đại diện {sourceLabel}: {rep.name}.</span>
      <span className="card-bottom"><span>{String(group.items.length).padStart(2,'0')} artwork</span><span className="rank-label">Đại diện · {rep.name}</span></span>
    </span>
  </button>;
});

const ArtworkCard=memo(function ArtworkCard({item,index,expanded,pending,onToggle,onReady}:{item:Artwork;index:number;expanded:boolean;pending:boolean;onToggle:(item:Artwork)=>void;onReady:(id:string)=>void}){
  const node=useRef<HTMLButtonElement>(null);
  const [hold,setHold]=useState<PreviewHold|null>(null);
  const toggle=()=>{
    if(!expanded){
      const rect=node.current?.getBoundingClientRect();
      if(rect&&rect.width>0&&rect.height>0)setHold({width:rect.width,height:rect.height});
    }
    onToggle(item);
  };
  return <button ref={node} type="button" className={`art-card${expanded?' expanded':''}${pending?' pending-expand':''}`} data-taxonomy-art={item.id} aria-expanded={expanded} aria-busy={pending} aria-label={`${pending?'Đang tải ảnh lớn':expanded?'Thu gọn':'Mở rộng'} ${item.name}`} onClick={toggle}>
    <span className="art-image-layer">
      <ViewportPreview item={item} alt={`${item.name} — ${item.category}, splash art game, hạng skin ${item.rank}`} eager={index<INITIAL_EAGER_COUNT&&!expanded} suspendLoad={expanded} holdSize={expanded?hold:null} sizes="(max-width:760px) 50vw,(max-width:1180px) 33vw,20vw"/>
      {expanded?<ExpandedImage item={item} onReady={()=>onReady(item.id)}/>:null}
    </span>
    <span className="shade" aria-hidden="true"/>
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[item.rank]||'var(--brand)'}}>{item.rank||'—'}</span>
    <span className="expand-mark" aria-hidden="true">{pending?'…':expanded?'−':'+'}</span>
    <span className="card-copy">
      <span className="card-meta">{item.category}</span>
      <strong className="card-title" data-title-fit={titleFitBucket(item.name)}>{item.name}</strong>
      {item.description?<span className="card-description">{item.description}</span>:null}
      <span className="card-bottom"><span>CREDIT ẢNH · {item.credit}</span><span className="rank-label">{item.rank}</span></span>
    </span>
  </button>;
});

export default function TaxonomyGalleryClient({mode,groups}:{mode:TaxonomyMode;groups:ArtworkTaxonomyGroup[]}){
  const [expandedGroup,setExpandedGroup]=useState<string|null>(null);
  const [pendingGroup,setPendingGroup]=useState<string|null>(null);
  const [expandedArtwork,setExpandedArtwork]=useState<ExpandedArtwork>(null);
  const [pendingArtwork,setPendingArtwork]=useState<ExpandedArtwork>(null);

  const toggleGroup=useCallback((group:ArtworkTaxonomyGroup)=>{
    if(expandedGroup===group.name){
      setExpandedGroup(null);setPendingGroup(null);setExpandedArtwork(null);setPendingArtwork(null);return;
    }
    setExpandedArtwork(null);setPendingArtwork(null);
    setPendingGroup(group.name);setExpandedGroup(group.name);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const card=document.querySelector<HTMLElement>(`[data-taxonomy-group="${CSS.escape(group.name)}"]`);
      const mobile=window.matchMedia?.('(max-width:760px)').matches??false;
      card?.scrollIntoView({behavior:mobile?'auto':'smooth',block:'center'});
    }));
  },[expandedGroup]);

  const toggleArtwork=useCallback((groupName:string,item:Artwork)=>{
    if(expandedArtwork?.groupName===groupName&&expandedArtwork.artworkId===item.id){
      setExpandedArtwork(null);setPendingArtwork(null);return;
    }
    const next={groupName,artworkId:item.id};
    setPendingArtwork(next);setExpandedArtwork(next);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const card=document.querySelector<HTMLElement>(`[data-taxonomy-art="${CSS.escape(item.id)}"]`);
      const mobile=window.matchMedia?.('(max-width:760px)').matches??false;
      card?.scrollIntoView({behavior:mobile?'auto':'smooth',block:'center'});
    }));
  },[expandedArtwork]);

  if(!groups.length){
    return <section className="taxonomy-empty" aria-live="polite"><strong>Chưa có taxonomy được gán.</strong><span>Các artwork sẽ tự xuất hiện tại đây khi metadata được thêm vào catalogue.</span></section>;
  }

  return <section className="catalog taxonomy-catalog" id="catalog">
    <ArtworkTitleFitter/>
    <div className="results-line"><div><strong>{String(groups.length).padStart(2,'0')}</strong><span>{mode==='skinlines'?'bộ trang phục':'dòng trang phục'} đang hiển thị</span></div></div>
    <div className="gallery-grid taxonomy-groups-grid">
      {groups.map((group,index)=>{
        const open=expandedGroup===group.name;
        return <Fragment key={group.name}>
          <GroupCard group={group} index={index} mode={mode} expanded={open} pending={pendingGroup===group.name} onToggle={toggleGroup} onReady={name=>setPendingGroup(current=>current===name?null:current)}/>
          {open?<section className="taxonomy-gallery-panel" aria-label={`Artwork thuộc ${group.name}`}>
            <div className="taxonomy-gallery-panel-head">
              <div><span>{mode==='skinlines'?'Skinline gallery':'Universe gallery'}</span><strong>{group.name}</strong></div>
              <span>{String(group.items.length).padStart(2,'0')} artwork</span>
            </div>
            <div className="gallery-grid taxonomy-artwork-grid">
              {group.items.map((item,itemIndex)=>{
                const expanded=expandedArtwork?.groupName===group.name&&expandedArtwork.artworkId===item.id;
                const pending=pendingArtwork?.groupName===group.name&&pendingArtwork.artworkId===item.id;
                return <ArtworkCard key={item.id} item={item} index={itemIndex} expanded={expanded} pending={pending} onToggle={art=>toggleArtwork(group.name,art)} onReady={id=>setPendingArtwork(current=>current?.groupName===group.name&&current.artworkId===id?null:current)}/>;
              })}
            </div>
          </section>:null}
        </Fragment>;
      })}
    </div>
  </section>;
}
