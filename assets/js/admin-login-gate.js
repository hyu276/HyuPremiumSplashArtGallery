(function(){
  'use strict';

  const OWNER_EMAIL='csquocnguyen@gmail.com';
  const MODERATION_ASSET_VERSION='20260824-email-role-routing-1';
  const AUTH_REQUEST_TIMEOUT_MS=12000;
  const SIGNOUT_TIMEOUT_MS=2500;

  function whenReady(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function timeoutError(label,ms){
    const error=new Error(`${label} timed out after ${Math.ceil(ms/1000)} seconds. Please check your connection and try again.`);
    error.name='TimeoutError';
    return error;
  }

  function withTimeout(promise,ms,label){
    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(timeoutError(label,ms)),ms);
    });
    return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
  }

  function createTimedFetch(timeoutMs=AUTH_REQUEST_TIMEOUT_MS){
    return async function timedFetch(input,init={}){
      const controller=new AbortController();
      let externalAbortHandler=null;
      const externalSignal=init?.signal;
      if(externalSignal){
        if(externalSignal.aborted)controller.abort();
        else{
          externalAbortHandler=()=>controller.abort();
          externalSignal.addEventListener('abort',externalAbortHandler,{once:true});
        }
      }
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        return await fetch(input,{...init,signal:controller.signal});
      }catch(error){
        if(controller.signal.aborted&&!externalSignal?.aborted)throw timeoutError('Supabase request',timeoutMs);
        throw error;
      }finally{
        clearTimeout(timer);
        if(externalSignal&&externalAbortHandler)externalSignal.removeEventListener('abort',externalAbortHandler);
      }
    };
  }

  whenReady(()=>{
    const wrap=document.querySelector('.wrap');
    const topActions=wrap?.querySelector('.top-actions');
    const security=wrap?.querySelector('.security');
    const ownerPill=document.getElementById('ownerPill');
    const email=document.getElementById('email');
    const password=document.getElementById('password');
    const login=document.getElementById('login');
    const logout=document.getElementById('logout');
    const load=document.getElementById('load');
    const save=document.getElementById('save');
    const status=document.getElementById('status');
    const loginPanel=login?.closest('.panel');
    const emailField=email?.closest('.field');
    const passwordField=password?.closest('.field');

    if(!wrap||!topActions||!ownerPill||!email||!password||!login||!logout||!load||!save||!status||!loginPanel||!emailField||!passwordField){
      document.documentElement.classList.remove('hyu-admin-auth-pending');
      return;
    }

    function installMultiProjectAdminClient(){
      let facade;
      try{
        if(typeof client==='undefined'||!window.supabase?.createClient)return;
        facade=client;
      }catch{return}

      const profiles=window.HYU_SUPABASE_PROFILES||{};
      const entries=Object.entries(profiles).filter(([,profile])=>profile?.enabled&&profile?.url&&profile?.publishableKey);
      if(!entries.length)return;

      const preferred=window.HYU_SUPABASE_PROFILE||entries[0][0];
      const profileClients=new Map(entries.map(([key,profile])=>[
        key,
        window.supabase.createClient(profile.url,profile.publishableKey,{
          auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
          global:{fetch:createTimedFetch()}
        })
      ]));
      let activeKey=profileClients.has(preferred)?preferred:entries[0][0];
      let activeClient=profileClients.get(activeKey);
      let verifiedUser=null;

      function publishVerifiedUser(user){
        verifiedUser=user||null;
        window.HYU_ACTIVE_ADMIN_VERIFIED_USER=verifiedUser;
      }

      function activate(key,candidate,user){
        activeKey=key;
        activeClient=candidate;
        publishVerifiedUser(user);
        window.HYU_SUPABASE_PROFILE=key;
        window.HYU_ACTIVE_ADMIN_PROFILE=key;
        window.HYU_SUPABASE_CONFIG={...(profiles[key]||{})};
        window.HYU_EFFECTIVE_ADMIN_ROLE=String(user?.email||'').trim().toLowerCase()===OWNER_EMAIL?'owner':'collaborator';
        try{
          const url=new URL(window.location.href);
          if(key==='owner')url.searchParams.delete('db');
          else url.searchParams.set('db',key);
          history.replaceState(null,'',url.pathname+(url.searchParams.toString()?`?${url.searchParams.toString()}`:''));
        }catch{}
      }

      function profileKeysForCredentials(credentials){
        const requestedEmail=String(credentials?.email||'').trim().toLowerCase();
        if(requestedEmail===OWNER_EMAIL){
          return profileClients.has('owner')?['owner']:[];
        }

        const nonOwner=entries.map(([key])=>key).filter(key=>key!=='owner'&&profileClients.has(key));
        if(preferred!=='owner'&&nonOwner.includes(preferred)){
          return [preferred,...nonOwner.filter(key=>key!==preferred)];
        }
        return nonOwner;
      }

      async function safeSignOut(candidate){
        try{await withTimeout(candidate.auth.signOut(),SIGNOUT_TIMEOUT_MS,'Supabase sign-out')}catch{}
      }

      async function testProfile(key,credentials){
        const candidate=profileClients.get(key);
        if(!candidate)return {ok:false,key,error:new Error('Supabase profile is unavailable.'),validCredentials:false};
        try{
          const {data,error}=await withTimeout(
            candidate.auth.signInWithPassword(credentials),
            AUTH_REQUEST_TIMEOUT_MS+1500,
            `${profiles[key]?.label||key} authentication`
          );
          if(error)return {ok:false,key,candidate,error,validCredentials:false};

          const user=data?.user;
          if(!user){
            await safeSignOut(candidate);
            return {ok:false,key,candidate,error:new Error('Supabase did not return an authenticated user.'),validCredentials:false};
          }

          const actualEmail=String(user.email||'').trim().toLowerCase();
          const shouldBeOwner=actualEmail===OWNER_EMAIL;
          if((shouldBeOwner&&key!=='owner')||(!shouldBeOwner&&key==='owner')){
            await safeSignOut(candidate);
            return {ok:false,key,candidate,error:new Error('This account is not allowed to use this admin role.'),validCredentials:true};
          }

          const {data:adminRow,error:adminError}=await withTimeout(
            candidate.from('admins').select('user_id').eq('user_id',user.id).maybeSingle(),
            AUTH_REQUEST_TIMEOUT_MS+1500,
            `${profiles[key]?.label||key} admin authorization`
          );

          if(!adminError&&adminRow)return {ok:true,key,candidate,data,user};

          await safeSignOut(candidate);
          return {
            ok:false,
            key,
            candidate,
            error:adminError||new Error('This account is not listed in public.admins for this project.'),
            validCredentials:true
          };
        }catch(error){
          await safeSignOut(candidate);
          return {ok:false,key,candidate,error,validCredentials:false};
        }
      }

      const authFacade=facade.auth;
      const storageFacade=facade.storage;
      if(!authFacade)return;

      authFacade.signInWithPassword=async credentials=>{
        publishVerifiedUser(null);
        window.HYU_EFFECTIVE_ADMIN_ROLE=null;
        const keys=profileKeysForCredentials(credentials);
        if(!keys.length){
          return {
            data:{user:null,session:null},
            error:new Error(String(credentials?.email||'').trim().toLowerCase()===OWNER_EMAIL
              ?'Owner database is unavailable.'
              :'No non-owner admin database is configured.')
          };
        }

        let remaining=keys.length;
        let finished=false;
        let validButUnauthorized=false;
        let lastAuthError=null;

        return await new Promise(resolve=>{
          const finishFailure=()=>{
            if(finished||remaining>0)return;
            finished=true;
            publishVerifiedUser(null);
            window.HYU_EFFECTIVE_ADMIN_ROLE=null;
            resolve({
              data:{user:null,session:null},
              error:validButUnauthorized
                ? new Error('This account is not authorized for the selected admin role.')
                : (lastAuthError||new Error('Invalid login credentials'))
            });
          };

          for(const key of keys){
            testProfile(key,credentials).then(result=>{
              remaining-=1;

              if(finished){
                if(result.ok&&result.candidate!==activeClient)safeSignOut(result.candidate);
                return;
              }

              if(result.ok){
                finished=true;
                activate(result.key,result.candidate,result.user);
                resolve({data:result.data,error:null});
                return;
              }

              if(result.validCredentials)validButUnauthorized=true;
              if(result.error)lastAuthError=result.error;
              finishFailure();
            }).catch(error=>{
              remaining-=1;
              lastAuthError=error;
              finishFailure();
            });
          }
        });
      };

      authFacade.getUser=(...args)=>{
        if(!args.length&&verifiedUser)return Promise.resolve({data:{user:verifiedUser},error:null});
        return activeClient.auth.getUser(...args);
      };
      authFacade.getSession=(...args)=>activeClient.auth.getSession(...args);
      authFacade.refreshSession=(...args)=>activeClient.auth.refreshSession(...args);
      authFacade.signOut=async(...args)=>{
        try{return await activeClient.auth.signOut(...args)}
        finally{
          publishVerifiedUser(null);
          window.HYU_EFFECTIVE_ADMIN_ROLE=null;
        }
      };
      facade.from=(...args)=>activeClient.from(...args);
      facade.rpc=(...args)=>activeClient.rpc(...args);
      if(storageFacade?.from)storageFacade.from=(...args)=>activeClient.storage.from(...args);

      window.HYU_GET_ACTIVE_ADMIN_PROFILE=()=>activeKey;
      window.HYU_GET_ACTIVE_ADMIN_CLIENT=()=>activeClient;
      window.HYU_GET_ACTIVE_ADMIN_VERIFIED_USER=()=>verifiedUser;
      window.HYU_GET_EFFECTIVE_ADMIN_ROLE=()=>window.HYU_EFFECTIVE_ADMIN_ROLE||null;
    }

    installMultiProjectAdminClient();

    const style=document.createElement('style');
    style.dataset.hyuAdminLoginGate='true';
    style.textContent=`
      .admin-auth-shell{display:none;min-height:100vh;width:100%;padding:24px;place-items:center;background:
        radial-gradient(circle at 50% 18%,rgba(67,220,255,.09),transparent 34%),
        linear-gradient(180deg,#0b0d10 0%,#090b0e 100%)}
      body.admin-auth-locked{min-height:100vh;overflow:hidden}
      body.admin-auth-locked .admin-auth-shell{display:grid}
      body.admin-auth-locked>.wrap,body.admin-auth-locked>.admin-jump-nav{display:none!important}
      .admin-auth-card{width:min(430px,100%);border:1px solid #28303a;border-radius:12px;background:#11151a;padding:24px;box-shadow:0 22px 60px rgba(0,0,0,.34)}
      .admin-auth-brand{font-size:18px;font-weight:900;letter-spacing:.08em;margin-bottom:22px}
      .admin-auth-brand b{color:#43dcff}
      .admin-auth-card h1{margin:0 0 18px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#c9d1d9}
      .admin-auth-card .field{margin-bottom:12px}
      .admin-auth-card .actions{margin-top:4px}
      .admin-auth-card #login{width:100%;background:#43dcff;color:#061016;border-color:#43dcff;font-weight:800}
      .admin-auth-card #login:disabled{opacity:.62;cursor:wait}
      .admin-auth-card #status{margin-top:12px}
      .admin-dashboard-status{max-width:980px;margin:-4px 0 14px}
      .admin-dashboard-status[hidden]{display:none!important}
      .admin-dashboard-status #status{margin:0;padding:8px 10px;border:1px solid #28303a;border-radius:7px;background:#0e1216}
      .admin-dashboard-status #status.ok{border-color:#27543c;background:#0c1711}
      .admin-dashboard-status #status.err{border-color:#56323a;background:#231518}
      .admin-dashboard-status #status.warn{border-color:#5a4725;background:#211a0d}
      @media(max-width:600px){.admin-auth-shell{padding:16px;min-height:100dvh}.admin-auth-card{padding:20px;border-radius:10px}}
    `;
    document.head.appendChild(style);

    const authShell=document.createElement('div');
    authShell.className='admin-auth-shell';
    authShell.setAttribute('aria-label','Admin sign in');

    const authCard=document.createElement('section');
    authCard.className='admin-auth-card';
    authCard.innerHTML='<div class="admin-auth-brand">HYU <b>PREMIUM</b></div><h1>Admin sign in</h1>';
    authCard.append(emailField,passwordField);

    const authActions=document.createElement('div');
    authActions.className='actions';
    authActions.appendChild(login);
    authCard.appendChild(authActions);
    authCard.appendChild(status);
    authShell.appendChild(authCard);
    document.body.insertBefore(authShell,document.body.firstChild);

    const galleryLink=topActions.querySelector('a');
    for(const button of [load,save,logout]){
      button.classList.add('admin-session-action');
      if(galleryLink)topActions.insertBefore(button,galleryLink);
      else topActions.appendChild(button);
    }

    const dashboardStatus=document.createElement('div');
    dashboardStatus.className='admin-dashboard-status';
    dashboardStatus.hidden=true;
    if(security)security.insertAdjacentElement('afterend',dashboardStatus);
    else wrap.querySelector('.grid')?.insertAdjacentElement('beforebegin',dashboardStatus);

    loginPanel.remove();

    const ensureModerationModule=()=>{
      if(window.__HYU_PUBLISH_MODERATION_MODULE__==='v2')return;
      const existing=document.querySelector('script[data-hyu-admin-publish-moderation]');
      if(existing){
        if(existing.dataset.version===MODERATION_ASSET_VERSION)return;
        existing.remove();
      }
      const script=document.createElement('script');
      script.src=`./assets/js/admin-publish-moderation.js?v=${MODERATION_ASSET_VERSION}`;
      script.dataset.hyuAdminPublishModeration='true';
      script.dataset.version=MODERATION_ASSET_VERSION;
      document.body.appendChild(script);
    };

    const syncAuthView=()=>{
      const signedIn=ownerPill.classList.contains('ok');
      document.body.classList.toggle('admin-auth-locked',!signedIn);
      document.body.classList.toggle('admin-authenticated',signedIn);
      for(const button of [load,save,logout])button.hidden=!signedIn;

      if(signedIn){
        if(status.parentElement!==dashboardStatus)dashboardStatus.appendChild(status);
        dashboardStatus.hidden=false;
        ensureModerationModule();
      }else{
        if(status.parentElement!==authCard)authCard.appendChild(status);
        dashboardStatus.hidden=true;
        window.setTimeout(()=>email.focus({preventScroll:true}),0);
      }
    };

    new MutationObserver(syncAuthView).observe(ownerPill,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});

    const submitOnEnter=e=>{
      if(e.key!=='Enter'||login.disabled)return;
      e.preventDefault();
      login.click();
    };
    email.addEventListener('keydown',submitOnEnter);
    password.addEventListener('keydown',submitOnEnter);

    syncAuthView();
    document.documentElement.classList.remove('hyu-admin-auth-pending');
  });
})();