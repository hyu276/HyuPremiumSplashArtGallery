import { artworkPath, getCatalogue, siteUrl } from '@/lib/catalogue';

const XML_ENTITIES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;'
};

const xml = (value: string) => String(value).replace(/[<>&"']/g, ch => XML_ENTITIES[ch] || ch);

export async function GET() {
  const { items } = await getCatalogue();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${items.map(item => `\n<url><loc>${xml(`${siteUrl}${artworkPath(item)}`)}</loc><image:image><image:loc>${xml(item.image)}</image:loc><image:title>${xml(item.name)}</image:title><image:caption>${xml(`${item.name} — ${item.category} gaming splash art`)}</image:caption></image:image></url>`).join('')}\n</urlset>`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600'
    }
  });
}
