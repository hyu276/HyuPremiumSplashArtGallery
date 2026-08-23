import { artworkPath, getCatalogue, siteUrl } from '@/lib/catalogue';
import { getSeoGlobalSettings, getSeoOverrides } from '@/lib/seo';

export async function GET(){
  const [settings,catalogue,overrides]=await Promise.all([getSeoGlobalSettings(),getCatalogue(),getSeoOverrides()]);
  const priority=overrides.filter(x=>x.enabled&&x.ai_summary).slice(0,40);
  const lines=[
    `# ${settings.site_name}`,
    '',settings.llms_summary,'',
    '## Primary pages',
    ...settings.llms_key_pages.map(path=>`- ${new URL(path,`${settings.site_url.replace(/\/$/,'')}/`).href}`),
    '',
    '## Content model',
    `- ${catalogue.items.length} public gaming splash artworks`,
    `- ${catalogue.categories.length} character/category groups`,
    '- Artwork pages expose character/category, skin rank, image credit, original image and permanent canonical URL.',
    '',
    '## AI-optimized page notes',
    ...(priority.length?priority.map(page=>`- ${new URL(page.path,`${settings.site_url.replace(/\/$/,'')}/`).href}: ${page.ai_summary}`):['- No custom AI page notes have been published yet.']),
    '',
    '## Artwork examples',
    ...catalogue.items.slice(0,30).map(item=>`- ${item.category} — ${item.name}: ${siteUrl}${artworkPath(item)}`),
    '',
    '## Sitemaps',
    `- ${settings.site_url.replace(/\/$/,'')}/sitemap.xml`,
    `- ${settings.site_url.replace(/\/$/,'')}/image-sitemap.xml`
  ];
  return new Response(lines.join('\n'),{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=0, s-maxage=3600'}});
}
