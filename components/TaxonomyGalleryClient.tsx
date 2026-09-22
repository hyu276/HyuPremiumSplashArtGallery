'use client';

import { useRef, useState, type CSSProperties } from 'react';
import ArtworkTitleFitter from '@/components/ArtworkTitleFitter';
import type { Artwork, ArtworkTaxonomyGroup } from '@/lib/catalogue';
import { artworkPreview } from '@/lib/catalogue';

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
type ExpandedArtwork={groupName:string;artworkId:string}|null;
type PreviewHold={width:number;height:number};

function titleFitBucket(value:string){const length=Array.from(String(value||'').trim()).length;return length>=52?'xxlong':length>=38?'xlong':length>=28?'long':length>=19?'medium':'short';}
function groupPanelId(mode:TaxonomyMode,index:number){return `${mode}-gallery-${index+1}`;}

function ArtworkCard({item,index,expanded,pending,onToggle,onReady}:{item:Artwork;index:number;expanded:boolean;pending:boolean;onToggle:()=>void;onReady:()=>void}){
  const cardNode=useRef<HTMLButtonElement>(null);
  const [previewHold,setPreviewHold]=useState<PreviewHold|null>(null);
  const [fullReady,setFullReady]=useState(false);
  const motionStyle={'--art-motion-delay':`${Math.min(index,12)*18}ms`} as CSSProperties;
  const holdStyle=expanded&&previewHold?({
    left:'50%',top:'50%',right:'auto',bottom:'auto',
    width:`min(${Math.max(1,Math.round(previewHold.width))}px, calc(100% - 24px))`,
    height:'auto',
    aspectRatio:`${Math.max(1,Math.round(previewHold.width))} / ${Math.max(1,Math.round(previewHold.height))}`,
    transform:'translate(-50%,-50%)',
    filter:'none',
    opacity:fullReady?0:1,
    transition:'opacity .16s ease',
    boxShadow:'0 18px 54px rgba(0,0,0,.28)'
  } as CSSProperties):undefined;

  function toggle(){
    if(!expanded){
      const rect=cardNode.current?.getBoundingClientRect();
      if(rect&&rect.width>0&&rect.height>0)setPreviewHold({width:rect.width,height:rect.height});
      setFullReady(false);
    }
    onToggle();
  }

  return <button
    ref={cardNode}
    type="button"
    style={motionStyle}
    className={`art-card taxonomy-art-card${expanded?' expanded':''}${pending?' pending-expand':''}`}
    data-taxonomy-artwork={item.id}
    aria-expanded={expanded}
    aria-busy={pending}
    aria-label={pending?`Đang tải ảnh lớn ${item.name}`:expanded?`Thu gọn ${item.name}`:`Mở ${item.name}`}
    onClick={toggle}
  >
    <span className="art-image-layer">
      <img className="preview" style={holdStyle} src={artworkPreview(item,640)} alt={`${item.name} — ${item.category}`} loading={index<5?'eager':'lazy'} decoding="async" fetchPriority="low" />
      {expanded?<img
        className={`full${fullReady?' ready':''}`}
        src={artworkPreview(item,1600)}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onLoad={()=>{setFullReady(true);onReady();}}
      />:null}
    </span>
    <span className="shade" aria-hidden="true" />
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[item.rank]||RANK_GRADIENTS.A}}>{item.rank}</span>
    <span className="expand-mark" aria-hidden="true">{pending?'…':expanded?'−':'+'}</span>
    <span className="card-copy">
      <span className="card-meta">{item.category}</span>
      <strong className="card-title" data-title-fit={titleFitBucket(item.name)}>{item.name}</strong>
      {item.description?<span className="card-description">{item.description}</span>:null}
      <span className="card-bottom"><span>CREDIT ẢNH · {item.credit}</span><span className="rank-label">{item.rank}</span></span>
    </span>
  </button>;
}

