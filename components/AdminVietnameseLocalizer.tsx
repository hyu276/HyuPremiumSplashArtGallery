'use client';

import { useEffect } from 'react';

const EXACT:Record<string,string>={
  'HYU PREMIUM / OWNER':'HYU PREMIUM / QUẢN TRỊ',
  'OWNER':'QUẢN TRỊ',
  'Next.js · React · TypeScript owner dashboard for artwork, SEO properties, images and team data.':'Dashboard quản trị artwork, thuộc tính SEO, hình ảnh và dữ liệu đội ngũ trên Next.js · React · TypeScript.',
  'Owner security:':'Bảo mật quản trị:',
  'Supabase Auth + Row Level Security remain authoritative. The browser uses only the public publishable key; owner access is verified against public.admins.':'Supabase Auth và Row Level Security là lớp kiểm soát quyền chính. Trình duyệt chỉ sử dụng khóa publishable công khai; quyền quản trị được xác minh qua public.admins.',
  'Checking Supabase session...':'Đang kiểm tra phiên đăng nhập Supabase...',
  'Sign in to check thumbnail coverage.':'Đăng nhập để kiểm tra tình trạng thumbnail.',
  'Sign in to manage the About Us team section.':'Đăng nhập để quản lý mục Đội ngũ trên trang Giới thiệu.',
  'Loading catalogue from Supabase...':'Đang tải bộ sưu tập từ Supabase...',
  'Signed out. Enter owner credentials.':'Chưa đăng nhập. Hãy nhập tài khoản quản trị.',
  'Signing in...':'Đang đăng nhập...',
  'Signed out.':'Đã đăng xuất.',
  'Admin login required.':'Cần đăng nhập bằng tài khoản quản trị.',
  'This account is not listed in public.admins.':'Tài khoản này chưa được cấp quyền trong public.admins.',
  'Selected image exceeds 10 MB.':'Ảnh đã chọn vượt quá giới hạn 10 MB.',
  'Use JPG, PNG, WebP or GIF.':'Vui lòng dùng ảnh JPG, PNG, WebP hoặc GIF.',
  'Artwork updated locally. Publish when ready.':'Đã cập nhật tác phẩm trong bản nháp. Bấm Xuất bản thay đổi khi hoàn tất.',
  'Artwork added locally. Publish when ready.':'Đã thêm tác phẩm vào bản nháp. Bấm Xuất bản thay đổi khi hoàn tất.',
  'Saving choices to Supabase...':'Đang lưu các tùy chọn lên Supabase...',
  'Publishing artwork catalogue...':'Đang xuất bản bộ sưu tập...',
  'Refreshing public gallery cache...':'Đang làm mới dữ liệu trên thư viện công khai...',
  'Published to Supabase and refreshed on the public gallery.':'Đã xuất bản lên Supabase và cập nhật thư viện công khai.',
  'Publish failed.':'Xuất bản thất bại.',
  'Public cache refresh failed.':'Không thể làm mới cache của thư viện công khai.',
  'Catalogue/options changed locally.':'Bộ sưu tập hoặc tùy chọn đã được thay đổi trong bản nháp.',
  'Catalogue is in sync with Supabase.':'Bộ sưu tập đang đồng bộ với Supabase.',
  'Sign in to load catalogue.':'Đăng nhập để tải bộ sưu tập.',
  'Thumbnail optimization failed.':'Tối ưu thumbnail thất bại.',
  'Team image exceeds 10 MB.':'Ảnh thành viên vượt quá giới hạn 10 MB.',
  'Team member Name is required.':'Vui lòng nhập tên thành viên.',
  'Team member image URL or file is required.':'Vui lòng nhập URL ảnh hoặc tải ảnh thành viên lên.',
  'Team member saved.':'Đã lưu thành viên.',
  'Unable to save team member.':'Không thể lưu thành viên.',
  'Team order saved.':'Đã lưu thứ tự đội ngũ.',
  'Unable to save team order.':'Không thể lưu thứ tự đội ngũ.',
  'Signed out':'Chưa đăng nhập',
  'Open gallery':'Mở thư viện',
  'Emergency legacy':'Dashboard dự phòng',
  'Supabase owner login':'Đăng nhập quản trị Supabase',
  'Password':'Mật khẩu',
  'Sign in':'Đăng nhập',
  'Sign out':'Đăng xuất',
  'Reload':'Tải lại',
  'Publish changes':'Xuất bản thay đổi',
  'Edit artwork':'Chỉnh sửa tác phẩm',
  'Add artwork':'Thêm tác phẩm',
  'Artwork preview':'Xem trước tác phẩm',
  'Name':'Tên',
  'Keep Name for next artwork':'Giữ tên cho tác phẩm tiếp theo',
  'Description':'Mô tả',
  'shown when expanded':'hiển thị khi mở rộng',
  'Category':'Danh mục',
  'Skin rank':'Hạng skin',
  'Image credit':'Credit ảnh',
  'Choose rank':'Chọn hạng',
  'Image URL':'URL ảnh',
  'optional when uploading file':'không bắt buộc nếu tải tệp lên',
  'JPG, PNG, WebP or GIF · max 10 MB · upload to Supabase Storage.':'JPG, PNG, WebP hoặc GIF · tối đa 10 MB · ảnh sẽ được tải lên Supabase Storage.',
  'Update artwork':'Cập nhật tác phẩm',
  'Clear':'Xóa form',
  'Artwork choices':'Tùy chọn tác phẩm',
  'Artwork image optimization':'Tối ưu ảnh tác phẩm',
  'Gallery cards use optimized 1600×900 WebP/JPEG thumbnails. Originals remain for expanded/detail SEO pages.':'Thẻ trong thư viện dùng thumbnail WebP/JPEG 1600×900 đã tối ưu. Ảnh gốc vẫn được giữ cho chế độ mở rộng và trang chi tiết SEO.',
  'Optimize missing thumbnails':'Tối ưu thumbnail còn thiếu',
  'Refresh status':'Làm mới trạng thái',
  'Stop':'Dừng',
  'Unpublished changes':'Có thay đổi chưa xuất bản',
  'No unpublished changes':'Không có thay đổi chưa xuất bản',
  'Select visible':'Chọn các mục đang hiển thị',
  'Hide':'Ẩn',
  'Unhide':'Hiện lại',
  'Clone':'Nhân bản',
  'Mark Việt Nam':'Đánh dấu Việt Nam',
  'Remove Việt Nam':'Bỏ đánh dấu Việt Nam',
  'Delete':'Xóa',
  'Edit':'Sửa',
  'No description':'Chưa có mô tả',
  'No artworks loaded or matching.':'Chưa có tác phẩm hoặc không có kết quả phù hợp.',
  'About Us / Our Team':'Giới thiệu / Đội ngũ',
  'Team changes save directly to Supabase. Drag rows or use arrows to reorder, then Save order.':'Thay đổi đội ngũ được lưu trực tiếp lên Supabase. Kéo thả hoặc dùng các nút mũi tên để sắp xếp, sau đó bấm Lưu thứ tự.',
  'Team member preview':'Xem trước ảnh thành viên',
  'Order':'Thứ tự',
  'Hide this member from About Us':'Ẩn thành viên này khỏi trang Giới thiệu',
  'or upload below':'hoặc tải tệp bên dưới',
  'Hide icon':'Ẩn biểu tượng',
  'Update team member':'Cập nhật thành viên',
  'Add team member':'Thêm thành viên',
  'Reload team':'Tải lại đội ngũ',
  'Save order':'Lưu thứ tự',
  'Hidden':'Đang ẩn',
  'Visible':'Đang hiển thị',
  'Add':'Thêm',
  'Category choices':'Danh sách danh mục',
  'Image credit choices':'Danh sách credit ảnh',
  'Skin rank choices':'Danh sách hạng skin',
  'Rename':'Đổi tên',
  'Remove':'Xóa'
};

