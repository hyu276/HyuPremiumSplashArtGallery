import { createClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://zkrhwqgmynbbmoktokdq.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq';

function tokenFrom(request:Request){
  const value=request.headers.get('authorization')||'';
  return value.toLowerCase().startsWith('bearer ')?value.slice(7).trim():'';
}

function client(token:string){
  return createClient(SUPABASE_URL,SUPABASE_KEY,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
}

export async function POST(request:Request){
  try{
    const token=tokenFrom(request);
    if(!token)return Response.json({error:'Authentication required.'},{status:401});

    const sb=client(token);
    const {data:{user},error:userError}=await sb.auth.getUser(token);
    if(userError||!user)return Response.json({error:'Invalid or expired session.'},{status:401});

    const {data:admin,error:adminError}=await sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(adminError)return Response.json({error:adminError.message},{status:500});
    if(!admin)return Response.json({error:'Admin permission required.'},{status:403});

    revalidateTag('catalogue');
    for(const path of ['/','/character/','/artworks/','/sitemap.xml','/image-sitemap.xml'])revalidatePath(path);

    return Response.json({ok:true,revalidatedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch(error:any){
    return Response.json({error:error?.message||'Catalogue revalidation failed.'},{status:500});
  }
}
