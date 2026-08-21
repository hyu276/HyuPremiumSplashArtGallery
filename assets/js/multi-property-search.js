(function(){
  'use strict';

  if(window.__HYU_MULTI_PROPERTY_SEARCH_BOOTSTRAPPED__)return;
  window.__HYU_MULTI_PROPERTY_SEARCH_BOOTSTRAPPED__=true;

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

  function searchableFields(item){
    const tags=Array.isArray(item?.tags)?item.tags:[];
    return [
      item?.name,
      item?.description,
      item?.category,
      item?.rank,
      item?.credit,
      ...tags
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

  function install(){
    let galleryState,baseFiltered;
    try{
      if(typeof state==='undefined'||typeof filtered!=='function')return false;
      galleryState=state;
      baseFiltered=filtered;
    }catch{return false}

    if(window.__HYU_MULTI_PROPERTY_SEARCH_READY__)return true;

    filtered=function(){
      const query=String(galleryState.query||'').trim();
      if(!query)return baseFiltered();

      // Preserve the catalogue's existing category/rank visibility and canonical sorting,
      // but bypass its old single-string search so each query token can match a different field.
      const originalQuery=galleryState.query;
      let candidates=[];
      try{
        galleryState.query='';
        candidates=baseFiltered();
      }finally{
        galleryState.query=originalQuery;
      }
      return candidates.filter(item=>matchesMultiPropertyQuery(item,query));
    };

    const input=document.querySelector('#search');
    if(input){
      input.placeholder='Search artwork or combine properties...';
      input.title='Combine terms across name, description, category, rank, credit and tags. Example: Marja Wave';
      input.setAttribute('aria-description','Multiple terms are combined with AND across artwork properties.');
    }

    window.HYU_MULTI_PROPERTY_SEARCH={normalizeSearch,parseQuery,matchesMultiPropertyQuery};
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
