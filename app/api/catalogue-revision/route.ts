import backendCatalogue from '@/data/backend/catalogue.json';

export const dynamic = 'force-static';

export async function GET() {
  const revision = String((backendCatalogue as { generatedAt?: unknown }).generatedAt || '');
  return Response.json(
    { revision },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=15',
        'CDN-Cache-Control': 'public, s-maxage=15, stale-while-revalidate=15',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}
