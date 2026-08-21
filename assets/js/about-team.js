(function(){
  'use strict';

  const grid=document.querySelector('#teamGrid');
  const state=document.querySelector('#teamState');
  if(!grid)return;

  const cfg=window.HYU_SUPABASE_CONFIG||{};
  const sdk=window.supabase;
  const ready=Boolean(cfg.enabled&&cfg.url&&cfg.publishableKey&&sdk?.createClient);

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const safeUrl=value=>{
    const raw=String(value||'').trim();
    if(!raw)return '';
    try{
      const url=new URL(raw,window.location.href);
      return /^https?:$/.test(url.protocol)?url.href:'';
    }catch{return ''}
  };

  const icons={
    facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 8.2V6.7c0-.7.5-.9 1-.9h2.5V2.1L14.3 2C10.9 2 9 4 9 6.4v1.8H6v4h3V22h4.2v-9.8h3.3l.5-4h-3.8Z" fill="currentColor"/></svg>',
    tiktok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.1 2h3.4c.3 2.1 1.5 3.6 3.5 4.2v3.4c-1.4 0-2.7-.4-3.8-1.2v7.2a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.5a3 3 0 1 0 1.7 2.8V2h.4Z" fill="currentColor"/></svg>',
    instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>',
    x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h4.7l4.1 5.5L17.6 3H20l-6.1 7.2L21 21h-4.7l-4.8-6.5L6 21H3.6l6.8-8L4 3Zm3.5 1.8 9.7 14.4h1.6L9.1 4.8H7.5Z" fill="currentColor"/></svg>',
    linkedin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.3 3.2A2.3 2.3 0 1 1 4.3 7.8a2.3 2.3 0 0 1 0-4.6ZM2.4 9.3h3.8V21H2.4V9.3Zm6.1 0h3.6v1.6h.1c.5-.9 1.7-2 3.6-2 3.8 0 4.5 2.5 4.5 5.8V21h-3.8v-5.6c0-1.3 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21H8.5V9.3Z" fill="currentColor"/></svg>'
  };

  const socialDefs=[
    ['facebook','Facebook'],
    ['tiktok','TikTok'],
    ['instagram','Instagram'],
    ['x','X'],
    ['linkedin','LinkedIn']
  ];

  function socialButtons(member){
    return socialDefs.map(([key,label])=>{
      const url=safeUrl(member[`${key}_url`]);
      const hidden=Boolean(member[`${key}_hidden`]);
      if(!url||hidden)return '';
      return `<a class="team-social" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow" aria-label="${esc(label)} — ${esc(member.name)}" title="${esc(label)}">${icons[key]}</a>`;
    }).join('');
  }

  function render(rows){
    if(!rows.length){
      grid.innerHTML='';
      if(state){
        state.hidden=false;
        state.innerHTML='<strong>Team profiles coming soon.</strong><span>OUR TEAM</span>';
      }
      return;
    }
    if(state)state.hidden=true;
    grid.innerHTML=rows.map(member=>`<article class="team-card"><img src="${esc(member.image)}" alt="${esc(member.name)}" loading="lazy" decoding="async"><div class="team-fade" aria-hidden="true"></div><div class="team-overlay"><h3>${esc(member.name)}</h3><div class="team-socials">${socialButtons(member)}</div></div></article>`).join('');
  }

  if(!ready){
    render([]);
    return;
  }

  const client=sdk.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  client.from('team_members')
    .select('id,name,image,sort_order,facebook_url,facebook_hidden,tiktok_url,tiktok_hidden,instagram_url,instagram_hidden,x_url,x_hidden,linkedin_url,linkedin_hidden')
    .eq('hidden',false)
    .order('sort_order',{ascending:true})
    .order('id',{ascending:true})
    .then(({data,error})=>{
      if(error){
        console.warn('Team section unavailable.',error);
        render([]);
        return;
      }
      render(data||[]);
    });
})();
