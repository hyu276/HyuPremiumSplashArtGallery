import { createClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag } from 'next/cache';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://zkrhwqgmynbbmoktokdq.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq';
const ALLOWED_ORIGINS=new Set(['https://hyu276.github.io','https://hyupremium.vercel.app']);

function cors(request:Request){const origin=request.headers.get('origin')||'';return {'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin)?origin:'https://hyu276.github.io','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Max-Age':'86400','Vary':'Origin'} as Record<string,string>}
function json(request:Request,data:unknown,status=200){return Response.json(data,{status,headers:cors(request)})}
function tokenFrom(request:Request){const value=request.headers.get('authorization')||'';return value.toLowerCase().startsWith('bearer ')?value.slice(7).trim():''}
function client(token:string){return createClient(SUPABASE_URL,SUPABASE_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
async function adminClient(request:Request){
  const token=tokenFrom(request);if(!token)throw new Error('Authentication required.');
  const sb=client(token);const {data:{user},error:userError}=await sb.auth.getUser(token);if(userError||!user)throw new Error('Invalid or expired session.');
  const {data:admin,error}=await sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();if(error||!admin)throw new Error('Admin permission required.');
  return {sb,user};
}
function refresh(){revalidateTag('seo-manager');revalidateTag('catalogue');for(const path of ['/','/character/','/artworks/','/about/','/news/','/blog/','/sitemap.xml','/image-sitemap.xml','/robots.txt','/llms.txt'])revalidatePath(path)}

export async function OPTIONS(request:Request){return new Response(null,{status:204,headers:cors(request)})}

export async function GET(request:Request){
  try{
    const {sb}=await adminClient(request);const url=new URL(request.url);const view=url.searchParams.get('view')||'bootstrap';
    if(view==='health')return json(request,{ok:true});
    const [global,overrides,targets,logs,artworks,categories,ranks,credits]=await Promise.all([
      sb.from('seo_global_settings').select('*').eq('id',true).maybeSingle(),
      sb.from('seo_page_overrides').select('*').order('path'),
      sb.from('seo_query_targets').select('*').order('priority',{ascending:false}).order('query'),
      sb.from('seo_change_log').select('*').order('created_at',{ascending:false}).limit(50),
      sb.from('artworks').select('id,name,description,image,thumbnail,tags,hidden,is_vietnamese_skin,updated_at,category:categories(name),rank:ranks(name),credit:image_credits(name)').order('name'),
      sb.from('categories').select('id,name').order('name'),sb.from('ranks').select('id,name,sort_order').order('sort_order'),sb.from('image_credits').select('id,name').order('name')
    ]);
    const error=global.error||overrides.error||targets.error||logs.error||artworks.error||categories.error||ranks.error||credits.error;if(error)throw error;
    return json(request,{global:global.data,overrides:overrides.data||[],targets:targets.data||[],logs:logs.data||[],artworks:artworks.data||[],categories:categories.data||[],ranks:ranks.data||[],credits:credits.data||[]});
  }catch(error:any){return json(request,{error:error?.message||'Request failed.'},401)}
}

export async function POST(request:Request){
  try{
    const {sb}=await adminClient(request);const body=await request.json();const action=String(body.action||'');let result:any=null;
    if(action==='save-global'){
      const allowed=['site_name','site_url','default_title','title_template','default_description','default_og_image','default_locale','google_site_verification','llms_summary','llms_key_pages','ai_crawlers'];const payload:Object=Object.fromEntries(allowed.filter(k=>k in body.data).map(k=>[k,body.data[k]]));
      const response=await sb.from('seo_global_settings').update(payload).eq('id',true).select().single();if(response.error)throw response.error;result=response.data;
    }else if(action==='upsert-page'){
      const allowed=['id','path','page_type','entity_id','target_keyword','keywords','title','meta_description','canonical_url','h1_suggestion','image_alt','og_title','og_description','og_image','robots_index','robots_follow','include_in_sitemap','schema_json','ai_summary','ai_key_facts','ai_faq','enabled'];
      const payload=Object.fromEntries(allowed.filter(k=>k in body.data).map(k=>[k,body.data[k]]));delete (payload as any).id;
      const response=await sb.from('seo_page_overrides').upsert(payload,{onConflict:'path'}).select().single();if(response.error)throw response.error;result=response.data;
    }else if(action==='delete-page'){
      const response=await sb.from('seo_page_overrides').delete().eq('path',String(body.path||''));if(response.error)throw response.error;result={deleted:true};
    }else if(action==='upsert-target'){
      const allowed=['id','query','intent','platform','priority','active','notes','cited','cited_url','competitors','last_checked_at'];const payload=Object.fromEntries(allowed.filter(k=>k in body.data).map(k=>[k,body.data[k]]));
      let response;if(payload.id){const id=payload.id;delete (payload as any).id;response=await sb.from('seo_query_targets').update(payload).eq('id',id).select().single()}else response=await sb.from('seo_query_targets').insert(payload).select().single();if(response.error)throw response.error;result=response.data;
    }else if(action==='delete-target'){
      const response=await sb.from('seo_query_targets').delete().eq('id',body.id);if(response.error)throw response.error;result={deleted:true};
    }else throw new Error('Unknown action.');
    refresh();return json(request,{ok:true,result});
  }catch(error:any){return json(request,{error:error?.message||'Request failed.'},400)}
}
