(function(){
  'use strict';

  const OWNER_EMAIL='csquocnguyen@gmail.com';
  const state={creditReady:false,activeIndex:-1,visibleOptions:[],menuMode:''};

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function signedInEmail(){
    try{
      if(typeof adminUser!=='undefined'&&adminUser?.email)return String(adminUser.email).trim().toLowerCase();
    }catch{}
    const pill=document.getElementById('ownerPill');
    if(!pill?.classList.contains('ok'))return '';
    const match=String(pill.textContent||'').match(/signed\s+in:\s*(.+)$/i);
    return String(match?.[1]||'').trim().toLowerCase();
  }

  function isCollaborator(){
    const email=signedInEmail();
    return Boolean(email&&email!==OWNER_EMAIL);
  }

  function normalize(value){
    return String(value||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/đ/g,'d')
      .replace(/\s+/g,' ')
      .trim();
  }

  function subsequence(haystack,needle){
    if(!needle)return true;
    let cursor=0;
    for(const ch of haystack){
      if(ch===needle[cursor])cursor+=1;
      if(cursor===needle.length)return true;
    }
    return false;
  }

  function creditSource(){
    const list=document.getElementById('creditOptions');
    if(!list)return [];
    const seen=new Set();
    const values=[];
    for(const option of list.querySelectorAll('option')){
      const value=String(option.value||option.textContent||'').trim();
      const key=normalize(value);
      if(!value||seen.has(key))continue;
      seen.add(key);
      values.push(value);
    }
    return values;
  }

  function scoreCredit(value,query){
    const candidate=normalize(value);
    const q=normalize(query);
    if(!q)return 0;
    if(candidate===q)return 1000;
    if(candidate.startsWith(q))return 800-(candidate.length-q.length);
    const wordIndex=candidate.split(' ').findIndex(word=>word.startsWith(q));
    if(wordIndex>=0)return 650-wordIndex*5;
    const index=candidate.indexOf(q);
    if(index>=0)return 500-index;
    if(subsequence(candidate,q))return 250;
    return -1;
  }

  function enhanceCreditPicker(){
    if(state.creditReady)return true;
    const input=document.getElementById('credit');
    const datalist=document.getElementById('creditOptions');
    if(!input||!datalist)return false;

    const field=input.closest('.field');
    if(!field)return false;

    state.creditReady=true;
    input.removeAttribute('list');
    input.setAttribute('autocomplete','off');
    input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-expanded','false');

    const wrap=document.createElement('div');
    wrap.className='admin-credit-combobox';
    input.parentNode.insertBefore(wrap,input);
    wrap.appendChild(input);

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='admin-credit-toggle';
    toggle.setAttribute('aria-label','Show all image credits');
    toggle.setAttribute('title','Show all image credits');
    toggle.innerHTML='<span aria-hidden="true">▼</span>';
    wrap.appendChild(toggle);

    const menu=document.createElement('div');
    menu.className='admin-credit-menu';
    menu.hidden=true;
    menu.setAttribute('role','listbox');
    wrap.appendChild(menu);
    input.setAttribute('aria-controls','admin-credit-menu');
    menu.id='admin-credit-menu';

    function closeMenu(){
      menu.hidden=true;
      state.menuMode='';
      input.setAttribute('aria-expanded','false');
      state.activeIndex=-1;
      input.removeAttribute('aria-activedescendant');
    }

    function selectValue(value){
      input.value=value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      closeMenu();
      input.focus({preventScroll:true});
    }

    function setActive(index){
      if(!state.visibleOptions.length)return;
      state.activeIndex=Math.max(0,Math.min(index,state.visibleOptions.length-1));
      const rows=[...menu.querySelectorAll('[data-credit-option]')];
      rows.forEach((row,i)=>row.classList.toggle('active',i===state.activeIndex));
      const active=rows[state.activeIndex];
      if(active){
        input.setAttribute('aria-activedescendant',active.id);
        active.scrollIntoView({block:'nearest'});
      }
    }

    function openMenu(mode='filter'){
      const source=creditSource();
      const query=input.value.trim();
      let values=source;
      if(mode!=='all'&&query){
        values=source
          .map(value=>({value,score:scoreCredit(value,query)}))
          .filter(item=>item.score>=0)
          .sort((a,b)=>b.score-a.score||a.value.localeCompare(b.value,undefined,{sensitivity:'base'}))
          .map(item=>item.value);
      }
      state.menuMode=mode;
      state.visibleOptions=values;
      state.activeIndex=-1;
      menu.innerHTML=values.length
        ? values.map((value,index)=>`<button type="button" id="admin-credit-option-${index}" class="admin-credit-option" role="option" data-credit-option="${index}"></button>`).join('')
        : '<div class="admin-credit-empty">No matching Image Credit.</div>';
      if(values.length){
        [...menu.querySelectorAll('[data-credit-option]')].forEach((button,index)=>{
          button.textContent=values[index];
          button.addEventListener('mousedown',event=>event.preventDefault());
          button.addEventListener('click',()=>selectValue(values[index]));
        });
      }
      menu.hidden=false;
      input.setAttribute('aria-expanded','true');
    }

    toggle.addEventListener('mousedown',event=>event.preventDefault());
    toggle.addEventListener('click',event=>{
      event.preventDefault();
      if(!menu.hidden&&state.menuMode==='all'){
        closeMenu();
      }else{
        openMenu('all');
        input.focus({preventScroll:true});
      }
    });

    input.addEventListener('input',()=>openMenu('filter'));
    input.addEventListener('focus',()=>{
      if(input.value.trim())openMenu('filter');
    });
    input.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'){
        event.preventDefault();
        if(menu.hidden)openMenu(input.value.trim()?'filter':'all');
        setActive(state.activeIndex+1);
      }else if(event.key==='ArrowUp'){
        event.preventDefault();
        if(menu.hidden)openMenu(input.value.trim()?'filter':'all');
        setActive(state.activeIndex<0?state.visibleOptions.length-1:state.activeIndex-1);
      }else if(event.key==='Enter'&&!menu.hidden&&state.activeIndex>=0){
        event.preventDefault();
        selectValue(state.visibleOptions[state.activeIndex]);
      }else if(event.key==='Escape'&&!menu.hidden){
        event.preventDefault();
        closeMenu();
      }
    });

    document.addEventListener('mousedown',event=>{
      if(!wrap.contains(event.target))closeMenu();
    });

    new MutationObserver(()=>{
      if(!menu.hidden)openMenu(state.menuMode==='all'?'all':'filter');
    }).observe(datalist,{childList:true,subtree:true,attributes:true});

    return true;
  }

  function ensureGuide(){
    const existing=document.getElementById('adminCollaboratorGuide');
    if(!isCollaborator()){
      existing?.remove();
      return;
    }
    if(existing)return;

    const wrap=document.querySelector('.wrap');
    const grid=wrap?.querySelector('.grid');
    if(!wrap||!grid)return;

    const guide=document.createElement('section');
    guide.id='adminCollaboratorGuide';
    guide.className='panel admin-collaborator-guide admin-scroll-target';
    guide.innerHTML=`
      <div class="admin-collab-guide-head">
        <div>
          <h2>Hướng dẫn sử dụng Dashboard</h2>
          <div class="admin-collab-guide-sub">Quy trình dành cho tài khoản cộng tác viên.</div>
        </div>
        <span class="admin-collab-guide-badge">COLLABORATOR</span>
      </div>
      <div class="admin-collab-guide-grid">
        <div><strong>01 · Chọn properties</strong><span>Category, Image Credit và Skin Rank của Owner được đồng bộ tự động. Bạn vẫn có thể tạo Category/Image Credit mới khi cần.</span></div>
        <div><strong>02 · Tạo artwork</strong><span>Điền metadata, chọn ảnh và bấm Add artwork. Kiểm tra lại artwork trong danh sách trước khi Publish.</span></div>
        <div><strong>03 · Publish changes</strong><span>Ảnh mới sẽ tạo Publish Request gửi vào Inbox của Owner thay vì được public ngay lập tức.</span></div>
        <div><strong>04 · Theo dõi duyệt</strong><span>Xem trạng thái trong Publish Requests: Pending, Approved hoặc Declined. Approved mới đủ điều kiện xuất hiện public.</span></div>
        <div><strong>05 · Property mới</strong><span>Property mới của collaborator chỉ được đồng bộ ngược lên Owner database khi artwork chứa property đó được Owner Approve.</span></div>
        <div><strong>06 · About Us / Team</strong><span>Team dùng chung dữ liệu Owner và chỉ có quyền xem đối với collaborator.</span></div>
      </div>
    `;
    wrap.insertBefore(guide,grid);
  }

  function enforceRankAddPermission(){
    const input=document.getElementById('newRank');
    const button=document.getElementById('addRank');
    if(!input||!button)return;
    const row=input.closest('.choice-row');
    const collaborator=isCollaborator();
    if(row)row.hidden=collaborator;
    input.disabled=collaborator;
    button.disabled=collaborator;
    input.dataset.ownerOnly=collaborator?'true':'false';
    button.dataset.ownerOnly=collaborator?'true':'false';
  }

  function syncAccountUx(){
    ensureGuide();
    enforceRankAddPermission();
  }

  function injectStyle(){
    if(document.querySelector('style[data-hyu-collaborator-ux]'))return;
    const style=document.createElement('style');
    style.dataset.hyuCollaboratorUx='true';
    style.textContent=`
      .admin-credit-combobox{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 38px;align-items:stretch}
      .admin-credit-combobox>.input{border-top-right-radius:0;border-bottom-right-radius:0}
      .admin-credit-toggle{border:1px solid var(--line);border-left:0;border-radius:0 6px 6px 0;background:#151b21;color:#9ba7b1;cursor:pointer;display:grid;place-items:center;padding:0}
      .admin-credit-toggle:hover,.admin-credit-toggle:focus-visible{color:var(--accent);background:#18242c;outline:none}
      .admin-credit-toggle span{font-size:10px;transition:transform .12s ease}
      .admin-credit-combobox:has(.admin-credit-menu:not([hidden])) .admin-credit-toggle span{transform:rotate(180deg)}
      .admin-credit-menu{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:900;max-height:260px;overflow:auto;border:1px solid #33404b;border-radius:7px;background:#0c1116;box-shadow:0 18px 38px rgba(0,0,0,.42);padding:5px}
      .admin-credit-menu[hidden]{display:none}
      .admin-credit-option{display:block;width:100%;border:0;border-radius:5px;background:transparent;color:#cbd4dc;text-align:left;padding:8px 9px;cursor:pointer;font-size:12px}
      .admin-credit-option:hover,.admin-credit-option.active{background:#102731;color:#43dcff}
      .admin-credit-empty{padding:12px 9px;color:var(--muted);font-size:11px;text-align:center}
      .admin-collaborator-guide{margin:0 0 14px!important;border-color:#30515f;background:linear-gradient(180deg,#111a20 0%,#10161b 100%)}
      .admin-collab-guide-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}
      .admin-collab-guide-head h2{margin:0 0 4px!important;color:#d8f6ff!important}
      .admin-collab-guide-sub{font-size:11px;color:var(--muted)}
      .admin-collab-guide-badge{font-size:9px;font-weight:900;letter-spacing:.12em;color:#43dcff;border:1px solid #315766;background:#10202a;border-radius:999px;padding:5px 8px;white-space:nowrap}
      .admin-collab-guide-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .admin-collab-guide-grid>div{border:1px solid #26323b;background:#0d1318;border-radius:7px;padding:10px;min-width:0}
      .admin-collab-guide-grid strong{display:block;color:#d9e4ea;font-size:11px;margin-bottom:4px}
      .admin-collab-guide-grid span{display:block;color:#8f9aa6;font-size:10px;line-height:1.5}
      @media(max-width:1050px){.admin-collab-guide-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:640px){.admin-collab-guide-head{display:block}.admin-collab-guide-badge{display:inline-flex;margin-top:8px}.admin-collab-guide-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  ready(()=>{
    injectStyle();
    if(!enhanceCreditPicker()){
      const observer=new MutationObserver(()=>{
        if(enhanceCreditPicker())observer.disconnect();
      });
      observer.observe(document.body,{childList:true,subtree:true});
      setTimeout(()=>observer.disconnect(),10000);
    }

    const ownerPill=document.getElementById('ownerPill');
    if(ownerPill){
      new MutationObserver(()=>setTimeout(syncAccountUx,40)).observe(ownerPill,{attributes:true,childList:true,subtree:true,characterData:true});
    }

    document.addEventListener('click',event=>{
      const button=event.target.closest?.('#addRank');
      if(!button||!isCollaborator())return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },true);

    document.addEventListener('keydown',event=>{
      if(event.target?.id!=='newRank'||event.key!=='Enter'||!isCollaborator())return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },true);

    setTimeout(syncAccountUx,120);
  });
})();
