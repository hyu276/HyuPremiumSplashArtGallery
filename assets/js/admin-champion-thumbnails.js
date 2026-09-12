(()=>{
  'use strict';

  const MAX_IMAGE_BYTES=10*1024*1024;
  const ACCEPTED=new Set(['image/jpeg','image/png','image/webp','image/gif']);
  const ADMIN_BACKEND=window.location.hostname==='hyu276.github.io'?'https://hyupremium.vercel.app/api/admin-backend':'/api/admin-backend';
  let state={catalogue:null,storageBase:'',category:'',choiceMap:{}};

  function tokenInput(){return document.querySelector('input[type="password"][placeholder^="github_pat_"]')}
  function token(){return String(tokenInput()?.value||'').trim()}
  function authHeaders(){const value=token();if(!value.startsWith('github_pat_'))throw new Error('Hãy đăng nhập dashboard bằng GitHub fine-grained token trước.');return {Authorization:`Bearer ${value}`}}
  function slug(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'champion'}
  function ext(file){return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'})[file.type]||'jpg'}
  function r2Url(key){return `${state.storageBase}/media/${key.split('/').map(encodeURIComponent).join('/')}`}
  function setStatus(text,type=''){const box=document.getElementById('champion-thumb-status');if(!box)return;box.className=`admin-status ${type}`;box.textContent=text}
  function categoryItems(category){return (state.catalogue?.items||[]).filter(item=>!item.hidden&&item.category===category)}
  function artworkPreview(item){return item?.variants?.['640']?.url||item?.thumbnail||''}
  function currentPreview(category){
    const choice=state.choiceMap[category];
    if(choice?.mode==='artwork'){const item=categoryItems(category).find(value=>value.id===choice.artworkId);return artworkPreview(item)}
    if(choice?.mode==='custom')return choice.variant?.url||choice.thumbnail||'';
    return artworkPreview(categoryItems(category)[0]);
  }
  function customUrls(choice){return choice?.mode==='custom'?[choice.image,choice.variant?.url,choice.thumbnail].filter(Boolean):[]}
  function adminDeleteUrl(mediaUrl){
    try{
      const media=new URL(mediaUrl),base=new URL(state.storageBase);
      if(media.origin!==base.origin||!media.pathname.startsWith('/media/champions/'))return '';
      const key=decodeURIComponent(media.pathname.slice('/media/'.length));
      return `${state.storageBase}/admin/media/${key.split('/').map(encodeURIComponent).join('/')}`;
    }catch{return ''}
  }
  async function cleanupOldCustom(choice,keepChoice){
    const keep=new Set(customUrls(keepChoice));
    for(const mediaUrl of new Set(customUrls(choice))){
      if(keep.has(mediaUrl))continue;
      const deleteUrl=adminDeleteUrl(mediaUrl);
      if(!deleteUrl)continue;
      try{await fetch(deleteUrl,{method:'DELETE',headers:authHeaders()})}catch{}
    }
  }

  async function backend(method,body){
    const response=await fetch(ADMIN_BACKEND,{method,headers:{...authHeaders(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Backend ${response.status}`);
    return payload;
  }

  async function load(){
    try{
      setStatus('Đang tải cấu hình thumbnail tướng...');
      const data=await backend('GET');
      state.catalogue=data.catalogue||{items:[],categories:[]};
      state.storageBase=String(data.storage?.publicBaseUrl||'').replace(/\/$/,'');
      state.choiceMap={...(state.catalogue.championThumbnails||{})};
      const available=(state.catalogue.categories||[]).filter(category=>categoryItems(category).length);
      state.category=available.includes(state.category)?state.category:(available[0]||'');
      renderControls();
      setStatus(`Đã tải ${available.length} tướng. Ảnh card công khai chỉ dùng derivative tối đa 640px.`,'ok');
    }catch(error){setStatus(error.message||'Không thể tải cấu hình thumbnail.','err')}
  }

  async function saveChoice(category,choice){
    if(!category)throw new Error('Vui lòng chọn tướng.');
    const previous=state.choiceMap[category];
    const next={...state.choiceMap};
    if(choice)next[category]=choice;else delete next[category];
    setStatus(`Đang lưu thumbnail ${category}...`);
    const result=await backend('POST',{championThumbnails:next});
    state.choiceMap=next;
    await cleanupOldCustom(previous,choice);
    setStatus(`Đã lưu ${category} (${String(result.commit||'').slice(0,7)}). Metadata sẽ kích hoạt deploy public site; admin vẫn ở GitHub Pages.`,'ok');
    setTimeout(()=>load().catch(()=>{}),1200);
  }

  async function uploadCustom(file){
    const category=state.category;
    if(!category)throw new Error('Vui lòng chọn tướng.');
    if(!file)throw new Error('Vui lòng chọn ảnh thumbnail mới.');
    if(file.size>MAX_IMAGE_BYTES)throw new Error('Ảnh vượt quá giới hạn 10 MB.');
    if(!ACCEPTED.has(file.type))throw new Error('Vui lòng dùng JPG, PNG, WebP hoặc GIF.');
    if(!state.storageBase)throw new Error('Cloudflare R2 chưa sẵn sàng.');
    const key=`champions/originals/${slug(category)}-${Date.now()}.${ext(file)}`;
    const url=`${state.storageBase}/admin/media/${key.split('/').map(encodeURIComponent).join('/')}`;
    let uploaded=false;
    try{
      setStatus(`Đang tải ảnh ${category} trực tiếp lên Cloudflare R2...`);
      const response=await fetch(url,{method:'PUT',headers:{...authHeaders(),'Content-Type':file.type},body:file});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||`R2 upload ${response.status}`);
      uploaded=true;
      await saveChoice(category,{mode:'custom',image:String(payload.url||r2Url(key))});
    }catch(error){
      if(uploaded){try{await fetch(url,{method:'DELETE',headers:authHeaders()})}catch{}}
      throw error;
    }
  }

  function renderControls(){
    const categorySelect=document.getElementById('champion-thumb-category');
    const artworkSelect=document.getElementById('champion-thumb-artwork');
    const preview=document.getElementById('champion-thumb-preview');
    if(!categorySelect||!artworkSelect||!preview)return;
    const categories=(state.catalogue?.categories||[]).filter(category=>categoryItems(category).length);
    categorySelect.innerHTML=categories.map(category=>`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    categorySelect.value=state.category;
    const items=categoryItems(state.category);
    artworkSelect.innerHTML=items.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.rank||'')}</option>`).join('');
    const choice=state.choiceMap[state.category];
    if(choice?.mode==='artwork'&&items.some(item=>item.id===choice.artworkId))artworkSelect.value=choice.artworkId;
    preview.src=currentPreview(state.category)||'';
    preview.hidden=!preview.src;
    const mode=document.getElementById('champion-thumb-mode');
    if(mode)mode.textContent=choice?.mode==='custom'?'Đang dùng ảnh upload riêng':choice?.mode==='artwork'?'Đang dùng artwork đã chọn':'Đang dùng artwork mặc định đầu tiên';
  }

  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}

  function mount(){
    if(document.getElementById('champion-thumb-panel'))return;
    const aside=document.querySelector('.admin-grid aside');
    if(!aside)return setTimeout(mount,100);
    const panel=document.createElement('section');
    panel.id='champion-thumb-panel';
    panel.className='admin-panel';
    panel.innerHTML=`
      <h2>Thumbnail trang Tướng</h2>
      <div class="admin-note">Chọn ảnh đại diện cho từng card tại <code>/champions/</code>. Artwork có sẵn tái sử dụng derivative 640px; ảnh upload riêng được lưu trực tiếp ở R2 và backend chỉ tạo một WebP tối đa 640px cho listing.</div>
      <div class="admin-actions" style="margin-top:10px"><button id="champion-thumb-load" class="admin-btn primary" type="button">Tải cấu hình tướng</button></div>
      <div class="admin-field"><label>Tướng</label><select id="champion-thumb-category" class="admin-select"></select></div>
      <img id="champion-thumb-preview" class="admin-preview" alt="Xem trước thumbnail tướng" hidden loading="lazy" decoding="async" />
      <div id="champion-thumb-mode" class="admin-note"></div>
      <div class="admin-field"><label>Chọn từ artwork cùng danh mục</label><select id="champion-thumb-artwork" class="admin-select"></select></div>
      <div class="admin-actions"><button id="champion-thumb-use-artwork" class="admin-btn primary" type="button">Dùng artwork này</button><button id="champion-thumb-default" class="admin-btn ghost" type="button">Về mặc định</button></div>
      <div class="admin-filebox" style="margin-top:12px"><input id="champion-thumb-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"/><div class="admin-note">Upload riêng: JPG, PNG, WebP hoặc GIF · tối đa 10 MB · browser → R2 trực tiếp, không proxy media qua Vercel.</div></div>
      <div class="admin-actions" style="margin-top:10px"><button id="champion-thumb-upload" class="admin-btn primary" type="button">Upload & dùng ảnh riêng</button></div>
      <div id="champion-thumb-status" class="admin-status">Đăng nhập rồi bấm “Tải cấu hình tướng”.</div>`;
    const firstPanel=aside.querySelector('.admin-panel');
    if(firstPanel?.nextSibling)aside.insertBefore(panel,firstPanel.nextSibling);else aside.appendChild(panel);

    document.getElementById('champion-thumb-load')?.addEventListener('click',load);
    document.getElementById('champion-thumb-category')?.addEventListener('change',event=>{state.category=event.target.value;renderControls()});
    document.getElementById('champion-thumb-artwork')?.addEventListener('change',event=>{const item=categoryItems(state.category).find(value=>value.id===event.target.value);const preview=document.getElementById('champion-thumb-preview');if(preview&&item){preview.src=artworkPreview(item);preview.hidden=!preview.src}});
    document.getElementById('champion-thumb-use-artwork')?.addEventListener('click',async()=>{try{const artworkId=String(document.getElementById('champion-thumb-artwork')?.value||'');if(!artworkId)throw new Error('Tướng này chưa có artwork khả dụng.');await saveChoice(state.category,{mode:'artwork',artworkId})}catch(error){setStatus(error.message||'Không thể lưu thumbnail.','err')}});
    document.getElementById('champion-thumb-default')?.addEventListener('click',async()=>{try{await saveChoice(state.category,null)}catch(error){setStatus(error.message||'Không thể đặt lại thumbnail.','err')}});
    document.getElementById('champion-thumb-upload')?.addEventListener('click',async()=>{try{const input=document.getElementById('champion-thumb-file');await uploadCustom(input?.files?.[0]||null);if(input)input.value=''}catch(error){setStatus(error.message||'Không thể upload thumbnail.','err')}});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
