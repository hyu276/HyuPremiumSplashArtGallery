import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const manifest=JSON.parse(await readFile('scripts/r2-migration-manifest.json','utf8'));
const supabaseItems=manifest.filter(x=>x.kind==='supabase');
const mediaBase=String(process.env.MEDIA_BASE||'').replace(/\/$/,'');
const supabaseUrl=String(process.env.SUPABASE_URL||'');
const publishableKey=String(process.env.SUPABASE_PUBLISHABLE_KEY||'');

if(!mediaBase||!supabaseUrl||!publishableKey)throw new Error('Required environment missing');

const byBucket=new Map();

for(const item of supabaseItems){
  const target=mediaBase+'/media/'+item.key.split('/').map(encodeURIComponent).join('/');
  const head=await fetch(target,{method:'HEAD',redirect:'follow'});
  if(!head.ok)throw new Error(`R2 verification failed ${head.status} ${target}`);
  const actual=Number(head.headers.get('content-length')||0);
  if(item.size&&actual!==Number(item.size)){
    throw new Error(`R2 size mismatch ${item.key}: ${actual} != ${item.size}`);
  }

  const prefix='legacy/owner/';
  if(!item.key.startsWith(prefix))throw new Error(`Unexpected key ${item.key}`);
  const rest=item.key.slice(prefix.length);
  const slash=rest.indexOf('/');
  if(slash<1)throw new Error(`Cannot derive bucket/path from ${item.key}`);
  const bucket=rest.slice(0,slash);
  const path=rest.slice(slash+1);
  if(!byBucket.has(bucket))byBucket.set(bucket,[]);
  byBucket.get(bucket).push(path);
}

const supabase=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
const results=[];

for(const [bucket,paths] of byBucket){
  const {data,error}=await supabase.storage.from(bucket).remove(paths);
  if(error)throw new Error(`Supabase Storage delete failed for ${bucket}: ${error.message}`);
  results.push({bucket,requested:paths.length,deleted:Array.isArray(data)?data.length:null});
}

console.log(JSON.stringify({ok:true,verified:supabaseItems.length,results}));