function translate(value:string){
  const text=value.trim();
  if(EXACT[text])return value.replace(text,EXACT[text]);
  const rules:[RegExp,(m:RegExpMatchArray)=>string][]=[
    [/^Signed in: (.+)$/i,m=>`Đã đăng nhập: ${m[1]}`],
    [/^Loaded (\d+) artworks from Supabase\.$/i,m=>`Đã tải ${m[1]} tác phẩm từ Supabase.`],
    [/^(\d+)\/(\d+) artworks optimized(?: · (\d+) remaining)?\.$/i,m=>`${m[1]}/${m[2]} tác phẩm đã tối ưu${m[3]?` · còn ${m[3]}`:''}.`],
    [/^Loaded (\d+) team members\.$/i,m=>`Đã tải ${m[1]} thành viên.`],
    [/^(\d+) artworks$/i,m=>`${m[1]} tác phẩm`],
    [/^(\d+) selected$/i,m=>`Đã chọn ${m[1]}`],
    [/^(\d+) team members$/i,m=>`${m[1]} thành viên`],
    [/^Order (\d+) · Hidden$/i,m=>`Thứ tự ${m[1]} · Đang ẩn`],
    [/^Order (\d+) · Visible$/i,m=>`Thứ tự ${m[1]} · Đang hiển thị`],
    [/^(\d+) image uploads$/i,m=>`${m[1]} ảnh chờ tải lên`],
    [/^(\d+) deletions$/i,m=>`${m[1]} mục chờ xóa`],
    [/^Optimizing (\d+)\/(\d+): (.+)\.\.\.$/i,m=>`Đang tối ưu ${m[1]}/${m[2]}: ${m[3]}...`],
    [/^Stopped\. (\d+) optimized, (\d+) failed\.$/i,m=>`Đã dừng. Tối ưu thành công ${m[1]}, lỗi ${m[2]}.`],
    [/^(\d+) optimized, (\d+) failed\.$/i,m=>`Tối ưu thành công ${m[1]}, lỗi ${m[2]}.`],
    [/^Uploading (.+)\.\.\.$/i,m=>`Đang tải lên ${m[1]}...`],
    [/^Published in Supabase, but public cache refresh failed: (.+)$/i,m=>`Đã xuất bản lên Supabase nhưng chưa thể làm mới thư viện công khai: ${m[1]}`],
    [/^Cannot remove (.+): artwork still references it\.$/i,m=>`Không thể xóa ${m[1]} vì vẫn có tác phẩm đang sử dụng mục này.`],
    [/^(.+) already exists\.$/i,m=>`${m[1]} đã tồn tại.`],
    [/^Select (.+)$/i,m=>`Chọn ${m[1]}`],
    [/^Drag (.+)$/i,m=>`Kéo ${m[1]}`]
  ];
  for(const [pattern,fn] of rules){const match=text.match(pattern);if(match)return value.replace(text,fn(match))}
  return value;
}

