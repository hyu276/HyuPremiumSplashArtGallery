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
      <section className="taxonomy-intro" id="top">
        <div><p className="taxonomy-intro-kicker">HYU PREMIUM / Universe catalogue</p><h1>Dòng trang phục<br/><em>theo thế giới.</em></h1></div>
        <p className="taxonomy-intro-copy">Mỗi dòng là một section riêng. Chọn tên dòng để mở gallery artwork theo cùng thao tác mở rộng của thư viện chính.</p>
      </section>
      <TaxonomyGalleryClient mode="universes" groups={groups}/>
    </main>
    <SiteFooter/>
  </>;
}
