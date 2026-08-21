(()=>{
'use strict';
const PREFIX='hyu-portfolio-admin:draft:v1:';
let pendingClear=new Set();
let statusTimer=0;

function modalKey(ctx=typeof editCtx!=='undefined'?editCtx:null){
  if(!ctx||!ctx.kind)return null;
  if(ctx.kind==='sectionMeta')return PREFIX+`modal:sectionMeta:${ctx.mode||'edit'}:${ctx.id??'new'}`;
  if(ctx.kind==='sectionItem')return PREFIX+`modal:sectionItem:${ctx.sectionId??'unknown'}:${ctx.id??'new'}`;
  return PREFIX+`modal:${ctx.kind}:${ctx.id??'new'}`;
}
function mainKey(kind){return PREFIX+`main:${kind}`}
function serialize(form){
  if(!form)return null;
  const data={savedAt:Date.now(),fields:{}};
  [...form.elements].forEach(el=>{
    if(!el.name||el.disabled)return;
    if(el.type==='checkbox')data.fields[el.name]={type:'checkbox',value:!!el.checked};
    else if(el.type==='radio'){if(el.checked)data.fields[el.name]={type:'radio',value:el.value}}
    else data.fields[el.name]={type:el.tagName==='TEXTAREA'?'textarea':el.type||'text',value:el.value};
  });
  return data;
}
function put(key,form){
  if(!key||!form)return;
  try{localStorage.setItem(key,JSON.stringify(serialize(form)));showStatus('Draft saved locally');}catch(e){console.warn('Draft autosave failed',e)}
}
function get(key){
  if(!key)return null;
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}
function drop(key){if(key)try{localStorage.removeItem(key)}catch{}}
function restore(key,form,{announce=true}={}){
  const draft=get(key);if(!draft?.fields||!form)return false;
  let restored=false;
  Object.entries(draft.fields).forEach(([name,meta])=>{
    const el=form.elements.namedItem(name);if(!el)return;
    if(meta.type==='checkbox')el.checked=!!meta.value;
    else if(meta.type==='radio'){
      const radios=form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
      radios.forEach(r=>r.checked=r.value===meta.value);
    }else el.value=meta.value??'';
    restored=true;
  });
  if(restored){
    form.querySelectorAll('input,textarea,select').forEach(el=>el.dispatchEvent(new Event('input',{bubbles:true})));
    if(announce)showStatus('Draft restored');
  }
  return restored;
}
function ensureStatus(){
  const head=document.querySelector('.modal-head');
  if(head&&!document.querySelector('#draft-status')){
    const s=document.createElement('span');s.id='draft-status';s.style.cssText='margin-left:auto;margin-right:12px;font-size:10px;font-weight:700;color:#667085;opacity:0;transition:opacity .15s';
    head.insertBefore(s,head.lastElementChild);
  }
}
function showStatus(text){
  ensureStatus();const s=document.querySelector('#draft-status');if(!s)return;
  s.textContent=text;s.style.opacity='1';clearTimeout(statusTimer);statusTimer=setTimeout(()=>s.style.opacity='0',1700);
}
function saveModalDraft(){const form=document.querySelector('#modal-form');if(form&&document.querySelector('#modal.open'))put(modalKey(),form)}
function restoreModalDraft(){ensureStatus();const form=document.querySelector('#modal-form');if(form)restore(modalKey(),form)}
function saveMain(kind){put(mainKey(kind),document.querySelector(`#${kind}-form`))}
function restoreMain(kind){restore(mainKey(kind),document.querySelector(`#${kind}-form`),{announce:false})}
function clearCurrentModal(){drop(modalKey())}
function clearMain(kind){drop(mainKey(kind))}
function markForClear(key){
  if(!key)return;
  pendingClear.add(key);
  setTimeout(()=>pendingClear.delete(key),6000);
}

// Re-opened editors recover their latest local draft, including after an accidental backdrop click.
if(typeof openModal==='function'){
  const base=openModal;
  openModal=function(...args){const r=base(...args);queueMicrotask(restoreModalDraft);return r};
}
if(typeof openSectionModal==='function'){
  const base=openSectionModal;
  openSectionModal=function(...args){const r=base(...args);queueMicrotask(restoreModalDraft);return r};
}

// Profile / Settings drafts survive tab navigation and page reload until a successful Save.
if(typeof render==='function'){
  const base=render;
  render=function(...args){const r=base(...args);queueMicrotask(()=>{restoreMain('profile');restoreMain('settings')});return r};
}

// Existing successful database writes call loadAll(); failed writes do not.
if(typeof loadAll==='function'){
  const base=loadAll;
  loadAll=async function(...args){
    if(pendingClear.size){pendingClear.forEach(drop);pendingClear.clear()}
    return base(...args);
  };
}

document.addEventListener('input',e=>{
  if(e.target.closest('#modal-form'))saveModalDraft();
  else if(e.target.closest('#profile-form'))saveMain('profile');
  else if(e.target.closest('#settings-form'))saveMain('settings');
});
document.addEventListener('change',e=>{
  if(e.target.closest('#modal-form'))saveModalDraft();
  else if(e.target.closest('#profile-form'))saveMain('profile');
  else if(e.target.closest('#settings-form'))saveMain('settings');
});

// Capture runs before the app's async save handlers.
document.addEventListener('submit',e=>{
  if(e.target?.id==='modal-form'){
    saveModalDraft();markForClear(modalKey());
  }
},true);
document.addEventListener('click',e=>{
  if(e.target.closest('#save-profile')){saveMain('profile');markForClear(mainKey('profile'));}
  if(e.target.closest('#save-settings')){saveMain('settings');markForClear(mainKey('settings'));}
  // Cancel is an explicit discard. X and backdrop exits keep the autosaved draft.
  if(e.target.closest('#cancel-modal')){const k=modalKey();drop(k);pendingClear.delete(k);}
},true);

// Save the latest keystrokes just before an accidental outside click closes the modal.
const modal=document.querySelector('#modal');
if(modal)modal.addEventListener('pointerdown',e=>{if(e.target===modal)saveModalDraft()},true);
// Inputs already autosave on every edit; this is only a last guard for an open modal.
window.addEventListener('beforeunload',()=>{if(document.querySelector('#modal.open'))saveModalDraft()});

// Initial restoration in case render already completed before this script loaded.
queueMicrotask(()=>{restoreMain('profile');restoreMain('settings');if(document.querySelector('#modal.open'))restoreModalDraft()});

window.HyuDrafts={clearCurrentModal,clearMain,restoreModalDraft,restoreMain};
})();
