'use client';

import { useEffect, useId, useRef, useState } from 'react';

type PickerOption=string|{value:string;label:string};

type Props={
  value:string;
  options:PickerOption[];
  placeholder:string;
  ariaLabel:string;
  onChange:(value:string)=>void;
  disabled?:boolean;
  searchable?:boolean;
  searchPlaceholder?:string;
};

export default function AdminCompactPicker({value,options,placeholder,ariaLabel,onChange,disabled=false,searchable=false,searchPlaceholder='Tìm kiếm...'}:Props){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const rootRef=useRef<HTMLDivElement|null>(null);
  const listId=useId();

  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{
      if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpen(false);
    };
    window.addEventListener('pointerdown',close);
    return()=>window.removeEventListener('pointerdown',close);
  },[open]);

  function choose(option:string){
    onChange(option);
    setOpen(false);
    setQuery('');
  }

  const normalized=options.map(option=>typeof option==='string'?{value:option,label:option}:option);
  const selected=normalized.find(option=>option.value===value);
  const needle=query.trim().toLowerCase();
  const filtered=needle?normalized.filter(option=>option.label.toLowerCase().includes(needle)):normalized;

  return <div className="admin-compact-picker" ref={rootRef} onKeyDown={event=>{if(event.key==='Escape')setOpen(false)}}>
    <button type="button" className="admin-compact-picker-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled||!options.length} onClick={()=>setOpen(current=>!current)}>
      <span>{selected?.label||placeholder}</span><span aria-hidden="true">▾</span>
    </button>
    {open?<div className="admin-compact-picker-menu" role="listbox" id={listId} aria-label={ariaLabel}>
      {searchable?<input className="admin-compact-picker-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={`${ariaLabel} — tìm kiếm`} autoFocus/>:null}
      <div className="admin-compact-picker-list">
        {filtered.length?filtered.map(option=><button type="button" role="option" aria-selected={value===option.value} className={`admin-compact-picker-option${value===option.value?' active':''}`} key={option.value} onClick={()=>choose(option.value)}>{option.label}</button>):<div className="admin-compact-picker-empty">Không có kết quả phù hợp.</div>}
      </div>
    </div>:null}
  </div>;
}
