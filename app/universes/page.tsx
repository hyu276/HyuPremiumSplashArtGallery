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
    <main className="taxonomy-page">
      <section className="hero taxonomy-hero" id="top"><div className="hero-kicker"><i></i> HYU PREMIUM / Universe catalogue</div><h1>Dòng trang phục<br/>theo <em>thế giới.</em></h1><div className="hero-foot"><p>Chọn một dòng trang phục để mở rộng artwork đại diện và khám phá toàn bộ splash art thuộc thế giới đó theo cùng thao tác của thư viện chính.</p><span>Cuộn xuống để khám phá ↓</span></div></section>
      <TaxonomyGalleryClient mode="universes" groups={groups}/>
    </main>
    <SiteFooter/>
  </>;
}
