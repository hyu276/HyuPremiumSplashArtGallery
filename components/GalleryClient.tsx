'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import type { Artwork, Catalogue } from '@/lib/catalogue';
import { artworkPath, slug } from '@/lib/catalogue';

const INITIAL_RANDOM_COUNT=6;
const SECOND_BATCH_COUNT=50;
const EGRESS_SAFE_MODE=(process.env.NEXT_PUBLIC_HYU_EGRESS_SAFE_MODE??'true').toLowerCase()!=='false';

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

type SearchToken={text:string;quoted:boolean};
type FilterOption={value:string;label:string};
type MotionDocument=Document&{startViewTransition?:(update:()=>void)=>unknown};

function norm(value:string){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function parseQuery(query:string){
  const parts:SearchToken[]=[];
  const pattern=/"([^"]+)"|'([^']+)'|(\S+)/g;
  let match:RegExpExecArray|null;
  while((match=pattern.exec(String(query||'')))){
    const quoted=match[1]!==undefined||match[2]!==undefined;
    const text=norm(match[1]??match[2]??match[3]??'');
    if(text)parts.push({text,quoted});
  }
  return parts;
}
function subsequenceMatch(haystack:string,needle:string){
  if(needle.length<4)return false;
  let cursor=0;
  for(const char of needle.replace(/\s/g,'')){
    cursor=haystack.indexOf(char,cursor);
    if(cursor<0)return false;
    cursor+=1;
  }
  return true;
}
function searchableFields(item:Artwork){
  const vietnameseAliases=item.isVietnameseSkin?['viet nam','vietnam','vn','skin viet nam','skin vietnam']:[];
  return [item.name,item.description,item.category,item.rank,item.credit,...item.tags,...vietnameseAliases].map(norm).filter(Boolean);
}
function matches(item:Artwork,query:string){
  const tokens=parseQuery(query);
  if(!tokens.length)return true;
  const fields=searchableFields(item);
  return tokens.every(token=>fields.some(field=>field.includes(token.text)||(!token.quoted&&subsequenceMatch(field,token.text))));
}
function randomUnit(){
  if(typeof window!=='undefined'&&window.crypto?.getRandomValues){
    const bucket=new Uint32Array(1);window.crypto.getRandomValues(bucket);return bucket[0]/4294967296;
  }
  return Math.random();
}
function shuffledIds(items:Artwork[]){
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(randomUnit()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}
  return copy.slice(0,Math.min(INITIAL_RANDOM_COUNT,copy.length)).map(item=>item.id);
}
function runMotionTransition(update:()=>void){
  if(typeof document==='undefined'||typeof window==='undefined'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){update();return}
  const start=(document as MotionDocument).startViewTransition;
  if(typeof start==='function'){start.call(document,()=>flushSync(update));return}
  update();
}
function artworkTransitionName(id:string){return `hyu-artwork-${id.replace(/[^a-zA-Z0-9_-]/g,'-')}`}

function GalleryFilterControl({label,value,options,onChange,ariaLabel}:{label:string;value:string;options:FilterOption[];onChange:(value:string)=>void;ariaLabel:string}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const selected=options.find(option=>option.value===value)||options[0];

  useEffect(()=>{
    const close=(event:MouseEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false)};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
    document.addEventListener('mousedown',close);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',escape)};
  },[]);

  const focusActive=()=>requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('.gallery-filter-option.is-active')?.focus());
  return <div className="gallery-filter-field">
    <span>{label}</span>
    <div ref={root} className={`gallery-filter-control${open?' is-open':''}`}>
      <button type="button" className="gallery-filter-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={()=>setOpen(current=>!current)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='Enter'||event.key===' '){event.preventDefault();setOpen(true);focusActive()}}}>
        <span className="gallery-filter-trigger-text">{selected?.label||'Tất cả'}</span><span className="gallery-filter-chevron" aria-hidden="true">⌄</span>
      </button>
      <div className="gallery-filter-menu" role="listbox" aria-label={ariaLabel} onKeyDown={event=>{
        const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.gallery-filter-option'));
        const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        if(event.key==='ArrowDown'){event.preventDefault();buttons[Math.min(buttons.length-1,Math.max(0,index+1))]?.focus()}
        else if(event.key==='ArrowUp'){event.preventDefault();buttons[Math.max(0,index-1)]?.focus()}
        else if(event.key==='Escape'){event.preventDefault();setOpen(false);root.current?.querySelector<HTMLButtonElement>('.gallery-filter-trigger')?.focus()}
      }}>
        {options.map(option=><button key={option.value} type="button" className={`gallery-filter-option${option.value===value?' is-active':''}`} role="option" aria-selected={option.value===value} onClick={()=>{onChange(option.value);setOpen(false)}}>{option.label}</button>)}
      </div>
    </div>
  </div>;
}

