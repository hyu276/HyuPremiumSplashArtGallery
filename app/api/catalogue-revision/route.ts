import { getCatalogue } from '@/lib/catalogue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { revision } = await getCatalogue();
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
