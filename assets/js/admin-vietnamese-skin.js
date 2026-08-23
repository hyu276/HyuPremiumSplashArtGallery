(function(){
  'use strict';

  if(window.__HYU_ADMIN_VIETNAMESE_SKIN__)return;

  function install(){
    try{
      if(typeof items==='undefined'||typeof client==='undefined'||typeof markDirty!=='function'||typeof setStatus!=='function'||typeof publish!=='function')return false;
    }catch{return false}

    const rankRow=document.querySelector('#rank')?.closest('.row');
    const applyButton=document.querySelector('#apply');
    const clearButton=document.querySelector('#clear');
    const saveButton=document.querySelector('#save');
    const editId=document.querySelector('#editingId');
    const list=document.querySelector('#list');
    const status=document.querySelector('#status');
    if(!rankRow||!applyButton||!clearButton||!saveButton||!editId||!list||!status)return false;

    window.__HYU_ADMIN_VIETNAMESE_SKIN__=true;

    if(!document.querySelector('style[data-hyu-admin-vietnamese-skin]')){
      const style=document.createElement('style');
      style.dataset.hyuAdminVietnameseSkin='true';
      style.textContent=`
        .vietnamese-skin-admin-field{margin:2px 0 11px}
        .vietnamese-skin-admin-check{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;margin:0!important;padding:9px 10px;border:1px solid var(--line);border-radius:6px;background:#0d1115;color:#d8e0e6!important;cursor:pointer;user-select:none}
        .vietnamese-skin-admin-check input{width:16px;height:16px;margin:0;accent-color:var(--accent);flex:none}
        .vietnamese-skin-admin-check strong{font-size:11px;letter-spacing:.01em}
        .vietnamese-skin-admin-help{margin-top:5px;color:var(--muted);font-size:10px;line-height:1.4}
        .admin-vietnamese-skin-badge{display:inline-flex;align-items:center;margin-left:6px;padding:2px 5px;border:1px solid rgba(67,220,255,.38);border-radius:999px;color:var(--accent);font-size:8px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;vertical-align:1px}
      `;
      document.head.appendChild(style);
    }

    let field=document.querySelector('[data-admin-vietnamese-skin-field]');
    if(!field){
      field=document.createElement('div');
      field.className='field vietnamese-skin-admin-field';
      field.dataset.adminVietnameseSkinField='true';
      field.innerHTML='<label class="vietnamese-skin-admin-check"><input type="checkbox" id="isVietnameseSkin"><strong>Đây là skin Việt Nam</strong></label><div class="vietnamese-skin-admin-help">Tick để artwork có property “Việt Nam”, dùng cho switch filter và tìm kiếm kết hợp như “Marja Việt Nam”.</div>';
      rankRow.insertAdjacentElement('afterend',field);
    }

    const checkbox=document.querySelector('#isVietnameseSkin');
    if(!checkbox)return false;

    const savedFlags=new Map();
    const pendingFlags=new Map();
    let hydrating=false;

    function flagFor(item){
      if(!item)return false;
      const id=String(item.id);
      if(pendingFlags.has(id))return Boolean(pendingFlags.get(id));
      if(Object.prototype.hasOwnProperty.call(item,'isVietnameseSkin'))return Boolean(item.isVietnameseSkin);
      return Boolean(savedFlags.get(id));
    }

    function syncEditingCheckbox(){
      const id=String(editId.value||'');
      if(!id){checkbox.checked=false;return}
      checkbox.checked=flagFor(items.find(item=>String(item.id)===id));
    }

    function decorateList(){
      const q=(document.querySelector('#listSearch')?.value||'').trim().toLowerCase();
      const shown=items.filter(item=>!q||[
        item.name,item.description,item.category,item.credit,item.rank,item.hidden?'hidden':'visible',flagFor(item)?'viet nam vietnam skin viet nam':''
      ].join(' ').toLowerCase().includes(q));
      const rows=[...list.querySelectorAll('.item')];
      rows.forEach((row,index)=>{
        row.querySelectorAll('.admin-vietnamese-skin-badge').forEach(el=>el.remove());
        const item=shown[index];
        if(!item||!flagFor(item))return;
        const title=row.querySelector('.title');
        if(!title)return;
        const badge=document.createElement('span');
        badge.className='admin-vietnamese-skin-badge';
        badge.textContent='Việt Nam';
        title.appendChild(badge);
      });
    }

    async function hydrateFlags(){
      if(hydrating||!client)return;
      let signedIn=false;
      try{signedIn=Boolean(typeof adminUser!=='undefined'&&adminUser)}catch{}
      if(!signedIn)return;
      hydrating=true;
      try{
        const {data,error}=await client.from('artworks').select('id,is_vietnamese_skin');
        if(error)throw error;
        savedFlags.clear();
        for(const row of data||[])savedFlags.set(String(row.id),Boolean(row.is_vietnamese_skin));
        for(const item of items){
          const id=String(item.id);
          item.isVietnameseSkin=pendingFlags.has(id)?Boolean(pendingFlags.get(id)):Boolean(savedFlags.get(id));
        }
        syncEditingCheckbox();
        decorateList();
      }catch(error){
        console.warn('Unable to load Vietnamese skin properties.',error);
      }finally{hydrating=false}
    }

    const statusObserver=new MutationObserver(()=>{
      const text=(status.textContent||'').trim();
      if(/^Loaded \d+ artworks from Supabase\./.test(text)||text.includes('Published and confirmed in Supabase'))hydrateFlags();
    });
    statusObserver.observe(status,{childList:true,subtree:true,characterData:true});

    new MutationObserver(decorateList).observe(list,{childList:true,subtree:true});

    list.addEventListener('click',event=>{
      const edit=event.target.closest('[data-edit]');
      if(!edit)return;
      queueMicrotask(syncEditingCheckbox);
    });

    clearButton.addEventListener('click',()=>{queueMicrotask(()=>{checkbox.checked=false})});

    applyButton.addEventListener('click',()=>{
      const editing=String(editId.value||'');
      const beforeIds=new Set(items.map(item=>String(item.id)));
      const desired=Boolean(checkbox.checked);
      queueMicrotask(()=>{
        let target=null;
        if(editing)target=items.find(item=>String(item.id)===editing)||null;
        else target=items.find(item=>!beforeIds.has(String(item.id)))||null;
        if(!target)return;
        const id=String(target.id);
        target.isVietnameseSkin=desired;
        pendingFlags.set(id,desired);
        markDirty();
        checkbox.checked=false;
        decorateList();
      });
    },true);

    document.querySelector('#listSearch')?.addEventListener('input',()=>queueMicrotask(decorateList));

    saveButton.addEventListener('click',async event=>{
      if(!pendingFlags.size)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const updates=[...pendingFlags.entries()];
      try{
        saveButton.disabled=true;
        await publish();
        for(const [id,value] of updates){
          const {error}=await client.from('artworks').update({is_vietnamese_skin:Boolean(value)}).eq('id',id);
          if(error)throw error;
          savedFlags.set(String(id),Boolean(value));
        }
        for(const [id] of updates)pendingFlags.delete(String(id));
        await hydrateFlags();
        setStatus('Published and confirmed in Supabase, including Vietnamese skin properties.','ok');
      }catch(error){
        for(const [id,value] of updates)pendingFlags.set(String(id),Boolean(value));
        try{markDirty()}catch{}
        setStatus(error?.message||'Unable to publish Vietnamese skin properties.','err');
      }finally{
        let signedIn=false;
        try{signedIn=Boolean(adminUser)}catch{}
        saveButton.disabled=!signedIn;
      }
    },true);

    setTimeout(hydrateFlags,0);
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(install()||attempts>160)clearInterval(timer);
    },50);
  }
})();
