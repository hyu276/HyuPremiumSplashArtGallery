import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getTeamMembers, safeSocialUrl } from '@/lib/team';
import { metadataForPath } from '@/lib/seo';
import './about.css';

export const revalidate=300;
export async function generateMetadata():Promise<Metadata>{return metadataForPath('/about/',{title:'Giới thiệu',description:'Giới thiệu HYU PREMIUM và thư viện splash art kỹ thuật số được tuyển chọn, quản lý thủ công.',alternates:{canonical:'https://hyupremium.vercel.app/about/'}})}

const SOCIALS=[['facebook','Facebook'],['tiktok','TikTok'],['instagram','Instagram'],['x','X'],['linkedin','LinkedIn']] as const;

export default async function About(){
  const team=await getTeamMembers();
  return <><SiteHeader/><main>
    <section className="page-hero"><div className="kicker">HYU PREMIUM / Giới thiệu</div><h1>Được xây dựng<br/><em>vì nghệ thuật.</em></h1><p>HYU PREMIUM là thư viện splash art kỹ thuật số được tuyển chọn và quản lý thủ công, tập trung trình bày artwork game như một bộ sưu tập có cấu trúc thay vì một luồng ảnh rời rạc.</p></section>
    <div className="content-wrap">
      <section className="section-grid"><div className="section-label">01 / HYU PREMIUM là gì?</div><div className="section-copy"><h2>Một thư viện hình ảnh luôn được cập nhật.</h2><p>Tác phẩm được tổ chức theo nhân vật hoặc danh mục, hạng skin và credit ảnh. Hệ thống được thiết kế để bộ sưu tập có thể tiếp tục mở rộng mà vẫn giữ cách trình bày nhất quán trên cả desktop lẫn mobile.</p></div></section>
      <section className="section-grid"><div className="section-label">02 / Nguyên tắc</div><div className="section-copy"><h2>Tuyển chọn kỹ, sắp xếp rõ, xem dễ.</h2><div className="principles"><article className="principle"><b>Tuyển chọn</b><h3>Chủ động kiểm soát nội dung</h3><p>Tác phẩm, trạng thái hiển thị, danh mục, credit và hạng skin được quản lý từ dashboard riêng.</p></article><article className="principle"><b>Cấu trúc</b><h3>Phân cấp rõ ràng</h3><p>Artwork được sắp xếp theo hệ thống danh mục và hạng xác định thay vì xuất hiện ngẫu nhiên như một feed thông thường.</p></article><article className="principle"><b>Trình bày</b><h3>Ưu tiên tác phẩm</h3><p>Thumbnail 16:9, giao diện tiết chế và typography tương phản cao giúp artwork luôn là trọng tâm.</p></article></div></div></section>
      <section className="section-grid"><div className="section-label">03 / Nền tảng</div><div className="section-copy"><h2>Thiết kế để tiếp tục phát triển.</h2><p>Website được triển khai trên Vercel, sử dụng GitHub làm nguồn metadata và Cloudflare R2 để lưu trữ, phân phối hình ảnh. Kiến trúc này cho phép mở rộng thêm các khu vực biên tập như Tin tức và Bài viết mà không làm thay đổi quy trình quản lý thư viện cốt lõi.</p></div></section>
      <section className="section-grid team-section" id="our-team"><div className="section-label">04 / Đội ngũ</div><div className="section-copy"><h2>Những người đứng sau thư viện.</h2><p>Đây là những người tham gia xây dựng, tuyển chọn và duy trì HYU PREMIUM.</p>{team.length?<div className="team-grid">{team.map(member=><article className="team-card" key={member.id}><img src={member.image} alt={member.name} loading="lazy" decoding="async"/><div className="team-fade" aria-hidden="true"></div><div className="team-overlay"><h3>{member.name}</h3><div className="team-socials">{SOCIALS.map(([key,label])=>{const hidden=Boolean(member[`${key}_hidden` as keyof typeof member]);const url=safeSocialUrl(String(member[`${key}_url` as keyof typeof member]||''));return !hidden&&url?<a className="team-social" key={key} href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${label} — ${member.name}`} title={label}>{label.slice(0,2)}</a>:null})}</div></div></article>)}</div>:<div className="team-state"><span>ĐỘI NGŨ</span><strong>Thông tin đội ngũ sẽ sớm được cập nhật.</strong></div>}</div></section>
    </div>
  </main><SiteFooter/></>;
}
