import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export default function NotFound(){
  return <div className="simple-page">
    <SiteHeader/>
    <main className="simple-main">
      <p className="eyebrow">404 / KHÔNG TÌM THẤY</p>
      <h1>Trang này không tồn tại.</h1>
      <p>Đường dẫn có thể đã thay đổi hoặc nội dung không còn khả dụng. Bạn có thể quay lại thư viện để tiếp tục khám phá.</p>
      <p><Link href="/character/">← Quay lại thư viện</Link></p>
    </main>
    <SiteFooter/>
  </div>;
}
