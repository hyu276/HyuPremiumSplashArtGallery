import type { Metadata } from 'next';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getTeamMembers, safeSocialUrl } from '@/lib/team';
import { metadataForPath } from '@/lib/seo';
import './about.css';

export const revalidate=300;
export async function generateMetadata():Promise<Metadata>{return metadataForPath('/about/',{title:'Giới thiệu',description:'Giới thiệu HYU PREMIUM và thư viện splash art kỹ thuật số được tuyển chọn, quản lý thủ công.',alternates:{canonical:'https://hyupremium.vercel.app/about/'}})}

const SOCIALS=[['facebook','Facebook'],['tiktok','TikTok'],['instagram','Instagram'],['x','X'],['linkedin','LinkedIn'],['pinterest','Pinterest'],['artstation','ArtStation'],['deviantart','DeviantArt']] as const;
type SocialKey=(typeof SOCIALS)[number][0];

function SocialIcon({social}:{social:SocialKey}){
  const props={width:14,height:14,viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true as const};
  if(social==='facebook')return <svg {...props}><path d="M13.5 22v-8.5h2.85l.43-3.33H13.5V8.04c0-.97.27-1.62 1.66-1.62h1.77V3.45a23.4 23.4 0 0 0-2.58-.14c-2.55 0-4.3 1.56-4.3 4.42v2.44H7.17v3.33h2.88V22h3.45Z"/></svg>;
  if(social==='tiktok')return <svg {...props}><path d="M19.59 6.69a4.8 4.8 0 0 1-3.77-4.25V2h-3.45v13.67a2.9 2.9 0 1 1-2-2.76V9.4a6.33 6.33 0 1 0 5.45 6.27V8.69a8.2 8.2 0 0 0 4.77 1.53V6.79c-.34 0-.67-.04-1-.1Z"/></svg>;
  if(social==='instagram')return <svg {...props} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
  if(social==='x')return <svg {...props}><path d="M18.24 2.25h3.31l-7.23 8.26 8.51 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z"/></svg>;
  if(social==='pinterest')return <svg {...props}><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>;
  if(social==='artstation')return <svg {...props}><path d="M0 17.723l2.027 3.505h.001a2.424 2.424 0 0 0 2.164 1.333h13.457l-2.792-4.838H0zm24 .025c0-.484-.143-.935-.388-1.314L15.728 2.728a2.424 2.424 0 0 0-2.142-1.289H9.419L21.598 22.54l1.92-3.325c.378-.637.482-.919.482-1.467zm-11.129-3.462L7.428 4.858l-5.444 9.428h10.887z"/></svg>;
  if(social==='deviantart')return <svg {...props}><path d="M19.207 4.794l.23-.43V0H15.07l-.436.44-2.058 3.925-.646.436H4.58v5.993h4.04l.36.436-4.175 7.98-.24.43V24H8.93l.436-.44 2.07-3.925.644-.436h7.35v-5.993h-4.05l-.36-.438 4.186-7.977z"/></svg>;
  return <svg {...props}><circle cx="5" cy="5" r="2"/><rect x="3" y="9" width="4" height="12" rx="1"/><path d="M10 9h3.8v1.65c.95-1.25 2.2-2 4.15-2 3.1 0 4.55 2 4.55 5.7V21h-4v-5.85c0-1.9-.55-3.15-2.25-3.15-1.85 0-2.25 1.4-2.25 3.15V21h-4V9Z"/></svg>;
}

export default async function About(){
  const team=await getTeamMembers();
  return <><SiteHeader/><main>
    <section className="page-hero"><div className="kicker">HYU PREMIUM / Giới thiệu</div><h1>Được xây dựng<br/><em>vì nghệ thuật.</em></h1><p>HYU PREMIUM là thư viện splash art kỹ thuật số được tuyển chọn và quản lý thủ công, tập trung trình bày artwork game như một bộ sưu tập có cấu trúc thay vì một luồng ảnh rời rạc.</p></section>
    <div className="content-wrap">
      <section className="section-grid"><div className="section-label">01 / HYU PREMIUM là gì?</div><div className="section-copy"><h2>Một thư viện hình ảnh luôn được cập nhật.</h2><p>Tác phẩm được tổ chức theo nhân vật hoặc danh mục, hạng skin và credit ảnh. Hệ thống được thiết kế để bộ sưu tập có thể tiếp tục mở rộng mà vẫn giữ cách trình bày nhất quán trên cả desktop lẫn mobile.</p></div></section>
      <section className="section-grid"><div className="section-label">02 / Nguyên tắc</div><div className="section-copy"><h2>Tuyển chọn kỹ, sắp xếp rõ, xem dễ.</h2><div className="principles"><article className="principle"><b>Tuyển chọn</b><h3>Chủ động kiểm soát nội dung</h3><p>Tác phẩm, trạng thái hiển thị, danh mục, credit và hạng skin được quản lý từ dashboard riêng.</p></article><article className="principle"><b>Cấu trúc</b><h3>Phân cấp rõ ràng</h3><p>Artwork được sắp xếp theo hệ thống danh mục và hạng xác định thay vì xuất hiện ngẫu nhiên như một feed thông thường.</p></article><article className="principle"><b>Trình bày</b><h3>Ưu tiên tác phẩm</h3><p>Thumbnail 16:9, giao diện tiết chế và typography tương phản cao giúp artwork luôn là trọng tâm.</p></article></div></div></section>
      <section className="section-grid"><div className="section-label">03 / Nền tảng</div><div className="section-copy"><h2>Thiết kế để tiếp tục phát triển.</h2><p>Website được triển khai trên Vercel, sử dụng GitHub làm nguồn metadata và Cloudflare R2 để lưu trữ, phân phối hình ảnh. Kiến trúc này cho phép mở rộng thêm các khu vực biên tập như Tin tức và Bài viết mà không làm thay đổi quy trình quản lý thư viện cốt lõi.</p></div></section>
      <section className="section-grid team-section" id="our-team"><div className="section-label">04 / Đội ngũ</div><div className="section-copy"><h2>Những người đứng sau thư viện.</h2><p>Đây là những người tham gia xây dựng, tuyển chọn và duy trì HYU PREMIUM.</p>{team.length?<div className="team-grid">{team.map(member=>{const v320=member.variants?.['320'];const v640=member.variants?.['640'];const src=v320?.url||v640?.url||member.image;const srcSet=[v320&&`${v320.url} ${v320.width}w`,v640&&`${v640.url} ${v640.width}w`].filter(Boolean).join(', ');return <article className="team-card" key={member.id}><img src={src} srcSet={srcSet||undefined} sizes="(max-width: 760px) 80vw, 320px" alt={member.name} loading="lazy" decoding="async"/><div className="team-fade" aria-hidden="true"></div><div className="team-overlay"><h3>{member.name}</h3><div className="team-socials">{SOCIALS.map(([key,label])=>{const hidden=Boolean(member[`${key}_hidden` as keyof typeof member]);const url=safeSocialUrl(String(member[`${key}_url` as keyof typeof member]||''));return !hidden&&url?<a className="team-social" key={key} href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${label} — ${member.name}`} title={label}><SocialIcon social={key}/></a>:null})}</div></div></article>})}</div>:<div className="team-state"><span>ĐỘI NGŨ</span><strong>Thông tin đội ngũ sẽ sớm được cập nhật.</strong></div>}</div></section>
    </div>
  </main><SiteFooter/></>;
}
