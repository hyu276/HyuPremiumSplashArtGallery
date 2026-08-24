(function(){
  'use strict';

  const OWNER_EMAIL='csquocnguyen@gmail.com';
  const LAST_CHOICES_KEY='hyu_admin_last_artwork_choices';
  let creditFixInstalled=false;
  let clearedForCurrentLogin=false;
  let clearedAfterLoad=false;

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

  function allCreditNames(){
    let values=[];

    try{
      if(typeof credits!=='undefined'&&Array.isArray(credits)){
        values=credits.map(item=>String(item?.name??item??'').trim()).filter(Boolean);
      }
    }catch{}

    if(!values.length){
      values=[...document.querySelectorAll('#creditChoices .choice')].map(chip=>{
        const clone=chip.cloneNode(true);
        clone.querySelectorAll('button').forEach(button=>button.remove());
        return String(clone.textContent||'').trim();
      }).filter(Boolean);
    }

    if(!values.length){
      values=[...document.querySelectorAll('#creditOptions option')]
        .map(option=>String(option.value||option.textContent||'').trim())
        .filter(Boolean);
    }

    const seen=new Set();
    return values.filter(value=>{
      const key=normalize(value);
      if(!key||seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  function scoreCredit(value,query){
    const candidate=normalize(value);
    const q=normalize(query);
    if(!q)return 0;
    if(candidate===q)return 1000;
    if(candidate.startsWith(q))return 800-(candidate.length-q.length);
    const words=candidate.split(' ');
    const wordIndex=words.findIndex(word=>word.startsWith(q));
    if(wordIndex>=0)return 650-wordIndex*5;
    const index=candidate.indexOf(q);
    if(index>=0)return 500-index;
    if(subsequence(candidate,q))return 250;
    return -1;
  }

  function renderCreditMenu(mode='all'){
    const input=document.getElementById('credit');
    const menu=document.querySelector('.admin-credit-menu');
    if(!input||!menu)return false;

    let values=allCreditNames();
    const query=input.value.trim();
    if(mode==='filter'&&query){
      values=values
        .map(value=>({value,score:scoreCredit(value,query)}))
        .filter(item=>item.score>=0)
        .sort((a,b)=>b.score-a.score||a.value.localeCompare(b.value,undefined,{sensitivity:'base'}))
        .map(item=>item.value);
    }

    menu.innerHTML='';
    if(!values.length){
      const empty=document.createElement('div');
      empty.className='admin-credit-empty';
      empty.textContent=mode==='all'?'No Image Credit available.':'No matching Image Credit.';
      menu.appendChild(empty);
    }else{
      values.forEach((value,index)=>{
        const button=document.createElement('button');
        button.type='button';
        button.id=`admin-credit-full-option-${index}`;
        button.className='admin-credit-option';
        button.setAttribute('role','option');
        button.textContent=value;
        button.addEventListener('mousedown',event=>event.preventDefault());
        button.addEventListener('click',()=>{
          input.value=value;
          input.dispatchEvent(new Event('input',{bubbles:true}));
          input.dispatchEvent(new Event('change',{bubbles:true}));
          menu.hidden=true;
          input.setAttribute('aria-expanded','false');
          input.focus({preventScroll:true});
        });
        menu.appendChild(button);
      });
    }

    menu.hidden=false;
    input.setAttribute('aria-expanded','true');
    return true;
  }

  function installCreditPickerFix(){
    if(creditFixInstalled)return true;
    const input=document.getElementById('credit');
    const toggle=document.querySelector('.admin-credit-toggle');
    const menu=document.querySelector('.admin-credit-menu');
    if(!input||!toggle||!menu)return false;

    creditFixInstalled=true;
    toggle.dataset.fullCreditSource='true';

    toggle.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      renderCreditMenu('all');
      input.focus({preventScroll:true});
    },true);

    input.addEventListener('input',()=>{
      setTimeout(()=>{
        if(document.activeElement===input)renderCreditMenu('filter');
      },0);
    });

    return true;
  }

  function clearRememberedCredit(){
    try{
      const value=JSON.parse(sessionStorage.getItem(LAST_CHOICES_KEY)||'{}');
      if(!value||typeof value!=='object')return;
      delete value.credit;
      delete value.creditName;
      delete value.imageCredit;
      delete value.image_credit;
      delete value.credit_id;
      sessionStorage.setItem(LAST_CHOICES_KEY,JSON.stringify(value));
    }catch{}
  }

  function clearCreditField(){
    const editing=document.getElementById('editingId');
    if(editing?.value)return;
    const input=document.getElementById('credit');
    if(!input)return;
    input.value='';
    input.dispatchEvent(new Event('change',{bubbles:true}));
    const menu=document.querySelector('.admin-credit-menu');
    if(menu)menu.hidden=true;
    input.setAttribute('aria-expanded','false');
  }

  function syncLoginCreditState(){
    const signedIn=Boolean(signedInEmail());
    if(!signedIn){
      clearedForCurrentLogin=false;
      clearedAfterLoad=false;
      return;
    }

    if(!clearedForCurrentLogin){
      clearRememberedCredit();
      clearCreditField();
      clearedForCurrentLogin=true;
    }
  }

  function setChoiceLabel(listId,text){
    const list=document.getElementById(listId);
    const field=list?.closest('.field');
    const label=field?.querySelector('label');
    if(!label)return false;

    const textNode=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&String(node.textContent||'').trim());
    if(textNode)textNode.textContent=`${text} `;
    else label.insertBefore(document.createTextNode(`${text} `),label.firstChild);
    return true;
  }

  function rewriteGuide(){
    const guide=document.getElementById('adminCollaboratorGuide');
    if(!guide||!isCollaborator())return false;
    if(guide.dataset.basicGuide==='true')return true;

    guide.dataset.basicGuide='true';
    guide.innerHTML=`
      <div class="admin-collab-guide-head">
        <div>
          <h2>Hướng dẫn sử dụng Dashboard</h2>
          <div class="admin-collab-guide-sub">Cách đăng một artwork mới.</div>
        </div>
        <span class="admin-collab-guide-badge">COLLABORATOR</span>
      </div>
      <div class="admin-collab-guide-grid">
        <div><strong>01 · Chọn ảnh</strong><span>Ở mục Add Artwork, bấm Chọn tệp và chọn ảnh bạn muốn đăng.</span></div>
        <div><strong>02 · Điền tên</strong><span>Nhập tên artwork vào ô Name. Description có thể điền thêm nếu cần.</span></div>
        <div><strong>03 · Chọn thông tin</strong><span>Chọn Tướng, Skin rank và Tác giả phù hợp cho artwork.</span></div>
        <div><strong>04 · Không thấy thông tin phù hợp?</strong><span>Kéo xuống Artwork Choices để thêm Tướng hoặc Tác giả mới, sau đó quay lại Add Artwork và chọn thông tin vừa thêm.</span></div>
        <div><strong>05 · Hoàn tất</strong><span>Bấm Add artwork, kiểm tra lại artwork trong danh sách rồi bấm Publish changes. Trạng thái gửi duyệt sẽ xuất hiện ở Publish Requests.</span></div>
      </div>
    `;
    return true;
  }

  function lockRankChoices(){
    const list=document.getElementById('rankChoices');
    if(!list)return false;

    const collaborator=isCollaborator();
    list.classList.toggle('collaborator-ranks-readonly',collaborator);

    for(const button of list.querySelectorAll('button')){
      button.hidden=collaborator;
      button.disabled=collaborator;
      button.tabIndex=collaborator?-1:0;
      button.setAttribute('aria-hidden',String(collaborator));
    }

    const field=list.closest('.field');
    const help=field?.nextElementSibling?.classList?.contains('choice-help')?field.nextElementSibling:null;
    if(help){
      if(collaborator){
        if(!help.dataset.ownerRankHelp)help.dataset.ownerRankHelp=help.innerHTML;
        help.textContent='Skin rank do Owner quản lý. Bạn chỉ có thể chọn các rank hiện có.';
      }else if(help.dataset.ownerRankHelp){
        help.innerHTML=help.dataset.ownerRankHelp;
        delete help.dataset.ownerRankHelp;
      }
    }
    return true;
  }

  function sync(){
    setChoiceLabel('categoryChoices','Tướng');
    setChoiceLabel('creditChoices','Tác giả');
    rewriteGuide();
    lockRankChoices();
    syncLoginCreditState();
    installCreditPickerFix();
  }

  function ready(){
    if(!document.querySelector('style[data-hyu-rank-readonly]')){
      const style=document.createElement('style');
      style.dataset.hyuRankReadonly='true';
      style.textContent=`
        #rankChoices.collaborator-ranks-readonly .choice{gap:0;padding-right:9px}
        #rankChoices.collaborator-ranks-readonly .choice button{display:none!important}
      `;
      document.head.appendChild(style);
    }

    document.addEventListener('click',event=>{
      if(!isCollaborator())return;
      const button=event.target.closest?.('#rankChoices button');
      if(!button)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },true);

    document.addEventListener('keydown',event=>{
      if(!isCollaborator())return;
      if(!event.target?.closest?.('#rankChoices button'))return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },true);

    sync();

    const pill=document.getElementById('ownerPill');
    if(pill){
      new MutationObserver(()=>setTimeout(sync,30)).observe(pill,{attributes:true,childList:true,subtree:true,characterData:true});
    }

    const status=document.getElementById('status');
    if(status){
      new MutationObserver(()=>{
        syncLoginCreditState();
        if(!clearedAfterLoad&&signedInEmail()&&/^loaded\s+\d+\s+artwork/i.test(String(status.textContent||'').trim())){
          clearRememberedCredit();
          clearCreditField();
          clearedAfterLoad=true;
        }
      }).observe(status,{childList:true,subtree:true,characterData:true});
    }

    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.addedNodes.length))sync();
    });
    observer.observe(document.body,{childList:true,subtree:true});

    setTimeout(sync,150);
    setTimeout(sync,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
