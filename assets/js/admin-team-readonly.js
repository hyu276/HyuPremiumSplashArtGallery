(function(){
  'use strict';

  const TEAM_OWNER_EMAIL='csquocnguyen@gmail.com';
  const DENIED_MESSAGE='VAN XIN QUỲ LẠY BỐ HUY ĐỂ ĐƯỢC CHỈNH SỬA';
  let canEditTeam=false;
  let resolving=false;
  let lastNoticeAt=0;

  function teamPanel(){
    return document.querySelector('#teamAdminPanel,#admin-about-team');
  }

  function activeClient(){
    try{
      if(typeof window.HYU_GET_ACTIVE_ADMIN_CLIENT==='function')return window.HYU_GET_ACTIVE_ADMIN_CLIENT();
      if(typeof client!=='undefined')return client;
    }catch{}
    return null;
  }

  function notifyDenied(){
    const now=Date.now();
    if(now-lastNoticeAt<350)return;
    lastNoticeAt=now;
    window.alert(DENIED_MESSAGE);
  }

  function isMutationButton(button){
    if(!button)return false;
    if(button.id==='teamReload')return false;
    return Boolean(
      button.id==='teamSave'||
      button.id==='teamClear'||
      button.matches('[data-team-edit],[data-team-toggle],.team-drag-handle')||
      button.closest('#teamAdminList')
    );
  }

  function applyPermissionState(){
    const panel=teamPanel();
    if(!panel)return;

    panel.classList.toggle('team-manager-readonly',!canEditTeam);
    panel.dataset.teamEditable=String(canEditTeam);

    const editableFields=panel.querySelectorAll('input:not([type="hidden"]),textarea,select');
    editableFields.forEach(field=>{
      if(field.id==='teamReload')return;
      if(field instanceof HTMLInputElement&&['checkbox','file','radio'].includes(field.type)){
        field.disabled=!canEditTeam;
      }else if('readOnly' in field){
        field.readOnly=!canEditTeam;
      }else{
        field.disabled=!canEditTeam;
      }
      field.setAttribute('aria-readonly',String(!canEditTeam));
    });

    panel.querySelectorAll('.team-drag-handle').forEach(handle=>{
      handle.draggable=canEditTeam;
      handle.setAttribute('aria-disabled',String(!canEditTeam));
    });

    panel.querySelectorAll('button').forEach(button=>{
      if(isMutationButton(button))button.classList.toggle('team-readonly-action',!canEditTeam);
    });
  }

  async function resolvePermission(){
    if(resolving)return;
    resolving=true;
    try{
      const pill=document.getElementById('ownerPill');
      if(!pill?.classList.contains('ok')){
        canEditTeam=false;
        applyPermissionState();
        return;
      }

      let email='';
      const supabaseClient=activeClient();
      if(supabaseClient?.auth?.getUser){
        try{
          const {data}=await supabaseClient.auth.getUser();
          email=String(data?.user?.email||'').trim().toLowerCase();
        }catch{}
      }

      if(!email){
        const match=String(pill.textContent||'').match(/signed\s+in:\s*(.+)$/i);
        email=String(match?.[1]||'').trim().toLowerCase();
      }

      canEditTeam=email===TEAM_OWNER_EMAIL;
      applyPermissionState();
    }finally{
      resolving=false;
    }
  }

  function denyCapturedAction(event){
    if(canEditTeam)return;
    const panel=teamPanel();
    if(!panel||!panel.contains(event.target))return;

    const button=event.target.closest?.('button');
    if(!isMutationButton(button))return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    notifyDenied();
  }

  function denyDrag(event){
    if(canEditTeam)return;
    const panel=teamPanel();
    const handle=event.target.closest?.('.team-drag-handle');
    if(!panel||!handle||!panel.contains(handle))return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    notifyDenied();
  }

  const style=document.createElement('style');
  style.dataset.hyuTeamReadonly='true';
  style.textContent=`
    .team-manager-readonly input[readonly],
    .team-manager-readonly textarea[readonly],
    .team-manager-readonly select:disabled,
    .team-manager-readonly input:disabled{cursor:not-allowed;opacity:.68}
    .team-manager-readonly .team-readonly-action{opacity:.68;cursor:not-allowed}
    .team-manager-readonly .team-drag-handle{cursor:not-allowed!important}
  `;
  document.head.appendChild(style);

  document.addEventListener('click',denyCapturedAction,true);
  document.addEventListener('dragstart',denyDrag,true);
  document.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse')denyDrag(event);
  },true);

  const ownerPill=document.getElementById('ownerPill');
  if(ownerPill){
    new MutationObserver(resolvePermission).observe(ownerPill,{attributes:true,childList:true,subtree:true});
  }

  const domObserver=new MutationObserver(()=>{
    applyPermissionState();
  });
  domObserver.observe(document.body,{childList:true,subtree:true});

  resolvePermission();
})();