export default function TaxonomyGalleryClient({mode,groups}:{mode:TaxonomyMode;groups:ArtworkTaxonomyGroup[]}){
  const [openGroups,setOpenGroups]=useState<string[]>([]);
  const [expanded,setExpanded]=useState<ExpandedArtwork>(null);
  const [pendingExpanded,setPendingExpanded]=useState<string|null>(null);
  const tracks=useRef<Record<string,HTMLDivElement|null>>({});

  function toggleGroup(name:string){
    setOpenGroups(current=>current.includes(name)?current.filter(value=>value!==name):[...current,name]);
    if(expanded?.groupName===name){setExpanded(null);setPendingExpanded(null);}
  }

  function toggleArtwork(groupName:string,item:Artwork){
    if(expanded?.groupName===groupName&&expanded.artworkId===item.id){
      setExpanded(null);
      setPendingExpanded(null);
      return;
    }
    setExpanded({groupName,artworkId:item.id});
    setPendingExpanded(item.id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const track=tracks.current[groupName];
      const card=track?.querySelector<HTMLElement>(`[data-taxonomy-artwork="${CSS.escape(item.id)}"]`);
      const mobile=window.matchMedia?.('(max-width: 760px)').matches??false;
      card?.scrollIntoView({behavior:mobile?'auto':'smooth',block:'center',inline:'nearest'});
    }));
  }

  function markReady(id:string){setPendingExpanded(current=>current===id?null:current);}

  function scrollGroup(name:string,direction:-1|1){
    const track=tracks.current[name];
    if(!track)return;
    track.scrollBy({left:track.clientWidth*.82*direction,behavior:'smooth'});
  }

  if(!groups.length){
    return <section className="taxonomy-empty" aria-live="polite">
      <strong>Chưa có taxonomy được gán.</strong>
      <span>Các artwork sẽ tự xuất hiện tại đây khi metadata {mode==='skinlines'?'skinlines':'universes'} được thêm vào catalogue.</span>
    </section>;
  }

  return <div className="taxonomy-stack" id="catalog">
    <ArtworkTitleFitter />
    {groups.map((group,groupIndex)=>{
      const isOpen=openGroups.includes(group.name);
      const panelId=groupPanelId(mode,groupIndex);
      return <section key={group.name} className={`taxonomy-group${isOpen?' is-open':''}`}>
        <button type="button" className="taxonomy-trigger" aria-expanded={isOpen} aria-controls={panelId} onClick={()=>toggleGroup(group.name)}>
          <span className="taxonomy-representative" aria-hidden="true">
            <img src={artworkPreview(group.representative,960)} alt="" loading={groupIndex<3?'eager':'lazy'} decoding="async" fetchPriority="low" />
          </span>
          <span className="taxonomy-heading">
            <span className="taxonomy-index">{String(groupIndex+1).padStart(2,'0')}</span>
            <span className="taxonomy-name">{group.name}</span>
            <span className="taxonomy-representative-label">Đại diện · {group.representative.name}</span>
          </span>
          <span className="taxonomy-meta">
            <span><span className="taxonomy-count">{String(group.items.length).padStart(2,'0')}</span> artwork</span>
            <span className="taxonomy-toggle" aria-hidden="true">+</span>
          </span>
        </button>
        {isOpen?<div className="gallery-drawer" id={panelId}>
          <div className="carousel-shell">
            <div className="carousel-topline">
              <span className="carousel-label">Gallery carousel · <strong>{group.name}</strong></span>
              <span className="carousel-controls">
                <button type="button" className="carousel-arrow" aria-label={`Cuộn ${group.name} sang trái`} onClick={()=>scrollGroup(group.name,-1)}>←</button>
                <button type="button" className="carousel-arrow" aria-label={`Cuộn ${group.name} sang phải`} onClick={()=>scrollGroup(group.name,1)}>→</button>
              </span>
            </div>
            <div ref={node=>{tracks.current[group.name]=node;}} className="taxonomy-gallery-carousel" role="group" aria-label={`Artwork thuộc ${group.name}`}>
              {group.items.map((item,index)=>{
                const isExpanded=expanded?.groupName===group.name&&expanded.artworkId===item.id;
                return <ArtworkCard key={item.id} item={item} index={index} expanded={isExpanded} pending={isExpanded&&pendingExpanded===item.id} onToggle={()=>toggleArtwork(group.name,item)} onReady={()=>markReady(item.id)}/>;
              })}
            </div>
          </div>
        </div>:null}
      </section>;
    })}
  </div>;
}
