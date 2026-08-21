(function(){
  'use strict';

  const KEEP_NAME_KEY='hyu_admin_keep_name';
  let cloneSourceId=null;

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  ready(()=>{
    const nameInput=document.querySelector('#name');
    const applyButton=document.querySelector('#apply');
    const clearButton=document.querySelector('#clear');
    const editingInput=document.querySelector('#editingId');
    const imageInput=document.querySelector('#image');
    const imageFile=document.querySelector('#imageFile');
    const preview=document.querySelector('#preview');
    const fileNote=document.querySelector('#fileNote');
    const formTitle=document.querySelector('#formTitle');
    const list=document.querySelector('#list');
    if(!nameInput||!applyButton||!editingInput||!list)return;

    const style=document.createElement('style');
    style.textContent=`
      .keep-name-option{display:flex!important;align-items:center;justify-content:flex-start!important;gap:8px!important;margin:7px 0 0!important;color:var(--muted)!important;font-size:11px!important;cursor:pointer;user-select:none}
      .keep-name-option input{width:15px;height:15px;margin:0;accent-color:var(--accent)}
      .btn.clone{color:#b9ecff;border-color:#315766;background:#10202a}
    `;
    document.head.appendChild(style);

    const nameField=nameInput.closest('.field');
    const keepLabel=document.createElement('label');
    keepLabel.className='keep-name-option';
    keepLabel.innerHTML='<input type="checkbox" id="keepNameAfterAdd"> <span>Keep Name for next artwork</span>';
    nameField?.appendChild(keepLabel);
    const keepName=document.querySelector('#keepNameAfterAdd');
    if(keepName){
      keepName.checked=sessionStorage.getItem(KEEP_NAME_KEY)==='1';
      keepName.addEventListener('change',()=>sessionStorage.setItem(KEEP_NAME_KEY,keepName.checked?'1':'0'));
    }

    function getItem(id){
      try{return items.find(x=>String(x.id)===String(id))||null}catch{return null}
    }

    function getStoragePath(url){
      try{return storagePathFromUrl(url)}catch{return null}
    }

    function enhanceList(){
      list.querySelectorAll('.controls').forEach(controls=>{
        if(controls.querySelector('[data-clone]'))return;
        const edit=controls.querySelector('[data-edit]');
        if(!edit)return;
        const clone=document.createElement('button');
        clone.type='button';
        clone.className='btn small clone';
        clone.dataset.clone=edit.dataset.edit;
        clone.textContent='Clone';
        clone.title='Clone this artwork into the Add Artwork form';
        edit.after(clone);
      });
    }

    function fillCloneForm(id){
      const source=getItem(id);
      if(!source)return;
      cloneSourceId=String(source.id);
      try{resetForm()}catch{}
      cloneSourceId=String(source.id);
      editingInput.value='';
      nameInput.value=source.name||'';
      const description=document.querySelector('#description');
      if(description)description.value=source.description||'';
      try{syncSearchChoice(document.querySelector('#category'),document.querySelector('#categoryOptions'),categories.map(v=>v.name),source.category)}catch{}
      try{syncSelect(document.querySelector('#rank'),ranks.map(v=>v.name),source.rank)}catch{}
      try{syncSearchChoice(document.querySelector('#credit'),document.querySelector('#creditOptions'),credits.map(v=>v.name),source.credit)}catch{}
      if(imageInput)imageInput.value=source.image||'';

      try{
        const pending=pendingUploads.get(source.id);
        if(pending?.file){
          selectedFile=pending.file;
          revokePreview();
          selectedPreviewUrl=URL.createObjectURL(pending.file);
          if(preview)preview.src=selectedPreviewUrl;
          if(fileNote)fileNote.textContent=`Cloning pending image: ${pending.file.name} · ${(pending.file.size/1024/1024).toFixed(2)} MB`;
        }else if(preview){
          preview.src=source.image||'';
        }
      }catch{
        if(preview)preview.src=source.image||'';
      }

      if(formTitle)formTitle.textContent='Clone artwork';
      applyButton.textContent='Add clone';
      window.scrollTo({top:0,behavior:'smooth'});
      try{setStatus(`Cloning "${source.name}". Edit any property, then click Add clone.`,'ok')}catch{}
    }

    new MutationObserver(enhanceList).observe(list,{childList:true,subtree:true});
    enhanceList();

    list.addEventListener('click',event=>{
      const cloneButton=event.target.closest('[data-clone]');
      if(cloneButton){
        event.preventDefault();
        event.stopImmediatePropagation();
        fillCloneForm(cloneButton.dataset.clone);
        return;
      }

      const editButton=event.target.closest('[data-edit]');
      if(editButton)cloneSourceId=null;

      const deleteButton=event.target.closest('[data-del]');
      if(!deleteButton)return;
      const item=getItem(deleteButton.dataset.del);
      if(!item?.image)return;
      let shared=false;
      try{shared=items.some(other=>String(other.id)!==String(item.id)&&other.image===item.image)}catch{}
      if(!shared)return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if(!confirm(`Delete "${item.name}"?`))return;
      try{clearPendingUpload(item.id)}catch{}
      try{if(!String(item.id).startsWith('local-'))deletedArtworkIds.add(item.id)}catch{}
      try{items=items.filter(v=>String(v.id)!==String(item.id))}catch{}
      if(editingInput.value===String(item.id))try{resetForm()}catch{}
      try{markDirty();render();setStatus('Artwork marked for deletion. Shared Storage image was preserved because another artwork still uses it.','ok')}catch{}
    },true);

    applyButton.addEventListener('click',()=>{
      const wasEditing=Boolean(editingInput.value);
      const editingId=editingInput.value;
      const oldItem=wasEditing?getItem(editingId):null;
      const oldImage=oldItem?.image||'';
      let sharedOldImage=false;
      if(oldImage){
        try{sharedOldImage=items.some(other=>String(other.id)!==String(editingId)&&other.image===oldImage)}catch{}
      }

      // Fix metadata-only edits: an existing artwork's current image is valid.
      if(wasEditing&&imageInput&&!imageInput.value.trim()&&!imageFile?.files?.length&&oldImage){
        imageInput.value=oldImage;
        if(preview&&!preview.getAttribute('src'))preview.src=oldImage;
      }

      const keepAfterAdd=!wasEditing&&Boolean(keepName?.checked);
      const keptName=nameInput.value;
      const sourceId=cloneSourceId;
      const source=sourceId?getItem(sourceId):null;
      let beforeIds;
      try{beforeIds=new Set(items.map(x=>String(x.id)))}catch{beforeIds=new Set()}

      queueMicrotask(()=>{
        // Preserve shared Storage files when an edited clone switches to another image.
        if(wasEditing&&sharedOldImage&&oldImage){
          const path=getStoragePath(oldImage);
          if(path)try{storageDeletes.delete(path)}catch{}
        }

        // Copy non-form metadata for a successful clone.
        if(source){
          let created=null;
          try{created=items.find(x=>!beforeIds.has(String(x.id)))}catch{}
          if(created){
            created.tags=Array.isArray(source.tags)?[...source.tags]:[];
            created.hidden=Boolean(source.hidden);
            try{render()}catch{}
            cloneSourceId=null;
          }
        }

        if(keepAfterAdd&&keepName)nameInput.value=keptName;
      });
    },true);

    clearButton?.addEventListener('click',()=>{cloneSourceId=null},true);
  });
})();
