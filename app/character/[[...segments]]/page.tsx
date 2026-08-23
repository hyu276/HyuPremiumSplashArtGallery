import type { Metadata } from 'next';
import GalleryClient from '@/components/GalleryClient';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import type { Artwork } from '@/lib/catalogue';
import { artworkPath, factualDescription, findArtwork, getCatalogue, siteUrl, slug } from '@/lib/catalogue';

export const revalidate = 300;
type PageProps = { params: Promise<{ segments?: string[] }> };

function seoForArtwork(item:Artwork){
  const vietnamese=item.isVietnameseSkin;
  const title=vietnamese?`${item.category} ${item.name} – Skin Việt Nam Liên Quân`:`${item.category} ${item.name} – Fanart Liên Quân`;
  const description=vietnamese?`Skin Việt Nam tự làm ${item.category} ${item.name} cho Liên Quân Mobile. Xem fanart splash art, hạng ${item.rank}, credit ${item.credit} và các artwork liên quan.`:factualDescription(item);
  const alt=vietnamese?`Splash art skin Việt Nam tự làm ${item.name} của ${item.category} trong Liên Quân Mobile`:`${item.name} — ${item.category} gaming splash art, skin rank ${item.rank}`;
  const keywords=[`${item.category} ${item.name}`,`skin ${item.category} ${item.name}`,`fanart ${item.category}`,`skin fanmade ${item.category}`,'fanart Liên Quân Mobile','skin fanmade Liên Quân','skin tự làm Liên Quân','splash art Liên Quân','Arena of Valor fanart',...(vietnamese?['skin Việt Nam Liên Quân','skin Việt Nam tự làm','fanmade skin Việt Nam','fanart Việt Nam Liên Quân']:[]),...item.tags].filter(Boolean);
  const aliases=[`${item.category} ${item.name}`,`${item.name} ${item.category}`,`${item.category} ${slug(item.name).replace(/-/g,' ')}`,`${item.category}: ${item.name}`];
  const answer=vietnamese?`${item.name} là concept skin Việt Nam tự làm dành cho ${item.category} trong Liên Quân Mobile (Arena of Valor), được lưu trữ trong HYU PREMIUM như một fanart/splash art fanmade. Artwork có skin rank ${item.rank} và image credit ${item.credit}. Trang này cung cấp ảnh gốc cùng các fanart ${item.category} liên quan trong bộ sưu tập.`:factualDescription(item);
  return {title,description,alt,keywords,aliases,answer};
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments = [] } = await params;
  const catalogue = await getCatalogue();
  const { category, artwork } = findArtwork(catalogue.items, segments[0], segments[1]);
  if (artwork) {
    const url = `${siteUrl}${artworkPath(artwork)}`;
    const seo=seoForArtwork(artwork);
    return {
      title:{absolute:seo.title},description:seo.description,keywords:seo.keywords,
      alternates:{canonical:url},
      robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},
      openGraph:{title:seo.title,description:seo.description,url,type:'article',images:[{url:artwork.image,alt:seo.alt}]},
      twitter:{card:'summary_large_image',title:seo.title,description:seo.description,images:[{url:artwork.image,alt:seo.alt}]}
    };
  }
  if (category) {
    const url = `${siteUrl}/character/${segments[0]}/`;
    const title = `${category} Splash Art Archive`;
    const description = `Browse ${category} gaming splash art in the HYU PREMIUM archive.`;
    return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: 'website' } };
  }
  return {title:{absolute:'HYU PREMIUM — Gaming Splash Art Archive'},description:'A curated searchable archive of gaming splash art organized by character/category, skin rank and image credit.',alternates:{canonical:`${siteUrl}/character/`}};
}

