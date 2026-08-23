'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Artwork, Catalogue } from '@/lib/catalogue';
import { artworkPath, slug } from '@/lib/catalogue';

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

function norm(value:string){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9+]+/g,' ').trim()}
function matches(item:Artwork, query:string){if(!query)return true;const needle=norm(query);const hay=norm([item.name,item.description,item.category,item.rank,item.credit,...item.tags].join(' '));if(hay.includes(needle))return true;let p=0;for(const ch of needle.replace(/\s/g,'')){p=hay.indexOf(ch,p);if(p<0)return false;p++}return true}

const ArtworkCard = memo(function ArtworkCard({item,index,expanded,onToggle}:{item:Artwork,index:number,expanded:boolean,onToggle:(item:Artwork)=>void}){
  const [fullReady,setFullReady]=useState(false);
  const fullRef=useRef<HTMLImageElement|null>(null);

  useEffect(()=>{
    if(!expanded||fullReady||item.image===item.thumbnail)return;
    let cancelled=false;
    const loader=new Image();
    loader.decoding='async';
    loader.src=item.image;
    const reveal=()=>{if(!cancelled)setFullReady(true)};
    if(loader.complete) loader.decode?.().then(reveal,reveal); else {loader.onload=()=>loader.decode?.().then(reveal,reveal);loader.onerror=()=>{}};
    return()=>{cancelled=true;loader.onload=null;loader.onerror=null};
  },[expanded,fullReady,item.image,item.thumbnail]);

  const prewarm=()=>{
    if(fullReady||item.image===item.thumbnail)return;
    const loader=new Image();
    loader.decoding='async';
    loader.src=item.image;
  };

  return <button className={`art-card${expanded?' expanded':''}`} data-id={item.id} aria-expanded={expanded} aria-label={`${expanded?'Collapse':'Expand'} ${item.name}`} onPointerDown={prewarm} onClick={()=>onToggle(item)}>
    <span className="art-image-layer" aria-hidden="true">
      <img className="preview" src={item.thumbnail||item.image} alt="" loading={index<8?'eager':'lazy'} decoding="async" fetchPriority={index<4?'high':'auto'} />
      {expanded && item.image!==item.thumbnail ? <img ref={fullRef} className={`full${fullReady?' ready':''}`} src={fullReady?item.image:undefined} alt="" decoding="async" /> : null}
    </span>
    <span className="shade"></span>
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[item.rank]||'var(--brand)'}}>{item.rank||'—'}</span>
    <span className="expand-mark">{expanded?'−':'+'}</span>
    <span className="card-copy"><span className="card-meta">{item.category}</span><strong>{item.name}</strong>{item.description?<span className="card-description">{item.description}</span>:null}<span className="card-bottom"><span className="credit">IMAGE CREDIT · {item.credit}</span><span className="rank-label">{item.rank}</span></span></span>
  </button>;
});

export default function GalleryClient({catalogue,initialCategory,initialArtworkId}:{catalogue:Catalogue,initialCategory:string|null,initialArtworkId:string|null}){
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState(initialCategory||'all');
  const [rank,setRank]=useState('all');
  const [credit,setCredit]=useState('all');
  const [vietnameseOnly,setVietnameseOnly]=useState(false);
  const [expanded,setExpanded]=useState(initialArtworkId);
  const [categoryOpen,setCategoryOpen]=useState(false);
  const [limit,setLimit]=useState(24);

  const filtered=useMemo(()=>catalogue.items.filter(item=>matches(item,query)&&(category==='all'||item.category===category)&&(rank==='all'||item.rank===rank)&&(credit==='all'||item.credit===credit)&&(!vietnameseOnly||item.isVietnameseSkin)),[catalogue.items,query,category,rank,credit,vietnameseOnly]);
  const visible=filtered.slice(0,limit);

  useEffect(()=>{setLimit(24);setExpanded(null)},[query,rank,credit,vietnameseOnly]);

  const syncUrl=useCallback((nextCategory:string,nextExpanded:Artwork|null)=>{
    const path=nextExpanded?artworkPath(nextExpanded):nextCategory==='all'?'/character/':`/character/${slug(nextCategory)}/`;
    if(window.location.pathname!==path)window.history.pushState({},'',path);
  },[]);

  const chooseCategory=(value:string)=>{
    const next=value===category&&value!=='all'?'all':value;
    setCategory(next);setExpanded(null);setLimit(24);syncUrl(next,null);
  };

  const toggle=useCallback((item:Artwork)=>{
    setExpanded(current=>{
      const next=current===item.id?null:item.id;
      syncUrl(category,next?item:null);
      if(next){requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector(`[data-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'})))}
      return next;
    });
  },[category,syncUrl]);

  useEffect(()=>{
    const onPop=()=>{
      const parts=window.location.pathname.split('/').filter(Boolean);
      if(parts[0]!=='character'){setCategory('all');setExpanded(null);return}
      const cat=catalogue.items.find(x=>slug(x.category)===parts[1])?.category||'all';
      const art=parts[2]?catalogue.items.find(x=>x.category===cat&&slug(x.name||x.id)===parts[2])?.id||null:null;
      setCategory(cat);setExpanded(art);
    };
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
  },[catalogue.items]);

  return <section className="catalog" id="catalog">
    <div className="filter-deck">
      <label className="search-wrap"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} type="search" autoComplete="off" placeholder="Search artwork, description or credit…" aria-label="Search the gallery" /></label>
      <div className={`category-shell${categoryOpen?' open':''}`}><div className="category-row" aria-label="Filter by category"><button className={category==='all'?'active':''} onClick={()=>chooseCategory('all')}>All</button>{catalogue.categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>chooseCategory(c)}>{c}</button>)}</div><button className="category-toggle" onClick={()=>setCategoryOpen(v=>!v)} aria-label="Toggle category list">⌄</button></div>
      <div className="select-row">
        <label className="filter-field"><span>Vietnamese skin</span><button className={`vn-switch${vietnameseOnly?' on':''}`} onClick={()=>setVietnameseOnly(v=>!v)} aria-pressed={vietnameseOnly}>{vietnameseOnly?'ON':'OFF'}</button></label>
        <label className="filter-field"><span>Skin rank</span><select value={rank} onChange={e=>setRank(e.target.value)}><option value="all">All ranks</option>{catalogue.ranks.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="filter-field"><span>Image credit</span><select value={credit} onChange={e=>setCredit(e.target.value)}><option value="all">All credits</option>{catalogue.credits.map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
    </div>
    <div className="results-line"><div><strong>{String(filtered.length).padStart(2,'0')}</strong><span>{filtered.length===1?'artwork':'artworks'} in view</span></div></div>
    {visible.length?<div className="gallery-grid">{visible.map((item,index)=><ArtworkCard key={item.id} item={item} index={index} expanded={expanded===item.id} onToggle={toggle}/>)}</div>:<div className="empty-state">Nothing in view.</div>}
    {limit<filtered.length?<div className="gallery-more"><button onClick={()=>setLimit(v=>Math.min(filtered.length,v+24))}>{limit+24>=filtered.length?'Open full gallery':`Show ${Math.min(24,filtered.length-limit)} more`} ↓</button></div>:null}
  </section>;
}
