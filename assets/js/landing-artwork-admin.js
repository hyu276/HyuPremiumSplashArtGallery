(() => {
  'use strict';
  const repo = 'hyu276/HyuPremiumSplashArtGallery';
  const branch = 'content/landing-artwork';
  const filePath = 'landing/content/artworks.json';
  const api = `https://api.github.com/repos/${repo}`;
  const catalogueUrl = `https://raw.githubusercontent.com/${repo}/main/data/backend/catalogue.json`;
  const draftKey = 'hyu_landing_artwork_draft_v1';
  const derivativePattern = /^https:\/\/hyu-premium-media\.csquocnguyen\.workers\.dev\/media\/artworks\/variants\/[a-z0-9-]+-(?:640|960|1600)\.webp$/;
  const slots = [
    ['hero','Hero','Mở đầu',true],['ebook-cta','CTA nhận ebook','Mở đầu',false],['gallery-cta','CTA gallery','Mở đầu',false],
    ['about-background','Nền giới thiệu','Không chỉ là một bộ trang phục',true],['about-idea','Ý tưởng','Không chỉ là một bộ trang phục',false],['about-design','Thiết kế nhân vật','Không chỉ là một bộ trang phục',false],['about-art','Splash art','Không chỉ là một bộ trang phục',false],
    ['concepts-background','Nền concept','Một nhân vật. Nhiều thế giới',true],['concept-mythic','Thần thoại','Một nhân vật. Nhiều thế giới',false],['concept-dream','Mộng tưởng','Một nhân vật. Nhiều thế giới',false],['concept-cosmic','Vũ trụ','Một nhân vật. Nhiều thế giới',false],['concept-fantasy','Fantasy','Một nhân vật. Nhiều thế giới',false],
    ['works-background','Nền gallery','Splash art gallery',true],['work-1','Tác phẩm 1','Splash art gallery',false],['work-2','Tác phẩm 2','Splash art gallery',false],['work-3','Tác phẩm 3','Splash art gallery',false],
    ['process-background','Nền quy trình','Quy trình sáng tạo',true]
  ];
  const byId = id => document.getElementById(id);
  let token = '';
  let user = '';
  let sha = '';
  let published = null;
  let working = null;
  let selected = slots[0][0];
  let mode = 'desktop';
  let catalogue = null;
  const landingOrigin = 'https://hyupremium.netlify.app';
  let liveMode = 'desktop';
  let liveReady = false;
  let previewFrame = 0;
  let drag = null;

  function status(message, error = false) {
    byId('status').textContent = message;
    byId('status').classList.toggle('error', error);
  }
  function decodeBase64(value) {
    const bytes = Uint8Array.from(atob(value.replace(/\s/g, '')), char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
  }
  async function github(url, options = {}) {
    const response = await fetch(url, {
      ...options, cache:'no-store',
      headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:`Bearer ${token}`,...options.headers}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if ([401,403].includes(response.status)) throw new Error('Token không hợp lệ hoặc thiếu quyền Contents: Read and write.');
      if ([409,422].includes(response.status)) throw new Error('Cấu hình trên GitHub đã thay đổi. Bản nháp còn giữ; hãy tải lại trang trước khi xuất bản.');
      throw new Error(`GitHub trả về ${response.status}: ${body.message || 'không thể xử lý yêu cầu'}`);
    }
    return body;
  }
  const contentsUrl = () => `${api}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
  function validate(config) {
    if (config?.version !== 1 || !config.slots) throw new Error('Định dạng cấu hình artwork không hợp lệ.');
    for (const [id] of slots) {
      const item = config.slots[id];
      if (!item || !derivativePattern.test(item.src)) throw new Error(`Ảnh ${id} phải là derivative WebP 640/960/1600 từ R2.`);
      for (const viewport of ['desktop','mobile']) {
        if (!item[viewport] || !['x','y'].every(axis => Number.isFinite(item[viewport][axis]) && item[viewport][axis] >= 0 && item[viewport][axis] <= 100)) throw new Error(`Crop ${viewport} không hợp lệ: ${id}.`);
      }
      if (!Number.isFinite(item.zoom) || item.zoom < 1 || item.zoom > 1.5 || !Number.isFinite(item.dim) || item.dim < 0 || item.dim > 1) throw new Error(`Hiệu ứng không hợp lệ: ${id}.`);
    }
    return config;
  }
  async function readConfig() {
    const file = await github(contentsUrl());
    const config = validate(JSON.parse(decodeBase64(file.content)));
    return {config, sha:file.sha};
  }
  function changed() { return JSON.stringify(working) !== JSON.stringify(published); }
  function refreshDirty() {
    const dirty = changed();
    byId('dirtyLabel').textContent = dirty ? 'Có thay đổi chưa xuất bản.' : 'Không có thay đổi.';
    byId('publishButton').disabled = !dirty;
  }
  function renderSlots() {
    const q = byId('slotSearch').value.trim().toLowerCase();
    const list = byId('slotList');
    list.replaceChildren();
    for (const [id,label,group] of slots) {
      if (!`${label} ${group}`.toLowerCase().includes(q)) continue;
      const button = document.createElement('button');
      button.type='button'; button.setAttribute('aria-current',id === selected ? 'true' : 'false');
      button.textContent=label;
      const caption=document.createElement('small'); caption.textContent=group; button.append(caption);
      button.addEventListener('click', () => { selected=id; renderSlots(); renderEditor(); queueLivePreview(); });
      list.append(button);
    }
  }
  function renderEditor() {
    const meta = slots.find(([id]) => id === selected);
    const item = working.slots[selected];
    byId('slotTitle').textContent=meta[1]; byId('slotGroup').textContent=meta[2].toUpperCase();
    byId('previewLabel').textContent=meta[1]; byId('imageUrl').value=item.src;
    for (const key of ['desktopX','desktopY','mobileX','mobileY','zoom','dim']) {
      const value=key === 'zoom' || key === 'dim' ? item[key] : item[key.startsWith('desktop') ? 'desktop' : 'mobile'][key.at(-1).toLowerCase()];
      byId(key).value=String(value);
      byId(`${key}Value`).textContent=key === 'zoom' ? `${Math.round(value*100)}%` : key === 'dim' ? `${Math.round(value*100)}%` : `${value}%`;
    }
    renderPreview();
  }
  function renderPreview() {
    const item=working.slots[selected];
    const crop=item[mode];
    const image=byId('previewImage');
    if (derivativePattern.test(item.src) && image.src !== item.src) image.src=item.src;
    image.style.objectPosition=`${crop.x}% ${crop.y}%`;
    image.style.transformOrigin=`${crop.x}% ${crop.y}%`;
    image.style.transform=`scale(${item.zoom})`;
    byId('previewDim').style.opacity=String(item.dim);
    byId('preview').classList.toggle('mobile',mode === 'mobile');
  }
  function updateRange(event) {
    const key=event.target.id, value=Number(event.target.value), item=working.slots[selected];
    if (key === 'zoom' || key === 'dim') item[key]=value;
    else item[key.startsWith('desktop') ? 'desktop' : 'mobile'][key.at(-1).toLowerCase()]=value;
    renderEditor(); refreshDirty(); queueLivePreview();
  }
  function queueLivePreview() {
    if (!working || !liveReady || previewFrame) return;
    previewFrame=requestAnimationFrame(() => {
      previewFrame=0;
      byId('liveFrame').contentWindow?.postMessage({type:'hyu-artwork-preview',version:1,config:working,slot:selected},landingOrigin);
    });
  }
  function resizeLivePreview() {
    const stage=byId('liveStage'), viewport=byId('liveViewport');
    const width=liveMode==='desktop'?1280:390, height=liveMode==='desktop'?850:844;
    const scale=Math.min(1,(stage.clientWidth-2)/width);
    viewport.style.width=`${width}px`; viewport.style.height=`${height}px`;
    viewport.style.transform=`scale(${scale})`;
    stage.style.height=`${Math.round(height*scale)+2}px`;
  }
  function setViewportMode(next) {
    mode=next;liveMode=next;
    document.querySelectorAll('.preview-mode button').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.mode||button.dataset.liveMode)===next)));
    renderPreview();resizeLivePreview();queueLivePreview();
  }
  function dragPreview(event) {
    if (event.button !== 0 || !working) return;
    const image=byId('previewImage'), box=byId('preview');
    if (!image.naturalWidth || !image.naturalHeight) return;
    const crop=working.slots[selected][mode];
    drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,cropX:crop.x,cropY:crop.y,slot:selected,mode};
    box.setPointerCapture(event.pointerId);box.classList.add('is-dragging');event.preventDefault();
  }
  function movePreview(event) {
    if (!drag || event.pointerId!==drag.pointer || selected!==drag.slot || mode!==drag.mode) return;
    const box=byId('preview'),image=byId('previewImage'),item=working.slots[selected];
    const width=box.clientWidth,height=box.clientHeight;
    const cover=Math.max(width/image.naturalWidth,height/image.naturalHeight);
    const overflowX=item.zoom*image.naturalWidth*cover-width;
    const overflowY=item.zoom*image.naturalHeight*cover-height;
    const clamp=value=>Math.round(Math.max(0,Math.min(100,value)));
    const crop=item[mode];
    if (overflowX>1) crop.x=clamp(drag.cropX-(event.clientX-drag.x)*100/overflowX);
    if (overflowY>1) crop.y=clamp(drag.cropY-(event.clientY-drag.y)*100/overflowY);
    renderEditor();refreshDirty();queueLivePreview();
  }
  function endPreview(event) {
    if (!drag || event.pointerId!==drag.pointer) return;
    byId('preview').classList.remove('is-dragging');drag=null;
  }
  function saveDraft() {
    try {
      localStorage.setItem(draftKey,JSON.stringify({sha,config:working}));
      status('Bản nháp đã lưu trên thiết bị này. Chưa thay đổi website Netlify.');
    } catch { status('Trình duyệt không thể lưu bản nháp. Giữ tab này mở để không mất thay đổi.',true); }
  }
  function restoreDraft() {
    try {
      const saved=JSON.parse(localStorage.getItem(draftKey)||'null');
      if (!saved) return;
      if (saved.sha !== sha) { status('Có bản nháp cũ nhưng dữ liệu GitHub đã đổi. Bản nháp được giữ trên thiết bị; chưa tự ghi đè.',true); return; }
      working=validate(saved.config);
      status('Đã khôi phục bản nháp trên thiết bị. Kiểm tra trước khi xuất bản.');
    } catch { status('Không thể đọc bản nháp đã lưu.',true); }
  }
  async function signIn(event) {
    event.preventDefault();
    const candidate=byId('tokenInput').value.trim();
    if (!candidate.startsWith('github_pat_')) return status('Cần fine-grained GitHub token bắt đầu bằng github_pat_.',true);
    token=candidate; status('Đang xác minh tài khoản và tải cấu hình…');
    try {
      const profile=await github('https://api.github.com/user');
      if (profile.login !== 'hyu276') throw new Error('Chỉ chủ sở hữu @hyu276 được quản lý landing.');
      const result=await readConfig();
      user=profile.login; sha=result.sha; published=result.config; working=structuredClone(result.config);
      byId('tokenInput').value=''; byId('loginPanel').hidden=true; byId('editor').hidden=false;
      byId('accountLabel').textContent=`Đã đăng nhập: @${user}`;
      restoreDraft(); renderSlots(); renderEditor(); refreshDirty();
      resizeLivePreview();queueLivePreview();
      if (!changed()) status('Đã tải cấu hình artwork từ GitHub.');
    } catch (error) { token=''; status(error.message || 'Không thể đăng nhập.',true); }
  }
  function signOut() {
    if (changed() && !confirm('Thay đổi chưa xuất bản. Đăng xuất?')) return;
    token=''; user=''; sha=''; published=null; working=null; catalogue=null;
    byId('editor').hidden=true; byId('picker').hidden=true; byId('loginPanel').hidden=false;
    byId('tokenInput').value=''; status('Đã đăng xuất khỏi tab.');
  }
  async function publish() {
    try {
      validate(working);
      if (!changed()) return status('Không có thay đổi để xuất bản.');
      const button=byId('publishButton'); button.disabled=true;
      status('Đang lưu một bản cập nhật cấu hình lên GitHub…');
      const serialized=JSON.stringify(working,null,2)+'\n';
      await github(`${api}/contents/${filePath}`,{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:'content: update Netlify landing artwork',content:encodeBase64(serialized),sha,branch})
      });
      const verified=await readConfig();
      if (JSON.stringify(verified.config)!==JSON.stringify(working)) throw new Error('GitHub chưa xác nhận đúng dữ liệu vừa ghi. Giữ bản nháp và kiểm tra lại.');
      sha=verified.sha; published=structuredClone(verified.config); working=structuredClone(verified.config);
      localStorage.removeItem(draftKey); refreshDirty();
      status('Đã xác minh cấu hình mới trên GitHub. Mở lại landing để xem; bộ đệm có thể cần vài phút.');
    } catch (error) { status((error.message||'Không thể xuất bản.')+' Bản nháp vẫn còn trong tab.',true); refreshDirty(); }
  }
  async function openPicker() {
    byId('picker').hidden=false; byId('gallerySearch').focus();
    if (catalogue) return renderPicker();
    byId('pickerResults').textContent='Đang tải danh sách gallery…';
    try {
      const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),12000);
      let response;
      try { response=await fetch(catalogueUrl,{cache:'no-store',signal:controller.signal}); }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`Catalogue ${response.status}`);
      const data=await response.json(); catalogue=(data.items||[]).filter(item=>!item.hidden);
      renderPicker();
    } catch { byId('pickerResults').textContent='Không tải được catalogue. Bạn vẫn có thể dán URL derivative R2 vào trường bên trên.'; }
  }
  function renderPicker() {
    const q=byId('gallerySearch').value.trim().toLowerCase();
    const results=byId('pickerResults'); results.replaceChildren();
    const large=slots.find(([id])=>id===selected)[3];
    let shown=0;
    for (const item of catalogue) {
      if (shown>=36) break;
      if (!`${item.name} ${item.category}`.toLowerCase().includes(q)) continue;
      const image=item.variants?.[large?'1600':'960']?.url;
      if (!derivativePattern.test(image||'')) continue;
      const button=document.createElement('button');button.type='button';
      const thumb=document.createElement('img');thumb.src=item.variants?.['640']?.url||image;thumb.alt='';thumb.loading='lazy';
      const caption=document.createElement('span');caption.textContent=item.name;
      const category=document.createElement('small');category.textContent=item.category;caption.append(category);
      button.append(thumb,caption);
      button.addEventListener('click',()=>{working.slots[selected].src=image;renderEditor();refreshDirty();queueLivePreview();byId('picker').hidden=true;status(`Đã chọn ${item.name}. Bấm Xuất bản để cập nhật Netlify.`);});
      results.append(button);shown++;
    }
    if (!shown) results.textContent='Không có artwork phù hợp.';
  }

  byId('loginForm').addEventListener('submit',signIn);
  byId('logoutButton').addEventListener('click',signOut);
  byId('slotSearch').addEventListener('input',renderSlots);
  byId('gallerySearch').addEventListener('input',()=>catalogue&&renderPicker());
  byId('openPicker').addEventListener('click',openPicker);
  byId('closePicker').addEventListener('click',()=>{byId('picker').hidden=true;});
  byId('saveDraft').addEventListener('click',saveDraft);
  byId('publishButton').addEventListener('click',publish);
  byId('imageUrl').addEventListener('change',event=>{const src=event.target.value.trim();if(!derivativePattern.test(src))return status('Chỉ dùng URL derivative WebP 640/960/1600 trên R2. Chọn từ gallery để lấy URL hợp lệ.',true);working.slots[selected].src=src;renderPreview();refreshDirty();queueLivePreview();});
  document.querySelectorAll('.controls input').forEach(input=>input.addEventListener('input',updateRange));
  document.querySelectorAll('[data-mode], [data-live-mode]').forEach(button=>button.addEventListener('click',()=>setViewportMode(button.dataset.mode||button.dataset.liveMode)));
  byId('preview').addEventListener('pointerdown',dragPreview);
  byId('preview').addEventListener('pointermove',movePreview);
  byId('preview').addEventListener('pointerup',endPreview);
  byId('preview').addEventListener('pointercancel',endPreview);
  byId('liveFrame').addEventListener('load',()=>{setTimeout(()=>{if(!liveReady)byId('liveStatus').textContent='Không thể mở preview. Kiểm tra bản deploy Netlify và tải lại trang.';},5000);});
  window.addEventListener('message',event=>{if(event.origin===landingOrigin && event.source===byId('liveFrame').contentWindow && event.data?.type==='hyu-artwork-preview-ready'){liveReady=true;byId('liveStatus').textContent='Bản nháp trong bố cục landing · chưa xuất bản';queueLivePreview();}});
  new ResizeObserver(resizeLivePreview).observe(byId('liveStage'));
  window.addEventListener('beforeunload',event=>{if(working&&changed()){event.preventDefault();event.returnValue='';}});
})();
