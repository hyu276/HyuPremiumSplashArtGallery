(function(){
  'use strict';

  const OWNER_EMAIL='csquocnguyen@gmail.com';
  const MODERATION_ASSET_VERSION='20260824-mobile-auth-lockless-1';
  const AUTH_REQUEST_TIMEOUT_MS=12000;
  const AUTH_FLOW_TIMEOUT_MS=18000;
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

    function setAuthStage(message){
      status.textContent=message;
      status.className='status';
    }

    function installDeterministicAdminClient(){
      let facade;
      try{
        if(typeof client==='undefined'||!window.supabase?.createClient)return;
        facade=client;
      }catch{return}

      const profiles=window.HYU_SUPABASE_PROFILES||{};
      const entries=Object.entries(profiles).filter(([,profile])=>profile?.enabled&&profile?.url&&profile?.publishableKey);
      if(!entries.length)return;

      const initialKey=window.HYU_SUPABASE_PROFILE&&profiles[window.HYU_SUPABASE_PROFILE]
        ?window.HYU_SUPABASE_PROFILE
        :(profiles.owner?'owner':entries[0][0]);

      const originalAuth={
        signInWithPassword:facade.auth?.signInWithPassword?.bind(facade.auth),
        getUser:facade.auth?.getUser?.bind(facade.auth),
        getSession:facade.auth?.getSession?.bind(facade.auth),
        refreshSession:facade.auth?.refreshSession?.bind(facade.auth),
        signOut:facade.auth?.signOut?.bind(facade.auth)
      };
      const originalFrom=facade.from?.bind(facade);
      const originalRpc=facade.rpc?.bind(facade);
      const originalStorageFrom=facade.storage?.from?.bind(facade.storage);
      if(!facade.auth||!originalAuth.signInWithPassword||!originalFrom||!originalStorageFrom)return;

      let activeKey=initialKey;
      let activeClient=facade;
      let verifiedUser=null;
      const lazyClients=new Map();

      function publishVerifiedUser(user){
        verifiedUser=user||null;
        window.HYU_ACTIVE_ADMIN_VERIFIED_USER=verifiedUser;
      }

      function targetProfileForEmail(value){
        const requestedEmail=String(value||'').trim().toLowerCase();
        if(requestedEmail===OWNER_EMAIL)return profiles.owner?'owner':'';
        if(profiles.huy9vnd?.enabled)return 'huy9vnd';
        return entries.find(([key])=>key!=='owner')?.[0]||'';
      }

      function clientForProfile(key){
        if(key===initialKey)return facade;
        if(lazyClients.has(key))return lazyClients.get(key);
        const profile=profiles[key];
        if(!profile?.url||!profile?.publishableKey)return null;
        const candidate=window.supabase.createClient(profile.url,profile.publishableKey,{
          auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
          global:{fetch:createTimedFetch()}
        });
        lazyClients.set(key,candidate);
        return candidate;
      }

      function authCall(candidate,method,...args){
        if(candidate===facade){
          const fn=originalAuth[method];
          if(!fn)throw new Error(`Supabase auth method ${method} is unavailable.`);
          return fn(...args);
        }
        return candidate.auth[method](...args);
      }

      function fromCall(...args){
        return activeClient===facade?originalFrom(...args):activeClient.from(...args);
      }

      function rpcCall(...args){
        if(activeClient===facade){
          if(!originalRpc)throw new Error('Supabase RPC is unavailable.');
          return originalRpc(...args);
        }
        return activeClient.rpc(...args);
      }

      function storageFromCall(...args){
        return activeClient===facade?originalStorageFrom(...args):activeClient.storage.from(...args);
      }

      function activate(key,candidate,user){
        activeKey=key;
        activeClient=candidate;
        publishVerifiedUser(user);
        const effectiveRole=String(user?.email||'').trim().toLowerCase()===OWNER_EMAIL?'owner':'collaborator';
        window.HYU_SUPABASE_PROFILE=key;
        window.HYU_ACTIVE_ADMIN_PROFILE=key;
        window.HYU_SUPABASE_CONFIG={...(profiles[key]||{})};
        window.HYU_EFFECTIVE_ADMIN_ROLE=effectiveRole;
        try{
          const url=new URL(window.location.href);
          if(key==='owner')url.searchParams.delete('db');
          else url.searchParams.set('db',key);
          history.replaceState(null,'',url.pathname+(url.searchParams.toString()?`?${url.searchParams.toString()}`:''));
        }catch{}
      }

      async function safeSignOut(candidate){
        if(!candidate)return;
        try{await withTimeout(authCall(candidate,'signOut'),SIGNOUT_TIMEOUT_MS,'Supabase sign-out')}catch{}
      }

      async function authenticate(credentials){
        const requestedEmail=String(credentials?.email||'').trim().toLowerCase();
        const targetKey=targetProfileForEmail(requestedEmail);
        if(!targetKey){
          return {data:{user:null,session:null},error:new Error(requestedEmail===OWNER_EMAIL?'Owner database is unavailable.':'No non-owner admin database is configured.')};
        }

        const candidate=clientForProfile(targetKey);
        if(!candidate)return {data:{user:null,session:null},error:new Error('Selected Supabase profile is unavailable.')};

        publishVerifiedUser(null);
        window.HYU_EFFECTIVE_ADMIN_ROLE=null;
        setAuthStage(requestedEmail===OWNER_EMAIL?'Authenticating owner account...':'Authenticating non-owner account...');

        let signedInData=null;
        try{
          const result=await withTimeout(
            authCall(candidate,'signInWithPassword',credentials),
            AUTH_REQUEST_TIMEOUT_MS+1500,
            `${profiles[targetKey]?.label||targetKey} authentication`
          );
          if(result?.error)throw result.error;
          signedInData=result?.data||null;
          const user=signedInData?.user;
          if(!user)throw new Error('Supabase did not return an authenticated user.');

          const actualEmail=String(user.email||'').trim().toLowerCase();
          if(actualEmail!==requestedEmail)throw new Error('Authenticated account does not match the requested email.');
          if((requestedEmail===OWNER_EMAIL&&targetKey!=='owner')||(requestedEmail!==OWNER_EMAIL&&targetKey==='owner')){
            throw new Error('This account is not allowed to use this admin role.');
          }

          setAuthStage(requestedEmail===OWNER_EMAIL?'Checking owner dashboard access...':'Checking non-owner dashboard access...');
          const adminResult=await withTimeout(
            candidate.rpc('is_admin'),
            AUTH_REQUEST_TIMEOUT_MS+1500,
            `${profiles[targetKey]?.label||targetKey} admin authorization`
          );
          if(adminResult?.error)throw adminResult.error;
          if(adminResult?.data!==true)throw new Error('This account is not listed as an admin in the selected Supabase project.');

          activate(targetKey,candidate,user);
          return {data:signedInData,error:null};
        }catch(error){
          await safeSignOut(candidate);
          publishVerifiedUser(null);
          window.HYU_EFFECTIVE_ADMIN_ROLE=null;
          return {data:{user:null,session:null},error:error instanceof Error?error:new Error(String(error))};
        }
      }

      facade.auth.signInWithPassword=credentials=>withTimeout(
        authenticate(credentials),
        AUTH_FLOW_TIMEOUT_MS,
        'Admin sign-in flow'
      ).catch(error=>({data:{user:null,session:null},error}));

      facade.auth.getUser=(...args)=>{
        if(!args.length&&verifiedUser)return Promise.resolve({data:{user:verifiedUser},error:null});
        return activeClient===facade?originalAuth.getUser(...args):activeClient.auth.getUser(...args);
      };
      facade.auth.getSession=(...args)=>activeClient===facade?originalAuth.getSession(...args):activeClient.auth.getSession(...args);
      facade.auth.refreshSession=(...args)=>activeClient===facade?originalAuth.refreshSession(...args):activeClient.auth.refreshSession(...args);
      facade.auth.signOut=async(...args)=>{
        try{return activeClient===facade?await originalAuth.signOut(...args):await activeClient.auth.signOut(...args)}
        finally{
          publishVerifiedUser(null);
          window.HYU_EFFECTIVE_ADMIN_ROLE=null;
        }
      };
      facade.from=(...args)=>fromCall(...args);
      facade.rpc=(...args)=>rpcCall(...args);
      facade.storage.from=(...args)=>storageFromCall(...args);

      window.HYU_GET_ACTIVE_ADMIN_PROFILE=()=>activeKey;
      window.HYU_GET_ACTIVE_ADMIN_CLIENT=()=>activeClient;
      window.HYU_GET_ACTIVE_ADMIN_VERIFIED_USER=()=>verifiedUser;
      window.HYU_GET_EFFECTIVE_ADMIN_ROLE=()=>window.HYU_EFFECTIVE_ADMIN_ROLE||null;
    }

    installDeterministicAdminClient();

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