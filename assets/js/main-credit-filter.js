(function(){
  'use strict';

  if(window.__HYU_MAIN_CREDIT_FILTER__)return;

  const INITIAL_RANDOM_COUNT=12;
  const SECOND_BATCH_COUNT=50;

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
    const gallery=document.querySelector('#gallery');
    const rankSelect=document.querySelector('#rank');
    if(!selectRow||!gallery||!rankSelect)return false;

    window.__HYU_MAIN_CREDIT_FILTER__=true;
    if(!Object.prototype.hasOwnProperty.call(galleryState,'credit'))galleryState.credit='all';

    if(!document.querySelector('style[data-hyu-credit-filter]')){
      const style=document.createElement('style');
      style.dataset.hyuCreditFilter='true';
      style.textContent=`
        .select-row{flex-wrap:wrap;align-items:flex-end}
        .gallery-filter-field{position:relative;min-width:118px}
        .gallery-filter-field>span{display:block;color:#8e979b;font-size:.48rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;margin-bottom:.25rem}
        .gallery-filter-native{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}
        .gallery-filter-control{position:relative;width:150px}
        .gallery-filter-trigger{width:100%;height:28px;border:0;border-bottom:1px solid #555950;background:transparent;color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px 4px 0;text-align:left;font-size:.68rem;outline:none}
        .gallery-filter-trigger:hover,.gallery-filter-trigger:focus-visible{border-color:var(--brand);color:#fff}
        .gallery-filter-trigger-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .gallery-filter-chevron{flex:none;color:#7f898d;font-size:.65rem;transition:transform .16s ease}
        .gallery-filter-control.is-open .gallery-filter-chevron{transform:rotate(180deg);color:var(--brand)}
        .gallery-filter-menu{position:absolute;z-index:90;top:calc(100% + 5px);right:0;width:168px;max-height:228px;overflow-y:auto;overscroll-behavior:contain;background:#111411;border:1px solid #424842;box-shadow:0 12px 28px rgba(0,0,0,.48);padding:4px;display:none;scrollbar-width:thin;scrollbar-color:#59625d #171a17}
        .gallery-filter-control.is-open .gallery-filter-menu{display:block}
        .gallery-filter-menu::-webkit-scrollbar{width:6px}
        .gallery-filter-menu::-webkit-scrollbar-track{background:#171a17}
        .gallery-filter-menu::-webkit-scrollbar-thumb{background:#59625d;border-radius:99px}
        .gallery-filter-option{width:100%;border:0;background:transparent;color:#d7dad3;padding:7px 8px;text-align:left;font-size:.67rem;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gallery-filter-option:hover,.gallery-filter-option:focus-visible{background:#1c2524;color:#fff;outline:none}
        .gallery-filter-option.is-active{background:rgba(67,220,255,.14);color:var(--brand);font-weight:800}
        .gallery-progressive-controls{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:28px 3vw 34px;border-top:1px solid rgba(241,241,234,.1);background:#080908}
        .gallery-progressive-controls[hidden]{display:none}
        .gallery-view-all{min-width:170px;border:1px solid rgba(67,220,255,.48);background:#0c1112;color:var(--brand);padding:11px 22px;font-size:.62rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;transition:background .18s ease,color .18s ease,border-color .18s ease,transform .18s ease}
        .gallery-view-all:hover,.gallery-view-all:focus-visible{background:var(--brand);color:var(--ink);border-color:var(--brand);outline:none;transform:translateY(-1px)}
        .gallery-progressive-note{color:#737b78;font-size:.48rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;text-align:center}
        @media(max-width:760px){.select-row{gap:.9rem 1.2rem}.gallery-filter-control{width:145px}.gallery-filter-menu{left:0;right:auto;width:165px;max-height:210px}.gallery-progressive-controls{padding:23px 4vw 29px}.gallery-view-all{min-width:155px}}
      `;
      document.head.appendChild(style);
    }

    const alpha=(a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base',numeric:true});

    function buildFilterControl(field,labelText,ariaLabel){
      field.classList.add('gallery-filter-field');
      let title=field.querySelector(':scope > span');
      if(!title){
        title=document.createElement('span');
        title.textContent=labelText;
        field.prepend(title);
      }
      let control=field.querySelector('.gallery-filter-control');
      if(!control){
        control=document.createElement('div');
        control.className='gallery-filter-control';
        control.innerHTML='<button class="gallery-filter-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="gallery-filter-trigger-text"></span><span class="gallery-filter-chevron" aria-hidden="true">⌄</span></button><div class="gallery-filter-menu" role="listbox"></div>';
        field.appendChild(control);
      }
      const trigger=control.querySelector('.gallery-filter-trigger');
      const triggerText=control.querySelector('.gallery-filter-trigger-text');
      const menu=control.querySelector('.gallery-filter-menu');
      menu.setAttribute('aria-label',ariaLabel);
      return {field,control,trigger,triggerText,menu};
    }

    const rankField=rankSelect.closest('label');
    rankSelect.classList.add('gallery-filter-native');
    const rankUi=buildFilterControl(rankField,'Skin rank','Filter by skin rank');

    let creditField=document.querySelector('[data-credit-filter]');
    if(!creditField){
      creditField=document.createElement('div');
      creditField.dataset.creditFilter='true';
      creditField.innerHTML='<span>Image credit</span>';
      selectRow.appendChild(creditField);
    }
    const creditUi=buildFilterControl(creditField,'Image credit','Filter by image credit');

    function closeControl(ui){
      ui.control.classList.remove('is-open');
      ui.trigger.setAttribute('aria-expanded','false');
    }

    function closeAllControls(except){
      [rankUi,creditUi].forEach(ui=>{if(ui!==except)closeControl(ui)});
    }

    function openControl(ui){
      closeAllControls(ui);
      ui.control.classList.add('is-open');
      ui.trigger.setAttribute('aria-expanded','true');
      requestAnimationFrame(()=>ui.menu.querySelector('.gallery-filter-option.is-active')?.scrollIntoView({block:'nearest'}));
    }

    function bindMenuKeyboard(ui,choose){
      ui.trigger.addEventListener('click',event=>{
        event.stopPropagation();
        ui.control.classList.contains('is-open')?closeControl(ui):openControl(ui);
      });
      ui.trigger.addEventListener('keydown',event=>{
        if(event.key==='ArrowDown'||event.key==='Enter'||event.key===' '){
          event.preventDefault();
          if(!ui.control.classList.contains('is-open'))openControl(ui);
          ui.menu.querySelector('.gallery-filter-option.is-active')?.focus();
        }
      });
      ui.menu.addEventListener('click',event=>{
        const option=event.target.closest('.gallery-filter-option[data-value]');
        if(option)choose(option.dataset.value);
      });
      ui.menu.addEventListener('keydown',event=>{
        const options=[...ui.menu.querySelectorAll('.gallery-filter-option')];
        const index=options.indexOf(document.activeElement);
        if(event.key==='ArrowDown'){
          event.preventDefault();
          options[Math.min(options.length-1,Math.max(0,index+1))]?.focus();
        }else if(event.key==='ArrowUp'){
          event.preventDefault();
          options[Math.max(0,index-1)]?.focus();
        }else if(event.key==='Escape'){
          event.preventDefault();
          closeControl(ui);
          ui.trigger.focus();
        }else if((event.key==='Enter'||event.key===' ')&&document.activeElement?.dataset?.value){
          event.preventDefault();
          choose(document.activeElement.dataset.value);
          ui.trigger.focus();
        }
      });
    }

    function renderOptions(ui,entries,selected){
      ui.menu.innerHTML=entries.map(([value,label])=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='gallery-filter-option'+(value===selected?' is-active':'');
        button.dataset.value=value;
        button.setAttribute('role','option');
        button.setAttribute('aria-selected',String(value===selected));
        button.textContent=label;
        return button.outerHTML;
      }).join('');
      const active=entries.find(([value])=>value===selected);
      ui.triggerText.textContent=active?.[1]||entries[0]?.[1]||'All';
      ui.trigger.title=ui.triggerText.textContent;
    }

    function availableCredits(){
      const fromOptions=Array.isArray(galleryState.options?.credits)?galleryState.options.credits:[];
      const fromItems=Array.isArray(galleryState.items)?galleryState.items.filter(item=>!item.hidden).map(item=>item.credit||'Uncredited'):[];
      return [...new Set([...fromOptions,...fromItems].filter(Boolean))].sort(alpha);
    }

    function syncCreditOptions(){
      const credits=availableCredits();
      const previous=galleryState.credit||'all';
      if(previous!=='all'&&!credits.includes(previous))galleryState.credit='all';
      const selected=galleryState.credit||'all';
      renderOptions(creditUi,[['all','All credits'],...credits.map(credit=>[credit,credit])],selected);
    }

    function syncRankOptions(){
      const entries=[...rankSelect.options].map(option=>[option.value,option.textContent||option.value]);
      renderOptions(rankUi,entries,rankSelect.value||'all');
    }

    function chooseCredit(value){
      galleryState.credit=value||'all';
      galleryState.expanded=null;
      syncCreditOptions();
      closeControl(creditUi);
      render();
    }

    function chooseRank(value){
      rankSelect.value=value||'all';
      syncRankOptions();
      closeControl(rankUi);
      rankSelect.dispatchEvent(new Event('change',{bubbles:true}));
    }

    bindMenuKeyboard(creditUi,chooseCredit);
    bindMenuKeyboard(rankUi,chooseRank);

    document.addEventListener('click',event=>{
      if(!rankUi.control.contains(event.target))closeControl(rankUi);
      if(!creditUi.control.contains(event.target))closeControl(creditUi);
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      closeControl(rankUi);
      closeControl(creditUi);
    });

    const progressive={stage:0,signature:'',sampleIds:[]};
    let progressiveControls=document.querySelector('.gallery-progressive-controls');
    if(!progressiveControls){
      progressiveControls=document.createElement('div');
      progressiveControls.className='gallery-progressive-controls';
      progressiveControls.hidden=true;
      progressiveControls.innerHTML='<button type="button" class="gallery-view-all">View all</button><div class="gallery-progressive-note"></div>';
      gallery.insertAdjacentElement('afterend',progressiveControls);
    }
    const viewAllButton=progressiveControls.querySelector('.gallery-view-all');
    const progressiveNote=progressiveControls.querySelector('.gallery-progressive-note');

    function cryptoRandomUnit(){
      if(window.crypto?.getRandomValues){
        const bucket=new Uint32Array(1);
        window.crypto.getRandomValues(bucket);
        return bucket[0]/4294967296;
      }
      return Math.random();
    }

    function cryptographicShuffle(list){
      const copy=[...list];
      for(let i=copy.length-1;i>0;i--){
        const j=Math.floor(cryptoRandomUnit()*(i+1));
        [copy[i],copy[j]]=[copy[j],copy[i]];
      }
      return copy;
    }

    function fullFilteredList(){
      const list=baseFiltered();
      if(!galleryState.credit||galleryState.credit==='all')return list;
      return list.filter(item=>(item.credit||'Uncredited')===galleryState.credit);
    }

    function isDefaultBrowseContext(){
      return !(galleryState.query||'').trim()&&(galleryState.category||'all')==='all'&&(galleryState.rank||'all')==='all'&&(galleryState.credit||'all')==='all';
    }

    function contextSignature(list){
      return [galleryState.query||'',galleryState.category||'all',galleryState.rank||'all',galleryState.credit||'all',...list.map(item=>item.id)].join('\u001f');
    }

    function ensureProgressiveContext(list){
      const signature=contextSignature(list);
      if(signature===progressive.signature)return;
      progressive.signature=signature;
      progressive.stage=0;
      const source=isDefaultBrowseContext()?cryptographicShuffle(list):list;
      progressive.sampleIds=source.slice(0,Math.min(INITIAL_RANDOM_COUNT,list.length)).map(item=>String(item.id));
    }

    function progressiveList(list){
      ensureProgressiveContext(list);
      if(list.length<=INITIAL_RANDOM_COUNT){
        const byId=new Map(list.map(item=>[String(item.id),item]));
        return progressive.sampleIds.map(id=>byId.get(id)).filter(Boolean);
      }
      if(progressive.stage===0){
        const byId=new Map(list.map(item=>[String(item.id),item]));
        return progressive.sampleIds.map(id=>byId.get(id)).filter(Boolean);
      }
      if(progressive.stage===1){
        return list.slice(0,Math.min(SECOND_BATCH_COUNT,list.length));
      }
      return list;
    }

    function syncProgressiveControls(){
      const full=fullFilteredList();
      ensureProgressiveContext(full);
      if(full.length<=INITIAL_RANDOM_COUNT||progressive.stage>=2){
        progressiveControls.hidden=true;
        return;
      }
      if(progressive.stage===0){
        const nextCount=Math.min(SECOND_BATCH_COUNT,full.length);
        progressiveControls.hidden=false;
        viewAllButton.textContent='View all';
        progressiveNote.textContent=`Show ${nextCount} artwork${nextCount===1?'':'s'} in catalogue order`;
        return;
      }
      const shown=Math.min(full.length,SECOND_BATCH_COUNT);
      if(shown>=full.length){
        progressiveControls.hidden=true;
        return;
      }
      progressiveControls.hidden=false;
      viewAllButton.textContent='View all';
      progressiveNote.textContent=`Open full gallery · ${full.length-shown} more artwork${full.length-shown===1?'':'s'}`;
    }

    filtered=function(){
      return progressiveList(fullFilteredList());
    };

    setupFilters=function(){
      baseSetupFilters();
      syncCreditOptions();
      syncRankOptions();
    };

    render=function(){
      baseRender();
      syncProgressiveControls();
    };

    viewAllButton.addEventListener('click',()=>{
      const full=fullFilteredList();
      ensureProgressiveContext(full);
      const scrollX=window.scrollX;
      const scrollY=window.scrollY;
      if(progressive.stage===0){
        progressive.stage=full.length>SECOND_BATCH_COUNT?1:2;
      }else{
        progressive.stage=2;
      }
      galleryState.expanded=null;
      render();
      requestAnimationFrame(()=>window.scrollTo({left:scrollX,top:scrollY,behavior:'auto'}));
    });

    syncCreditOptions();
    syncRankOptions();
    render();
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
