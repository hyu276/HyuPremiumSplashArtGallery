(function(){
  'use strict';

  const KEEP_NAME_KEY='hyu_admin_keep_name';
  const IDLE_TIMEOUT_MS=15*60*1000;
  const MAX_TEAM_IMAGE_BYTES=10*1024*1024;
  let cloneSourceId=null;
  let idleTimer=0;
  let teamRows=[];
  let teamLoaded=false;
  let teamLoading=false;
  let teamSelectedFile=null;
  let teamPreviewUrl=null;

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  ready(()=>{
    const nameInput=document.querySelector('#name');
    const applyButton=document.querySelector('#apply');
    const clearButton=document.querySelector('#clear');
    const editingInput=document.querySelector('#editingId');
    const imageInput=document.querySelector('#image');
    const imageFile=document.querySelector('#imageFile');
    const preview=document.querySelector('#preview');
    const fileNote=document.querySelector('#fileNote');
    const formTitle=document.querySelector('#formTitle');
    const list=document.querySelector('#list');
    const emailInput=document.querySelector('#email');
    const passwordInput=document.querySelector('#password');
    const loginButton=document.querySelector('#login');
    const logoutButton=document.querySelector('#logout');
    const ownerPill=document.querySelector('#ownerPill');
    const openGallery=document.querySelector('.top-actions a[target="_blank"]');
    if(!nameInput||!applyButton||!editingInput||!list)return;

    if(location.search||location.hash){
      try{history.replaceState(null,'',location.pathname)}catch{}
    }

    if(emailInput){
      emailInput.autocomplete='off';
      emailInput.autocapitalize='none';
      emailInput.spellcheck=false;
    }
    if(passwordInput)passwordInput.autocomplete='off';
    if(openGallery)openGallery.rel='noopener noreferrer';

    loginButton?.addEventListener('click',()=>{
      setTimeout(()=>{if(passwordInput)passwordInput.value=''},0);
    },true);

    logoutButton?.addEventListener('click',()=>{
      if(emailInput)emailInput.value='';
      if(passwordInput)passwordInput.value='';
      try{window.HYU_CLEAR_LEGACY_SUPABASE_AUTH?.()}catch{}
      clearTimeout(idleTimer);
      teamLoaded=false;
      teamRows=[];
      renderTeamList();
      setTeamStatus('Sign in to manage the About Us team section.');
    },true);

    const style=document.createElement('style');
    style.textContent=`
      .keep-name-option{display:flex!important;align-items:center;justify-content:flex-start!important;gap:8px!important;margin:7px 0 0!important;color:var(--muted)!important;font-size:11px!important;cursor:pointer;user-select:none}
      .keep-name-option input{width:15px;height:15px;margin:0;accent-color:var(--accent)}
      .btn.clone{color:#b9ecff;border-color:#315766;background:#10202a}
      .team-admin-note{font-size:11px;color:var(--muted);margin:-3px 0 11px}
      .team-admin-preview{width:100%;aspect-ratio:1;object-fit:cover;border:1px solid var(--line);border-radius:7px;background:#080a0c;margin:4px 0 10px;max-height:320px}
      .team-admin-check{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:7px!important;margin:6px 0 0!important;color:var(--muted)!important;font-size:11px!important;cursor:pointer}
      .team-admin-check input{width:14px;height:14px;margin:0;accent-color:var(--accent)}
      .team-social-admin{display:grid;gap:8px;margin:9px 0 12px}.team-social-admin .field{margin:0}
      .team-social-line{display:grid;grid-template-columns:90px minmax(0,1fr) auto;gap:7px;align-items:center}.team-social-line>strong{font-size:10px;color:#aab5be;text-transform:uppercase;letter-spacing:.08em}.team-social-line .input{height:36px}.team-social-line label{margin:0!important;white-space:nowrap}
      .team-admin-list{display:grid;gap:6px;margin-top:11px}.team-admin-item{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid #212832;background:#0d1115;border-radius:7px;padding:6px}.team-admin-item.is-hidden{opacity:.55;border-style:dashed}.team-admin-thumb{width:58px;height:58px;object-fit:cover;border-radius:5px;background:#07090b}.team-admin-title{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.team-admin-meta{font-size:10px;color:var(--muted);margin-top:2px}.team-admin-empty{padding:18px;border:1px dashed var(--line);border-radius:7px;color:var(--muted);font-size:11px;text-align:center}
      @media(max-width:520px){.team-social-line{grid-template-columns:1fr}.team-social-line>strong{margin-top:4px}.team-social-line label{margin-bottom:5px!important}}
    `;
    document.head.appendChild(style);

    const nameField=nameInput.closest('.field');
    const keepLabel=document.createElement('label');
    keepLabel.className='keep-name-option';
    keepLabel.innerHTML='<input type="checkbox" id="keepNameAfterAdd"> <span>Keep Name for next artwork</span>';
    nameField?.appendChild(keepLabel);
    const keepName=document.querySelector('#keepNameAfterAdd');
    if(keepName){
      try{keepName.checked=sessionStorage.getItem(KEEP_NAME_KEY)==='1'}catch{}
      keepName.addEventListener('change',()=>{try{sessionStorage.setItem(KEEP_NAME_KEY,keepName.checked?'1':'0')}catch{}});
    }

    const choicePanel=document.querySelector('#rankChoices')?.closest('.panel');
    const teamPanel=document.createElement('section');
    teamPanel.className='panel';
    teamPanel.id='teamAdminPanel';
    teamPanel.innerHTML=`
      <h2>About Us / Our Team</h2>
      <div class="team-admin-note">Team changes save directly to Supabase. Hidden members and hidden social icons are not shown publicly.</div>
      <input id="teamMemberId" type="hidden">
      <img id="teamPreview" class="team-admin-preview" alt="Team member preview">
      <div class="row">
        <div class="field"><label>Name</label><input class="input" id="teamName" placeholder="Team member name"></div>
        <div class="field"><label>Order <span>lower = earlier</span></label><input class="input" id="teamOrder" type="number" min="0" step="1" value="0"></div>
      </div>
      <label class="team-admin-check"><input type="checkbox" id="teamHidden"> Hide this member from About Us</label>
      <div class="field" style="margin-top:9px"><label>Image URL <span>or upload below</span></label><input class="input" id="teamImage" placeholder="https://..."></div>
      <div class="filebox"><input id="teamImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><div class="file-note" id="teamFileNote">Upload a square portrait when possible (max 10 MB). Files publish to the Supabase team bucket.</div></div>
      <div class="team-social-admin">
        <div class="team-social-line"><strong>Facebook</strong><input class="input" id="teamFacebook" placeholder="https://facebook.com/..."><label class="team-admin-check"><input type="checkbox" id="teamFacebookHidden"> Hide icon</label></div>
        <div class="team-social-line"><strong>TikTok</strong><input class="input" id="teamTiktok" placeholder="https://tiktok.com/@..."><label class="team-admin-check"><input type="checkbox" id="teamTiktokHidden"> Hide icon</label></div>
        <div class="team-social-line"><strong>Instagram</strong><input class="input" id="teamInstagram" placeholder="https://instagram.com/..."><label class="team-admin-check"><input type="checkbox" id="teamInstagramHidden"> Hide icon</label></div>
        <div class="team-social-line"><strong>X</strong><input class="input" id="teamX" placeholder="https://x.com/..."><label class="team-admin-check"><input type="checkbox" id="teamXHidden"> Hide icon</label></div>
        <div class="team-social-line"><strong>LinkedIn</strong><input class="input" id="teamLinkedin" placeholder="https://linkedin.com/in/..."><label class="team-admin-check"><input type="checkbox" id="teamLinkedinHidden"> Hide icon</label></div>
      </div>
      <div class="actions"><button class="btn primary" id="teamSave">Add team member</button><button class="btn ghost" id="teamClear">Clear</button><button class="btn" id="teamReload">Reload team</button></div>
      <div class="status" id="teamStatus">Sign in to manage the About Us team section.</div>
      <div class="team-admin-list" id="teamAdminList"></div>
    `;
    if(choicePanel)choicePanel.insertAdjacentElement('afterend',teamPanel);
    else document.querySelector('aside')?.appendChild(teamPanel);

    const teamEls={
      id:document.querySelector('#teamMemberId'),preview:document.querySelector('#teamPreview'),name:document.querySelector('#teamName'),order:document.querySelector('#teamOrder'),hidden:document.querySelector('#teamHidden'),image:document.querySelector('#teamImage'),file:document.querySelector('#teamImageFile'),fileNote:document.querySelector('#teamFileNote'),save:document.querySelector('#teamSave'),clear:document.querySelector('#teamClear'),reload:document.querySelector('#teamReload'),status:document.querySelector('#teamStatus'),list:document.querySelector('#teamAdminList'),
      facebook:document.querySelector('#teamFacebook'),facebookHidden:document.querySelector('#teamFacebookHidden'),tiktok:document.querySelector('#teamTiktok'),tiktokHidden:document.querySelector('#teamTiktokHidden'),instagram:document.querySelector('#teamInstagram'),instagramHidden:document.querySelector('#teamInstagramHidden'),x:document.querySelector('#teamX'),xHidden:document.querySelector('#teamXHidden'),linkedin:document.querySelector('#teamLinkedin'),linkedinHidden:document.querySelector('#teamLinkedinHidden')
    };

    function setTeamStatus(message,type=''){
      if(!teamEls.status)return;
      teamEls.status.textContent=message;
      teamEls.status.className='status '+type;
    }

    function teamStoragePath(url){
      const m=String(url||'').match(/\/storage\/v1\/object\/public\/team\/(.+)$/);
      return m?decodeURIComponent(m[1]):'';
    }

    function revokeTeamPreview(){
      if(teamPreviewUrl){URL.revokeObjectURL(teamPreviewUrl);teamPreviewUrl=null}
    }

    function resetTeamForm(){
      revokeTeamPreview();
      teamSelectedFile=null;
      if(teamEls.id)teamEls.id.value='';
      if(teamEls.name)teamEls.name.value='';
      if(teamEls.order)teamEls.order.value=String(teamRows.length?Math.max(...teamRows.map(x=>Number(x.sort_order)||0))+1:0);
      if(teamEls.hidden)teamEls.hidden.checked=false;
      if(teamEls.image)teamEls.image.value='';
      if(teamEls.file)teamEls.file.value='';
      if(teamEls.fileNote)teamEls.fileNote.textContent='Upload a square portrait when possible (max 10 MB). Files publish to the Supabase team bucket.';
      if(teamEls.preview)teamEls.preview.removeAttribute('src');
      for(const key of ['facebook','tiktok','instagram','x','linkedin']){
        if(teamEls[key])teamEls[key].value='';
        if(teamEls[`${key}Hidden`])teamEls[`${key}Hidden`].checked=false;
      }
      if(teamEls.save)teamEls.save.textContent='Add team member';
    }

    function renderTeamList(){
      if(!teamEls.list)return;
      if(!teamRows.length){
        teamEls.list.innerHTML='<div class="team-admin-empty">No team members loaded.</div>';
        return;
      }
      teamEls.list.innerHTML=teamRows.map(member=>`<div class="team-admin-item${member.hidden?' is-hidden':''}"><img class="team-admin-thumb" src="${esc(member.image||'')}" alt=""><div><div class="team-admin-title">${esc(member.name)}</div><div class="team-admin-meta">Order ${Number(member.sort_order)||0} · ${member.hidden?'Hidden':'Visible'}</div></div><div class="controls"><button class="btn small" data-team-edit="${member.id}">Edit</button><button class="btn small visibility${member.hidden?' hidden':''}" data-team-toggle="${member.id}">${member.hidden?'Unhide':'Hide'}</button></div></div>`).join('');
    }

    function migrationMissing(error){
      const text=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();
      return text.includes('team_members')&&(text.includes('does not exist')||text.includes('schema cache')||text.includes('relation')||text.includes('pgrst205'));
    }

    async function loadTeamMembers(){
      if(teamLoading||!client)return;
      if(!ownerPill?.classList.contains('ok'))return;
      teamLoading=true;
      setTeamStatus('Loading team members from Supabase...');
      try{
        const {data,error}=await client.from('team_members').select('*').order('sort_order',{ascending:true}).order('id',{ascending:true});
        if(error)throw error;
        teamRows=data||[];
        teamLoaded=true;
        renderTeamList();
        resetTeamForm();
        setTeamStatus(`Loaded ${teamRows.length} team member${teamRows.length===1?'':'s'}.`,'ok');
      }catch(error){
        teamLoaded=false;
        teamRows=[];
        renderTeamList();
        if(migrationMissing(error))setTeamStatus('Team database is not installed yet. Run supabase/team-section.sql once in Supabase SQL Editor.','warn');
        else setTeamStatus(error.message||'Unable to load team members.','err');
      }finally{teamLoading=false}
    }

    function normalizeSocialUrl(value,label){
      const raw=String(value||'').trim();
      if(!raw)return '';
      try{
        const url=new URL(raw);
        if(!/^https?:$/.test(url.protocol))throw new Error();
        return url.href;
      }catch{throw new Error(`${label} must be a valid http(s) URL.`)}
    }

    function teamFileExt(file){
      return {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type]||'jpg';
    }

    async function saveTeamMember(){
      try{
        await ensureAdmin();
        const id=teamEls.id?.value||'';
        const old=id?teamRows.find(x=>String(x.id)===String(id)):null;
        const memberName=teamEls.name?.value.trim()||'';
        if(!memberName)throw new Error('Team member Name is required.');
        const order=Math.max(0,Number.parseInt(teamEls.order?.value||'0',10)||0);
        let image=teamEls.image?.value.trim()||old?.image||'';
        if(!image&&!teamSelectedFile)throw new Error('Team member image URL or image file is required.');

        const payload={
          name:memberName,
          sort_order:order,
          hidden:Boolean(teamEls.hidden?.checked),
          image,
          facebook_url:normalizeSocialUrl(teamEls.facebook?.value,'Facebook'),facebook_hidden:Boolean(teamEls.facebookHidden?.checked),
          tiktok_url:normalizeSocialUrl(teamEls.tiktok?.value,'TikTok'),tiktok_hidden:Boolean(teamEls.tiktokHidden?.checked),
          instagram_url:normalizeSocialUrl(teamEls.instagram?.value,'Instagram'),instagram_hidden:Boolean(teamEls.instagramHidden?.checked),
          x_url:normalizeSocialUrl(teamEls.x?.value,'X'),x_hidden:Boolean(teamEls.xHidden?.checked),
          linkedin_url:normalizeSocialUrl(teamEls.linkedin?.value,'LinkedIn'),linkedin_hidden:Boolean(teamEls.linkedinHidden?.checked)
        };

        let uploadedPath='';
        if(teamSelectedFile){
          uploadedPath=`members/${slug(memberName)||'member'}-${Date.now()}.${teamFileExt(teamSelectedFile)}`;
          setTeamStatus(`Uploading ${teamSelectedFile.name}...`);
          const {error:uploadError}=await client.storage.from('team').upload(uploadedPath,teamSelectedFile,{upsert:false,contentType:teamSelectedFile.type});
          if(uploadError)throw uploadError;
          const {data}=client.storage.from('team').getPublicUrl(uploadedPath);
          payload.image=data.publicUrl;
        }

        setTeamStatus(id?'Updating team member...':'Adding team member...');
        const result=id
          ?await client.from('team_members').update(payload).eq('id',id).select('*').single()
          :await client.from('team_members').insert(payload).select('*').single();
        if(result.error){
          if(uploadedPath)await client.storage.from('team').remove([uploadedPath]).catch(()=>{});
          throw result.error;
        }

        if(old?.image&&old.image!==payload.image){
          const oldPath=teamStoragePath(old.image);
          if(oldPath)await client.storage.from('team').remove([oldPath]).catch(()=>{});
        }
        teamSelectedFile=null;
        await loadTeamMembers();
        setTeamStatus(id?'Team member updated. Public About Us is live from Supabase.':'Team member added. Public About Us is live from Supabase.','ok');
      }catch(error){setTeamStatus(error.message||'Unable to save team member.','err')}
    }

    function editTeamMember(id){
      const member=teamRows.find(x=>String(x.id)===String(id));
      if(!member)return;
      revokeTeamPreview();
      teamSelectedFile=null;
      teamEls.id.value=member.id;
      teamEls.name.value=member.name||'';
      teamEls.order.value=String(Number(member.sort_order)||0);
      teamEls.hidden.checked=Boolean(member.hidden);
      teamEls.image.value=member.image||'';
      teamEls.file.value='';
      teamEls.fileNote.textContent='Keep the current image, enter another URL, or upload a replacement.';
      teamEls.preview.src=member.image||'';
      for(const key of ['facebook','tiktok','instagram','x','linkedin']){
        teamEls[key].value=member[`${key}_url`]||'';
        teamEls[`${key}Hidden`].checked=Boolean(member[`${key}_hidden`]);
      }
      teamEls.save.textContent='Update team member';
      teamPanel.scrollIntoView({behavior:'smooth',block:'start'});
      setTeamStatus(`Editing ${member.name}.`,'ok');
    }

    async function toggleTeamMember(id){
      const member=teamRows.find(x=>String(x.id)===String(id));
      if(!member)return;
      try{
        await ensureAdmin();
        const hidden=!Boolean(member.hidden);
        const {error}=await client.from('team_members').update({hidden}).eq('id',member.id);
        if(error)throw error;
        await loadTeamMembers();
        setTeamStatus(`${member.name} is now ${hidden?'hidden':'visible'} on About Us.`,'ok');
      }catch(error){setTeamStatus(error.message||'Unable to change team visibility.','err')}
    }

    teamEls.image?.addEventListener('input',event=>{
      if(teamSelectedFile)return;
      const value=event.target.value.trim();
      if(value)teamEls.preview.src=value;
      else teamEls.preview.removeAttribute('src');
    });

    teamEls.file?.addEventListener('change',event=>{
      revokeTeamPreview();
      teamSelectedFile=event.target.files?.[0]||null;
      if(!teamSelectedFile)return;
      if(teamSelectedFile.size>MAX_TEAM_IMAGE_BYTES){teamSelectedFile=null;event.target.value='';return setTeamStatus('Team image exceeds 10 MB.','err')}
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(teamSelectedFile.type)){teamSelectedFile=null;event.target.value='';return setTeamStatus('Use JPG, PNG, WebP or GIF for team images.','err')}
      teamPreviewUrl=URL.createObjectURL(teamSelectedFile);
      teamEls.preview.src=teamPreviewUrl;
      teamEls.fileNote.textContent=`Selected: ${teamSelectedFile.name} · ${(teamSelectedFile.size/1024/1024).toFixed(2)} MB`;
    });

    teamEls.save?.addEventListener('click',saveTeamMember);
    teamEls.clear?.addEventListener('click',()=>{resetTeamForm();setTeamStatus(teamLoaded?'Form cleared.':'Sign in to manage the About Us team section.');});
    teamEls.reload?.addEventListener('click',()=>{teamLoaded=false;loadTeamMembers()});
    teamEls.list?.addEventListener('click',event=>{
      const edit=event.target.closest('[data-team-edit]');
      if(edit)return editTeamMember(edit.dataset.teamEdit);
      const toggle=event.target.closest('[data-team-toggle]');
      if(toggle)toggleTeamMember(toggle.dataset.teamToggle);
    });
    renderTeamList();
    resetTeamForm();

    const syncOwnerPrivacy=()=>{
      if(!ownerPill)return;
      if(ownerPill.classList.contains('ok')){
        if(emailInput)emailInput.value='';
        if(ownerPill.textContent!=='Signed in: owner')ownerPill.textContent='Signed in: owner';
        armIdleLogout();
        if(!teamLoaded&&!teamLoading)loadTeamMembers();
      }
    };
    if(ownerPill){
      new MutationObserver(syncOwnerPrivacy).observe(ownerPill,{attributes:true,childList:true,subtree:true,characterData:true});
      syncOwnerPrivacy();
    }

    function armIdleLogout(){
      clearTimeout(idleTimer);
      if(!ownerPill?.classList.contains('ok'))return;
      idleTimer=setTimeout(()=>{
        if(!ownerPill?.classList.contains('ok'))return;
        logoutButton?.click();
        setTimeout(()=>{try{setStatus('Signed out automatically after 15 minutes of inactivity.','warn')}catch{}},50);
      },IDLE_TIMEOUT_MS);
    }
    for(const eventName of ['pointerdown','keydown','touchstart','scroll'])window.addEventListener(eventName,armIdleLogout,{passive:true});
    window.addEventListener('pagehide',()=>{
      clearTimeout(idleTimer);
      revokeTeamPreview();
      if(emailInput)emailInput.value='';
      if(passwordInput)passwordInput.value='';
      try{window.HYU_CLEAR_LEGACY_SUPABASE_AUTH?.()}catch{}
    });

    function getItem(id){
      try{return items.find(x=>String(x.id)===String(id))||null}catch{return null}
    }

    function getStoragePath(url){
      try{return storagePathFromUrl(url)}catch{return null}
    }

    function enhanceList(){
      list.querySelectorAll('.controls').forEach(controls=>{
        if(controls.querySelector('[data-clone]'))return;
        const edit=controls.querySelector('[data-edit]');
        if(!edit)return;
        const clone=document.createElement('button');
        clone.type='button';
        clone.className='btn small clone';
        clone.dataset.clone=edit.dataset.edit;
        clone.textContent='Clone';
        clone.title='Clone this artwork into the Add Artwork form';
        edit.after(clone);
      });
    }

    function fillCloneForm(id){
      const source=getItem(id);
      if(!source)return;
      cloneSourceId=String(source.id);
      try{resetForm()}catch{}
      cloneSourceId=String(source.id);
      editingInput.value='';
      nameInput.value=source.name||'';
      const description=document.querySelector('#description');
      if(description)description.value=source.description||'';
      try{syncSearchChoice(document.querySelector('#category'),document.querySelector('#categoryOptions'),categories.map(v=>v.name),source.category)}catch{}
      try{syncSelect(document.querySelector('#rank'),ranks.map(v=>v.name),source.rank)}catch{}
      try{syncSearchChoice(document.querySelector('#credit'),document.querySelector('#creditOptions'),credits.map(v=>v.name),source.credit)}catch{}
      if(imageInput)imageInput.value=source.image||'';
      try{
        const pending=pendingUploads.get(source.id);
        if(pending?.file){
          selectedFile=pending.file;
          revokePreview();
          selectedPreviewUrl=URL.createObjectURL(pending.file);
          if(preview)preview.src=selectedPreviewUrl;
          if(fileNote)fileNote.textContent=`Cloning pending image: ${pending.file.name} · ${(pending.file.size/1024/1024).toFixed(2)} MB`;
        }else if(preview)preview.src=source.image||'';
      }catch{if(preview)preview.src=source.image||''}
      if(formTitle)formTitle.textContent='Clone artwork';
      applyButton.textContent='Add clone';
      window.scrollTo({top:0,behavior:'smooth'});
      try{setStatus(`Cloning "${source.name}". Edit any property, then click Add clone.`,'ok')}catch{}
    }

    new MutationObserver(enhanceList).observe(list,{childList:true,subtree:true});
    enhanceList();

    list.addEventListener('click',event=>{
      const cloneButton=event.target.closest('[data-clone]');
      if(cloneButton){event.preventDefault();event.stopImmediatePropagation();fillCloneForm(cloneButton.dataset.clone);return}
      const editButton=event.target.closest('[data-edit]');
      if(editButton)cloneSourceId=null;
      const deleteButton=event.target.closest('[data-del]');
      if(!deleteButton)return;
      const item=getItem(deleteButton.dataset.del);
      if(!item?.image)return;
      let shared=false;
      try{shared=items.some(other=>String(other.id)!==String(item.id)&&other.image===item.image)}catch{}
      if(!shared)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(!confirm(`Delete "${item.name}"?`))return;
      try{clearPendingUpload(item.id)}catch{}
      try{if(!String(item.id).startsWith('local-'))deletedArtworkIds.add(item.id)}catch{}
      try{items=items.filter(v=>String(v.id)!==String(item.id))}catch{}
      if(editingInput.value===String(item.id))try{resetForm()}catch{}
      try{markDirty();render();setStatus('Artwork marked for deletion. Shared Storage image was preserved because another artwork still uses it.','ok')}catch{}
    },true);

    applyButton.addEventListener('click',()=>{
      const wasEditing=Boolean(editingInput.value);
      const editingId=editingInput.value;
      const oldItem=wasEditing?getItem(editingId):null;
      const oldImage=oldItem?.image||'';
      let sharedOldImage=false;
      if(oldImage){try{sharedOldImage=items.some(other=>String(other.id)!==String(editingId)&&other.image===oldImage)}catch{}}
      if(wasEditing&&imageInput&&!imageInput.value.trim()&&!imageFile?.files?.length&&oldImage){imageInput.value=oldImage;if(preview&&!preview.getAttribute('src'))preview.src=oldImage}
      const keepAfterAdd=!wasEditing&&Boolean(keepName?.checked);
      const keptName=nameInput.value;
      const sourceId=cloneSourceId;
      const source=sourceId?getItem(sourceId):null;
      let beforeIds;
      try{beforeIds=new Set(items.map(x=>String(x.id)))}catch{beforeIds=new Set()}
      queueMicrotask(()=>{
        if(wasEditing&&sharedOldImage&&oldImage){const path=getStoragePath(oldImage);if(path)try{storageDeletes.delete(path)}catch{}}
        if(source){
          let created=null;
          try{created=items.find(x=>!beforeIds.has(String(x.id)))}catch{}
          if(created){created.tags=Array.isArray(source.tags)?[...source.tags]:[];created.hidden=Boolean(source.hidden);try{render()}catch{};cloneSourceId=null}
        }
        if(keepAfterAdd&&keepName)nameInput.value=keptName;
      });
    },true);

    clearButton?.addEventListener('click',()=>{cloneSourceId=null},true);
  });
})();
