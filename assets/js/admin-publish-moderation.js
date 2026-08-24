(function(){
  'use strict';

  if(window.__HYU_PUBLISH_MODERATION_MODULE__==='v2')return;
  window.__HYU_PUBLISH_MODERATION_MODULE__='v2';

  const OWNER_EMAIL='csquocnguyen@gmail.com';
  const MODERATION_URL='https://zkrhwqgmynbbmoktokdq.supabase.co/functions/v1/publish-moderation';
  const POLL_MS=12000;
  const RESOLVE_RETRY_MS=700;
  const RESOLVE_RETRY_LIMIT=24;
  const trackedUploads=new Map();

  let currentViewer=null;
  let panel=null;
  let listEl=null;
  let noteEl=null;
  let refreshButton=null;
  let filterMode='pending';
  let pollTimer=0;
  let loading=false;
  let hookInstalled=false;
  let resolveAttempts=0;
  let resolveTimer=0;

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function facade(){
    try{return typeof client!=='undefined'?client:null}catch{return null}
  }

  function activeClient(){
    try{
      if(typeof window.HYU_GET_ACTIVE_ADMIN_CLIENT==='function'){
        const c=window.HYU_GET_ACTIVE_ADMIN_CLIENT();
        if(c)return c;
      }
    }catch{}
    return facade();
  }

  function activeProfile(){
    try{
      if(typeof window.HYU_GET_ACTIVE_ADMIN_PROFILE==='function'){
        const key=window.HYU_GET_ACTIVE_ADMIN_PROFILE();
        if(key)return String(key);
      }
    }catch{}
    return String(window.HYU_ACTIVE_ADMIN_PROFILE||window.HYU_SUPABASE_PROFILE||'owner');
  }

  function dashboardUser(){
    try{
      if(typeof adminUser!=='undefined'&&adminUser?.email)return adminUser;
    }catch{}
    return null;
  }

  function dashboardSignedIn(){
    return Boolean(document.getElementById('ownerPill')?.classList.contains('ok'));
  }

  async function viewer(){
    const local=dashboardUser();
    if(local?.email){
      return {
        user:local,
        email:String(local.email||'').trim().toLowerCase(),
        profile:activeProfile()
      };
    }

    const c=activeClient();
    if(c?.auth?.getSession){
      try{
        const {data}=await c.auth.getSession();
        const user=data?.session?.user;
        if(user?.email){
          return {
            user,
            email:String(user.email||'').trim().toLowerCase(),
            profile:activeProfile()
          };
        }
      }catch{}
    }

    if(c?.auth?.getUser){
      try{
        const {data,error}=await c.auth.getUser();
        if(!error&&data?.user?.email){
          return {
            user:data.user,
            email:String(data.user.email||'').trim().toLowerCase(),
            profile:activeProfile()
          };
        }
      }catch{}
    }

    const pill=document.getElementById('ownerPill');
    if(pill?.classList.contains('ok')){
      const match=String(pill.textContent||'').match(/signed\s+in:\s*([^\s]+@[^\s]+)$/i);
      if(match?.[1]){
        return {
          user:{email:match[1]},
          email:String(match[1]).trim().toLowerCase(),
          profile:activeProfile()
        };
      }
    }

    return null;
  }

  async function accessToken(){
    const c=activeClient();
    if(!c?.auth?.getSession)return '';
    try{
      const {data}=await c.auth.getSession();
      return data?.session?.access_token||'';
    }catch{return ''}
  }

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function requestStatusClass(status){
    return ['approved','declined','pending','superseded','cancelled'].includes(status)?status:'pending';
  }

  function formatTime(value){
    if(!value)return '';
    try{return new Date(value).toLocaleString()}catch{return String(value)}
  }

  async function moderationFetch(path='',options={}){
    const token=await accessToken();
    if(!token)throw new Error('Admin session is unavailable. Please sign in again.');
    const response=await fetch(`${MODERATION_URL}${path}`,{
      ...options,
      headers:{
        ...(options.headers||{}),
        Authorization:`Bearer ${token}`,
        'Content-Type':'application/json'
      },
      cache:'no-store',
      credentials:'omit'
    });
    let payload={};
    try{payload=await response.json()}catch{}
    if(!response.ok)throw new Error(payload?.error||`Moderation request failed (${response.status}).`);
    return payload;
  }

  async function createPublishRequest(row,path){
    const v=currentViewer||await viewer();
    if(!v||v.email===OWNER_EMAIL)return null;
    const payload=await moderationFetch('',{
      method:'POST',
      body:JSON.stringify({
        action:'create',
        sourceProfile:v.profile,
        artworkId:String(row.id||''),
        artworkName:String(row.name||''),
        candidateImage:String(row.image||''),
        uploadPath:path,
        metadata:{
          description:String(row.description||''),
          category_id:row.category_id??null,
          rank_id:row.rank_id??null,
          credit_id:row.credit_id??null,
          tags:Array.isArray(row.tags)?row.tags:[],
          hidden:Boolean(row.hidden)
        }
      })
    });
    return payload?.request||null;
  }

  async function cancelPublishRequest(requestId){
    if(!requestId)return;
    try{
      await moderationFetch('',{
        method:'POST',
        body:JSON.stringify({action:'cancel',requestId})
      });
    }catch(error){
      console.warn('Unable to cancel failed publish request',error);
    }
  }

  function imageMatchesPath(image,path){
    const raw=String(image||'');
    if(!raw||!path)return false;
    try{
      const decoded=decodeURIComponent(raw);
      return decoded.includes(`/${path}`)||decoded.endsWith(path);
    }catch{
      return raw.includes(`/${path}`)||raw.endsWith(path);
    }
  }

  function matchingTrackedUpload(row){
    for(const path of trackedUploads.keys()){
      if(imageMatchesPath(row?.image,path))return path;
    }
    return '';
  }

  async function cleanupUploadedPaths(paths,originalStorageFrom){
    const unique=[...new Set(paths.filter(Boolean))];
    if(!unique.length)return;
    try{await originalStorageFrom('artworks').remove(unique)}catch(error){
      console.warn('Unable to remove failed moderated uploads',error);
    }
  }

  function installPublishHook(){
    if(hookInstalled)return true;
    const c=facade();
    if(!c?.from||!c?.storage?.from)return false;
    if(c.__hyuPublishModerationHooked){hookInstalled=true;return true}

    const originalFrom=c.from.bind(c);
    const originalStorageFrom=c.storage.from.bind(c.storage);

    c.storage.from=function(bucket){
      const api=originalStorageFrom(bucket);
      if(bucket!=='artworks'||!api)return api;
      return new Proxy(api,{
        get(target,prop){
          if(prop==='upload'){
            return async function(path,file,options){
              const result=await target.upload(path,file,options);
              if(!result?.error&&/^uploads\//.test(String(path||''))){
                trackedUploads.set(String(path),{
                  name:String(file?.name||''),
                  size:Number(file?.size||0),
                  type:String(file?.type||'')
                });
              }
              return result;
            };
          }
          const value=target[prop];
          return typeof value==='function'?value.bind(target):value;
        }
      });
    };

    c.from=function(table){
      const api=originalFrom(table);
      if(table!=='artworks'||!api)return api;
      return new Proxy(api,{
        get(target,prop){
          if(prop==='upsert'){
            return async function(rows,options){
              const v=currentViewer||await viewer();
              const rowList=Array.isArray(rows)?rows:[rows];
              const affected=rowList
                .map(row=>({row,path:matchingTrackedUpload(row)}))
                .filter(entry=>entry.path);

              if(!affected.length||!v||v.email===OWNER_EMAIL){
                const result=await target.upsert(rows,options);
                if(!result?.error)affected.forEach(({path})=>trackedUploads.delete(path));
                return result;
              }

              const created=[];
              try{
                for(const entry of affected){
                  const request=await createPublishRequest(entry.row,entry.path);
                  if(!request?.id)throw new Error(`Unable to create publish request for ${entry.row?.name||entry.row?.id||'artwork'}.`);
                  created.push({requestId:request.id,path:entry.path});
                }
              }catch(error){
                for(const item of created)await cancelPublishRequest(item.requestId);
                await cleanupUploadedPaths(affected.map(x=>x.path),originalStorageFrom);
                return {data:null,error:error instanceof Error?error:new Error(String(error))};
              }

              const result=await target.upsert(rows,options);
              if(result?.error){
                for(const item of created)await cancelPublishRequest(item.requestId);
                await cleanupUploadedPaths(affected.map(x=>x.path),originalStorageFrom);
                return result;
              }

              affected.forEach(({path})=>trackedUploads.delete(path));
              window.dispatchEvent(new CustomEvent('hyu:publish-request-created',{detail:{count:created.length}}));
              return result;
            };
          }
          const value=target[prop];
          return typeof value==='function'?value.bind(target):value;
        }
      });
    };

    try{Object.defineProperty(c,'__hyuPublishModerationHooked',{value:true,configurable:false})}catch{
      try{c.__hyuPublishModerationHooked=true}catch{}
    }
    hookInstalled=true;
    return true;
  }

  function injectStyle(){
    if(document.querySelector('style[data-hyu-publish-moderation]'))return;
    const style=document.createElement('style');
    style.dataset.hyuPublishModeration='true';
    style.textContent=`
      .publish-moderation-panel{grid-column:1/-1;min-width:0;order:-100}
      .publish-moderation-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px}
      .publish-moderation-head h2{margin-bottom:4px!important}
      .publish-moderation-note{font-size:11px;color:var(--muted);max-width:850px}
      .publish-moderation-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
      .publish-filter.active{border-color:#43dcff;color:#43dcff;background:#102731}
      .publish-request-list{display:grid;gap:8px}
      .publish-request-card{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid #212832;background:#0d1115;border-radius:8px;padding:9px}
      .publish-request-card img{width:150px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#07090b;border:1px solid #202832}
      .publish-request-title{font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .publish-request-meta{margin-top:4px;color:var(--muted);font-size:10px;display:flex;gap:8px 12px;flex-wrap:wrap}
      .publish-request-path{margin-top:4px;color:#74818d;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:720px}
      .publish-request-side{display:grid;justify-items:end;gap:8px;min-width:170px}
      .publish-status{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
      .publish-status.pending{color:#f5d98a;border-color:#5a4725;background:#211a0d}
      .publish-status.approved{color:#9be5b9;border-color:#27543c;background:#0c1711}
      .publish-status.declined{color:#ffc4ca;border-color:#56323a;background:#231518}
      .publish-status.superseded,.publish-status.cancelled{color:#aab5be;background:#151a20}
      .publish-request-actions{display:flex;gap:6px;justify-content:flex-end}
      .publish-empty{padding:24px;border:1px dashed var(--line);border-radius:7px;color:var(--muted);text-align:center;font-size:11px}
      .publish-inbox-count{display:inline-flex;min-width:20px;height:20px;padding:0 6px;align-items:center;justify-content:center;border-radius:999px;background:#43dcff;color:#061016;font-size:10px;font-weight:900;margin-left:5px}
      @media(max-width:760px){.publish-moderation-head{display:block}.publish-moderation-toolbar{margin-top:10px}.publish-request-card{grid-template-columns:92px minmax(0,1fr)}.publish-request-card img{width:92px}.publish-request-side{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;min-width:0}.publish-request-actions{margin-left:auto}}
    `;
    document.head.appendChild(style);
  }

  function removeModerationNavButtons(){
    document.querySelectorAll('[data-admin-jump="admin-publish-inbox"],[data-admin-jump="admin-publish-requests"]').forEach(el=>el.remove());
  }

  function buildPanel(isOwner){
    const grid=document.querySelector('.grid');
    if(!grid)return false;

    const wantedId=isOwner?'admin-publish-inbox':'admin-publish-requests';
    if(panel&&panel.id===wantedId&&panel.isConnected)return true;

    panel?.remove();
    removeModerationNavButtons();

    panel=document.createElement('section');
    panel.className='panel publish-moderation-panel admin-scroll-target';
    panel.id=wantedId;
    panel.dataset.publishModerationReady='true';
    panel.innerHTML=`
      <div class="publish-moderation-head">
        <div><h2>${isOwner?'Publish Inbox':'Publish Requests'}</h2><div class="publish-moderation-note" id="publishModerationNote"></div></div>
        <div class="publish-moderation-toolbar" id="publishModerationToolbar"></div>
      </div>
      <div class="publish-request-list" id="publishRequestList"><div class="publish-empty">Loading publish requests...</div></div>
    `;
    grid.insertBefore(panel,grid.firstChild);

    listEl=panel.querySelector('#publishRequestList');
    noteEl=panel.querySelector('#publishModerationNote');
    const toolbar=panel.querySelector('#publishModerationToolbar');

    if(isOwner){
      noteEl.textContent='Images uploaded by other admin accounts wait here for approval before they can appear in the public catalogue.';
      toolbar.innerHTML='<button class="btn small publish-filter active" type="button" data-publish-filter="pending">Pending</button><button class="btn small publish-filter" type="button" data-publish-filter="all">All</button><button class="btn small" type="button" id="publishRefresh">Reload inbox</button>';
      toolbar.addEventListener('click',event=>{
        const filter=event.target.closest('[data-publish-filter]');
        if(!filter)return;
        filterMode=filter.dataset.publishFilter||'pending';
        toolbar.querySelectorAll('[data-publish-filter]').forEach(btn=>btn.classList.toggle('active',btn===filter));
        loadRequests(true);
      });
    }else{
      noteEl.textContent='Every original image you upload is sent to the owner for approval. Pending or declined images are not eligible for the public catalogue.';
      toolbar.innerHTML='<button class="btn small" type="button" id="publishRefresh">Reload status</button>';
    }

    refreshButton=panel.querySelector('#publishRefresh');
    refreshButton?.addEventListener('click',()=>loadRequests(true));
    syncQuickNav(isOwner);
    window.dispatchEvent(new CustomEvent('hyu:publish-moderation-panel-ready',{detail:{owner:isOwner}}));
    return true;
  }

  function syncQuickNav(isOwner){
    const id=isOwner?'admin-publish-inbox':'admin-publish-requests';
    const label=isOwner?'Publish Inbox':'Publish requests';

    const install=()=>{
      const nav=document.querySelector('.admin-jump-nav');
      if(!nav)return false;
      if(nav.querySelector(`[data-admin-jump="${id}"]`))return true;

      const button=document.createElement('button');
      button.type='button';
      button.dataset.adminJump=id;
      button.textContent=label;
      button.addEventListener('click',()=>{
        document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
        try{history.replaceState(null,'',`#${id}`)}catch{}
      });

      const title=nav.querySelector('.admin-jump-nav-title');
      if(title)title.insertAdjacentElement('afterend',button);
      else nav.prepend(button);
      return true;
    };

    if(install())return;
    const observer=new MutationObserver(()=>{if(install())observer.disconnect()});
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  function requestCard(row,isOwner){
    const status=requestStatusClass(String(row.status||'pending'));
    const decisionTime=row.decided_at?` · decided ${esc(formatTime(row.decided_at))}`:'';
    const requester=isOwner?`<span>${esc(row.requester_email||'')}</span><span>Source: ${esc(row.source_profile||'')}</span>`:'';
    const actions=isOwner&&status==='pending'
      ? `<div class="publish-request-actions"><button class="btn small primary" data-publish-decision="approved" data-request-id="${esc(row.id)}">Approve</button><button class="btn small danger" data-publish-decision="declined" data-request-id="${esc(row.id)}">Decline</button></div>`
      : '';

    return `<article class="publish-request-card" data-publish-request="${esc(row.id)}">
      <img src="${esc(row.candidate_image||'')}" alt="">
      <div>
        <div class="publish-request-title">${esc(row.artwork_name||row.artwork_id||'Artwork')}</div>
        <div class="publish-request-meta">${requester}<span>Artwork ID: ${esc(row.artwork_id||'')}</span><span>Submitted ${esc(formatTime(row.created_at))}${decisionTime}</span></div>
        <div class="publish-request-path">${esc(row.upload_path||row.candidate_image||'')}</div>
      </div>
      <div class="publish-request-side"><span class="publish-status ${status}">${esc(status)}</span>${actions}</div>
    </article>`;
  }

  function renderRequests(rows,isOwner){
    if(!listEl)return;
    const filtered=isOwner&&filterMode==='pending'?rows.filter(row=>row.status==='pending'):rows;

    if(!filtered.length){
      listEl.innerHTML=`<div class="publish-empty">${isOwner&&filterMode==='pending'?'No pending publish requests.':'No publish requests yet.'}</div>`;
    }else{
      listEl.innerHTML=filtered.map(row=>requestCard(row,isOwner)).join('');
    }

    if(isOwner){
      const pending=rows.filter(row=>row.status==='pending').length;
      const navButton=document.querySelector('[data-admin-jump="admin-publish-inbox"]');
      if(navButton){
        navButton.querySelector('.publish-inbox-count')?.remove();
        if(pending){
          const badge=document.createElement('span');
          badge.className='publish-inbox-count';
          badge.textContent=String(pending);
          navButton.appendChild(badge);
        }
      }
    }
  }

  async function loadRequests(force=false){
    if(loading||!currentViewer||!panel)return;
    if(document.hidden&&!force)return;

    loading=true;
    if(refreshButton)refreshButton.disabled=true;

    try{
      const isOwner=currentViewer.email===OWNER_EMAIL;
      const query=isOwner&&filterMode==='pending'?'?status=pending':'';
      const payload=await moderationFetch(query,{method:'GET'});
      renderRequests(Array.isArray(payload?.requests)?payload.requests:[],isOwner);
    }catch(error){
      if(listEl){
        listEl.innerHTML=`<div class="publish-empty">Inbox is visible, but requests could not be loaded: ${esc(error?.message||'Unknown error')}</div>`;
      }
    }finally{
      loading=false;
      if(refreshButton)refreshButton.disabled=false;
    }
  }

  async function decide(requestId,decision,button){
    if(!requestId||!['approved','declined'].includes(decision))return;
    if(currentViewer?.email!==OWNER_EMAIL)return;

    if(button)button.disabled=true;
    try{
      await moderationFetch('',{
        method:'POST',
        body:JSON.stringify({action:'decide',requestId,decision})
      });
      await loadRequests(true);
    }catch(error){
      window.alert(error?.message||'Unable to save moderation decision.');
    }finally{
      if(button)button.disabled=false;
    }
  }

  function scheduleResolve(){
    clearTimeout(resolveTimer);
    if(resolveAttempts>=RESOLVE_RETRY_LIMIT)return;
    resolveAttempts+=1;
    resolveTimer=setTimeout(()=>syncViewer({load:true,retry:true}),RESOLVE_RETRY_MS);
  }

  async function syncViewer(options={}){
    const v=await viewer();

    if(!v){
      if(dashboardSignedIn()){
        scheduleResolve();
        return;
      }

      currentViewer=null;
      panel?.remove();
      panel=listEl=noteEl=refreshButton=null;
      removeModerationNavButtons();
      clearInterval(pollTimer);
      pollTimer=0;
      resolveAttempts=0;
      return;
    }

    resolveAttempts=0;
    clearTimeout(resolveTimer);

    const signature=`${v.profile}:${v.email}`;
    const previous=currentViewer?`${currentViewer.profile}:${currentViewer.email}`:'';
    const changed=signature!==previous;
    currentViewer=v;

    if(changed||!panel||!panel.isConnected){
      filterMode='pending';
      buildPanel(v.email===OWNER_EMAIL);
    }

    installPublishHook();

    if(options.load!==false||changed)await loadRequests(true);
    if(!pollTimer)pollTimer=setInterval(()=>loadRequests(false),POLL_MS);
  }

  ready(()=>{
    injectStyle();
    installPublishHook();

    const ownerPill=document.getElementById('ownerPill');
    if(ownerPill){
      new MutationObserver(()=>{
        resolveAttempts=0;
        setTimeout(()=>syncViewer({load:true}),30);
      }).observe(ownerPill,{attributes:true,childList:true,subtree:true,characterData:true});
    }

    document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-publish-decision]');
      if(!button)return;
      event.preventDefault();
      event.stopPropagation();
      decide(button.dataset.requestId,button.dataset.publishDecision,button);
    });

    window.addEventListener('hyu:publish-request-created',()=>setTimeout(()=>loadRequests(true),100));
    window.addEventListener('focus',()=>{
      if(panel)loadRequests(true);
      else syncViewer({load:true});
    });
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)return;
      if(panel)loadRequests(true);
      else syncViewer({load:true});
    });

    // Dashboard code calls setOwner() only after admin verification completes. The lexical
    // adminUser value can become available without a DOM mutation in some execution orders,
    // so retry briefly until the signed-in viewer is resolved and the panel exists.
    let bootstrapChecks=0;
    const bootstrapTimer=setInterval(()=>{
      bootstrapChecks+=1;
      if(panel?.isConnected||bootstrapChecks>=30){
        clearInterval(bootstrapTimer);
        return;
      }
      if(dashboardSignedIn()||dashboardUser())syncViewer({load:true});
    },500);

    setTimeout(()=>syncViewer({load:true}),80);
  });
})();
