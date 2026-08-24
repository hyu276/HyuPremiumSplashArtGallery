(function(){
  'use strict';

  if(window.__HYU_PUBLISH_REQUEST_HOOK__==='v1')return;
  window.__HYU_PUBLISH_REQUEST_HOOK__='v1';

  const OWNER_EMAIL='csquocnguyen@gmail.com';
  const MODERATION_URL='https://zkrhwqgmynbbmoktokdq.supabase.co/functions/v1/publish-moderation';
  const trackedUploads=new Map();

  function facade(){
    try{return typeof client!=='undefined'?client:null}catch{return null}
  }

  function activeClient(){
    try{
      if(typeof window.HYU_GET_ACTIVE_ADMIN_CLIENT==='function'){
        const value=window.HYU_GET_ACTIVE_ADMIN_CLIENT();
        if(value)return value;
      }
    }catch{}
    return facade();
  }

  function activeProfile(){
    try{
      if(typeof window.HYU_GET_ACTIVE_ADMIN_PROFILE==='function'){
        const value=window.HYU_GET_ACTIVE_ADMIN_PROFILE();
        if(value)return String(value);
      }
    }catch{}
    return String(window.HYU_ACTIVE_ADMIN_PROFILE||window.HYU_SUPABASE_PROFILE||'owner');
  }

  async function currentUser(){
    try{
      if(typeof adminUser!=='undefined'&&adminUser?.email)return adminUser;
    }catch{}
    const c=activeClient();
    if(!c?.auth?.getUser)return null;
    try{
      const {data,error}=await c.auth.getUser();
      return !error?data?.user||null:null;
    }catch{return null}
  }

  async function accessToken(){
    const c=activeClient();
    if(!c?.auth?.getSession)return '';
    try{
      const {data}=await c.auth.getSession();
      return data?.session?.access_token||'';
    }catch{return ''}
  }

  async function moderationPost(body){
    const token=await accessToken();
    if(!token)throw new Error('Admin session is unavailable. Please sign in again.');
    const response=await fetch(MODERATION_URL,{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify(body),
      cache:'no-store',
      credentials:'omit'
    });
    let payload={};
    try{payload=await response.json()}catch{}
    if(!response.ok)throw new Error(payload?.error||`Moderation request failed (${response.status}).`);
    return payload;
  }

  function imageMatchesPath(image,path){
    const raw=String(image||'');
    if(!raw||!path)return false;
    try{
      const decoded=decodeURIComponent(raw);
      return decoded.includes(`/${path}`)||decoded.endsWith(path);
    }catch{
      return raw.includes(`/${path}`)||raw.endsWith(path);
    }
  }

  function matchingTrackedUpload(row){
    for(const path of trackedUploads.keys()){
      if(imageMatchesPath(row?.image,path))return path;
    }
    return '';
  }

  async function createRequest(row,path,user){
    const email=String(user?.email||'').trim().toLowerCase();
    if(!email||email===OWNER_EMAIL)return null;
    const payload=await moderationPost({
      action:'create',
      sourceProfile:activeProfile(),
      artworkId:String(row?.id||''),
      artworkName:String(row?.name||''),
      candidateImage:String(row?.image||''),
      uploadPath:String(path||''),
      metadata:{
        description:String(row?.description||''),
        category_id:row?.category_id??null,
        rank_id:row?.rank_id??null,
        credit_id:row?.credit_id??null,
        tags:Array.isArray(row?.tags)?row.tags:[],
        hidden:Boolean(row?.hidden)
      }
    });
    return payload?.request||null;
  }

  async function cancelRequest(requestId){
    if(!requestId)return;
    try{await moderationPost({action:'cancel',requestId})}catch(error){
      console.warn('[publish-request-hook] unable to cancel request',error);
    }
  }

  function looksLikeExistingModerationWrapper(fn){
    try{
      const source=Function.prototype.toString.call(fn);
      return source.includes('matchingTrackedUpload')||source.includes('hyu:publish-request-created');
    }catch{return false}
  }

  function install(){
    const c=facade();
    if(!c?.from||!c?.storage?.from)return false;
    if(c.from?.__hyuPublishRequestHookV1&&c.storage.from?.__hyuPublishRequestHookV1)return true;

    // If the original moderation module is already wrapped around the CURRENT routed
    // client, do not double-wrap and create duplicate requests.
    if(looksLikeExistingModerationWrapper(c.from))return true;

    const originalFrom=c.from.bind(c);
    const originalStorageFrom=c.storage.from.bind(c.storage);

    const routedStorageFrom=function(bucket){
      const api=originalStorageFrom(bucket);
      if(bucket!=='artworks'||!api)return api;
      return new Proxy(api,{
        get(target,prop){
          if(prop==='upload'){
            return async function(path,file,options){
              const result=await target.upload(path,file,options);
              if(!result?.error&&/^uploads\//.test(String(path||''))){
                trackedUploads.set(String(path),{
                  name:String(file?.name||''),
                  size:Number(file?.size||0),
                  type:String(file?.type||'')
                });
              }
              return result;
            };
          }
          const value=target[prop];
          return typeof value==='function'?value.bind(target):value;
        }
      });
    };
    routedStorageFrom.__hyuPublishRequestHookV1=true;
    c.storage.from=routedStorageFrom;

    const routedFrom=function(table){
      const api=originalFrom(table);
      if(table!=='artworks'||!api)return api;
      return new Proxy(api,{
        get(target,prop){
          if(prop==='upsert'){
            return async function(rows,options){
              const rowList=Array.isArray(rows)?rows:[rows];
              const affected=rowList
                .map(row=>({row,path:matchingTrackedUpload(row)}))
                .filter(entry=>entry.path);

              if(!affected.length){
                return target.upsert(rows,options);
              }

              const user=await currentUser();
              const email=String(user?.email||'').trim().toLowerCase();
              if(!user||email===OWNER_EMAIL){
                const result=await target.upsert(rows,options);
                if(!result?.error)affected.forEach(({path})=>trackedUploads.delete(path));
                return result;
              }

              const created=[];
              try{
                for(const entry of affected){
                  const request=await createRequest(entry.row,entry.path,user);
                  if(!request?.id)throw new Error(`Unable to create publish request for ${entry.row?.name||entry.row?.id||'artwork'}.`);
                  created.push({requestId:request.id,path:entry.path});
                }
              }catch(error){
                for(const item of created)await cancelRequest(item.requestId);
                try{await originalStorageFrom('artworks').remove(affected.map(item=>item.path))}catch{}
                return {data:null,error:error instanceof Error?error:new Error(String(error))};
              }

              const result=await target.upsert(rows,options);
              if(result?.error){
                for(const item of created)await cancelRequest(item.requestId);
                return result;
              }

              affected.forEach(({path})=>trackedUploads.delete(path));
              window.dispatchEvent(new CustomEvent('hyu:publish-request-created',{detail:{count:created.length}}));
              return result;
            };
          }
          const value=target[prop];
          return typeof value==='function'?value.bind(target):value;
        }
      });
    };
    routedFrom.__hyuPublishRequestHookV1=true;
    c.from=routedFrom;

    console.info('[publish-request-hook] installed for routed admin client',activeProfile());
    return true;
  }

  function installWhenReady(attempt=0){
    if(install())return;
    if(attempt>=40){
      console.error('[publish-request-hook] could not attach to admin client');
      return;
    }
    setTimeout(()=>installWhenReady(attempt+1),250);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>installWhenReady(),{once:true});
  }else installWhenReady();

  // Re-check whenever login routing changes the active Supabase project.
  const pill=document.getElementById('ownerPill');
  if(pill){
    new MutationObserver(()=>setTimeout(()=>installWhenReady(),0))
      .observe(pill,{attributes:true,childList:true,subtree:true});
  }
})();
