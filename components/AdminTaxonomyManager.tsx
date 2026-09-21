'use client';

import React, { useMemo, useState } from 'react';

export type AdminUniverse={name:string;skinlines:string[]};

type ArtworkRef={
  id:string;
  name:string;
  category:string;
  skinline?:string;
  skinlines?:string[];
};

type Status={text:string;type?:'ok'|'err'|'warn'|''};

type Props={
  items:ArtworkRef[];
  skinlines:string[];
  universes:AdminUniverse[];
  status:Status;
  onAddSkinline:(name:string)=>void;
  onRenameSkinline:(currentName:string,nextName:string)=>void;
  onDeleteSkinline:(name:string)=>void;
  onSetArtworkSkinline:(id:string,skinline:string)=>void;
  onAddUniverse:(name:string)=>void;
  onRenameUniverse:(currentName:string,nextName:string)=>void;
  onDeleteUniverse:(name:string)=>void;
  onToggleUniverseSkinline:(universeName:string,skinline:string)=>void;
};

function sameName(a:string,b:string){return a.trim().toLowerCase()===b.trim().toLowerCase()}

export default function AdminTaxonomyManager({
  items,skinlines,universes,status,onAddSkinline,onRenameSkinline,onDeleteSkinline,onSetArtworkSkinline,onAddUniverse,onRenameUniverse,onDeleteUniverse,onToggleUniverseSkinline
}:Props){
  const [skinlineDraft,setSkinlineDraft]=useState('');
  const [universeDraft,setUniverseDraft]=useState('');
  const [assignmentDrafts,setAssignmentDrafts]=useState<Record<string,string>>({});
  const assignedBySkinline=useMemo(()=>new Map(skinlines.map(name=>[name,items.filter(item=>sameName(item.skinline||item.skinlines?.[0]||'',name))])),[items,skinlines]);

  function createSkinline(){
    const value=skinlineDraft.trim();
    if(!value)return;
    onAddSkinline(value);
    setSkinlineDraft('');
  }

  function renameSkinline(name:string){
    const next=prompt(`Đổi tên skinline “${name}”:`,name)?.trim();
    if(next)onRenameSkinline(name,next);
  }

  function removeSkinline(name:string){
    const assigned=assignedBySkinline.get(name)?.length||0;
    if(confirm(`Xóa skinline “${name}”? ${assigned} skin đang thuộc bộ này sẽ được chuyển về trạng thái chưa gán.`))onDeleteSkinline(name);
  }

  function assignArtwork(skinline:string){
    const id=assignmentDrafts[skinline]||'';
    if(!id)return;
    onSetArtworkSkinline(id,skinline);
    setAssignmentDrafts(current=>({...current,[skinline]:''}));
  }

  function createUniverse(){
    const value=universeDraft.trim();
    if(!value)return;
    onAddUniverse(value);
    setUniverseDraft('');
  }

  function renameUniverse(name:string){
    const next=prompt(`Đổi tên Skin Universe “${name}”:`,name)?.trim();
    if(next)onRenameUniverse(name,next);
  }

  function removeUniverse(name:string){
    if(confirm(`Xóa Skin Universe “${name}”? Các skinline bên trong sẽ được giữ nguyên.`))onDeleteUniverse(name);
  }

  return <>
    <section className="admin-panel skinline-manager">
      <h2>Skinline / Trang phục theo bộ</h2>
      <div className="admin-note">Tạo, đổi tên hoặc xóa skinline; thêm/bỏ skin khỏi từng skinline. Mọi thay đổi vẫn là bản nháp cho tới khi bấm <strong>Xuất bản thay đổi</strong>.</div>
      <div className="taxonomy-create-row">
        <input className="admin-input" value={skinlineDraft} onChange={event=>setSkinlineDraft(event.target.value)} placeholder="Tên skinline mới"/>
        <button className="admin-btn primary" onClick={createSkinline}>Tạo skinline</button>
      </div>
      <div className="taxonomy-admin-list">
        {skinlines.length?skinlines.map(skinline=>{
          const assigned=assignedBySkinline.get(skinline)||[];
          return <div className="taxonomy-admin-card" key={skinline}>
            <div className="taxonomy-admin-head">
              <div><strong>{skinline}</strong><span>{assigned.length} skin</span></div>
              <div className="admin-controls">
                <button className="admin-btn small" onClick={()=>renameSkinline(skinline)}>Đổi tên</button>
                <button className="admin-btn small danger" onClick={()=>removeSkinline(skinline)}>Xóa</button>
              </div>
            </div>
            <div className="taxonomy-assignment-row">
              <select className="admin-select" value={assignmentDrafts[skinline]||''} onChange={event=>setAssignmentDrafts(current=>({...current,[skinline]:event.target.value}))}>
                <option value="">Chọn skin để thêm / chuyển vào bộ này</option>
                {items.filter(item=>!sameName(item.skinline||item.skinlines?.[0]||'',skinline)).map(item=><option key={item.id} value={item.id}>{item.name} — {item.category}{item.skinline?` · hiện: ${item.skinline}`:''}</option>)}
              </select>
              <button className="admin-btn" disabled={!assignmentDrafts[skinline]} onClick={()=>assignArtwork(skinline)}>Thêm skin</button>
            </div>
            <div className="taxonomy-member-list">
              {assigned.length?assigned.map(item=><span className="taxonomy-member" key={item.id}>
                <span>{item.name}<small>{item.category}</small></span>
                <button type="button" onClick={()=>onSetArtworkSkinline(item.id,'')} title="Bỏ khỏi skinline">×</button>
              </span>):<span className="admin-muted">Chưa có skin nào trong skinline này.</span>}
            </div>
          </div>;
        }):<div className="admin-empty">Chưa có skinline. Tạo skinline đầu tiên để bắt đầu phân nhóm artwork.</div>}
      </div>
      <div className={`admin-status ${status.type||''}`}>{status.text}</div>
    </section>

    <section className="admin-panel universe-manager">
      <h2>Skin Universe / Dòng trang phục</h2>
      <div className="admin-note">Một Skin Universe có thể chứa nhiều skinline. Artwork tự kế thừa Universe từ skinline mà nó đang thuộc.</div>
      <div className="taxonomy-create-row">
        <input className="admin-input" value={universeDraft} onChange={event=>setUniverseDraft(event.target.value)} placeholder="Tên Skin Universe mới"/>
        <button className="admin-btn primary" onClick={createUniverse}>Tạo Universe</button>
      </div>
      <div className="taxonomy-admin-list">
        {universes.length?universes.map(universe=><div className="taxonomy-admin-card" key={universe.name}>
          <div className="taxonomy-admin-head">
            <div><strong>{universe.name}</strong><span>{universe.skinlines.length} skinline</span></div>
            <div className="admin-controls">
              <button className="admin-btn small" onClick={()=>renameUniverse(universe.name)}>Đổi tên</button>
              <button className="admin-btn small danger" onClick={()=>removeUniverse(universe.name)}>Xóa</button>
            </div>
          </div>
          <div className="universe-skinline-grid">
            {skinlines.length?skinlines.map(skinline=>{
              const selected=universe.skinlines.some(line=>sameName(line,skinline));
              return <label className={`universe-skinline-option${selected?' selected':''}`} key={skinline}>
                <input type="checkbox" checked={selected} onChange={()=>onToggleUniverseSkinline(universe.name,skinline)}/>
                <span>{skinline}</span>
              </label>;
            }):<span className="admin-muted">Hãy tạo skinline trước.</span>}
          </div>
        </div>):<div className="admin-empty">Chưa có Skin Universe.</div>}
      </div>
    </section>
  </>;
}
