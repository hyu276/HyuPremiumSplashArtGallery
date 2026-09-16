(()=>{
  'use strict';

  let championObserver=null;

  function panelByHeading(root,needle){
    const normalized=needle.toLowerCase();
    return [...root.querySelectorAll('.admin-panel')].find(panel=>String(panel.querySelector('h2')?.textContent||'').trim().toLowerCase().includes(normalized))||null;
  }

  function placeChampionPanel(){
    const grid=document.querySelector('.admin-grid');
    const panel=document.getElementById('champion-thumb-panel');
    if(!grid||!panel)return false;
    if(panel.parentElement!==grid)grid.appendChild(panel);
    panel.dataset.adminPosition='bottom';
    championObserver?.disconnect();
    championObserver=null;
    return true;
  }

  function mount(){
    const wrap=document.querySelector('.admin-wrap');
    if(!wrap)return setTimeout(mount,80);
    if(document.getElementById('admin-page-nav'))return placeChampionPanel();

    const auth=panelByHeading(wrap,'đăng nhập');
    const artwork=panelByHeading(wrap,'tác phẩm');
    const options=panelByHeading(wrap,'tùy chọn tác phẩm');
    const optimizer=panelByHeading(wrap,'tối ưu ảnh tác phẩm');
    const team=wrap.querySelector('.team-manager');
    const artworkList=wrap.querySelector('.admin-list')?.closest('.admin-panel');

    if(auth)auth.id='admin-auth';
    if(artwork)artwork.id='admin-artwork-editor';
    if(options)options.id='admin-options';
    if(optimizer)optimizer.id='admin-optimizer';
    if(team)team.id='admin-team';
    if(artworkList)artworkList.id='admin-artwork-list';

    const nav=document.createElement('nav');
    nav.id='admin-page-nav';
    nav.className='admin-page-nav';
    nav.setAttribute('aria-label','Điều hướng trang quản trị');
    nav.innerHTML=`
      <a href="#admin-auth">Xác thực</a>
      <a href="#admin-artwork-editor">Tác phẩm</a>
      <a href="#admin-options">Tùy chọn</a>
      <a href="#admin-optimizer">Tối ưu ảnh</a>
      <a href="#admin-artwork-list">Danh sách artwork</a>
      <a href="#admin-team">Đội ngũ</a>
      <a href="#champion-thumb-panel">Thumbnail trang Tướng</a>`;

    const top=wrap.querySelector('.admin-top');
    if(top)top.insertAdjacentElement('afterend',nav);else wrap.prepend(nav);

    if(!placeChampionPanel()){
      championObserver=new MutationObserver(placeChampionPanel);
      championObserver.observe(wrap,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