function translateNode(root:ParentNode){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node:Node|null;
  while((node=walker.nextNode())){
    const current=node.nodeValue||'';const next=translate(current);if(next!==current)node.nodeValue=next;
  }
  if(root instanceof Element){
    const elements=[root,...Array.from(root.querySelectorAll('*'))];
    for(const element of elements){
      for(const attr of ['title','aria-label','placeholder']){const current=element.getAttribute(attr);if(current){const next=translate(current);if(next!==current)element.setAttribute(attr,next)}}
    }
  }
}

export default function AdminVietnameseLocalizer(){
  useEffect(()=>{
    const body=document.body;
    translateNode(body);
    const observer=new MutationObserver(records=>{for(const record of records){
      if(record.type==='characterData'&&record.target.parentNode)translateNode(record.target.parentNode);
      if(record.type==='attributes'&&record.target instanceof Element)translateNode(record.target);
      for(const added of record.addedNodes){if(added.nodeType===Node.ELEMENT_NODE)translateNode(added as Element);else if(added.parentNode)translateNode(added.parentNode)}
    }});
    observer.observe(body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});

    const originalConfirm=window.confirm.bind(window);
    const originalPrompt=window.prompt.bind(window);
    window.confirm=(message?:string)=>originalConfirm(message?message
      .replace(/^Delete “(.+)”\? This remains local until Publish changes\.$/i,'Xóa “$1”? Thay đổi chỉ được áp dụng khi bạn bấm Xuất bản thay đổi.')
      .replace(/^Delete (\d+) selected artworks locally\?$/i,'Xóa $1 tác phẩm đã chọn khỏi bản chỉnh sửa hiện tại?')
      .replace(/^Delete team member “(.+)”\?$/i,'Xóa thành viên “$1”?'):message);
    window.prompt=(message?:string,defaultValue?:string)=>originalPrompt(message?.replace(/^Rename (.+):$/i,'Đổi tên $1:'),defaultValue);

    return()=>{observer.disconnect();window.confirm=originalConfirm;window.prompt=originalPrompt};
  },[]);
  return null;
}
