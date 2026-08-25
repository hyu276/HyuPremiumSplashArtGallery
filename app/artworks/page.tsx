import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { artworkPath, getCatalogue } from '@/lib/catalogue';
import { metadataForPath } from '@/lib/seo';

export const revalidate=300;
export async function generateMetadata():Promise<Metadata>{return metadataForPath('/artworks/',{title:'Thư viện Splash Art Game — Danh mục tác phẩm',description:'Duyệt thư viện splash art game HYU PREMIUM theo nhân vật hoặc danh mục, hạng skin và credit ảnh.',alternates:{canonical:'https://hyupremium.vercel.app/artworks/'}})}

export default async function ArtworkIndex(){
  const {items}=await getCatalogue();
  return <><SiteHeader/><main className="simple-main" style={{maxWidth:'none'}}><p className="eyebrow">HYU PREMIUM / DANH MỤC TÁC PHẨM</p><h1>Danh mục tác phẩm.</h1><div className="gallery-grid">{items.map((item,index)=><a className="art-card" href={artworkPath(item)} key={item.id}><span className="art-image-layer"><img className="preview" src={item.thumbnail||item.image} alt={`${item.name} — ${item.category}, splash art game, hạng skin ${item.rank}`} loading={index<8?'eager':'lazy'} decoding="async"/></span><span className="shade"></span><span className="card-number">{String(index+1).padStart(2,'0')}</span><span className="card-copy"><span className="card-meta">{item.category} · {item.rank}</span><strong>{item.name}</strong><span className="card-bottom"><span>CREDIT ẢNH · {item.credit}</span></span></span></a>)}</div></main><SiteFooter/></>;
}
