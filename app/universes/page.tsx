import type { Metadata } from 'next';
import CatalogueFreshnessGuard from '@/components/CatalogueFreshnessGuard';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import TaxonomyGalleryClient from '@/components/TaxonomyGalleryClient';
import { artworkTaxonomyGroups, getCatalogue, siteUrl } from '@/lib/catalogue';

export const revalidate=300;

export const metadata:Metadata={
  title:'Dòng trang phục — HYU PREMIUM',
  description:'Khám phá splash art HYU PREMIUM theo từng dòng trang phục và mở gallery carousel của mỗi dòng.',
  alternates:{canonical:`${siteUrl}/universes/`},
  openGraph:{title:'Dòng trang phục — HYU PREMIUM',description:'Khám phá splash art HYU PREMIUM theo từng dòng trang phục.',url:`${siteUrl}/universes/`,type:'website',locale:'vi_VN'}
};

export default async function UniversesPage(){
  const catalogue=await getCatalogue();
  const groups=artworkTaxonomyGroups(catalogue.items,'universes',catalogue.taxonomyRepresentatives.universes);
  return <>
    <SiteHeader/>
    <CatalogueFreshnessGuard revision={catalogue.revision}/>
    <main className="taxonomy-page"><section className="hero taxonomy-hero" id="top"><div className="hero-kicker"><i></i> HYU PREMIUM / Universe catalogue</div><h1>Dòng trang phục<br/><em>đa vũ trụ.</em></h1><div className="hero-foot"><p>Khám phá các dòng trang phục qua artwork đại diện cố định và gallery tương tác theo chuẩn thư viện HYU PREMIUM.</p><span>Cuộn xuống để khám phá ↓</span></div></section><TaxonomyGalleryClient mode="universes" groups={groups}/><section className="manifesto"><p className="eyebrow">HYU PREMIUM / UNIVERSES</p><h2>Mỗi bộ sưu tập có<br/>một dấu ấn <em>riêng.</em></h2><div className="manifesto-copy"><p>Artwork đại diện được chỉ định thủ công trong admin hoặc chọn ổn định từ skin rank cao nhất khi chưa có lựa chọn riêng.</p><p>Gallery sử dụng cùng ngôn ngữ tương tác với thư viện nhân vật: card 16:9, hover, expand inline và derivative 1600px khi mở rộng.</p></div></section></main>
    <SiteFooter/>
  </>;
}
