(function(){
  'use strict';

  if(window.__HYU_MULTI_PROPERTY_SEARCH_BOOTSTRAPPED__)return;
  window.__HYU_MULTI_PROPERTY_SEARCH_BOOTSTRAPPED__=true;

  const vietnameseById=new Map();
  let vietnameseMetadataLoaded=false;

  function normalizeSearch(value){
    return String(value??'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }

  function parseQuery(query){
    const parts=[];
    const pattern=/"([^"]+)"|'([^']+)'|(\S+)/g;
    let match;
    while((match=pattern.exec(String(query||'')))){
      const quoted=match[1]!==undefined||match[2]!==undefined;
      const raw=match[1]??match[2]??match[3]??'';
      const text=normalizeSearch(raw);
      if(text)parts.push({text,quoted});
    }
    return parts;
  }

  function subsequenceMatch(haystack,needle){
    if(needle.length<4)return false;
    let cursor=0;
    for(const char of needle.replace(/\s/g,'')){
      cursor=haystack.indexOf(char,cursor);
      if(cursor<0)return false;
      cursor+=1;
    }
    return true;
  }

  function isVietnameseSkin(item){
    if(!item)return false;
    if(Object.prototype.hasOwnProperty.call(item,'isVietnameseSkin'))return Boolean(item.isVietnameseSkin);
    if(Object.prototype.hasOwnProperty.call(item,'is_vietnamese_skin'))return Boolean(item.is_vietnamese_skin);
    return Boolean(vietnameseById.get(String(item.id)));
  }

  function searchableFields(item){
    const tags=Array.isArray(item?.tags)?item.tags:[];
    const vietnameseAliases=isVietnameseSkin(item)
      ? ['viet nam','vietnam','vn','skin viet nam','skin vietnam']
      : [];
    return [
      item?.name,
      item?.description,
      item?.category,
      item?.rank,
      item?.credit,
      ...tags,
      ...vietnameseAliases
    ].map(normalizeSearch).filter(Boolean);
  }

  function tokenMatches(fields,token){
    return fields.some(field=>{
      if(field.includes(token.text))return true;
      return !token.quoted&&subsequenceMatch(field,token.text);
    });
  }

  function matchesMultiPropertyQuery(item,query){
    const tokens=parseQuery(query);
    if(!tokens.length)return true;
    const fields=searchableFields(item);
    return tokens.every(token=>tokenMatches(fields,token));
  }

  function installVietnameseFilterUi(galleryState){
    const selectRow=document.querySelector('.select-row');
    if(!selectRow)return;
    if(!Object.prototype.hasOwnProperty.call(galleryState,'vietnameseOnly'))galleryState.vietnameseOnly=false;

    if(!document.querySelector('style[data-hyu-vietnamese-skin-filter]')){
      const style=document.createElement('style');
      style.dataset.hyuVietnameseSkinFilter='true';
      style.textContent=`
        .vietnamese-skin-filter{display:flex;align-items:flex-end;min-height:28px}
        .vietnamese-skin-switch{height:28px;border:0;background:transparent;color:#cdd3d0;display:inline-flex;align-items:center;gap:8px;padding:0;font-size:.62rem;font-weight:800;white-space:nowrap;outline:none}
        .vietnamese-skin-switch:hover,.vietnamese-skin-switch:focus-visible{color:#fff}
        .vietnamese-skin-track{position:relative;width:30px;height:16px;border:1px solid #59615d;border-radius:999px;background:#151815;flex:none;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease}
        .vietnamese-skin-knob{position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#8b938f;transition:transform .16s ease,background .16s ease}
        .vietnamese-skin-switch[aria-checked="true"]{color:var(--brand)}
        .vietnamese-skin-switch[aria-checked="true"] .vietnamese-skin-track{background:rgba(67,220,255,.16);border-color:var(--brand);box-shadow:0 0 12px rgba(67,220,255,.12)}
        .vietnamese-skin-switch[aria-checked="true"] .vietnamese-skin-knob{transform:translateX(14px);background:var(--brand)}
        @media(max-width:760px){.vietnamese-skin-switch{font-size:.56rem;gap:7px}.vietnamese-skin-track{width:28px;height:15px}.vietnamese-skin-knob{width:9px;height:9px}.vietnamese-skin-switch[aria-checked="true"] .vietnamese-skin-knob{transform:translateX(13px)}}
      `;
      document.head.appendChild(style);
    }

    let field=document.querySelector('[data-vietnamese-skin-filter]');
    if(!field){
      field=document.createElement('div');
      field.className='vietnamese-skin-filter';
      field.dataset.vietnameseSkinFilter='true';
      field.innerHTML='<button type="button" class="vietnamese-skin-switch" role="switch" aria-checked="false" aria-label="Chỉ xem skin Việt Nam?"><span class="vietnamese-skin-track" aria-hidden="true"><span class="vietnamese-skin-knob"></span></span><span>Chỉ xem skin Việt Nam?</span></button>';
      selectRow.appendChild(field);
    }

    const button=field.querySelector('.vietnamese-skin-switch');
    if(!button||button.dataset.bound==='true')return;
    button.dataset.bound='true';

    const sync=()=>button.setAttribute('aria-checked',String(Boolean(galleryState.vietnameseOnly)));
    sync();
    button.addEventListener('click',()=>{
      galleryState.vietnameseOnly=!galleryState.vietnameseOnly;
      galleryState.expanded=null;
      sync();
      try{render()}catch{}
      button.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  function install(){
    let galleryState,baseFiltered,baseApplyCatalogue;
    try{
      if(typeof state==='undefined'||typeof filtered!=='function')return false;
      galleryState=state;
      baseFiltered=filtered;
      if(typeof applyCatalogue==='function')baseApplyCatalogue=applyCatalogue;
    }catch{return false}

    if(window.__HYU_MULTI_PROPERTY_SEARCH_READY__)return true;

    function hydrateVietnameseFlags(){
      for(const item of galleryState.items||[]){
        const id=String(item.id);
        if(vietnameseById.has(id))item.isVietnameseSkin=Boolean(vietnameseById.get(id));
        else if(!Object.prototype.hasOwnProperty.call(item,'isVietnameseSkin'))item.isVietnameseSkin=Boolean(item.is_vietnamese_skin);
      }
    }

    async function loadVietnameseMetadata(){
      const client=window.HYU_SUPABASE?.client;
      if(!client)return;
      try{
        const {data,error}=await client.from('artworks').select('id,is_vietnamese_skin').eq('hidden',false);
        if(error)throw error;
        vietnameseById.clear();
        for(const row of data||[])vietnameseById.set(String(row.id),Boolean(row.is_vietnamese_skin));
        vietnameseMetadataLoaded=true;
        hydrateVietnameseFlags();
        try{render()}catch{}
      }catch(error){
        console.warn('Vietnamese skin metadata unavailable; filter will stay empty until metadata can be loaded.',error);
      }
    }

    if(baseApplyCatalogue){
      applyCatalogue=function(items,options,revision){
        baseApplyCatalogue(items,options,revision);
        hydrateVietnameseFlags();
        if(!vietnameseMetadataLoaded)loadVietnameseMetadata();
      };
    }

    filtered=function(){
      const query=String(galleryState.query||'').trim();
      let candidates=[];

      if(!query){
        candidates=baseFiltered();
      }else{
        const originalQuery=galleryState.query;
        try{
          galleryState.query='';
          candidates=baseFiltered();
        }finally{
          galleryState.query=originalQuery;
        }
        candidates=candidates.filter(item=>matchesMultiPropertyQuery(item,query));
      }

      if(galleryState.vietnameseOnly)candidates=candidates.filter(isVietnameseSkin);
      return candidates;
    };

    const input=document.querySelector('#search');
    if(input){
      input.placeholder='Search artwork or combine properties...';
      input.title='Combine terms across name, description, category, rank, credit, tags and the Vietnamese-skin property. Example: Marja Việt Nam';
      input.setAttribute('aria-description','Multiple terms are combined with AND across artwork properties. Vietnamese skins can be searched with Việt Nam, Vietnam or VN.');
    }

    installVietnameseFilterUi(galleryState);
    hydrateVietnameseFlags();
    loadVietnameseMetadata();

    window.HYU_MULTI_PROPERTY_SEARCH={normalizeSearch,parseQuery,matchesMultiPropertyQuery,isVietnameseSkin};
    window.__HYU_MULTI_PROPERTY_SEARCH_READY__=true;
    window.dispatchEvent(new CustomEvent('hyu:multi-property-search-ready'));
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(install()||attempts>=240)clearInterval(timer);
    },25);
  }
})();
