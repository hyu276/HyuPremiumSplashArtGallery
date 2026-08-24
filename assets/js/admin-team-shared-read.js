(function(){
  'use strict';

  const TEAM_OWNER_EMAIL='csquocnguyen@gmail.com';
  const EDGE_URL='https://zkrhwqgmynbbmoktokdq.supabase.co/functions/v1/shared-team-admin-read';
  let loading=false;
  let lastSignature='';

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function panel(){return document.querySelector('#teamAdminPanel,#admin-about-team')}
  function list(){return document.querySelector('#teamAdminList')}
  function status(){return document.querySelector('#teamStatus')}
  function count(){return document.querySelector('#teamListCount')}

  function setStatus(message,type=''){
    const el=status();
    if(!el)return;
    el.textContent=message;
    el.className='status '+type;
  }

  async function currentUser(){
    try{
      const c=typeof window.HYU_GET_ACTIVE_ADMIN_CLIENT==='function'?window.HYU_GET_ACTIVE_ADMIN_CLIENT():null;
      if(c?.auth?.getUser){
        const {data}=await c.auth.getUser();
        return data?.user||null;
      }
    }catch{}
    return null;
  }

  async function currentAccessToken(){
    try{
      const c=typeof window.HYU_GET_ACTIVE_ADMIN_CLIENT==='function'?window.HYU_GET_ACTIVE_ADMIN_CLIENT():null;
      if(c?.auth?.getSession){
        const {data}=await c.auth.getSession();
        return data?.session?.access_token||'';
      }
    }catch{}
    return '';
  }

  function render(rows){
    const target=list();
    if(!target)return;

    if(!Array.isArray(rows)||!rows.length){
      target.innerHTML='<div class="team-admin-empty">No team members loaded.</div>';
      if(count())count().textContent='0 members · read only';
      return;
    }

    target.innerHTML=rows.map(member=>`<div class="team-admin-item${member.hidden?' is-hidden':''}" data-team-member-id="${esc(member.id)}"><img class="team-admin-thumb" src="${esc(member.image||'')}" alt=""><div><div class="team-admin-title">${esc(member.name)}</div><div class="team-admin-meta">Order ${Number(member.sort_order)||0} · ${member.hidden?'Hidden':'Visible'}</div></div><div class="controls"><button class="btn small" data-team-edit="${esc(member.id)}">Edit</button><button class="btn small visibility${member.hidden?' hidden':''}" data-team-toggle="${esc(member.id)}">${member.hidden?'Unhide':'Hide'}</button></div></div>`).join('');

    if(count())count().textContent=`${rows.length} member${rows.length===1?'':'s'} · read only`;
  }

  async function loadSharedTeam(force=false){
    if(loading)return;
    const p=panel();
    const l=list();
    if(!p||!l)return;

    const user=await currentUser();
    const email=String(user?.email||'').trim().toLowerCase();
    if(!email||email===TEAM_OWNER_EMAIL)return;

    const token=await currentAccessToken();
    if(!token)return;

    loading=true;
    setStatus('Loading shared team list from owner database...');
    try{
      const response=await fetch(EDGE_URL,{
        method:'GET',
        headers:{Authorization:`Bearer ${token}`},
        cache:'no-store',
        credentials:'omit'
      });
      if(!response.ok){
        let detail='';
        try{detail=(await response.json())?.error||''}catch{}
        throw new Error(detail||`Unable to load shared team (${response.status}).`);
      }
      const payload=await response.json();
      const rows=Array.isArray(payload?.team)?payload.team:[];
      const signature=JSON.stringify(rows.map(row=>[row.id,row.updated_at,row.hidden,row.sort_order]));
      if(force||signature!==lastSignature){
        render(rows);
        lastSignature=signature;
      }
      setStatus(`Loaded ${rows.length} shared team member${rows.length===1?'':'s'} from owner database.`,'ok');
    }catch(error){
      setStatus(error?.message||'Unable to load shared team list.','err');
    }finally{
      loading=false;
    }
  }

  document.addEventListener('click',event=>{
    const reload=event.target.closest?.('#teamReload');
    if(!reload)return;
    Promise.resolve(currentUser()).then(user=>{
      const email=String(user?.email||'').trim().toLowerCase();
      if(email&&email!==TEAM_OWNER_EMAIL){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        loadSharedTeam(true);
      }
    });
  },true);

  const ownerPill=document.getElementById('ownerPill');
  if(ownerPill){
    new MutationObserver(()=>setTimeout(()=>loadSharedTeam(true),40)).observe(ownerPill,{attributes:true,childList:true,subtree:true});
  }

  const observer=new MutationObserver(()=>{
    const p=panel();
    const l=list();
    if(!p||!l)return;
    const emptyText=l.textContent||'';
    if(/No team members loaded|0 members/i.test(emptyText))setTimeout(()=>loadSharedTeam(false),30);
  });
  observer.observe(document.body,{childList:true,subtree:true});

  setTimeout(()=>loadSharedTeam(true),120);
})();
