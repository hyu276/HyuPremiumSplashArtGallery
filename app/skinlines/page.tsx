import type { Metadata } from 'next';
import CatalogueFreshnessGuard from '@/components/CatalogueFreshnessGuard';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import TaxonomyGalleryClient from '@/components/TaxonomyGalleryClient';
import { artworkTaxonomyGroups, getCatalogue, siteUrl } from '@/lib/catalogue';

export const revalidate=300;

export const metadata:Metadata={
  title:'Trang phục theo bộ — HYU PREMIUM',
  description:'Khám phá splash art HYU PREMIUM theo từng bộ trang phục và mở gallery carousel của mỗi bộ.',
  alternates:{canonical:`${siteUrl}/skinlines/`},
  openGraph:{title:'Trang phục theo bộ — HYU PREMIUM',description:'Khám phá splash art HYU PREMIUM theo từng bộ trang phục.',url:`${siteUrl}/skinlines/`,type:'website',locale:'vi_VN'}
};

export default async function SkinlinesPage(){
  const catalogue=await getCatalogue();
  const groups=artworkTaxonomyGroups(catalogue.items,'skinlines',catalogue.taxonomyRepresentatives.skinlines);
  return <>
    <SiteHeader/>
    <CatalogueFreshnessGuard revision={catalogue.revision}/>
    <main className="taxonomy-page">
      <section className="hero taxonomy-hero" id="top"><div className="hero-kicker"><i></i> HYU PREMIUM / Skinline catalogue</div><h1>Trang phục<br/>theo <em>bộ.</em></h1><div className="hero-foot"><p>Chọn một bộ trang phục để mở rộng artwork đại diện và khám phá toàn bộ splash art thuộc bộ đó theo cùng thao tác của thư viện chính.</p><span>Cuộn xuống để khám phá ↓</span></div></section>
      <TaxonomyGalleryClient mode="skinlines" groups={groups}/>
    </main>
    <SiteFooter/>
  </>;
}
