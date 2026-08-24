(function(){
  'use strict';

  const COLLAPSE_KEY='hyu_admin_choice_collapse_v1';
  const ADMIN_FEATURE_VERSION='20260824-shared-team-read-2';

  function whenReady(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function readCollapseState(){
    try{return JSON.parse(sessionStorage.getItem(COLLAPSE_KEY)||'{}')}catch{return{}}
  }

  function saveCollapseState(state){
    try{sessionStorage.setItem(COLLAPSE_KEY,JSON.stringify(state))}catch{}
  }

  whenReady(()=>{
    const css=document.createElement('style');
    css.textContent=`
      html{scroll-behavior:smooth}
      .admin-scroll-target{scroll-margin-top:22px}
      .choice-field-enhanced>label{align-items:center}
      .choice-collapse-toggle{border:0;background:transparent;color:#8f9aa6;padding:2px 0 2px 8px;display:inline-flex;align-items:center;gap:6px;font-size:10px;line-height:1;cursor:pointer;margin-left:auto}
      .choice-collapse-toggle:hover,.choice-collapse-toggle:focus-visible{color:#43dcff;outline:none}
      .choice-collapse-count{font-variant-numeric:tabular-nums;letter-spacing:.02em}
      .choice-collapse-icon{display:inline-block;font-size:9px;transition:transform .18s ease;transform:rotate(180deg)}
      .choice-field-enhanced.choices-collapsed .choice-collapse-icon{transform:rotate(0deg)}
      .choice-field-enhanced.choices-collapsed .choice-list{display:none}
      .choice-help.choice-help-collapsed{display:none}
      .admin-jump-nav{position:fixed;left:12px;top:50%;transform:translateY(-50%);z-index:120;width:150px;border:1px solid #28303a;border-radius:10px;background:rgba(12,16,20,.94);backdrop-filter:blur(14px);padding:8px;box-shadow:0 16px 36px rgba(0,0,0,.28)}
      .admin-jump-nav-title{padding:6px 7px 8px;color:#697681;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
      .admin-jump-nav button{width:100%;border:0;border-radius:6px;background:transparent;color:#9ba6b0;text-align:left;padding:8px 9px;font-size:11px;font-weight:700;cursor:pointer;transition:background .15s ease,color .15s ease}
      .admin-jump-nav button:hover,.admin-jump-nav button:focus-visible{background:#151d23;color:#dce8ee;outline:none}
      .admin-jump-nav button.active{background:#102731;color:#43dcff;box-shadow:inset 2px 0 0 #43dcff}
      .admin-jump-nav button+button{margin-top:2px}
      @media(min-width:1181px){body.admin-jump-nav-ready .wrap{width:min(1720px,100%);padding-left:180px}}
      @media(max-width:1180px){
        .admin-jump-nav{position:sticky;top:0;left:auto;transform:none;width:100%;border-radius:0;border-left:0;border-right:0;display:flex;align-items:center;gap:4px;padding:7px 12px;overflow-x:auto;scrollbar-width:none}
        .admin-jump-nav::-webkit-scrollbar{display:none}
        .admin-jump-nav-title{display:none}
        .admin-jump-nav button{width:auto;flex:0 0 auto;white-space:nowrap;padding:7px 10px}
        .admin-jump-nav button+button{margin-top:0}
        .admin-jump-nav button.active{box-shadow:inset 0 -2px 0 #43dcff}
      }
    `;
    document.head.appendChild(css);

    const collapseState=readCollapseState();
    const optionLists=[
      ['categoryChoices','categories'],
      ['creditChoices','credits'],
      ['rankChoices','ranks']
    ];

    function enhanceChoiceList(listId,key){
      const list=document.getElementById(listId);
      if(!list||list.dataset.collapsibleReady==='true')return;
      const field=list.closest('.field');
      const label=field?.querySelector('label');
      if(!field||!label)return;

      list.dataset.collapsibleReady='true';
      field.classList.add('choice-field-enhanced');
      const help=field.nextElementSibling?.classList?.contains('choice-help')?field.nextElementSibling:null;

      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='choice-collapse-toggle';
      toggle.innerHTML='<span class="choice-collapse-count">0 options</span><span class="choice-collapse-icon" aria-hidden="true">▼</span>';
      label.appendChild(toggle);

      let collapsed=collapseState[key]!==undefined?Boolean(collapseState[key]):true;
      const countEl=toggle.querySelector('.choice-collapse-count');

      function syncCount(){
        const count=list.children.length;
        countEl.textContent=`${count} option${count===1?'':'s'}`;
      }

      function apply(){
        field.classList.toggle('choices-collapsed',collapsed);
        help?.classList.toggle('choice-help-collapsed',collapsed);
        toggle.setAttribute('aria-expanded',String(!collapsed));
        toggle.title=collapsed?'Expand options':'Collapse options';
        collapseState[key]=collapsed;
        saveCollapseState(collapseState);
      }

      toggle.addEventListener('click',()=>{collapsed=!collapsed;apply()});
      new MutationObserver(syncCount).observe(list,{childList:true});
      syncCount();
      apply();
    }

    optionLists.forEach(([id,key])=>enhanceChoiceList(id,key));

    function buildNavigation(){
      if(document.querySelector('.admin-jump-nav'))return true;
      const addArtwork=document.querySelector('#formTitle')?.closest('.panel');
      const optimizer=document.querySelector('#imageOptimizerPanel');
      const artworkChoices=document.querySelector('#rankChoices')?.closest('.panel');
      const team=document.querySelector('#teamAdminPanel');
      const artworkList=document.querySelector('#list')?.closest('.panel');
      if(!addArtwork||!optimizer||!artworkChoices||!team||!artworkList)return false;

      const targets=[
        ['admin-add-artwork','Add artwork',addArtwork],
        ['admin-image-optimizer','Image optimizer',optimizer],
        ['admin-artwork-choices','Artwork choices',artworkChoices],
        ['admin-about-team','About Us / Team',team],
        ['admin-artwork-list','Artwork list',artworkList]
      ];

      targets.forEach(([id,,el])=>{el.id=id;el.classList.add('admin-scroll-target')});

      const nav=document.createElement('nav');
      nav.className='admin-jump-nav';
      nav.setAttribute('aria-label','Admin section navigation');
      nav.innerHTML='<div class="admin-jump-nav-title">Quick navigation</div>'+targets.map(([id,label])=>`<button type="button" data-admin-jump="${id}">${label}</button>`).join('');
      document.body.insertBefore(nav,document.body.firstChild);
      document.body.classList.add('admin-jump-nav-ready');

      const buttons=[...nav.querySelectorAll('[data-admin-jump]')];
      buttons.forEach(button=>button.addEventListener('click',()=>{
        const target=document.getElementById(button.dataset.adminJump);
        if(!target)return;
        target.scrollIntoView({behavior:'smooth',block:'start'});
        history.replaceState(null,'',`#${button.dataset.adminJump}`);
      }));

      const setActive=id=>buttons.forEach(button=>button.classList.toggle('active',button.dataset.adminJump===id));
      setActive(targets[0][0]);

      if('IntersectionObserver' in window){
        const observer=new IntersectionObserver(entries=>{
          const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top));
          if(visible[0])setActive(visible[0].target.id);
        },{rootMargin:'-15% 0px -68% 0px',threshold:[0,.05,.2]});
        targets.forEach(([, ,el])=>observer.observe(el));
      }

      const hash=location.hash.slice(1);
      if(targets.some(([id])=>id===hash))setTimeout(()=>document.getElementById(hash)?.scrollIntoView({behavior:'smooth',block:'start'}),80);
      return true;
    }

    if(!buildNavigation()){
      const observer=new MutationObserver(()=>{
        if(buildNavigation())observer.disconnect();
      });
      observer.observe(document.body,{childList:true,subtree:true});
      setTimeout(()=>observer.disconnect(),10000);
    }

    if(!document.querySelector('script[data-hyu-admin-team-layout]')){
      const teamLayout=document.createElement('script');
      teamLayout.src=`./assets/js/admin-team-layout.js?v=${ADMIN_FEATURE_VERSION}`;
      teamLayout.dataset.hyuAdminTeamLayout='true';
      document.body.appendChild(teamLayout);
    }

    if(!document.querySelector('script[data-hyu-admin-team-readonly]')){
      const teamReadonly=document.createElement('script');
      teamReadonly.src=`./assets/js/admin-team-readonly.js?v=${ADMIN_FEATURE_VERSION}`;
      teamReadonly.dataset.hyuAdminTeamReadonly='true';
      document.body.appendChild(teamReadonly);
    }

    if(!document.querySelector('script[data-hyu-admin-team-shared-read]')){
      const teamSharedRead=document.createElement('script');
      teamSharedRead.src=`./assets/js/admin-team-shared-read.js?v=${ADMIN_FEATURE_VERSION}`;
      teamSharedRead.dataset.hyuAdminTeamSharedRead='true';
      document.body.appendChild(teamSharedRead);
    }

    const loadBatchActions=()=>{
      if(window.__HYU_ADMIN_BATCH_ACTIONS__||document.querySelector('script[data-hyu-admin-batch-actions]'))return;
      const batch=document.createElement('script');
      batch.src=`./assets/js/admin-batch-actions.js?v=${ADMIN_FEATURE_VERSION}`;
      batch.dataset.hyuAdminBatchActions='true';
      document.body.appendChild(batch);
    };

    const existingVietnamese=document.querySelector('script[data-hyu-admin-vietnamese-skin]');
    if(existingVietnamese){
      loadBatchActions();
    }else{
      const vietnameseSkin=document.createElement('script');
      vietnameseSkin.src=`./assets/js/admin-vietnamese-skin.js?v=${ADMIN_FEATURE_VERSION}`;
      vietnameseSkin.dataset.hyuAdminVietnameseSkin='true';
      vietnameseSkin.addEventListener('load',loadBatchActions,{once:true});
      vietnameseSkin.addEventListener('error',loadBatchActions,{once:true});
      document.body.appendChild(vietnameseSkin);
      setTimeout(loadBatchActions,1200);
    }
  });
})();
