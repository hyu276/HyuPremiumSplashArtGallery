(function(){
  'use strict';

  if(window.__HYU_MAIN_CREDIT_FILTER__)return;

  function install(){
    let galleryState,baseFiltered,baseSetupFilters,baseRender;
    try{
      if(typeof state==='undefined'||typeof filtered!=='function'||typeof setupFilters!=='function'||typeof render!=='function')return false;
      galleryState=state;
      baseFiltered=filtered;
      baseSetupFilters=setupFilters;
      baseRender=render;
    }catch{return false}

    const selectRow=document.querySelector('.select-row');
    if(!selectRow)return false;

    window.__HYU_MAIN_CREDIT_FILTER__=true;
    if(!Object.prototype.hasOwnProperty.call(galleryState,'credit'))galleryState.credit='all';

    if(!document.querySelector('style[data-hyu-credit-filter]')){
      const style=document.createElement('style');
      style.dataset.hyuCreditFilter='true';
      style.textContent=`
        .select-row{flex-wrap:wrap;align-items:flex-end}
        .credit-filter-field{position:relative;min-width:118px}
        .credit-filter-field>span{display:block;color:#8e979b;font-size:.48rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;margin-bottom:.25rem}
        .credit-filter-control{position:relative;width:150px}
        .credit-filter-trigger{width:100%;height:28px;border:0;border-bottom:1px solid #555950;background:transparent;color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px 4px 0;text-align:left;font-size:.68rem;outline:none}
        .credit-filter-trigger:hover,.credit-filter-trigger:focus-visible{border-color:var(--brand);color:#fff}
        .credit-filter-trigger-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .credit-filter-chevron{flex:none;color:#7f898d;font-size:.65rem;transition:transform .16s ease}
        .credit-filter-control.is-open .credit-filter-chevron{transform:rotate(180deg);color:var(--brand)}
        .credit-filter-menu{position:absolute;z-index:90;top:calc(100% + 5px);right:0;width:168px;max-height:228px;overflow-y:auto;overscroll-behavior:contain;background:#111411;border:1px solid #424842;box-shadow:0 12px 28px rgba(0,0,0,.48);padding:4px;display:none;scrollbar-width:thin;scrollbar-color:#59625d #171a17}
        .credit-filter-control.is-open .credit-filter-menu{display:block}
        .credit-filter-menu::-webkit-scrollbar{width:6px}
        .credit-filter-menu::-webkit-scrollbar-track{background:#171a17}
        .credit-filter-menu::-webkit-scrollbar-thumb{background:#59625d;border-radius:99px}
        .credit-filter-option{width:100%;border:0;background:transparent;color:#d7dad3;padding:7px 8px;text-align:left;font-size:.67rem;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .credit-filter-option:hover,.credit-filter-option:focus-visible{background:#1c2524;color:#fff;outline:none}
        .credit-filter-option.is-active{background:rgba(67,220,255,.14);color:var(--brand);font-weight:800}
        @media(max-width:760px){.select-row{gap:.9rem 1.2rem}.select-row label{min-width:105px}.credit-filter-control{width:145px}.credit-filter-menu{left:0;right:auto;width:165px;max-height:210px}}
      `;
      document.head.appendChild(style);
    }

    let field=document.querySelector('[data-credit-filter]');
    if(!field){
      field=document.createElement('div');
      field.className='credit-filter-field';
      field.dataset.creditFilter='true';
      field.innerHTML='<span>Image credit</span><div class="credit-filter-control"><button class="credit-filter-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="credit-filter-trigger-text">All credits</span><span class="credit-filter-chevron" aria-hidden="true">⌄</span></button><div class="credit-filter-menu" role="listbox" aria-label="Filter by image credit"></div></div>';
      selectRow.appendChild(field);
    }

    const control=field.querySelector('.credit-filter-control');
    const trigger=field.querySelector('.credit-filter-trigger');
    const triggerText=field.querySelector('.credit-filter-trigger-text');
    const menu=field.querySelector('.credit-filter-menu');
    if(!control||!trigger||!triggerText||!menu)return false;

    const alpha=(a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base',numeric:true});

    function availableCredits(){
      const fromOptions=Array.isArray(galleryState.options?.credits)?galleryState.options.credits:[];
      const fromItems=Array.isArray(galleryState.items)?galleryState.items.filter(item=>!item.hidden).map(item=>item.credit||'Uncredited'):[];
      return [...new Set([...fromOptions,...fromItems].filter(Boolean))].sort(alpha);
    }

    function closeMenu(){
      control.classList.remove('is-open');
      trigger.setAttribute('aria-expanded','false');
    }

    function openMenu(){
      control.classList.add('is-open');
      trigger.setAttribute('aria-expanded','true');
      requestAnimationFrame(()=>menu.querySelector('.credit-filter-option.is-active')?.scrollIntoView({block:'nearest'}));
    }

    function chooseCredit(value){
      galleryState.credit=value||'all';
      galleryState.expanded=null;
      syncCreditOptions();
      closeMenu();
      baseRender();
    }

    function syncCreditOptions(){
      const credits=availableCredits();
      const previous=galleryState.credit||'all';
      if(previous!=='all'&&!credits.includes(previous))galleryState.credit='all';
      const selected=galleryState.credit||'all';
      const entries=[['all','All credits'],...credits.map(credit=>[credit,credit])];
      menu.innerHTML=entries.map(([value,label])=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='credit-filter-option'+(value===selected?' is-active':'');
        button.dataset.credit=value;
        button.setAttribute('role','option');
        button.setAttribute('aria-selected',String(value===selected));
        button.textContent=label;
        return button.outerHTML;
      }).join('');
      triggerText.textContent=selected==='all'?'All credits':selected;
      trigger.title=triggerText.textContent;
    }

    filtered=function(){
      const list=baseFiltered();
      if(!galleryState.credit||galleryState.credit==='all')return list;
      return list.filter(item=>(item.credit||'Uncredited')===galleryState.credit);
    };

    setupFilters=function(){
      baseSetupFilters();
      syncCreditOptions();
    };

    trigger.addEventListener('click',event=>{
      event.stopPropagation();
      control.classList.contains('is-open')?closeMenu():openMenu();
    });

    menu.addEventListener('click',event=>{
      const option=event.target.closest('.credit-filter-option[data-credit]');
      if(!option)return;
      chooseCredit(option.dataset.credit);
    });

    trigger.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='Enter'||event.key===' '){
        if(!control.classList.contains('is-open')){
          event.preventDefault();
          openMenu();
          menu.querySelector('.credit-filter-option.is-active')?.focus();
        }
      }
    });

    menu.addEventListener('keydown',event=>{
      const options=[...menu.querySelectorAll('.credit-filter-option')];
      const index=options.indexOf(document.activeElement);
      if(event.key==='ArrowDown'){
        event.preventDefault();
        options[Math.min(options.length-1,index+1)]?.focus();
      }else if(event.key==='ArrowUp'){
        event.preventDefault();
        options[Math.max(0,index-1)]?.focus();
      }else if(event.key==='Escape'){
        event.preventDefault();
        closeMenu();
        trigger.focus();
      }else if((event.key==='Enter'||event.key===' ')&&document.activeElement?.dataset?.credit){
        event.preventDefault();
        chooseCredit(document.activeElement.dataset.credit);
        trigger.focus();
      }
    });

    document.addEventListener('click',event=>{
      if(!control.contains(event.target))closeMenu();
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&control.classList.contains('is-open')){
        closeMenu();
        trigger.focus();
      }
    });

    syncCreditOptions();
    baseRender();
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(install()||attempts>=80)clearInterval(timer);
    },50);
  }
})();
