'use client';

import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <div className="simple-page">
    <SiteHeader/>
    <main className="simple-main">
      <p className="eyebrow">HYU PREMIUM / CÓ LỖI XẢY RA</p>
      <h1>Chưa thể tải nội dung.</h1>
      <p>Hệ thống vừa gặp sự cố tạm thời. Bạn có thể thử tải lại nội dung ngay bây giờ.</p>
      <p><button type="button" onClick={reset}>Thử lại</button></p>
    </main>
    <SiteFooter/>
  </div>;
}
