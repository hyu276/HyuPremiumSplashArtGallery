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
  const groups=artworkTaxonomyGroups(catalogue.items,'skinlines');
  return <>
    <SiteHeader/>
    <CatalogueFreshnessGuard revision={catalogue.revision}/>
    <main className="taxonomy-page">
      <section className="taxonomy-intro" id="top">
        <div><p className="taxonomy-intro-kicker">HYU PREMIUM / Skinline catalogue</p><h1>Trang phục theo bộ<br/><em>theo nhóm.</em></h1></div>
        <p className="taxonomy-intro-copy">Mỗi bộ là một section riêng. Chọn tên bộ để mở gallery carousel chứa những artwork đã được gán vào bộ đó.</p>
      </section>
      <TaxonomyGalleryClient mode="skinlines" groups={groups}/>
    </main>
    <SiteFooter/>
  </>;
}
