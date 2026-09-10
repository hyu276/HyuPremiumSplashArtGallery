import backendCatalogue from '@/data/backend/catalogue.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const revision = String((backendCatalogue as { generatedAt?: unknown }).generatedAt || '');
  return Response.json(
    { revision },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}
