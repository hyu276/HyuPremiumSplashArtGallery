'use client';

import React, { useMemo, useState } from 'react';
import AdminCompactPicker from '@/components/AdminCompactPicker';

export type AdminUniverse={name:string;skinlines:string[]};

type ArtworkRef={
  id:string;
  name:string;
  category:string;
  rank?:string;
  rankOrder?:number;
  hidden?:boolean;
  skinline?:string;
  skinlines?:string[];
  universes?:string[];
};

type Status={text:string;type?:'ok'|'err'|'warn'|''};

type Props={
  items:ArtworkRef[];
  skinlines:string[];
  universes:AdminUniverse[];
  status:Status;
  skinlineRepresentatives:Record<string,string>;
  universeRepresentatives:Record<string,string>;
  onAddSkinline:(name:string)=>void;
  onRenameSkinline:(currentName:string,nextName:string)=>void;
  onDeleteSkinline:(name:string)=>void;
  onSetArtworkSkinline:(id:string,skinline:string)=>void;
  onAddUniverse:(name:string)=>void;
  onRenameUniverse:(currentName:string,nextName:string)=>void;
  onDeleteUniverse:(name:string)=>void;
  onSetUniverseSkinlines:(universeName:string,skinlines:string[])=>void;
  onSetSkinlineRepresentative:(skinline:string,artworkId:string)=>void;
  onSetUniverseRepresentative:(universe:string,artworkId:string)=>void;
};

function sameName(a:string,b:string){return a.trim().toLowerCase()===b.trim().toLowerCase()}
function highestRankArtwork(rows:ArtworkRef[]){return [...rows].filter(item=>!item.hidden).sort((a,b)=>Number(b.rankOrder||0)-Number(a.rankOrder||0)||a.id.localeCompare(b.id,undefined,{sensitivity:'base',numeric:true}))[0]}

