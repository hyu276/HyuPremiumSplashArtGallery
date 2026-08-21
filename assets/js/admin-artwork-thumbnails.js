(function(){
  'use strict';

  if(window.__HYU_ADMIN_ARTWORK_THUMBNAILS__)return;

  const TARGET_W=1600;
  const TARGET_H=900;
  const WEBP_QUALITY=.82;
  const JPEG_QUALITY=.84;
  const CACHE_SECONDS='31536000';
  let stopRequested=false;
  let running=false;

  function waitForAdmin(){
    try{
      if(typeof client==='undefined'||typeof publish!=='function'||typeof ensureAdmin!=='function'||typeof loadAll!=='function'||typeof items==='undefined'||typeof pendingUploads==='undefined')return false;
    }catch{return false}
    install();
    return true;
  }

  function canvasBlob(canvas,type,quality){
    return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  }

  async function sourceBlob(source){
    if(source instanceof Blob)return source;
    const url=String(source||'').trim();
    if(!url)throw new Error('Image source is empty.');
    const response=await fetch(url,{mode:'cors',cache:'force-cache',credentials:'omit'});
    if(!response.ok)throw new Error(`Image fetch failed (${response.status}).`);
    return await response.blob();
  }

  async function decodeBlob(blob){
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(blob,{imageOrientation:'from-image'})}
      catch{return await createImageBitmap(blob)}
    }
    const url=URL.createObjectURL(blob);
    try{
      const img=new Image();
      img.decoding='async';
      img.src=url;
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Image decode failed.'))});
      return img;
    }finally{URL.revokeObjectURL(url)}
  }

  async function makeThumbnail(source){
    const input=await sourceBlob(source);
    const decoded=await decodeBlob(input);
    const sw=decoded.width||decoded.naturalWidth||0;
    const sh=decoded.height||decoded.naturalHeight||0;
    if(!sw||!sh){decoded.close?.();throw new Error('Invalid image dimensions.')}

    const downscale=Math.min(1,sw/TARGET_W,sh/TARGET_H);
    const tw=Math.max(1,Math.round(TARGET_W*downscale));
    const th=Math.max(1,Math.round(TARGET_H*downscale));
    const targetRatio=TARGET_W/TARGET_H;
    const sourceRatio=sw/sh;
    let sx=0,sy=0,cropW=sw,cropH=sh;
    if(sourceRatio>targetRatio){
      cropW=sh*targetRatio;
      sx=(sw-cropW)/2;
    }else if(sourceRatio<targetRatio){
      cropH=sw/targetRatio;
      sy=(sh-cropH)/2;
    }

    const canvas=document.createElement('canvas');
    canvas.width=tw;
    canvas.height=th;
    const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
    if(!ctx){decoded.close?.();throw new Error('Canvas unavailable.')}
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(decoded,sx,sy,cropW,cropH,0,0,tw,th);
    decoded.close?.();

    let output=await canvasBlob(canvas,'image/webp',WEBP_QUALITY);
    let ext='webp';
    if(!output||output.type!=='image/webp'){
      output=await canvasBlob(canvas,'image/jpeg',JPEG_QUALITY);
      ext='jpg';
    }
    canvas.width=1;
    canvas.height=1;
    if(!output)throw new Error('Thumbnail encoding failed.');
    return {blob:output,ext,width:tw,height:th,sourceBytes:input.size||0};
  }

  function artworkStoragePath(url){
    const m=String(url||'').match(/\/storage\/v1\/object\/public\/artworks\/(.+?)(?:\?.*)?$/);
    return m?decodeURIComponent(m[1]):'';
  }

  async function uploadThumbnail(id,name,source){
    const optimized=await makeThumbnail(source);
    const base=(typeof slug==='function'?slug(id||name):String(id||name).replace(/[^a-z0-9]+/gi,'-').toLowerCase())||'art';
    const path=`thumbnails/${base}-${Date.now()}.${optimized.ext}`;
    const {error}=await client.storage.from('artworks').upload(path,optimized.blob,{
      upsert:false,
      contentType:optimized.blob.type,
      cacheControl:CACHE_SECONDS
    });
    if(error)throw error;
    const {data}=client.storage.from('artworks').getPublicUrl(path);
    return {...optimized,path,url:data.publicUrl};
  }

  async function removeUploaded(paths){
    const unique=[...new Set(paths.filter(Boolean))];
    if(!unique.length)return;
    try{await client.storage.from('artworks').remove(unique)}catch{}
  }

  function formatBytes(bytes){
    if(!Number.isFinite(bytes)||bytes<=0)return '0 MB';
    return `${(bytes/1024/1024).toFixed(bytes>=10*1024*1024?1:2)} MB`;
  }

  function createPanel(){
    if(document.querySelector('#imageOptimizerPanel'))return document.querySelector('#imageOptimizerPanel');
    const addPanel=document.querySelector('#formTitle')?.closest('.panel');
    if(!addPanel)return null;
    const panel=document.createElement('section');
    panel.className='panel';
    panel.id='imageOptimizerPanel';
    panel.innerHTML=`
      <h2>Artwork image optimization</h2>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Gallery cards use a 1600×900 optimized WebP/JPEG thumbnail. The original image is kept for expanded view only.</div>
      <div class="actions">
        <button class="btn primary" id="optimizeMissingThumbs" type="button">Optimize missing thumbnails</button>
        <button class="btn" id="refreshThumbStatus" type="button">Refresh status</button>
        <button class="btn danger" id="stopThumbOptimization" type="button" disabled>Stop</button>
      </div>
      <div class="status" id="thumbOptimizerStatus">Sign in to check thumbnail coverage.</div>
    `;
    addPanel.insertAdjacentElement('afterend',panel);
    return panel;
  }

  async function queryRows(){
    const {data,error}=await client.from('artworks').select('id,name,image,thumbnail').order('id',{ascending:true});
    if(error)throw error;
    return data||[];
  }

  function install(){
    if(window.__HYU_ADMIN_ARTWORK_THUMBNAILS__)return;
    window.__HYU_ADMIN_ARTWORK_THUMBNAILS__=true;
    const panel=createPanel();
    if(!panel)return;
    const optimizeButton=panel.querySelector('#optimizeMissingThumbs');
    const refreshButton=panel.querySelector('#refreshThumbStatus');
    const stopButton=panel.querySelector('#stopThumbOptimization');
    const status=panel.querySelector('#thumbOptimizerStatus');
    const ownerPill=document.querySelector('#ownerPill');

    function setOptimizerStatus(message,type=''){
      status.textContent=message;
      status.className='status '+type;
    }

    async function refreshCoverage(){
      if(running)return;
      if(!ownerPill?.classList.contains('ok'))return setOptimizerStatus('Sign in to check thumbnail coverage.');
      try{
        const rows=await queryRows();
        const optimized=rows.filter(row=>String(row.thumbnail||'').trim()).length;
        const missing=rows.length-optimized;
        setOptimizerStatus(`${optimized}/${rows.length} artworks optimized${missing?` · ${missing} remaining`:''}.`,missing?'warn':'ok');
      }catch(error){setOptimizerStatus(error.message||'Unable to check thumbnails.','err')}
    }

    async function optimizeMissing(){
      if(running)return;
      try{await ensureAdmin()}catch(error){return setOptimizerStatus(error.message||'Admin login required.','err')}
      running=true;
      stopRequested=false;
      optimizeButton.disabled=true;
      refreshButton.disabled=true;
      stopButton.disabled=false;
      let completed=0,failed=0,sourceBytes=0,thumbBytes=0;
      const failures=[];
      try{
        const rows=await queryRows();
        const missing=rows.filter(row=>!String(row.thumbnail||'').trim());
        if(!missing.length){setOptimizerStatus(`All ${rows.length} artworks already have optimized thumbnails.`,'ok');return}
        for(let i=0;i<missing.length;i++){
          if(stopRequested)break;
          const row=missing[i];
          setOptimizerStatus(`Optimizing ${i+1}/${missing.length}: ${row.name}...`);
          try{
            const result=await uploadThumbnail(row.id,row.name,row.image);
            const {error}=await client.from('artworks').update({thumbnail:result.url}).eq('id',row.id);
            if(error){await removeUploaded([result.path]);throw error}
            completed+=1;
            sourceBytes+=result.sourceBytes||0;
            thumbBytes+=result.blob.size||0;
          }catch(error){
            failed+=1;
            failures.push(`${row.name}: ${error.message||'failed'}`);
          }
          await new Promise(resolve=>setTimeout(resolve,35));
        }
        const saved=Math.max(0,sourceBytes-thumbBytes);
        if(stopRequested){
          setOptimizerStatus(`Stopped. ${completed} optimized, ${failed} failed. Estimated transfer reduction for processed originals: ${formatBytes(saved)}.`,'warn');
        }else if(failed){
          console.warn('Thumbnail optimization failures',failures);
          setOptimizerStatus(`${completed} optimized, ${failed} failed. Estimated transfer reduction: ${formatBytes(saved)}. Failed external/CORS images can be re-uploaded from a local file.`,'warn');
        }else{
          setOptimizerStatus(`${completed} thumbnails created. Estimated transfer reduction versus those originals: ${formatBytes(saved)}.`,'ok');
        }
      }catch(error){setOptimizerStatus(error.message||'Thumbnail optimization failed.','err')}
      finally{
        running=false;
        optimizeButton.disabled=false;
        refreshButton.disabled=false;
        stopButton.disabled=true;
      }
    }

    optimizeButton.addEventListener('click',optimizeMissing);
    refreshButton.addEventListener('click',refreshCoverage);
    stopButton.addEventListener('click',()=>{stopRequested=true;stopButton.disabled=true});

    const originalPublish=publish;
    publish=async function(){
      await ensureAdmin();
      let beforeRows=[];
      try{beforeRows=await queryRows()}catch{}
      const beforeMap=new Map(beforeRows.map(row=>[String(row.id),row]));
      const localSnapshot=(items||[]).map(item=>({id:String(item.id),name:item.name||item.id,image:item.image||''}));
      const pendingSnapshot=new Map([...pendingUploads.entries()].map(([id,p])=>[String(id),p?.file||null]));
      const candidates=localSnapshot.filter(item=>{
        const before=beforeMap.get(item.id);
        return pendingSnapshot.has(item.id)||!before||String(before.image||'')!==String(item.image||'');
      });
      const prepared=new Map();
      const temporaryPaths=[];
      let optimizedCount=0;

      for(const item of candidates){
        const file=pendingSnapshot.get(item.id);
        if(!file)continue;
        try{
          setStatus(`Preparing optimized thumbnail for ${item.name}...`);
          const result=await uploadThumbnail(item.id,item.name,file);
          prepared.set(item.id,result);
          temporaryPaths.push(result.path);
        }catch(error){console.warn(`Thumbnail preparation failed for ${item.name}`,error)}
      }

      try{
        await originalPublish();
      }catch(error){
        await removeUploaded(temporaryPaths);
        throw error;
      }

      const cleanup=[];
      for(const item of candidates){
        let result=prepared.get(item.id);
        if(!result){
          try{
            setStatus(`Optimizing gallery thumbnail for ${item.name}...`);
            result=await uploadThumbnail(item.id,item.name,item.image);
          }catch(error){
            console.warn(`Thumbnail optimization failed for ${item.name}`,error);
            continue;
          }
        }
        const {error}=await client.from('artworks').update({thumbnail:result.url}).eq('id',item.id);
        if(error){
          await removeUploaded([result.path]);
          console.warn(`Thumbnail database update failed for ${item.name}`,error);
          continue;
        }
        optimizedCount+=1;
        const oldPath=artworkStoragePath(beforeMap.get(item.id)?.thumbnail);
        if(oldPath&&oldPath!==result.path)cleanup.push(oldPath);
      }
      await removeUploaded(cleanup);
      if(optimizedCount){
        await loadAll();
        setStatus(`Published and confirmed in Supabase · ${optimizedCount} optimized thumbnail${optimizedCount===1?'':'s'} refreshed.`,'ok');
      }
      refreshCoverage();
    };

    if(ownerPill){
      new MutationObserver(()=>{if(ownerPill.classList.contains('ok'))refreshCoverage()}).observe(ownerPill,{attributes:true,childList:true,subtree:true});
      if(ownerPill.classList.contains('ok'))refreshCoverage();
    }
  }

  if(!waitForAdmin()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(waitForAdmin()||attempts>240)clearInterval(timer);
    },25);
  }
})();
