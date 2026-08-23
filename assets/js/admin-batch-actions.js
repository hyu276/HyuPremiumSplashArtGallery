(function(){
  'use strict';

  if(window.__HYU_ADMIN_BATCH_ACTIONS__)return;

  function install(){
    try{
      if(typeof items==='undefined'||typeof markDirty!=='function'||typeof render!=='function'||typeof setStatus!=='function')return false;
    }catch{return false}

    const list=document.querySelector('#list');
    const toolbar=document.querySelector('#listSearch')?.closest('.toolbar');
    const search=document.querySelector('#listSearch');
    if(!list||!toolbar||!search)return false;

    window.__HYU_ADMIN_BATCH_ACTIONS__=true;
    const selectedIds=new Set();

    const style=document.createElement('style');
    style.dataset.hyuAdminBatchActions='true';
    style.textContent=`
      #list .item{position:relative;padding-left:38px}
      .admin-batch-row-check{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:15px;height:15px;margin:0;accent-color:var(--accent);cursor:pointer;z-index:2}
      .admin-batch-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:-2px 0 10px;padding:8px 9px;border:1px solid #26313a;border-radius:7px;background:#0d1216}
      .admin-batch-select-all{display:inline-flex;align-items:center;gap:7px;margin-right:2px;color:#b8c3cc;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer;user-select:none}
      .admin-batch-select-all input{width:15px;height:15px;margin:0;accent-color:var(--accent)}
      .admin-batch-count{min-width:72px;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
      .admin-batch-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto}
      .admin-batch-actions .btn{padding:6px 9px;font-size:10px}
      .admin-batch-actions .btn.batch-vn{color:#9deeff;border-color:#315766;background:#10202a}
      .admin-batch-actions .btn.batch-vn-remove{color:#bdc7ce;background:#141a1f}
      .admin-batch-actions .btn.batch-delete{color:#ffc4ca;border-color:#56323a;background:#231518}
      .admin-batch-actions .btn:disabled{opacity:.35}
      #list .item.batch-selected{border-color:#3d788b;box-shadow:inset 3px 0 0 var(--accent);background:#0f171c}
      @media(max-width:860px){
        #list .item{padding-left:34px}
        .admin-batch-row-check{left:9px}
        .admin-batch-actions{width:100%;margin-left:0}
        .admin-batch-actions .btn{flex:1 1 auto}
      }
    `;
    document.head.appendChild(style);

    const batch=document.createElement('div');
    batch.className='admin-batch-toolbar';
    batch.innerHTML=`
      <label class="admin-batch-select-all"><input type="checkbox" id="batchSelectVisible"> <span>Select visible</span></label>
      <span class="admin-batch-count" id="batchSelectedCount">0 selected</span>
      <div class="admin-batch-actions">
        <button type="button" class="btn" data-batch-action="hide" disabled>Hide</button>
        <button type="button" class="btn" data-batch-action="clone" disabled>Clone</button>
        <button type="button" class="btn batch-vn" data-batch-action="vietnamese" disabled>Mark Việt Nam</button>
        <button type="button" class="btn batch-vn-remove" data-batch-action="not-vietnamese" disabled>Remove Việt Nam</button>
        <button type="button" class="btn batch-delete" data-batch-action="delete" disabled>Delete</button>
      </div>
    `;
    toolbar.insertAdjacentElement('afterend',batch);

    const selectAll=batch.querySelector('#batchSelectVisible');
    const count=batch.querySelector('#batchSelectedCount');
    const actionButtons=[...batch.querySelectorAll('[data-batch-action]')];

    function shownItems(){
      const q=search.value.trim().toLowerCase();
      return items.filter(item=>!q||[
        item.name,item.description,item.category,item.credit,item.rank,item.hidden?'hidden':'visible',item.isVietnameseSkin?'viet nam vietnam skin viet nam':''
      ].join(' ').toLowerCase().includes(q));
    }

    function selectedItems(){
      const byId=new Map(items.map(item=>[String(item.id),item]));
      return [...selectedIds].map(id=>byId.get(id)).filter(Boolean);
    }

    function syncToolbar(){
      for(const id of [...selectedIds]){
        if(!items.some(item=>String(item.id)===id))selectedIds.delete(id);
      }
      const visible=shownItems();
      const selectedVisible=visible.filter(item=>selectedIds.has(String(item.id))).length;
      const total=selectedIds.size;
      count.textContent=`${total} selected`;
      actionButtons.forEach(button=>button.disabled=total===0);
      selectAll.checked=visible.length>0&&selectedVisible===visible.length;
      selectAll.indeterminate=selectedVisible>0&&selectedVisible<visible.length;
    }

    function decorateRows(){
      const shown=shownItems();
      const rows=[...list.querySelectorAll('.item')];
      rows.forEach((row,index)=>{
        const item=shown[index];
        if(!item)return;
        const id=String(item.id);
        row.dataset.batchArtworkId=id;
        row.classList.toggle('batch-selected',selectedIds.has(id));
        let checkbox=row.querySelector('.admin-batch-row-check');
        if(!checkbox){
          checkbox=document.createElement('input');
          checkbox.type='checkbox';
          checkbox.className='admin-batch-row-check';
          checkbox.setAttribute('aria-label',`Select ${item.name}`);
          row.prepend(checkbox);
        }
        checkbox.checked=selectedIds.has(id);
        checkbox.dataset.batchId=id;
      });
      syncToolbar();
    }

    function clearSelection(){
      selectedIds.clear();
      decorateRows();
    }

    function uniqueCloneId(source){
      const base=`${String(source.id)}-copy`;
      let candidate=base;
      let n=2;
      while(items.some(item=>String(item.id)===candidate))candidate=`${base}-${n++}`;
      return candidate;
    }

    function uniqueCloneName(source){
      const base=`${String(source.name||'Artwork')} Copy`;
      let candidate=base;
      let n=2;
      const names=new Set(items.map(item=>String(item.name||'').toLowerCase()));
      while(names.has(candidate.toLowerCase()))candidate=`${base} ${n++}`;
      return candidate;
    }

    function storagePath(url){
      try{
        if(typeof storagePathFromUrl==='function')return storagePathFromUrl(url);
      }catch{}
      const m=String(url||'').match(/\/storage\/v1\/object\/public\/artworks\/(.+)$/);
      return m?decodeURIComponent(m[1]):'';
    }

    function setVietnamese(ids,value){
      const api=window.HYU_ADMIN_VIETNAMESE_SKIN;
      if(api?.setMany){
        api.setMany(ids,Boolean(value));
        return true;
      }
      for(const id of ids){
        const item=items.find(entry=>String(entry.id)===String(id));
        if(item)item.isVietnameseSkin=Boolean(value);
      }
      markDirty();
      return false;
    }

    function batchHide(){
      const chosen=selectedItems();
      if(!chosen.length)return;
      chosen.forEach(item=>{item.hidden=true});
      markDirty();
      render();
      clearSelection();
      setStatus(`${chosen.length} artwork${chosen.length===1?'':'s'} marked hidden locally. Publish changes to save.`,'ok');
    }

    function batchClone(){
      const chosen=selectedItems();
      if(!chosen.length)return;
      const clones=[];
      const vnApi=window.HYU_ADMIN_VIETNAMESE_SKIN;
      for(const source of chosen){
        const clone={
          ...source,
          id:uniqueCloneId(source),
          name:uniqueCloneName(source),
          tags:Array.isArray(source.tags)?[...source.tags]:[],
          hidden:Boolean(source.hidden)
        };
        delete clone.created_at;
        delete clone.updated_at;
        clone.isVietnameseSkin=Boolean(vnApi?.getFlag?vnApi.getFlag(source):source.isVietnameseSkin);
        clones.push(clone);
      }
      items.unshift(...clones);
      for(const clone of clones){
        if(clone.isVietnameseSkin&&vnApi?.setFlag)vnApi.setFlag(clone.id,true,{silent:true});
      }
      markDirty();
      render();
      clearSelection();
      setStatus(`${clones.length} artwork clone${clones.length===1?'':'s'} created locally with shared source images. Publish changes to save.`,'ok');
    }

    function batchVietnamese(value){
      const chosen=selectedItems();
      if(!chosen.length)return;
      const ids=chosen.map(item=>String(item.id));
      const integrated=setVietnamese(ids,value);
      render();
      clearSelection();
      setStatus(`${chosen.length} artwork${chosen.length===1?'':'s'} marked ${value?'as Vietnamese skin':'as not Vietnamese skin'} locally.${integrated?' Publish changes to save.':' Property editor is still loading; verify before publishing.'}`,integrated?'ok':'warn');
    }

    function batchDelete(){
      const chosen=selectedItems();
      if(!chosen.length)return;
      if(!confirm(`Delete ${chosen.length} selected artwork${chosen.length===1?'':'s'}? This remains local until you Publish changes.`))return;
      const chosenIds=new Set(chosen.map(item=>String(item.id)));
      const remaining=items.filter(item=>!chosenIds.has(String(item.id)));
      const vnApi=window.HYU_ADMIN_VIETNAMESE_SKIN;

      for(const item of chosen){
        try{if(typeof clearPendingUpload==='function')clearPendingUpload(item.id)}catch{}
        try{if(typeof deletedArtworkIds!=='undefined')deletedArtworkIds.add(item.id)}catch{}
        const path=storagePath(item.image);
        if(path&&!remaining.some(other=>other.image===item.image)){
          try{if(typeof storageDeletes!=='undefined')storageDeletes.add(path)}catch{}
        }
        vnApi?.forget?.(item.id);
      }

      items=remaining;
      try{
        const editing=document.querySelector('#editingId');
        if(editing&&chosenIds.has(String(editing.value))&&typeof resetForm==='function')resetForm();
      }catch{}
      markDirty();
      render();
      clearSelection();
      setStatus(`${chosen.length} artwork${chosen.length===1?'':'s'} marked for deletion. Shared Storage images still referenced by other artworks were preserved.`,'ok');
    }

    list.addEventListener('change',event=>{
      const checkbox=event.target.closest('.admin-batch-row-check[data-batch-id]');
      if(!checkbox)return;
      const id=String(checkbox.dataset.batchId);
      if(checkbox.checked)selectedIds.add(id);else selectedIds.delete(id);
      checkbox.closest('.item')?.classList.toggle('batch-selected',checkbox.checked);
      syncToolbar();
    });

    selectAll.addEventListener('change',()=>{
      const visible=shownItems();
      if(selectAll.checked)visible.forEach(item=>selectedIds.add(String(item.id)));
      else visible.forEach(item=>selectedIds.delete(String(item.id)));
      decorateRows();
    });

    batch.addEventListener('click',event=>{
      const button=event.target.closest('[data-batch-action]');
      if(!button||button.disabled)return;
      const action=button.dataset.batchAction;
      if(action==='hide')batchHide();
      else if(action==='clone')batchClone();
      else if(action==='vietnamese')batchVietnamese(true);
      else if(action==='not-vietnamese')batchVietnamese(false);
      else if(action==='delete')batchDelete();
    });

    search.addEventListener('input',()=>queueMicrotask(decorateRows));
    new MutationObserver(()=>queueMicrotask(decorateRows)).observe(list,{childList:true,subtree:true});
    decorateRows();
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(install()||attempts>200)clearInterval(timer);
    },40);
  }
})();