export default function AdminTaxonomyManager({
  items,skinlines,universes,status,skinlineRepresentatives,universeRepresentatives,onAddSkinline,onRenameSkinline,onDeleteSkinline,onSetArtworkSkinline,onAddUniverse,onRenameUniverse,onDeleteUniverse,onSetUniverseSkinlines,onSetSkinlineRepresentative,onSetUniverseRepresentative
}:Props){
  const [skinlineDraft,setSkinlineDraft]=useState('');
  const [universeDraft,setUniverseDraft]=useState('');
  const [activeSkinlineState,setActiveSkinlineState]=useState('');
  const [activeUniverseState,setActiveUniverseState]=useState('');
  const [artworkTargets,setArtworkTargets]=useState<Record<string,string>>({});
  const [selectedSkinlines,setSelectedSkinlines]=useState<Set<string>>(()=>new Set());
  const [batchUniverse,setBatchUniverse]=useState('');
  const [skinlineSearch,setSkinlineSearch]=useState('');

  const assignedBySkinline=useMemo(()=>new Map(skinlines.map(name=>[name,items.filter(item=>sameName(item.skinline||item.skinlines?.[0]||'',name))])),[items,skinlines]);
  const activeSkinline=skinlines.find(name=>sameName(name,activeSkinlineState))||skinlines[0]||'';
  const activeUniverse=universes.find(universe=>sameName(universe.name,activeUniverseState))||universes[0]||null;
  const activeArtworkTarget=activeSkinline?artworkTargets[activeSkinline]||'':'';
  const activeSkinlineItems=activeSkinline?(assignedBySkinline.get(activeSkinline)||[]):[];
  const availableArtwork=activeSkinline?items.filter(item=>!sameName(item.skinline||item.skinlines?.[0]||'',activeSkinline)):[];
  const activeSkinlineRepresentativeId=activeSkinline?skinlineRepresentatives[activeSkinline]||'':'';
  const activeSkinlineRepresentative=activeSkinlineItems.find(item=>item.id===activeSkinlineRepresentativeId&&!item.hidden);
  const automaticSkinlineRepresentative=highestRankArtwork(activeSkinlineItems);
  const activeUniverseItems=activeUniverse?items.filter(item=>!item.hidden&&(item.universes||[]).some(name=>sameName(name,activeUniverse.name))):[];
  const activeUniverseRepresentativeId=activeUniverse?universeRepresentatives[activeUniverse.name]||'':'';
  const activeUniverseRepresentative=activeUniverseItems.find(item=>item.id===activeUniverseRepresentativeId);
  const automaticUniverseRepresentative=highestRankArtwork(activeUniverseItems);
  const skinlineNeedle=skinlineSearch.trim().toLowerCase();
  const filteredSkinlines=skinlineNeedle?skinlines.filter(name=>name.toLowerCase().includes(skinlineNeedle)):skinlines;

  function createSkinline(){
    const value=skinlineDraft.trim();
    if(!value)return;
    onAddSkinline(value);
    setActiveSkinlineState(value);
    setSkinlineDraft('');
  }

  function renameSkinline(name:string){
    const next=prompt(`Đổi tên skinline “${name}”:`,name)?.trim();
    if(!next)return;
    onRenameSkinline(name,next);
    setActiveSkinlineState(next);
    setSelectedSkinlines(current=>{
      const updated=new Set<string>();
      current.forEach(value=>updated.add(sameName(value,name)?next:value));
      return updated;
    });
  }

  function removeSkinline(name:string){
    const assigned=assignedBySkinline.get(name)?.length||0;
    if(!confirm(`Xóa skinline “${name}”? ${assigned} skin đang thuộc bộ này sẽ được chuyển về trạng thái chưa gán.`))return;
    onDeleteSkinline(name);
    setActiveSkinlineState('');
    setSelectedSkinlines(current=>{const next=new Set(current);for(const value of next){if(sameName(value,name))next.delete(value)}return next});
  }

  function assignArtwork(){
    if(!activeSkinline||!activeArtworkTarget)return;
    onSetArtworkSkinline(activeArtworkTarget,activeSkinline);
    setArtworkTargets(current=>({...current,[activeSkinline]:''}));
  }

  function createUniverse(){
    const value=universeDraft.trim();
    if(!value)return;
    onAddUniverse(value);
    setActiveUniverseState(value);
    setUniverseDraft('');
  }

  function renameUniverse(name:string){
    const next=prompt(`Đổi tên Skin Universe “${name}”:`,name)?.trim();
    if(!next)return;
    onRenameUniverse(name,next);
    setActiveUniverseState(next);
    if(sameName(batchUniverse,name))setBatchUniverse(next);
  }

  function removeUniverse(name:string){
    if(!confirm(`Xóa Skin Universe “${name}”? Các skinline bên trong sẽ được giữ nguyên.`))return;
    onDeleteUniverse(name);
    setActiveUniverseState('');
    if(sameName(batchUniverse,name))setBatchUniverse('');
  }

  function removeUniverseMember(skinline:string){
    if(!activeUniverse)return;
    onSetUniverseSkinlines(activeUniverse.name,activeUniverse.skinlines.filter(member=>!sameName(member,skinline)));
  }

  function toggleSelectedSkinline(name:string){
    setSelectedSkinlines(current=>{
      const next=new Set(current);
      const existing=[...next].find(value=>sameName(value,name));
      if(existing)next.delete(existing);else next.add(name);
      return next;
    });
  }

  function toggleAllSkinlines(){
    setSelectedSkinlines(current=>{
      if(!filteredSkinlines.length)return current;
      const allSelected=filteredSkinlines.every(name=>[...current].some(value=>sameName(value,name)));
      const next=new Set(current);
      filteredSkinlines.forEach(name=>{const existing=[...next].find(value=>sameName(value,name));if(allSelected&&existing)next.delete(existing);else if(!allSelected&&!existing)next.add(name)});
      return next;
    });
  }

  function batchAddToUniverse(){
    const universe=universes.find(row=>sameName(row.name,batchUniverse));
    if(!universe||!selectedSkinlines.size)return;
    const next=[...universe.skinlines];
    selectedSkinlines.forEach(name=>{if(!next.some(member=>sameName(member,name)))next.push(name)});
    onSetUniverseSkinlines(universe.name,next);
    setActiveUniverseState(universe.name);
    setSelectedSkinlines(new Set());
  }

  const selectedAll=filteredSkinlines.length>0&&filteredSkinlines.every(name=>[...selectedSkinlines].some(value=>sameName(value,name)));

  return <>
    <section className="admin-panel skinline-manager">
      <div className="taxonomy-section-head"><div><h2>Skinline / Trang phục theo bộ</h2><div className="admin-note">Danh sách và member list đều giới hạn 4 dòng; phần dư cuộn bên trong thay vì kéo dài toàn section.</div></div><span className="admin-badge">{skinlines.length} skinline</span></div>
      <div className="taxonomy-create-row">
        <input className="admin-input" value={skinlineDraft} onChange={event=>setSkinlineDraft(event.target.value)} placeholder="Tên skinline mới"/>
        <button className="admin-btn primary" onClick={createSkinline}>Tạo skinline</button>
      </div>
      <div className="taxonomy-compact-manager">
        <div className="taxonomy-entity-list">
          {skinlines.length?skinlines.map(name=>{
            const assigned=assignedBySkinline.get(name)||[];
            return <button type="button" className={`taxonomy-entity-row${sameName(activeSkinline,name)?' active':''}`} key={name} onClick={()=>setActiveSkinlineState(name)}>
              <span><strong>{name}</strong><small>{assigned.length} artwork</small></span><span aria-hidden="true">›</span>
            </button>;
          }):<div className="taxonomy-compact-empty">Chưa có skinline.</div>}
        </div>
        <div className="taxonomy-detail">
          {activeSkinline?<>
            <div className="taxonomy-detail-head"><div><strong>{activeSkinline}</strong><span>{activeSkinlineItems.length} artwork</span></div><div className="admin-controls"><button className="admin-btn small" onClick={()=>renameSkinline(activeSkinline)}>Đổi tên</button><button className="admin-btn small danger" onClick={()=>removeSkinline(activeSkinline)}>Xóa</button></div></div>
            <div className="taxonomy-representative">
              <div className="taxonomy-representative-label"><strong>Artwork đại diện</strong><span>{activeSkinlineRepresentative?'Chỉ định thủ công':automaticSkinlineRepresentative?`Tự động · hạng cao nhất: ${automaticSkinlineRepresentative.name} (${automaticSkinlineRepresentative.rank||'—'})`:'Chưa có artwork khả dụng'}</span></div>
              <div className="taxonomy-detail-add"><AdminCompactPicker value={activeSkinlineRepresentative?.id||''} options={activeSkinlineItems.filter(item=>!item.hidden).map(item=>({value:item.id,label:`${item.name} — ${item.category} · ${item.rank||'—'}`}))} placeholder={automaticSkinlineRepresentative?`Tự động · ${automaticSkinlineRepresentative.name}`:'Chọn artwork đại diện...'} ariaLabel={`Artwork đại diện cho ${activeSkinline}`} onChange={value=>onSetSkinlineRepresentative(activeSkinline,value)} searchable searchPlaceholder="Tìm artwork đại diện..."/><button className="admin-btn small" disabled={!activeSkinlineRepresentativeId} onClick={()=>onSetSkinlineRepresentative(activeSkinline,'')}>Tự động</button></div>
            </div>
            <div className="taxonomy-detail-add">
              <AdminCompactPicker value={activeArtworkTarget} options={availableArtwork.map(item=>({value:item.id,label:`${item.name} — ${item.category}`}))} placeholder="Chọn artwork..." ariaLabel={`Artwork để thêm vào ${activeSkinline}`} onChange={value=>setArtworkTargets(current=>({...current,[activeSkinline]:value}))} searchable searchPlaceholder="Tìm theo tên artwork hoặc tướng..."/>
              <button className="admin-btn small" disabled={!activeArtworkTarget} onClick={assignArtwork}>Thêm skin</button>
            </div>
            <div className="taxonomy-member-list">
              {(assignedBySkinline.get(activeSkinline)||[]).length?(assignedBySkinline.get(activeSkinline)||[]).map(item=><div className="taxonomy-member-row" key={item.id}><span>{item.name}<small> · {item.category}</small></span><button type="button" onClick={()=>onSetArtworkSkinline(item.id,'')} title="Bỏ khỏi skinline">×</button></div>):<div className="taxonomy-member-row"><span className="admin-muted">Chưa có artwork.</span></div>}
            </div>
          </>:<div className="taxonomy-compact-empty">Tạo hoặc chọn một Skinline để quản lý.</div>}
        </div>
      </div>
      <div className={`admin-status ${status.type||''}`}>{status.text}</div>
    </section>

    <section className="admin-panel universe-manager">
      <div className="taxonomy-section-head"><div><h2>Skin Universe / Dòng trang phục</h2><div className="admin-note">Không còn grid checkbox toàn bộ Skinline. Chọn Universe bên trái; danh sách member bên phải chỉ hiện tối đa 4 dòng.</div></div><span className="admin-badge">{universes.length} universe</span></div>
      <div className="taxonomy-create-row">
        <input className="admin-input" value={universeDraft} onChange={event=>setUniverseDraft(event.target.value)} placeholder="Tên Skin Universe mới"/>
        <button className="admin-btn primary" onClick={createUniverse}>Tạo Universe</button>
      </div>
      <div className="taxonomy-compact-manager">
        <div className="taxonomy-entity-list">
          {universes.length?universes.map(universe=><button type="button" className={`taxonomy-entity-row${activeUniverse&&sameName(activeUniverse.name,universe.name)?' active':''}`} key={universe.name} onClick={()=>setActiveUniverseState(universe.name)}>
            <span><strong>{universe.name}</strong><small>{universe.skinlines.length} skinline</small></span><span aria-hidden="true">›</span>
          </button>):<div className="taxonomy-compact-empty">Chưa có Skin Universe.</div>}
        </div>
        <div className="taxonomy-detail">
          {activeUniverse?<>
            <div className="taxonomy-detail-head"><div><strong>{activeUniverse.name}</strong><span>{activeUniverse.skinlines.length} skinline · {activeUniverseItems.length} artwork</span></div><div className="admin-controls"><button className="admin-btn small" onClick={()=>renameUniverse(activeUniverse.name)}>Đổi tên</button><button className="admin-btn small danger" onClick={()=>removeUniverse(activeUniverse.name)}>Xóa</button></div></div>
            <div className="taxonomy-representative">
              <div className="taxonomy-representative-label"><strong>Artwork đại diện</strong><span>{activeUniverseRepresentative?'Chỉ định thủ công':automaticUniverseRepresentative?`Tự động · hạng cao nhất: ${automaticUniverseRepresentative.name} (${automaticUniverseRepresentative.rank||'—'})`:'Chưa có artwork khả dụng'}</span></div>
              <div className="taxonomy-detail-add"><AdminCompactPicker value={activeUniverseRepresentative?.id||''} options={activeUniverseItems.map(item=>({value:item.id,label:`${item.name} — ${item.category} · ${item.rank||'—'}`}))} placeholder={automaticUniverseRepresentative?`Tự động · ${automaticUniverseRepresentative.name}`:'Chọn artwork đại diện...'} ariaLabel={`Artwork đại diện cho ${activeUniverse.name}`} onChange={value=>onSetUniverseRepresentative(activeUniverse.name,value)} searchable searchPlaceholder="Tìm artwork đại diện..."/><button className="admin-btn small" disabled={!activeUniverseRepresentativeId} onClick={()=>onSetUniverseRepresentative(activeUniverse.name,'')}>Tự động</button></div>
            </div>
            <div className="taxonomy-member-list">
              {activeUniverse.skinlines.length?activeUniverse.skinlines.map(skinline=><div className="taxonomy-member-row" key={skinline}><span>{skinline}<small> · {assignedBySkinline.get(skinline)?.length||0} artwork</small></span><button type="button" onClick={()=>removeUniverseMember(skinline)} title="Bỏ khỏi Universe">×</button></div>):<div className="taxonomy-member-row"><span className="admin-muted">Chưa có Skinline. Dùng batch list bên dưới để thêm.</span></div>}
            </div>
          </>:<div className="taxonomy-compact-empty">Tạo hoặc chọn một Universe để quản lý.</div>}
        </div>
      </div>
    </section>

    <section className="admin-panel universe-batch-manager">
      <div className="taxonomy-section-head"><div><h2>Danh sách Skinline — Batch add vào Skin Universe</h2><div className="admin-note">Tick nhiều Skinline, chọn Universe rồi thêm hàng loạt. Khung danh sách chỉ hiện tối đa 4 Skinline và cuộn phần còn lại.</div></div><span className="admin-badge">Đã chọn {selectedSkinlines.size}</span></div>
      <div className="taxonomy-batch-search"><input className="admin-input" type="search" value={skinlineSearch} onChange={event=>setSkinlineSearch(event.target.value)} placeholder="Tìm Skinline cần add vào Universe..." aria-label="Tìm Skinline cần add vào Universe"/><span className="admin-badge">{filteredSkinlines.length}/{skinlines.length} Skinline</span></div>
      <div className="admin-batch taxonomy-batch-toolbar">
        <label className="admin-check" style={{margin:0}}><input type="checkbox" checked={selectedAll} onChange={toggleAllSkinlines}/> Chọn các Skinline đang hiển thị</label>
        <AdminCompactPicker value={batchUniverse} options={universes.map(universe=>universe.name)} placeholder="Chọn Universe..." ariaLabel="Universe cho các Skinline đã chọn" onChange={setBatchUniverse}/>
        <button className="admin-btn small primary" disabled={!selectedSkinlines.size||!batchUniverse} onClick={batchAddToUniverse}>Thêm vào Universe</button>
      </div>
      <div className="taxonomy-batch-list">
        {filteredSkinlines.length?filteredSkinlines.map(skinline=>{
          const memberships=universes.filter(universe=>universe.skinlines.some(member=>sameName(member,skinline))).map(universe=>universe.name);
          const checked=[...selectedSkinlines].some(value=>sameName(value,skinline));
          return <label className={`taxonomy-batch-row${checked?' selected':''}`} key={skinline}>
            <input type="checkbox" checked={checked} onChange={()=>toggleSelectedSkinline(skinline)}/>
            <span><strong>{skinline}</strong><small>{assignedBySkinline.get(skinline)?.length||0} artwork</small></span>
            <span className="admin-meta">{memberships.length?'Universe: '+memberships.join(', '):'Chưa thuộc Universe nào'}</span>
          </label>;
        }):<div className="taxonomy-compact-empty">{skinlineSearch.trim()?'Không có Skinline phù hợp với tìm kiếm.':'Chưa có Skinline để batch add.'}</div>}
      </div>
    </section>
  </>;
}
