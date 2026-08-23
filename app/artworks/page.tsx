import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { artworkPath, getCatalogue } from '@/lib/catalogue';
import { metadataForPath } from '@/lib/seo';

export const revalidate=300;
export async function generateMetadata():Promise<Metadata>{return metadataForPath('/artworks/',{title:'Gaming Splash Art Archive — Artwork Index',description:'Browse the HYU PREMIUM gaming splash art archive by character/category, skin rank and image credit.',alternates:{canonical:'https://hyupremium.vercel.app/artworks/'}})}

export default async function ArtworkIndex(){
  const {items}=await getCatalogue();
  return <><SiteHeader/><main className="simple-main" style={{maxWidth:'none'}}><p className="eyebrow">HYU PREMIUM / ARTWORK INDEX</p><h1>Artwork index.</h1><div className="gallery-grid">{items.map((item,index)=><a className="art-card" href={artworkPath(item)} key={item.id}><span className="art-image-layer"><img className="preview" src={item.thumbnail||item.image} alt={`${item.name} — ${item.category} gaming splash art, skin rank ${item.rank}`} loading={index<8?'eager':'lazy'} decoding="async"/></span><span className="shade"></span><span className="card-number">{String(index+1).padStart(2,'0')}</span><span className="card-copy"><span className="card-meta">{item.category} · {item.rank}</span><strong>{item.name}</strong><span className="card-bottom"><span>IMAGE CREDIT · {item.credit}</span></span></span></a>)}</div></main><SiteFooter/></>;
}