export default async function CharacterGalleryPage({ params }: PageProps) {
  const { segments = [] } = await params;
  const catalogue = await getCatalogue();
  const route = findArtwork(catalogue.items, segments[0], segments[1]);
  const routeItems=route.category?catalogue.items.filter(item=>item.category===route.category):catalogue.items;
  const itemList = {'@context':'https://schema.org','@type':'CollectionPage',name:route.category?`${route.category} Splash Art Archive`:'HYU PREMIUM Gaming Splash Art Archive',url:`${siteUrl}${route.category?`/character/${segments[0]}/`:'/character/'}`,mainEntity:{'@type':'ItemList',numberOfItems:routeItems.length,itemListElement:routeItems.map((item,index)=>({'@type':'ListItem',position:index+1,url:`${siteUrl}${artworkPath(item)}`,name:item.name,image:item.image}))}};
  const artwork=route.artwork;
  const seo=artwork?seoForArtwork(artwork):null;
  const pageUrl=artwork?`${siteUrl}${artworkPath(artwork)}`:'';
  const artworkJsonLd=artwork&&seo?{'@context':'https://schema.org','@graph':[
    {'@type':'WebPage','@id':`${pageUrl}#webpage`,url:pageUrl,name:seo.title,description:seo.description,isPartOf:{'@type':'WebSite','@id':`${siteUrl}/#website`,url:`${siteUrl}/`,name:'HYU PREMIUM'},primaryImageOfPage:{'@id':`${pageUrl}#image`},breadcrumb:{'@id':`${pageUrl}#breadcrumb`},inLanguage:'vi-VN',mainEntity:{'@id':`${pageUrl}#artwork`},about:{'@type':'VideoGame',name:'Liên Quân Mobile',alternateName:'Arena of Valor'},keywords:seo.keywords.join(', '),dateModified:artwork.updatedAt},
    {'@type':'ImageObject','@id':`${pageUrl}#image`,contentUrl:artwork.image,thumbnailUrl:artwork.thumbnail,name:`${artwork.name} — ${artwork.category}`,caption:artwork.isVietnameseSkin?`${artwork.category} ${artwork.name} – Skin Việt Nam Tự Làm Liên Quân`:`${artwork.category} ${artwork.name} splash art`,creditText:artwork.credit,representativeOfPage:true,description:seo.alt,about:{'@type':'VideoGame',name:'Liên Quân Mobile',alternateName:'Arena of Valor'},inLanguage:'vi-VN'},
    {'@type':['VisualArtwork','CreativeWork'],'@id':`${pageUrl}#artwork`,url:pageUrl,name:artwork.name,description:seo.answer,image:{'@id':`${pageUrl}#image`},genre:artwork.isVietnameseSkin?['Fan art','Fanmade game skin','Skin Việt Nam tự làm','Splash art']:['Fan art','Fanmade game skin','Splash art'],keywords:seo.keywords.join(', '),headline:seo.title,alternateName:seo.aliases,artform:'Fan art / fanmade game skin concept',artMedium:'Digital illustration',about:{'@type':'VideoGame',name:'Liên Quân Mobile',alternateName:'Arena of Valor'},inLanguage:'vi-VN',dateModified:artwork.updatedAt},
    {'@type':'BreadcrumbList','@id':`${pageUrl}#breadcrumb`,itemListElement:[{'@type':'ListItem',position:1,name:'HYU PREMIUM',item:`${siteUrl}/`},{'@type':'ListItem',position:2,name:'Characters',item:`${siteUrl}/character/`},{'@type':'ListItem',position:3,name:artwork.category,item:`${siteUrl}/character/${slug(artwork.category)}/`},{'@type':'ListItem',position:4,name:artwork.name,item:pageUrl}]}
  ]}:null;

  return <>
    <SiteHeader />
    <section className="hero" id="top"><div className="hero-kicker"><i></i> Owner-curated game art index</div><h1>The art<br />of the <em>game.</em></h1><div className="hero-foot"><p>A living archive ordered by category, then by its owner-defined skin tier system.</p><span>Scroll to explore ↓</span></div></section>
    <GalleryClient catalogue={catalogue} initialCategory={route.category} initialArtworkId={artwork?.id || null} />
    <section className="crawl-links" aria-labelledby="crawl-title"><h2 id="crawl-title">Crawlable artwork directory</h2><details><summary>Browse {catalogue.items.length} permanent artwork pages</summary><div className="crawl-grid">{catalogue.items.map(item => <a key={item.id} href={artworkPath(item)}>{item.category} — {item.name}</a>)}</div></details></section>
    {artwork&&seo?<section className="seo-artwork-context" aria-labelledby="seoArtworkTitle"><a className="seo-artwork-thumb" href={artwork.image} target="_blank" rel="noopener" aria-label={`Mở ảnh gốc ${artwork.name}`}><img src={artwork.image} alt={seo.alt} loading="lazy" decoding="async"/></a><div className="seo-artwork-copy"><p className="seo-artwork-kicker">{artwork.isVietnameseSkin?'Skin Việt Nam tự làm · ':''}Fanart Liên Quân · {artwork.rank} · {artwork.credit}</p><h1 id="seoArtworkTitle">{seo.title}</h1><p className="seo-artwork-answer">{seo.answer}</p><dl className="seo-artwork-facts"><div><dt>Game</dt><dd>Liên Quân Mobile / Arena of Valor</dd></div><div><dt>Nhân vật</dt><dd>{artwork.category}</dd></div><div><dt>Loại</dt><dd>{artwork.isVietnameseSkin?'Skin Việt Nam tự làm / fanmade':'Fanart / fanmade skin'}</dd></div><div><dt>Skin rank</dt><dd>{artwork.rank}</dd></div><div><dt>Image credit</dt><dd>{artwork.credit}</dd></div></dl><p className="seo-artwork-aliases"><strong>Tên tìm kiếm:</strong> {seo.aliases.slice(0,3).join(' · ')}</p><nav><a href={`/character/${slug(artwork.category)}/`}>Xem thêm fanart {artwork.category}</a><a href="/artworks/">Toàn bộ artwork</a></nav></div></section>:null}
    <section className="manifesto"><p className="eyebrow">HYU PREMIUM / ARCHIVE</p><h2>Every frame is<br />a world <em>waiting.</em></h2><div className="manifesto-copy"><p>An owner-managed splash-art archive designed around a strict 16:9 presentation and a deterministic category/rank order.</p><p>The catalogue is backed by Supabase while SEO routes render server-side.</p></div></section>
    <SiteFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(itemList).replace(/</g,'\\u003c')}} />
    {artworkJsonLd?<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(artworkJsonLd).replace(/</g,'\\u003c')}} />:null}
  </>;
}
