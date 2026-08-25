'use client';

import { useEffect } from 'react';

const EXACT:Record<string,string>={
  'OWNER':'QUẢN TRỊ',
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
  'Update artwork':'Cập nhật tác phẩm',
  'Clear':'Xóa form',
  'Artwork choices':'Tùy chọn tác phẩm',
  'Artwork image optimization':'Tối ưu ảnh tác phẩm',
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
    [/^(\d+) optimized, (\d+) failed\.$/i,m=>`Tối ưu thành công ${m[1]}, lỗi ${m[2]}.`]
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
    const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData'&&record.target.parentNode)translateNode(record.target.parentNode);for(const added of record.addedNodes){if(added.nodeType===Node.ELEMENT_NODE)translateNode(added as Element);else if(added.parentNode)translateNode(added.parentNode)}}});
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