const ViewportPreview=memo(function ViewportPreview({src,alt,eager}:{src:string;alt:string;eager:boolean}){
  const node=useRef<HTMLImageElement>(null);
  const [armed,setArmed]=useState(eager);

  useEffect(()=>{
    if(armed)return;
    const image=node.current;if(!image)return;
    if(typeof IntersectionObserver==='undefined'){setArmed(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setArmed(true);observer.disconnect();}
    },{rootMargin:'640px 0px'});
    observer.observe(image);
    return()=>observer.disconnect();
  },[armed]);

  useEffect(()=>{if(eager&&!armed)setArmed(true)},[eager,armed]);

  return <img ref={node} className="preview" src={armed?src:undefined} data-src={armed?undefined:src} alt={alt} loading={eager?'eager':'lazy'} decoding="async" fetchPriority={eager?'high':'low'} />;
});

const ArtworkCard = memo(function ArtworkCard({item,index,expanded,onToggle}:{item:Artwork;index:number;expanded:boolean;onToggle:(item:Artwork)=>void}){
  const [fullReady,setFullReady]=useState(EGRESS_SAFE_MODE||item.image===item.thumbnail);

  useEffect(()=>{
    if(EGRESS_SAFE_MODE||!expanded||fullReady||item.image===item.thumbnail)return;
    let cancelled=false;
    const loader=new Image();
    loader.decoding='async';loader.src=item.image;
    const reveal=()=>{if(!cancelled)setFullReady(true)};
    const decode=()=>loader.decode?.().then(reveal,reveal)??reveal();
    if(loader.complete)decode();else{loader.onload=decode;loader.onerror=()=>{}};
    return()=>{cancelled=true;loader.onload=null;loader.onerror=null};
  },[expanded,fullReady,item.image,item.thumbnail]);

  const imageAlt=`${item.name} — ${item.category}, splash art game, hạng skin ${item.rank}`;
  const motionStyle={viewTransitionName:artworkTransitionName(item.id),'--art-motion-delay':`${Math.min(index,12)*18}ms`} as CSSProperties;
  return <button style={motionStyle} className={`art-card${expanded?' expanded':''}`} data-id={item.id} aria-expanded={expanded} aria-label={`${expanded?'Thu gọn':'Mở rộng'} ${item.name}`} onClick={()=>onToggle(item)}>
    <span className="art-image-layer">
      <ViewportPreview src={item.thumbnail||item.image} alt={imageAlt} eager={index<INITIAL_RANDOM_COUNT||expanded}/>
      {!EGRESS_SAFE_MODE&&expanded&&item.image!==item.thumbnail&&fullReady?<img className="full ready" src={item.image} alt="" aria-hidden="true" decoding="async" fetchPriority="high"/>:null}
    </span>
    <span className="shade" aria-hidden="true"></span>
    <span className="card-number">{String(index+1).padStart(2,'0')}</span>
    <span className="tier" style={{background:RANK_GRADIENTS[item.rank]||'var(--brand)'}}>{item.rank||'—'}</span>
    <span className="expand-mark" aria-hidden="true">{expanded?'−':'+'}</span>
    <span className="card-copy"><span className="card-meta">{item.category}</span><strong>{item.name}</strong>{item.description?<span className="card-description">{item.description}</span>:null}<span className="card-bottom"><span className="credit">CREDIT ẢNH · {item.credit}</span><span className="rank-label">{item.rank}</span></span></span>
  </button>;
});

