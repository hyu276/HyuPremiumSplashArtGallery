(function(){
  'use strict';

  if(window.__HYU_SHARED_PROPERTIES__?.ready)return;

  const OWNER_EMAIL='csquocnguyen@gmail.com';
  const SYNC_INTERVAL_MS=30000;
  const RETRY_MS=1800;
  let syncing=false;
  let retryTimer=0;
  let pollTimer=0;
  let lastOwnerSignature='';

  function activeClient(){
    try{
      if(typeof window.HYU_GET_ACTIVE_ADMIN_CLIENT==='function'){
        const c=window.HYU_GET_ACTIVE_ADMIN_CLIENT();
        if(c)return c;
      }
    }catch{}
    try{return typeof client!=='undefined'?client:null}catch{return null}
  }

  function activeProfile(){
    try{
      if(typeof window.HYU_GET_ACTIVE_ADMIN_PROFILE==='function'){
        const key=window.HYU_GET_ACTIVE_ADMIN_PROFILE();
        if(key)return String(key);
      }
    }catch{}
    return String(window.HYU_ACTIVE_ADMIN_PROFILE||window.HYU_SUPABASE_PROFILE||'owner');
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

  function hasDirtyLocalChanges(){
    try{return typeof dirty!=='undefined'&&Boolean(dirty)}catch{return false}
  }

  function normalizeName(value){
    return String(value||'')
      .normalize('NFC')
      .trim()
      .replace(/\s+/g,' ')
      .toLowerCase();
  }

  function ownerConfig(){
    const profile=window.HYU_SUPABASE_PROFILES?.owner;
    return profile?.url&&profile?.publishableKey?profile:null;
  }

  async function ownerRest(path){
    const cfg=ownerConfig();
    if(!cfg)throw new Error('Owner Supabase profile is unavailable.');
    const response=await fetch(`${cfg.url}/rest/v1/${path}`,{
      headers:{apikey:cfg.publishableKey,Accept:'application/json'},
      cache:'no-store',
      credentials:'omit'
    });
    if(!response.ok)throw new Error(`Owner property sync failed (${response.status}).`);
    return response.json();
  }

  async function loadOwnerProperties(){
    const [categoriesRows,creditsRows,ranksRows]=await Promise.all([
      ownerRest('categories?select=id,name&order=name.asc'),
      ownerRest('image_credits?select=id,name&order=name.asc'),
      ownerRest('ranks?select=id,name,sort_order&order=sort_order.asc')
    ]);
    return {
      categories:Array.isArray(categoriesRows)?categoriesRows:[],
      credits:Array.isArray(creditsRows)?creditsRows:[],
      ranks:Array.isArray(ranksRows)?ranksRows:[]
    };
  }

  async function loadLocalProperties(c){
    const [categoryRes,creditRes,rankRes]=await Promise.all([
      c.from('categories').select('id,name').order('name'),
      c.from('image_credits').select('id,name').order('name'),
      c.from('ranks').select('id,name,sort_order').order('sort_order')
    ]);
    const error=categoryRes.error||creditRes.error||rankRes.error;
    if(error)throw error;
    return {
      categories:categoryRes.data||[],
      credits:creditRes.data||[],
      ranks:rankRes.data||[]
    };
  }

  function preferredRow(group,ownerName){
    if(ownerName){
      const exact=group.find(row=>String(row.name||'')===ownerName);
      if(exact)return exact;
    }
    return group.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];
  }

  async function dedupeLocalTable(c,{table,fk,ownerRows,localRows}){
    let changed=false;
    const ownerByNorm=new Map(ownerRows.map(row=>[normalizeName(row.name),String(row.name||'').trim()]));
    const groups=new Map();
    for(const row of localRows){
      const key=normalizeName(row.name);
      if(!key)continue;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    }

    for(const [key,group] of groups){
      if(group.length<2)continue;
      const keep=preferredRow(group,ownerByNorm.get(key));
      for(const duplicate of group){
        if(duplicate.id===keep.id)continue;
        if(fk){
          const {error:updateError}=await c.from('artworks').update({[fk]:keep.id}).eq(fk,duplicate.id);
          if(updateError)throw updateError;
        }
        const {error:deleteError}=await c.from(table).delete().eq('id',duplicate.id);
        if(deleteError)throw deleteError;
        changed=true;
      }
    }
    return changed;
  }

  async function mergeOwnerRows(c,{table,fk,ownerRows,localRows,isRank=false}){
    let changed=await dedupeLocalTable(c,{table,fk,ownerRows,localRows});

    const refreshed=await c.from(table).select(isRank?'id,name,sort_order':'id,name');
    if(refreshed.error)throw refreshed.error;
    let rows=refreshed.data||[];
    const byNorm=new Map(rows.map(row=>[normalizeName(row.name),row]));

    for(const ownerRow of ownerRows){
      const ownerName=String(ownerRow.name||'').normalize('NFC').trim().replace(/\s+/g,' ');
      const key=normalizeName(ownerName);
      if(!key)continue;
      const local=byNorm.get(key);
      if(local){
        if(String(local.name||'')!==ownerName){
          const {error}=await c.from(table).update({name:ownerName}).eq('id',local.id);
          if(error)throw error;
          local.name=ownerName;
          changed=true;
        }
      }else{
        const payload=isRank?{name:ownerName,sort_order:Number(ownerRow.sort_order)||0}:{name:ownerName};
        const {data,error}=await c.from(table).insert(payload).select(isRank?'id,name,sort_order':'id,name').single();
        if(error){
          if(String(error.code||'')!=='23505')throw error;
        }else if(data){
          rows.push(data);
          byNorm.set(key,data);
          changed=true;
        }
      }
    }

    if(isRank){
      const after=await c.from('ranks').select('id,name,sort_order').order('sort_order');
      if(after.error)throw after.error;
      const ownerOrder=new Map(ownerRows.map((row,index)=>[normalizeName(row.name),index]));
      const ownerRanks=[];
      const extras=[];
      for(const row of after.data||[]){
        if(ownerOrder.has(normalizeName(row.name)))ownerRanks.push(row);
        else extras.push(row);
      }
      ownerRanks.sort((a,b)=>(ownerOrder.get(normalizeName(a.name))??9999)-(ownerOrder.get(normalizeName(b.name))??9999));
      extras.sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.name).localeCompare(String(b.name)));
      const desired=[...ownerRanks,...extras];
      for(let index=0;index<desired.length;index++){
        const row=desired[index];
        if(Number(row.sort_order)!==index){
          const {error}=await c.from('ranks').update({sort_order:index}).eq('id',row.id);
          if(error)throw error;
          changed=true;
        }
      }
    }

    return changed;
  }

  async function refreshDashboardState(){
    if(hasDirtyLocalChanges())return;
    try{
      if(typeof loadAll==='function'){
        await loadAll();
        return;
      }
    }catch(error){
      console.warn('Owner property sync could not reload the dashboard automatically.',error);
    }

    const c=activeClient();
    if(!c)return;
    try{
      const local=await loadLocalProperties(c);
      if(typeof categories!=='undefined')categories.splice(0,categories.length,...local.categories);
      if(typeof credits!=='undefined')credits.splice(0,credits.length,...local.credits);
      if(typeof ranks!=='undefined')ranks.splice(0,ranks.length,...local.ranks);
      if(typeof syncChoiceUI==='function')syncChoiceUI();
      if(typeof render==='function')render();
    }catch(error){
      console.warn('Owner property sync could not refresh the property UI.',error);
    }
  }

  function scheduleRetry(){
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>syncFromOwner(false),RETRY_MS);
  }

  async function syncFromOwner(force=false){
    if(syncing)return;
    const email=signedInEmail();
    const profile=activeProfile();
    if(!email||email===OWNER_EMAIL||profile==='owner')return;
    if(hasDirtyLocalChanges()&&!force){
      scheduleRetry();
      return;
    }

    const c=activeClient();
    if(!c)return scheduleRetry();

    syncing=true;
    try{
      const owner=await loadOwnerProperties();
      const signature=JSON.stringify({
        categories:owner.categories.map(row=>[normalizeName(row.name),row.name]),
        credits:owner.credits.map(row=>[normalizeName(row.name),row.name]),
        ranks:owner.ranks.map(row=>[normalizeName(row.name),row.name,row.sort_order])
      });

      const local=await loadLocalProperties(c);
      let changed=false;
      changed=(await mergeOwnerRows(c,{table:'categories',fk:'category_id',ownerRows:owner.categories,localRows:local.categories}))||changed;
      changed=(await mergeOwnerRows(c,{table:'image_credits',fk:'credit_id',ownerRows:owner.credits,localRows:local.credits}))||changed;
      changed=(await mergeOwnerRows(c,{table:'ranks',fk:'rank_id',ownerRows:owner.ranks,localRows:local.ranks,isRank:true}))||changed;

      if(changed)await refreshDashboardState();
      lastOwnerSignature=signature;
      window.dispatchEvent(new CustomEvent('hyu:owner-properties-synced',{detail:{changed,profile}}));
    }catch(error){
      console.warn('Unable to synchronize owner properties into this admin database.',error);
      scheduleRetry();
    }finally{
      syncing=false;
    }
  }

  const api={
    ready:true,
    sync:()=>syncFromOwner(true),
    normalizeName
  };
  window.__HYU_SHARED_PROPERTIES__=api;

  const pill=document.getElementById('ownerPill');
  if(pill){
    new MutationObserver(()=>setTimeout(()=>syncFromOwner(false),100)).observe(pill,{attributes:true,childList:true,subtree:true});
  }

  const status=document.getElementById('status');
  if(status){
    new MutationObserver(()=>{
      if(/Loaded .* from Supabase|Published and confirmed/i.test(String(status.textContent||'')))setTimeout(()=>syncFromOwner(false),120);
    }).observe(status,{childList:true,subtree:true,characterData:true});
  }

  window.addEventListener('focus',()=>syncFromOwner(false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncFromOwner(false)});
  window.addEventListener('hyu:publish-request-created',()=>setTimeout(()=>syncFromOwner(false),250));

  pollTimer=setInterval(()=>syncFromOwner(false),SYNC_INTERVAL_MS);
  setTimeout(()=>syncFromOwner(false),500);
})();
