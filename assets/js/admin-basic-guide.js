(function(){
  'use strict';

  const OWNER_EMAIL='csquocnguyen@gmail.com';

  function signedInEmail(){
    try{
      if(typeof adminUser!=='undefined'&&adminUser?.email)return String(adminUser.email).trim().toLowerCase();
    }catch{}
    const pill=document.getElementById('ownerPill');
    if(!pill?.classList.contains('ok'))return '';
    const match=String(pill.textContent||'').match(/signed\s+in:\s*(.+)$/i);
    return String(match?.[1]||'').trim().toLowerCase();
  }

  function isCollaborator(){
    const email=signedInEmail();
    return Boolean(email&&email!==OWNER_EMAIL);
  }

  function setChoiceLabel(listId,text){
    const list=document.getElementById(listId);
    const field=list?.closest('.field');
    const label=field?.querySelector('label');
    if(!label)return false;

    const textNode=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&String(node.textContent||'').trim());
    if(textNode)textNode.textContent=`${text} `;
    else label.insertBefore(document.createTextNode(`${text} `),label.firstChild);
    return true;
  }

  function rewriteGuide(){
    const guide=document.getElementById('adminCollaboratorGuide');
    if(!guide||!isCollaborator())return false;
    if(guide.dataset.basicGuide==='true')return true;

    guide.dataset.basicGuide='true';
    guide.innerHTML=`
      <div class="admin-collab-guide-head">
        <div>
          <h2>Hướng dẫn sử dụng Dashboard</h2>
          <div class="admin-collab-guide-sub">Cách đăng một artwork mới.</div>
        </div>
        <span class="admin-collab-guide-badge">COLLABORATOR</span>
      </div>
      <div class="admin-collab-guide-grid">
        <div><strong>01 · Chọn ảnh</strong><span>Ở mục Add Artwork, bấm Chọn tệp và chọn ảnh bạn muốn đăng.</span></div>
        <div><strong>02 · Điền tên</strong><span>Nhập tên artwork vào ô Name. Description có thể điền thêm nếu cần.</span></div>
        <div><strong>03 · Chọn thông tin</strong><span>Chọn Tướng, Skin rank và Tác giả phù hợp cho artwork.</span></div>
        <div><strong>04 · Không thấy thông tin phù hợp?</strong><span>Kéo xuống Artwork Choices để thêm Tướng hoặc Tác giả mới, sau đó quay lại Add Artwork và chọn thông tin vừa thêm.</span></div>
        <div><strong>05 · Hoàn tất</strong><span>Bấm Add artwork, kiểm tra lại artwork trong danh sách rồi bấm Publish changes. Trạng thái gửi duyệt sẽ xuất hiện ở Publish Requests.</span></div>
      </div>
    `;
    return true;
  }

  function sync(){
    setChoiceLabel('categoryChoices','Tướng');
    setChoiceLabel('creditChoices','Tác giả');
    rewriteGuide();
  }

  function ready(){
    sync();

    const pill=document.getElementById('ownerPill');
    if(pill){
      new MutationObserver(()=>setTimeout(sync,30)).observe(pill,{attributes:true,childList:true,subtree:true,characterData:true});
    }

    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.addedNodes.length))sync();
    });
    observer.observe(document.body,{childList:true,subtree:true});

    setTimeout(sync,150);
    setTimeout(sync,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
