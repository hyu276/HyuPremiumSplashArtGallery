import type { Metadata } from 'next';
import { publicMediaUrl } from '@/lib/media';
import backendCatalogue from '@/data/backend/catalogue.json';
import backendSeo from '@/data/backend/seo.json';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://zkrhwqgmynbbmoktokdq.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq';

export type SeoGlobalSettings={site_name:string;site_url:string;default_title:string;title_template:string;default_description:string;default_og_image:string;default_locale:string;google_site_verification:string;llms_summary:string;llms_key_pages:string[];ai_crawlers:Record<string,boolean>};
export type SeoPageOverride={id?:string;path:string;page_type:string;entity_id?:string|null;target_keyword:string;keywords:string[];title:string;meta_description:string;canonical_url:string;h1_suggestion:string;image_alt:string;og_title:string;og_description:string;og_image:string;robots_index:boolean;robots_follow:boolean;include_in_sitemap:boolean;schema_json:Record<string,unknown>;ai_summary:string;ai_key_facts:unknown[];ai_faq:unknown[];enabled:boolean};

const DEFAULT_GLOBAL:SeoGlobalSettings={site_name:'HYU PREMIUM',site_url:'https://hyupremium.vercel.app',default_title:'HYU PREMIUM — Thư viện Splash Art Game',title_template:'%s | HYU PREMIUM',default_description:'Thư viện splash art game được tuyển chọn, có thể tìm kiếm và lọc theo nhân vật, danh mục, hạng skin và credit ảnh.',default_og_image:'',default_locale:'vi_VN',google_site_verification:'KMBRePIo30hKHau-mQc3tM_H0bELdtJRxXfo8I1PDGE',llms_summary:'HYU PREMIUM là thư viện splash art game được tuyển chọn và quản lý thủ công, với các trang tác phẩm cố định được tổ chức theo nhân vật, hạng skin và credit ảnh.',llms_key_pages:['/character/','/artworks/','/about/','/news/','/blog/'],ai_crawlers:{GPTBot:true,'ChatGPT-User':true,PerplexityBot:true,ClaudeBot:true,'anthropic-ai':true,'Google-Extended':true,bingbot:true}};
const localReady=()=>Boolean((backendCatalogue as any).ready===true);
const localSeo=()=>backendSeo as any;

async function rest<T>(path:string):Promise<T>{try{const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},next:{revalidate:60,tags:['seo-manager']}});if(!response.ok)throw new Error(`SEO REST ${response.status}`);return await response.json() as T}catch{return [] as T}}

export async function getSeoGlobalSettings():Promise<SeoGlobalSettings>{
  if(localReady()){const row=localSeo()?.global;if(row)return {...DEFAULT_GLOBAL,...row,llms_key_pages:Array.isArray(row.llms_key_pages)?row.llms_key_pages:DEFAULT_GLOBAL.llms_key_pages,ai_crawlers:row.ai_crawlers&&typeof row.ai_crawlers==='object'?row.ai_crawlers:DEFAULT_GLOBAL.ai_crawlers}}
  const rows=await rest<any[]>('seo_global_settings?select=*&id=eq.true&limit=1');const row=rows[0];if(!row)return DEFAULT_GLOBAL;return {...DEFAULT_GLOBAL,...row,llms_key_pages:Array.isArray(row.llms_key_pages)?row.llms_key_pages:DEFAULT_GLOBAL.llms_key_pages,ai_crawlers:row.ai_crawlers&&typeof row.ai_crawlers==='object'?row.ai_crawlers:DEFAULT_GLOBAL.ai_crawlers};
}
export async function getSeoOverride(path:string):Promise<SeoPageOverride|null>{
  if(localReady()){const rows=Array.isArray(localSeo()?.overrides)?localSeo().overrides:[];return rows.find((row:any)=>row?.path===path&&row?.enabled!==false)||null}
  const encoded=encodeURIComponent(path);const rows=await rest<any[]>(`seo_page_overrides?select=*&path=eq.${encoded}&enabled=eq.true&limit=1`);return rows[0]||null;
}
export async function getSeoOverrides():Promise<SeoPageOverride[]>{
  if(localReady())return (Array.isArray(localSeo()?.overrides)?localSeo().overrides:[]).filter((row:any)=>row?.enabled!==false) as SeoPageOverride[];
  return rest<SeoPageOverride[]>('seo_page_overrides?select=*&enabled=eq.true');
}

export function applySeoOverride(base:Metadata,override:SeoPageOverride|null,global?:SeoGlobalSettings):Metadata{
  if(!override)return base;const canonical=override.canonical_url||override.path;const title=override.title||undefined;const description=override.meta_description||undefined;const ogTitle=override.og_title||override.title||undefined;const ogDescription=override.og_description||override.meta_description||undefined;const ogImage=override.og_image?publicMediaUrl(override.og_image):undefined;
  return {...base,...(title?{title:{absolute:title}}:{}),...(description?{description}:{}),...(override.keywords?.length?{keywords:override.keywords}:{}),alternates:{...(base.alternates||{}),canonical},robots:{index:override.robots_index,follow:override.robots_follow,googleBot:{index:override.robots_index,follow:override.robots_follow,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},openGraph:{...(base.openGraph||{}),...(ogTitle?{title:ogTitle}:{}),...(ogDescription?{description:ogDescription}:{}),...(ogImage?{images:[{url:ogImage,alt:override.image_alt||ogTitle||''}]}:{}),...(global?.default_locale?{locale:global.default_locale}:{})},twitter:{...(base.twitter||{}),card:'summary_large_image',...(ogTitle?{title:ogTitle}:{}),...(ogDescription?{description:ogDescription}:{}),...(ogImage?{images:[{url:ogImage,alt:override.image_alt||ogTitle||''}]}:{})}};
}
export async function metadataForPath(path:string,base:Metadata):Promise<Metadata>{const [global,override]=await Promise.all([getSeoGlobalSettings(),getSeoOverride(path)]);return applySeoOverride(base,override,global)}
export function absoluteSeoUrl(pathOrUrl:string,siteUrl:string){if(/^https?:\/\//i.test(pathOrUrl))return pathOrUrl;return new URL(pathOrUrl,`${siteUrl.replace(/\/$/,'')}/`).href}