export default function GalleryClient({catalogue,initialCategory,initialArtworkId}:{catalogue:Catalogue;initialCategory:string|null;initialArtworkId:string|null}){
  const [query,setQuery]=useState('');
  const [mobileSearchDraft,setMobileSearchDraft]=useState('');
  const [category,setCategory]=useState(initialCategory||'all');
  const [rank,setRank]=useState('all');
  const [credit,setCredit]=useState('all');
  const [vietnameseOnly,setVietnameseOnly]=useState(false);
  const [expanded,setExpanded]=useState(initialArtworkId);
  const [categoryOpen,setCategoryOpen]=useState(false);
  const [mobileFiltersOpen,setMobileFiltersOpen]=useState(false);
  const [stage,setStage]=useState<0|1|2>(initialArtworkId?2:0);
  const [sampleIds,setSampleIds]=useState<string[]>(()=>catalogue.items.slice(0,INITIAL_RANDOM_COUNT).map(item=>item.id));
  const mobileSearchInputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{setSampleIds(shuffledIds(catalogue.items))},[catalogue.items]);
  useEffect(()=>{setMobileSearchDraft(query)},[query]);

  useEffect(()=>{
    if(!mobileFiltersOpen)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileFiltersOpen(false)};
    document.addEventListener('keydown',escape);
    return()=>document.removeEventListener('keydown',escape);
  },[mobileFiltersOpen]);

  const filtered=useMemo(()=>catalogue.items.filter(item=>matches(item,query)&&(category==='all'||item.category===category)&&(rank==='all'||item.rank===rank)&&(credit==='all'||item.credit===credit)&&(!vietnameseOnly||item.isVietnameseSkin)),[catalogue.items,query,category,rank,credit,vietnameseOnly]);
  const defaultBrowse=!query.trim()&&category==='all'&&rank==='all'&&credit==='all'&&!vietnameseOnly;
  const visible=useMemo(()=>{
    if(stage===2)return filtered;
    if(stage===1)return filtered.slice(0,Math.min(SECOND_BATCH_COUNT,filtered.length));
    if(!defaultBrowse)return filtered.slice(0,Math.min(INITIAL_RANDOM_COUNT,filtered.length));
    const byId=new Map(filtered.map(item=>[item.id,item]));
    return sampleIds.map(id=>byId.get(id)).filter((item):item is Artwork=>Boolean(item));
  },[filtered,stage,defaultBrowse,sampleIds]);

  const syncUrl=useCallback((nextCategory:string,nextExpanded:Artwork|null)=>{
    const path=nextExpanded?artworkPath(nextExpanded):nextCategory==='all'?'/character/':`/character/${slug(nextCategory)}/`;
    if(window.location.pathname!==path)window.history.pushState({},'',path);
  },[]);

  const closeExpanded=useCallback(()=>{setExpanded(null);syncUrl(category,null)},[category,syncUrl]);

  const submitMobileSearch=useCallback(()=>{
    const next=mobileSearchDraft.trim();
    mobileSearchInputRef.current?.blur();
    runMotionTransition(()=>{
      setQuery(next);
      setMobileSearchDraft(next);
      setExpanded(null);
      setMobileFiltersOpen(false);
      syncUrl(category,null);
    });
  },[mobileSearchDraft,category,syncUrl]);

  const openMobileSearch=useCallback(()=>{
    flushSync(()=>{
      setMobileSearchDraft(query);
      setMobileFiltersOpen(true);
    });
    const input=mobileSearchInputRef.current;
    input?.focus({preventScroll:true});
    if(input)input.setSelectionRange(input.value.length,input.value.length);
  },[query]);

  const clearMobileSearch=useCallback(()=>{
    runMotionTransition(()=>{
      setQuery('');
      setMobileSearchDraft('');
      setExpanded(null);
      syncUrl(category,null);
    });
  },[category,syncUrl]);

  const chooseCategory=(value:string)=>{
    const next=value===category&&value!=='all'?'all':value;
    runMotionTransition(()=>{setCategory(next);setExpanded(null);syncUrl(next,null)});
  };

  const toggle=useCallback((item:Artwork)=>{
    runMotionTransition(()=>setExpanded(current=>{
      const next=current===item.id?null:item.id;
      syncUrl(category,next?item:null);
      if(next)requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector(`[data-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'})));
      return next;
    }));
  },[category,syncUrl]);

  const showMore=()=>{
    const scrollX=window.scrollX,scrollY=window.scrollY;
    runMotionTransition(()=>{
      setExpanded(null);
      setStage(current=>current===0?(filtered.length>SECOND_BATCH_COUNT?1:2):2);
    });
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({left:scrollX,top:scrollY,behavior:'auto'})));
  };

  useEffect(()=>{
    const onPop=()=>runMotionTransition(()=>{
      const parts=window.location.pathname.split('/').filter(Boolean);
      if(parts[0]!=='character'){setCategory('all');setExpanded(null);return}
      const cat=catalogue.items.find(item=>slug(item.category)===parts[1])?.category||'all';
      const art=parts[2]?catalogue.items.find(item=>item.category===cat&&slug(item.name||item.id)===parts[2])?.id||null:null;
      setCategory(cat);setExpanded(art);if(art)setStage(2);
    });
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
  },[catalogue.items]);

  const rankOptions=useMemo<FilterOption[]>(()=>[{value:'all',label:'Tất cả hạng'},...catalogue.ranks.map(value=>({value,label:value}))],[catalogue.ranks]);
  const creditOptions=useMemo<FilterOption[]>(()=>[{value:'all',label:'Tất cả credit'},...catalogue.credits.map(value=>({value,label:value}))],[catalogue.credits]);
  const showProgressive=stage===0?filtered.length>INITIAL_RANDOM_COUNT:stage===1?filtered.length>SECOND_BATCH_COUNT:false;
  const progressiveNote=stage===0?`Hiển thị ${Math.min(SECOND_BATCH_COUNT,filtered.length)} tác phẩm theo thứ tự bộ sưu tập`:`Mở toàn bộ thư viện · còn ${Math.max(0,filtered.length-SECOND_BATCH_COUNT)} tác phẩm`;
  const activeMobileQuery=query.trim();

  const sharedFilterControls=<>
    <div className={`category-shell category-filter-shell${categoryOpen?' open is-expanded':''}`}><div className="category-row" aria-label="Lọc theo danh mục"><button data-cat="all" className={category==='all'?'active':''} onClick={()=>chooseCategory('all')}>Tất cả</button>{catalogue.categories.map(value=><button data-cat={value} key={value} className={category===value?'active':''} onClick={()=>chooseCategory(value)}>{value}</button>)}</div><button className="category-toggle category-filter-toggle" onClick={()=>setCategoryOpen(current=>!current)} aria-label="Mở hoặc thu gọn danh sách danh mục" aria-expanded={categoryOpen}><span className="category-filter-label">Danh mục</span><span className="category-filter-icon" aria-hidden="true"></span></button></div>
    <div className="select-row">
      <div className="vietnamese-skin-filter"><button type="button" className="vietnamese-skin-switch" role="switch" aria-checked={vietnameseOnly} aria-label="Chỉ xem skin Việt Nam" onClick={()=>runMotionTransition(()=>{setVietnameseOnly(current=>!current);closeExpanded()})}><span className="vietnamese-skin-track" aria-hidden="true"><span className="vietnamese-skin-knob"></span></span><span>Chỉ xem skin Việt Nam</span></button></div>
      <GalleryFilterControl label="Hạng skin" value={rank} options={rankOptions} ariaLabel="Lọc theo hạng skin" onChange={value=>runMotionTransition(()=>{setRank(value);closeExpanded()})}/>
      <GalleryFilterControl label="Credit ảnh" value={credit} options={creditOptions} ariaLabel="Lọc theo credit ảnh" onChange={value=>runMotionTransition(()=>{setCredit(value);closeExpanded()})}/>
    </div>
  </>;

  const desktopFilters=<>
    <label className="search-wrap"><span aria-hidden="true">⌕</span><input value={query} onChange={event=>{setQuery(event.target.value);closeExpanded()}} type="search" autoComplete="off" placeholder="Tìm theo tên, nhân vật, hạng, credit..." title="Có thể kết hợp nhiều từ khóa theo tên, mô tả, danh mục, hạng, credit, tag và thuộc tính skin Việt Nam. Ví dụ: Marja Việt Nam" aria-label="Tìm kiếm trong thư viện" aria-description="Nhập nhiều từ khóa để lọc đồng thời. Cụm từ trong dấu ngoặc kép sẽ được tìm chính xác. Có thể tìm skin Việt Nam bằng Việt Nam, Vietnam hoặc VN." /></label>
    {sharedFilterControls}
  </>;

  const mobileFilters=<>
    <form className="search-wrap mobile-search-wrap" role="search" onSubmit={event=>{event.preventDefault();submitMobileSearch()}}>
      <span aria-hidden="true">⌕</span>
      <input ref={mobileSearchInputRef} value={mobileSearchDraft} onChange={event=>setMobileSearchDraft(event.target.value)} type="search" inputMode="search" enterKeyHint="search" autoComplete="off" placeholder="Tìm theo tên, nhân vật, hạng, credit..." title="Có thể kết hợp nhiều từ khóa theo tên, mô tả, danh mục, hạng, credit, tag và thuộc tính skin Việt Nam. Ví dụ: Marja Việt Nam" aria-label="Tìm kiếm trong thư viện" aria-description="Nhập từ khóa rồi bấm nút tìm kiếm hoặc phím Tìm kiếm trên bàn phím. Các bộ lọc khác vẫn được giữ nguyên." />
      <button type="submit" className="mobile-search-submit" aria-label="Tìm kiếm"><span aria-hidden="true">⌕</span></button>
    </form>
    {sharedFilterControls}
  </>;

  return <section className="catalog" id="catalog">
    <div className={`filter-deck desktop-filter-deck${categoryOpen?' category-expanded':''}`}>
      {desktopFilters}
    </div>
    <div className={`mobile-filter-launcher-shell${activeMobileQuery?' has-search':''}`}>
      <button type="button" className={`mobile-filter-launcher${activeMobileQuery?' is-search-active':''}`} aria-haspopup="dialog" aria-expanded={mobileFiltersOpen} aria-label={activeMobileQuery?`Chỉnh tìm kiếm: ${activeMobileQuery}`:'Mở tìm kiếm và bộ lọc'} onClick={()=>activeMobileQuery?openMobileSearch():setMobileFiltersOpen(true)}>
        <span className="mobile-filter-launcher-icon" aria-hidden="true">⌕</span>
        {activeMobileQuery?<span className="mobile-search-summary-copy"><span className="mobile-search-summary-kicker">Đang tìm</span><span className="mobile-search-summary-query">{activeMobileQuery}</span></span>:<span className="mobile-filter-launcher-label">Tìm kiếm &amp; bộ lọc</span>}
        {!activeMobileQuery?<span className="mobile-filter-launcher-chevron" aria-hidden="true">⌄</span>:null}
      </button>
      {activeMobileQuery?<button type="button" className="mobile-search-clear" aria-label={`Xóa tìm kiếm: ${activeMobileQuery}`} onClick={clearMobileSearch}>×</button>:null}
    </div>
    <div className={`mobile-filter-layer ${mobileFiltersOpen?'is-open':'is-closed'}`} aria-hidden={!mobileFiltersOpen} onClick={event=>{if(event.target===event.currentTarget)setMobileFiltersOpen(false)}}>
      <div className={`filter-deck mobile-filter-popup${categoryOpen?' category-expanded':''}`} role="dialog" aria-modal={mobileFiltersOpen} aria-label="Tìm kiếm và bộ lọc thư viện" onClick={event=>event.stopPropagation()}>
        <div className="mobile-filter-popup-head"><span>Tìm kiếm &amp; bộ lọc</span><button type="button" className="mobile-filter-popup-close" aria-label="Đóng tìm kiếm và bộ lọc" onClick={()=>setMobileFiltersOpen(false)}>×</button></div>
        {mobileFilters}
      </div>
    </div>
    <div className="results-line"><div><strong>{String(filtered.length).padStart(2,'0')}</strong><span>tác phẩm đang hiển thị</span></div></div>
    {visible.length?<div className="gallery-grid">{visible.map((item,index)=><ArtworkCard key={item.id} item={item} index={index} expanded={expanded===item.id} onToggle={toggle}/>)}</div>:<div className="empty-state">Không tìm thấy tác phẩm phù hợp.</div>}
    {showProgressive?<div className="gallery-progressive-controls"><button type="button" className="gallery-view-all" onClick={showMore}>Xem thêm</button><div className="gallery-progressive-note">{progressiveNote}</div></div>:null}
  </section>;
}
