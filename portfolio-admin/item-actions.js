(()=>{
const stripSystemFields=item=>{const {id,created_at,updated_at,...rest}=item||{};return {...rest}};

function decorateStandardList(kind){
  const box=document.querySelector(`#${kind}-list`);
  if(!box)return;
  const items=state[kind]||[];
  box.querySelectorAll('[data-edit]').forEach(edit=>{
    if(edit.dataset.edit!==kind)return;
    const id=edit.dataset.id;
    const item=items.find(x=>String(x.id)===String(id));
    const actions=edit.closest('.row-actions');
    if(!item||!actions||actions.querySelector(`[data-clone="${kind}"][data-id="${CSS.escape(String(id))}"]`))return;
    const clone=document.createElement('button');
    clone.className='btn small secondary';
    clone.type='button';
    clone.dataset.clone=kind;
    clone.dataset.id=id;
    clone.textContent='Clone';
    const hide=document.createElement('button');
    hide.className='btn small secondary';
    hide.type='button';
    hide.dataset.hide=kind;
    hide.dataset.id=id;
    hide.textContent=item.visible===false?'Show':'Hide';
    const del=actions.querySelector('[data-delete]');
    actions.insertBefore(clone,del||null);
    actions.insertBefore(hide,del||null);
  });
}

function decorateSectionItems(){
  document.querySelectorAll('[data-section-item-edit]').forEach(edit=>{
    const id=edit.dataset.sectionItemEdit;
    const item=state.sectionItems.find(x=>String(x.id)===String(id));
    const actions=edit.closest('.row-actions');
    if(!item||!actions||actions.querySelector(`[data-section-item-clone="${CSS.escape(String(id))}"]`))return;
    const clone=document.createElement('button');
    clone.className='btn small secondary';
    clone.type='button';
    clone.dataset.sectionItemClone=id;
    clone.textContent='Clone';
    const hide=document.createElement('button');
    hide.className='btn small secondary';
    hide.type='button';
    hide.dataset.sectionItemHide=id;
    hide.textContent=item.visible===false?'Show':'Hide';
    const del=actions.querySelector('[data-section-item-delete]');
    actions.insertBefore(clone,del||null);
    actions.insertBefore(hide,del||null);
  });
}

async function cloneStandard(kind,id){
  const src=(state[kind]||[]).find(x=>String(x.id)===String(id));
  const tableName=table[kind];
  if(!src||!tableName)return;
  const payload=stripSystemFields(src);
  payload.sort_order=(Number(src.sort_order)||0)+1;
  const {error}=await db.from(tableName).insert(payload);
  if(error)return notify(error.message,true);
  notify('Cloned.');
  await loadAll();
}

async function toggleStandard(kind,id){
  const src=(state[kind]||[]).find(x=>String(x.id)===String(id));
  const tableName=table[kind];
  if(!src||!tableName)return;
  const next=src.visible===false;
  const {error}=await db.from(tableName).update({visible:next}).eq('id',id);
  if(error)return notify(error.message,true);
  notify(next?'Item shown.':'Item hidden.');
  await loadAll();
}

async function cloneSectionItem(id){
  const src=state.sectionItems.find(x=>String(x.id)===String(id));
  if(!src)return;
  const payload=stripSystemFields(src);
  payload.sort_order=(Number(src.sort_order)||0)+1;
  const {error}=await db.from('portfolio_section_items').insert(payload);
  if(error)return notify(error.message,true);
  notify('Entry cloned.');
  await loadAll();
}

async function toggleSectionItem(id){
  const src=state.sectionItems.find(x=>String(x.id)===String(id));
  if(!src)return;
  const next=src.visible===false;
  const {error}=await db.from('portfolio_section_items').update({visible:next}).eq('id',id);
  if(error)return notify(error.message,true);
  notify(next?'Entry shown.':'Entry hidden.');
  await loadAll();
}

const baseRenderList=renderList;
renderList=function(kind){
  baseRenderList(kind);
  decorateStandardList(kind);
};

const baseRenderSectionPanels=renderSectionPanels;
renderSectionPanels=function(){
  baseRenderSectionPanels();
  decorateSectionItems();
};

const baseRender=render;
render=function(){
  baseRender();
  ['highlights','projects','skills','education'].forEach(decorateStandardList);
  decorateSectionItems();
};

document.addEventListener('click',async e=>{
  const clone=e.target.closest('[data-clone]');
  if(clone){e.preventDefault();e.stopPropagation();return cloneStandard(clone.dataset.clone,clone.dataset.id)}
  const hide=e.target.closest('[data-hide]');
  if(hide){e.preventDefault();e.stopPropagation();return toggleStandard(hide.dataset.hide,hide.dataset.id)}
  const sectionClone=e.target.closest('[data-section-item-clone]');
  if(sectionClone){e.preventDefault();e.stopPropagation();return cloneSectionItem(sectionClone.dataset.sectionItemClone)}
  const sectionHide=e.target.closest('[data-section-item-hide]');
  if(sectionHide){e.preventDefault();e.stopPropagation();return toggleSectionItem(sectionHide.dataset.sectionItemHide)}
});

['highlights','projects','skills','education'].forEach(decorateStandardList);
decorateSectionItems();
})();
