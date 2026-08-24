import { NextRequest } from 'next/server';
import { supabaseArtworkOrigin } from '@/lib/media';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const ONE_YEAR=31536000;

function cacheHeaders(contentType:string|null,etag:string|null,lastModified:string|null){
  const headers=new Headers();
  if(contentType)headers.set('Content-Type',contentType);
  if(etag)headers.set('ETag',etag);
  if(lastModified)headers.set('Last-Modified',lastModified);
  headers.set('Cache-Control',`public, max-age=${ONE_YEAR}, immutable`);
  headers.set('CDN-Cache-Control',`public, s-maxage=${ONE_YEAR}, stale-while-revalidate=86400`);
  headers.set('Vercel-CDN-Cache-Control',`public, s-maxage=${ONE_YEAR}, stale-while-revalidate=86400`);
  headers.set('Access-Control-Allow-Origin','*');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('X-HYU-Egress-Shield','vercel-cdn');
  return headers;
}

async function proxy(request:NextRequest,segments:string[],head=false){
  const [sourceId,...objectSegments]=segments;
  const origin=supabaseArtworkOrigin(sourceId,objectSegments.join('/'));
  if(!origin)return new Response('Invalid media path',{status:400});

  const upstream=await fetch(origin,{
    method:head?'HEAD':'GET',
    headers:{Accept:request.headers.get('accept')||'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'},
    cache:'no-store',
    redirect:'follow'
  });

  if(!upstream.ok){
    return new Response(head?null:'Media origin unavailable',{
      status:upstream.status,
      headers:{'Cache-Control':'no-store','X-HYU-Egress-Shield':'origin-error'}
    });
  }

  const headers=cacheHeaders(upstream.headers.get('content-type'),upstream.headers.get('etag'),upstream.headers.get('last-modified'));
  const length=upstream.headers.get('content-length');
  if(length)headers.set('Content-Length',length);
  return new Response(head?null:upstream.body,{status:200,headers});
}

export async function GET(request:NextRequest,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params;
  return proxy(request,path||[]);
}

export async function HEAD(request:NextRequest,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params;
  return proxy(request,path||[],true);
}
