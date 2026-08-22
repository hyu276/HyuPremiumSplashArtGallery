# HYU PREMIUM SEO architecture

The public Vercel deployment uses build-time static generation for search and image discovery.

## What is generated on every Vercel build

`npm run build` runs `scripts/build-seo.mjs`. The script reads the current visible catalogue from Supabase and creates:

- `/artworks/` — a crawlable HTML artwork index
- `/artwork/<artwork-id>/` — one stable HTML page for every visible artwork
- `/sitemap.xml` — page sitemap with Google image sitemap extensions
- `/image-sitemap.xml` — image-focused sitemap
- `/robots.txt` — allows public crawling and advertises both sitemaps
- canonical, robots, Open Graph and Twitter metadata on public static pages
- CollectionPage / ItemList JSON-LD on the main archive
- WebPage / CreativeWork / ImageObject / BreadcrumbList JSON-LD on each artwork page

The public Gallery still uses its existing interactive JavaScript UI. `assets/js/seo-runtime.js` adds descriptive `alt`, `title` and ARIA metadata to gallery artwork images after render.

## Artwork SEO fields

SEO output uses only catalogue data that exists in Supabase:

- artwork name
- description, when present
- category / character
- skin rank
- image credit
- tags
- original image
- optimized thumbnail
- updated timestamp

If `description` is empty, the generator creates a short factual metadata sentence. It does not invent skin lore, official status, artist biography or other unsupported claims.

## URLs

Artwork URLs are based on the stable artwork ID:

`https://hyupremium.vercel.app/artwork/<artwork-id>/`

Renaming an artwork does not change its canonical URL as long as its ID remains unchanged.

## Image SEO

Each artwork page uses the original image as the preferred image in:

- `og:image`
- ImageObject `contentUrl`
- image sitemap `<image:loc>`

The optimized thumbnail is separately exposed as `thumbnailUrl`. This keeps Google image discovery tied to the high-quality source while users browsing the main Gallery can continue receiving lighter thumbnails.

## Search Console actions still required

Repository code can make pages crawlable but cannot force Google to index or rank them. After deployment:

1. Add/verify `https://hyupremium.vercel.app/` in Google Search Console.
2. Submit `https://hyupremium.vercel.app/sitemap.xml`.
3. Optionally submit `https://hyupremium.vercel.app/image-sitemap.xml`.
4. Inspect several `/artwork/<id>/` URLs and request indexing.
5. Monitor Page indexing, Image search performance and Core Web Vitals.

## Important

Do not add fabricated keyword paragraphs, hidden keyword blocks or misleading structured data. Search metadata should remain consistent with what visitors can see on each artwork page.
