(function(){
  'use strict';

  let dragState=null;
  let reorderSaving=false;

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  ready(()=>{
    const panel=document.querySelector('#teamAdminPanel');
    const list=document.querySelector('#teamAdminList');
    const grid=document.querySelector('.grid');
    if(!panel||!list||!grid)return;

    const css=document.createElement('style');
    css.textContent=`
      #teamAdminPanel.team-manager-wide{grid-column:1/-1;margin-top:0!important;min-width:0}
      .team-admin-split{display:grid;grid-template-columns:minmax(420px,.95fr) minmax(460px,1.05fr);gap:18px;align-items:start}
      .team-admin-editor-pane,.team-admin-list-pane{min-width:0}
      .team-admin-editor-pane{padding-right:2px}
      .team-admin-editor-pane .team-admin-preview{max-width:320px}
      .team-admin-list-pane{border-left:1px solid var(--line);padding-left:18px}
      .team-admin-list-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:0 0 10px}
      .team-admin-list-head strong{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#c9d1d9}
      .team-admin-list-head span{color:var(--muted);font-size:10px;text-align:right}
      #teamAdminList.team-admin-list-side{margin-top:0;max-height:720px;overflow:auto;overscroll-behavior:contain;padding-right:3px;scrollbar-width:thin;scrollbar-color:#43505c #0d1115}
      #teamAdminList.team-admin-list-side::-webkit-scrollbar{width:7px}
      #teamAdminList.team-admin-list-side::-webkit-scrollbar-track{background:#0d1115}
      #teamAdminList.team-admin-list-side::-webkit-scrollbar-thumb{background:#43505c;border-radius:99px}
      #teamAdminList .team-admin-item{grid-template-columns:28px 58px minmax(0,1fr) auto!important;transition:border-color .14s ease,background .14s ease,opacity .14s ease,transform .14s ease}
      #teamAdminList .team-admin-item.team-dragging{opacity:.42;background:#101a20;transform:scale(.995)}
      #teamAdminList .team-admin-item.team-drop-target{border-color:#43dcff;box-shadow:0 0 0 1px rgba(67,220,255,.16) inset}
      .team-drag-handle{width:26px;height:42px;border:0;border-radius:5px;background:transparent;color:#697783;display:grid;place-items:center;padding:0;cursor:grab;touch-action:none;user-select:none;font-size:16px;line-height:1;letter-spacing:-3px}
      .team-drag-handle:hover,.team-drag-handle:focus-visible{background:#172129;color:#43dcff;outline:none}
      .team-drag-handle:active{cursor:grabbing}
      #teamAdminPanel.team-reorder-saving .team-drag-handle{pointer-events:none;opacity:.35}
      @media(max-width:980px){
        .team-admin-split{grid-template-columns:1fr}
        .team-admin-list-pane{border-left:0;border-top:1px solid var(--line);padding-left:0;padding-top:16px}
        #teamAdminList.team-admin-list-side{max-height:none}
      }
      @media(max-width:520px){
        #teamAdminList .team-admin-item{grid-template-columns:26px 52px minmax(0,1fr)!important}
        #teamAdminList .team-admin-item .controls{grid-column:2/-1}
        .team-admin-thumb{width:52px;height:52px}
        .team-admin-list-head{align-items:flex-start;flex-direction:column;gap:3px}
        .team-admin-list-head span{text-align:left}
      }
    `;
    document.head.appendChild(css);

    function setStatus(message,type=''){
      const status=document.querySelector('#teamStatus');
      if(!status)return;
      status.textContent=message;
      status.className='status '+type;
    }

    function memberId(item){
      if(!item)return '';
      return item.dataset.teamMemberId||item.querySelector('[data-team-edit]')?.dataset.teamEdit||item.querySelector('[data-team-toggle]')?.dataset.teamToggle||'';
    }

    function orderedItems(){
      return [...list.querySelectorAll(':scope > .team-admin-item')];
    }

    function orderSnapshot(){
      const items=orderedItems();
      const ids=[];
      const oldOrders=new Map();
      items.forEach((item,index)=>{
        const id=memberId(item);
        if(!id)return;
        ids.push(String(id));
        const text=item.querySelector('.team-admin-meta')?.textContent||'';
        const match=text.match(/Order\s+(\d+)/i);
        oldOrders.set(String(id),match?Number(match[1]):index+1);
      });
      return {ids,oldOrders};
    }

    function sameOrder(a,b){
      return a.length===b.length&&a.every((id,index)=>String(id)===String(b[index]));
    }

    function restoreDom(ids){
      const byId=new Map(orderedItems().map(item=>[String(memberId(item)),item]));
      ids.forEach(id=>{const item=byId.get(String(id));if(item)list.appendChild(item)});
    }

    function syncVisibleOrder(){
      const items=orderedItems();
      items.forEach((item,index)=>{
        const meta=item.querySelector('.team-admin-meta');
        if(!meta)return;
        const visibility=/Hidden/i.test(meta.textContent)?'Hidden':'Visible';
        meta.textContent=`Order ${index+1} · ${visibility}`;
      });
      const editingId=document.querySelector('#teamMemberId')?.value||'';
      if(editingId){
        const index=items.findIndex(item=>String(memberId(item))===String(editingId));
        if(index>=0){
          const order=document.querySelector('#teamOrder');
          if(order)order.value=String(index+1);
        }
      }else if(!(document.querySelector('#teamName')?.value||'').trim()){
        const order=document.querySelector('#teamOrder');
        if(order)order.value=String(items.length+1);
      }
    }

    function decorateItems(){
      orderedItems().forEach(item=>{
        const id=memberId(item);
        if(id)item.dataset.teamMemberId=String(id);
        if(item.querySelector('.team-drag-handle'))return;
        const handle=document.createElement('button');
        handle.type='button';
        handle.className='team-drag-handle';
        handle.draggable=true;
        handle.setAttribute('aria-label',`Drag to reorder ${item.querySelector('.team-admin-title')?.textContent||'team member'}`);
        handle.title='Drag to reorder';
        handle.textContent='⋮⋮';
        item.prepend(handle);
      });
      const count=document.querySelector('#teamListCount');
      if(count)count.textContent=`${orderedItems().length} member${orderedItems().length===1?'':'s'} · drag to reorder`;
    }

    async function persistOrder(snapshot){
      if(reorderSaving)return;
      const items=orderedItems();
      const ids=items.map(memberId).filter(Boolean).map(String);
      if(sameOrder(snapshot.ids,ids))return;

      reorderSaving=true;
      panel.classList.add('team-reorder-saving');
      setStatus('Saving team order to Supabase...');
      const applied=[];

      try{
        if(typeof ensureAdmin==='function')await ensureAdmin();
        if(typeof client==='undefined'||!client)throw new Error('Supabase client is unavailable.');

        for(let index=0;index<ids.length;index++){
          const id=ids[index];
          const {error}=await client.from('team_members').update({sort_order:index+1}).eq('id',id);
          if(error)throw error;
          applied.push(id);
        }

        syncVisibleOrder();
        setStatus('Team order saved. About Us now uses this order.','ok');
      }catch(error){
        if(typeof client!=='undefined'&&client){
          for(const id of applied){
            const oldOrder=snapshot.oldOrders.get(String(id));
            if(oldOrder===undefined)continue;
            try{await client.from('team_members').update({sort_order:oldOrder}).eq('id',id)}catch{}
          }
        }
        restoreDom(snapshot.ids);
        syncVisibleOrder();
        setStatus(`${error?.message||'Unable to save team order.'} Previous order restored.`,'err');
      }finally{
        reorderSaving=false;
        panel.classList.remove('team-reorder-saving');
        dragState=null;
        orderedItems().forEach(item=>item.classList.remove('team-dragging','team-drop-target'));
      }
    }

    function startDrag(item,pointerId=null){
      if(!item||reorderSaving)return false;
      dragState={item,pointerId,snapshot:orderSnapshot()};
      item.classList.add('team-dragging');
      return true;
    }

    function moveDraggedTo(clientY,target){
      if(!dragState?.item||!target||target===dragState.item||!list.contains(target))return;
      orderedItems().forEach(item=>item.classList.remove('team-drop-target'));
      target.classList.add('team-drop-target');
      const rect=target.getBoundingClientRect();
      const after=clientY>rect.top+rect.height/2;
      list.insertBefore(dragState.item,after?target.nextSibling:target);
    }

    function autoScrollList(clientY){
      const rect=list.getBoundingClientRect();
      const edge=54;
      if(clientY<rect.top+edge)list.scrollTop-=14;
      else if(clientY>rect.bottom-edge)list.scrollTop+=14;
    }

    function finishDrag(){
      if(!dragState)return;
      const snapshot=dragState.snapshot;
      dragState.item?.classList.remove('team-dragging');
      orderedItems().forEach(item=>item.classList.remove('team-drop-target'));
      persistOrder(snapshot);
    }

    function buildLayout(){
      if(panel.classList.contains('team-manager-wide'))return;
      panel.classList.add('team-manager-wide');
      grid.appendChild(panel);

      const heading=panel.querySelector(':scope > h2');
      const note=panel.querySelector(':scope > .team-admin-note');
      const split=document.createElement('div');
      split.className='team-admin-split';
      const editor=document.createElement('div');
      editor.className='team-admin-editor-pane';
      const listPane=document.createElement('div');
      listPane.className='team-admin-list-pane';
      const listHead=document.createElement('div');
      listHead.className='team-admin-list-head';
      listHead.innerHTML='<strong>Team member list</strong><span id="teamListCount">Drag to reorder</span>';

      [...panel.children].forEach(child=>{
        if(child===heading||child===note||child===list)return;
        editor.appendChild(child);
      });
      list.classList.add('team-admin-list-side');
      listPane.append(listHead,list);
      split.append(editor,listPane);
      panel.appendChild(split);
    }

    buildLayout();
    decorateItems();

    const observer=new MutationObserver(()=>decorateItems());
    observer.observe(list,{childList:true});

    list.addEventListener('dragstart',event=>{
      const handle=event.target.closest('.team-drag-handle');
      if(!handle)return;
      const item=handle.closest('.team-admin-item');
      if(!startDrag(item))return event.preventDefault();
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain',memberId(item));
      }
    });

    list.addEventListener('dragover',event=>{
      if(!dragState)return;
      event.preventDefault();
      if(event.dataTransfer)event.dataTransfer.dropEffect='move';
      autoScrollList(event.clientY);
      moveDraggedTo(event.clientY,event.target.closest('.team-admin-item'));
    });

    list.addEventListener('drop',event=>{
      if(!dragState)return;
      event.preventDefault();
      finishDrag();
    });

    list.addEventListener('dragend',()=>{
      if(dragState)finishDrag();
    });

    list.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse')return;
      const handle=event.target.closest('.team-drag-handle');
      if(!handle)return;
      const item=handle.closest('.team-admin-item');
      if(!startDrag(item,event.pointerId))return;
      event.preventDefault();
      try{handle.setPointerCapture(event.pointerId)}catch{}
    });

    list.addEventListener('pointermove',event=>{
      if(!dragState||dragState.pointerId!==event.pointerId)return;
      event.preventDefault();
      autoScrollList(event.clientY);
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.team-admin-item');
      moveDraggedTo(event.clientY,target);
    });

    const finishPointer=event=>{
      if(!dragState||dragState.pointerId!==event.pointerId)return;
      event.preventDefault();
      finishDrag();
    };
    list.addEventListener('pointerup',finishPointer);
    list.addEventListener('pointercancel',finishPointer);

    list.addEventListener('click',event=>{
      const edit=event.target.closest('[data-team-edit]');
      if(!edit)return;
      queueMicrotask(()=>{
        const items=orderedItems();
        const index=items.findIndex(item=>String(memberId(item))===String(edit.dataset.teamEdit));
        const order=document.querySelector('#teamOrder');
        if(index>=0&&order)order.value=String(index+1);
      });
    });

    document.querySelector('#teamClear')?.addEventListener('click',()=>{
      setTimeout(()=>{
        if(!(document.querySelector('#teamMemberId')?.value||'')){
          const order=document.querySelector('#teamOrder');
          if(order)order.value=String(orderedItems().length+1);
        }
      },0);
    });
  });
})();
