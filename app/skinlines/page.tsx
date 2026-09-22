import type { Metadata } from 'next';
import CatalogueFreshnessGuard from '@/components/CatalogueFreshnessGuard';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import TaxonomyGalleryClient from '@/components/TaxonomyGalleryClient';
import { artworkTaxonomyGroups, getCatalogue, siteUrl } from '@/lib/catalogue';

export const revalidate=300;

export const metadata:Metadata={
  title:'Trang phục theo bộ — HYU PREMIUM',
  description:'Khám phá splash art HYU PREMIUM theo từng bộ trang phục với gallery tương tác.',
  alternates:{canonical:`${siteUrl}/skinlines/`},
  openGraph:{title:'Trang phục theo bộ — HYU PREMIUM',description:'Khám phá splash art HYU PREMIUM theo từng bộ trang phục.',url:`${siteUrl}/skinlines/`,type:'website',locale:'vi_VN'}
};

export default async function SkinlinesPage(){
  const catalogue=await getCatalogue();
  const groups=artworkTaxonomyGroups(catalogue.items,'skinlines',catalogue.taxonomyRepresentatives.skinlines);
  return <>
    <SiteHeader/>
    <CatalogueFreshnessGuard revision={catalogue.revision}/>
    <main className="taxonomy-page"><section className="hero taxonomy-hero" id="top"><div className="hero-kicker"><i></i> HYU PREMIUM / Skinline catalogue</div><h1>Trang phục<br/><em>theo bộ.</em></h1><div className="hero-foot"><p>Khám phá các bộ trang phục qua gallery tương tác theo chuẩn thư viện HYU PREMIUM.</p><span>Cuộn xuống để khám phá ↓</span></div></section><TaxonomyGalleryClient mode="skinlines" groups={groups}/><section className="manifesto"><p className="eyebrow">HYU PREMIUM / SKINLINES</p><h2>Mỗi bộ sưu tập có<br/>một dấu ấn <em>riêng.</em></h2><div className="manifesto-copy"><p>Gallery sử dụng cùng ngôn ngữ tương tác với thư viện nhân vật: card 16:9, hover, expand inline và derivative 1600px khi mở rộng.</p></div></section></main>
    <SiteFooter/>
  </>;
}
