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
        .select-row label[data-credit-filter]{min-width:112px}
        @media(max-width:760px){.select-row{gap:.9rem 1.2rem}.select-row label{min-width:105px}}
      `;
      document.head.appendChild(style);
    }

    let creditSelect=document.querySelector('#creditFilter');
    if(!creditSelect){
      const label=document.createElement('label');
      label.dataset.creditFilter='true';
      label.innerHTML='<span>Image credit</span><select id="creditFilter" aria-label="Filter by image credit"><option value="all">All credits</option></select>';
      selectRow.appendChild(label);
      creditSelect=label.querySelector('#creditFilter');
    }

    const alpha=(a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base',numeric:true});

    function availableCredits(){
      const fromOptions=Array.isArray(galleryState.options?.credits)?galleryState.options.credits:[];
      const fromItems=Array.isArray(galleryState.items)?galleryState.items.filter(item=>!item.hidden).map(item=>item.credit||'Uncredited'):[];
      return [...new Set([...fromOptions,...fromItems].filter(Boolean))].sort(alpha);
    }

    function syncCreditOptions(){
      const credits=availableCredits();
      const previous=galleryState.credit||'all';
      creditSelect.innerHTML='<option value="all">All credits</option>'+credits.map(credit=>{
        const option=document.createElement('option');
        option.value=credit;
        option.textContent=credit;
        return option.outerHTML;
      }).join('');
      if(previous==='all'||credits.includes(previous)){
        galleryState.credit=previous;
        creditSelect.value=previous;
      }else{
        galleryState.credit='all';
        creditSelect.value='all';
      }
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

    creditSelect.addEventListener('change',event=>{
      galleryState.credit=event.target.value||'all';
      galleryState.expanded=null;
      baseRender();
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
