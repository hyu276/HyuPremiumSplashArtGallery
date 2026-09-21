'use client';

import { useRef, useState } from 'react';
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
type ExpandedArtwork={groupName:string;artwork:Artwork}|null;

function titleFitBucket(value:string){const length=Array.from(String(value||'').trim()).length;return length>=52?'xxlong':length>=38?'xlong':length>=28?'long':length>=19?'medium':'short';}
function groupPanelId(mode:TaxonomyMode,index:number){return `${mode}-gallery-${index+1}`;}

function ArtworkCard({item,index,onExpand}:{item:Artwork;index:number;onExpand:()=>void}){
  return <button type="button" className="art-card taxonomy-art-card" aria-label={`Mở ${item.name}`} onClick={onExpand}>
    <span className="art-image-layer">
      <img src={artworkPreview(item,640)} alt={`${item.name} — ${item.category}`} loading={index<5?'eager':'lazy'} decoding="async" fetchPriority="low" />
    </span>
    <span className="shade" />
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[item.rank]||RANK_GRADIENTS.A}}>{item.rank}</span>
    <span className="expand-mark">+</span>
    <span className="card-copy">
      <span className="card-meta">{item.category}</span>
      <strong className="card-title" data-title-fit={titleFitBucket(item.name)}>{item.name}</strong>
      <span className="card-bottom"><span>CREDIT ẢNH · {item.credit}</span><span className="rank-label">{item.rank}</span></span>
    </span>
  </button>;
}

function ExpandedStage({artwork,onClose}:{artwork:Artwork;onClose:()=>void}){
  return <div className="taxonomy-expanded-stage">
    <img src={artworkPreview(artwork,1600)} alt={`${artwork.name} — ${artwork.category}`} loading="eager" decoding="async" fetchPriority="high" />
    <span className="taxonomy-expanded-shade" />
    <div className="taxonomy-expanded-copy">
      <span className="card-meta">{artwork.category}</span>
      <strong>{artwork.name}</strong>
      <span className="card-bottom"><span>CREDIT ẢNH · {artwork.credit}</span><span className="rank-label">{artwork.rank}</span></span>
    </div>
    <button type="button" className="taxonomy-expanded-close" aria-label="Đóng artwork" onClick={onClose}>−</button>
  </div>;
}

export default function TaxonomyGalleryClient({mode,groups}:{mode:TaxonomyMode;groups:ArtworkTaxonomyGroup[]}){
  const [openGroups,setOpenGroups]=useState<string[]>([]);
  const [expanded,setExpanded]=useState<ExpandedArtwork>(null);
  const tracks=useRef<Record<string,HTMLDivElement|null>>({});

  function toggleGroup(name:string){
    setOpenGroups(current=>current.includes(name)?current.filter(value=>value!==name):[...current,name]);
    setExpanded(current=>current?.groupName===name?null:current);
  }

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
      const expandedArtwork=expanded?.groupName===group.name?expanded.artwork:null;
      return <section key={group.name} className={`taxonomy-group${isOpen?' is-open':''}`}>
        <button type="button" className="taxonomy-trigger" aria-expanded={isOpen} aria-controls={panelId} onClick={()=>toggleGroup(group.name)}>
          <span>
            <span className="taxonomy-index">{String(groupIndex+1).padStart(2,'0')}</span>
            <span className="taxonomy-name">{group.name}</span>
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
              {group.items.map((item,index)=><ArtworkCard key={item.id} item={item} index={index} onExpand={()=>setExpanded({groupName:group.name,artwork:item})}/>)}
            </div>
            {expandedArtwork?<ExpandedStage artwork={expandedArtwork} onClose={()=>setExpanded(null)}/>:null}
          </div>
        </div>:null}
      </section>;
    })}
  </div>;
}
