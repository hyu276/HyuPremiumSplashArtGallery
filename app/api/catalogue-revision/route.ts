import { getCatalogueRevision } from '@/lib/catalogue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_ORIGIN='https://hyu276.github.io';
const CORS_HEADERS={
  'Access-Control-Allow-Origin':ADMIN_ORIGIN,
  'Vary':'Origin',
  'X-Content-Type-Options':'nosniff'
};

export async function OPTIONS(){
  return new Response(null,{status:204,headers:{
    ...CORS_HEADERS,
    'Access-Control-Allow-Methods':'GET, OPTIONS',
    'Access-Control-Allow-Headers':'Accept',
    'Cache-Control':'public, max-age=0, s-maxage=300'
  }});
}

export async function GET(){
  try{
    const revision=await getCatalogueRevision();
    return Response.json({revision},{headers:{
      ...CORS_HEADERS,
      'Cache-Control':'public, max-age=0, s-maxage=15, stale-while-revalidate=15',
      'CDN-Cache-Control':'public, s-maxage=15, stale-while-revalidate=15'
    }});
  }catch(error){
    console.error('catalogue-revision upstream unavailable',error instanceof Error?error.message:'unknown');
    return Response.json({error:'Chưa thể xác minh revision GitHub.'},{status:503,headers:{
      ...CORS_HEADERS,
      'Cache-Control':'no-store'
    }});
  }
}
