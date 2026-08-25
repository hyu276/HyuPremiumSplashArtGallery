import { NextRequest } from 'next/server';
import { legacyMediaRedirectUrl } from '@/lib/media';

export const runtime='edge';
export const dynamic='force-dynamic';

function redirect(segments:string[]){
  const target=legacyMediaRedirectUrl(segments||[]);
  if(!target)return new Response('Legacy media path not found',{status:404,headers:{'Cache-Control':'public, max-age=300'}});
  return Response.redirect(target,308);
}

export async function GET(_request:NextRequest,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params;
  return redirect(path||[]);
}

export async function HEAD(_request:NextRequest,{params}:{params:Promise<{path:string[]}>}){
  const {path}=await params;
  return redirect(path||[]);
}
