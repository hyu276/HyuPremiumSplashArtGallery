/* Normalize the visible bounds of transparent, still skin-rank badges before R2 upload. */
const MAX_OUTPUT_EDGE = 1024;
const MAX_ANALYSIS_PIXELS = 8_000_000;
const SAFETY_PADDING = 0.08;

export type BadgeBounds = { left:number; top:number; right:number; bottom:number };
export type PreparedBadge = { file:File; normalized:boolean; reason:string };

export function visibleAlphaBounds(data:Uint8ClampedArray,width:number,height:number):BadgeBounds|null {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      if(data[(y*width+x)*4+3]===0)continue;
      if(x<left)left=x;
      if(x>right)right=x;
      if(y<top)top=y;
      if(y>bottom)bottom=y;
    }
  }
  return right<left?null:{left,top,right,bottom};
}

export function paddedBadgeBounds(bounds:BadgeBounds){
  const width=bounds.right-bounds.left+1;
  const height=bounds.bottom-bounds.top+1;
  const padding=Math.max(3,Math.ceil(Math.max(width,height)*SAFETY_PADDING));
  return {width:width+padding*2,height:height+padding*2,offsetX:padding-bounds.left,offsetY:padding-bounds.top};
}

function animatedWebp(header:Uint8Array){
  return header.length>=21&&String.fromCharCode(...header.subarray(0,4))==='RIFF'&&
    String.fromCharCode(...header.subarray(8,12))==='WEBP'&&
    String.fromCharCode(...header.subarray(12,16))==='VP8X'&&Boolean(header[20]&2);
}

function animatedPng(bytes:Uint8Array){
  if(bytes.length<24)return false;
  let cursor=8;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  while(cursor+12<=bytes.length){
    const length=view.getUint32(cursor,false);
    if(length>bytes.length-cursor-12)break;
    const type=String.fromCharCode(...bytes.subarray(cursor+4,cursor+8));
    if(type==='acTL')return true;
    if(type==='IDAT'||type==='IEND')break;
    cursor+=length+12;
  }
  return false;
}

function encodePng(canvas:HTMLCanvasElement):Promise<Blob>{
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob&&blob.type==='image/png'?resolve(blob):reject(new Error('Không thể mã hóa ảnh badge PNG.')), 'image/png'));
}

export async function prepareSkinRankBadge(file:File):Promise<PreparedBadge>{
  if(file.type==='image/gif')return {file,normalized:false,reason:'Giữ nguyên GIF động'};
  if(file.type!=='image/png'&&file.type!=='image/webp')return {file,normalized:false,reason:'Ảnh không có kênh alpha để chuẩn hóa'};
  const header=new Uint8Array(await file.arrayBuffer());
  if(file.type==='image/png'&&animatedPng(header))return {file,normalized:false,reason:'Giữ nguyên PNG động'};
  if(file.type==='image/webp'&&animatedWebp(header))return {file,normalized:false,reason:'Giữ nguyên WebP động'};

  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file)}catch{throw new Error('Không giải mã được ảnh badge. Vui lòng chọn PNG/WebP hợp lệ.')}
  try{
    if(!bitmap.width||!bitmap.height)throw new Error('Ảnh badge không có kích thước hợp lệ.');
    if(bitmap.width*bitmap.height>MAX_ANALYSIS_PIXELS){
      return {file,normalized:false,reason:'Ảnh quá lớn để phân tích alpha an toàn; giữ nguyên file nhằm bảo toàn chi tiết'};
    }
    const width=bitmap.width;
    const height=bitmap.height;
    const working=document.createElement('canvas');working.width=width;working.height=height;
    const ctx=working.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Trình duyệt không hỗ trợ xử lý alpha của badge.');
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(bitmap,0,0,width,height);
    const pixels=ctx.getImageData(0,0,width,height).data;
    const bounds=visibleAlphaBounds(pixels,width,height);
    if(!bounds)throw new Error('Badge hoàn toàn trong suốt, không có nội dung để hiển thị.');
    const visibleWidth=bounds.right-bounds.left+1;
    const visibleHeight=bounds.bottom-bounds.top+1;
    const hasMargins=visibleWidth<width*.90||visibleHeight<height*.90;
    if(!hasMargins)return {file,normalized:false,reason:'Ảnh đã sát vùng nội dung, không cần cắt'};
    const crop=paddedBadgeBounds(bounds);
    const outputScale=Math.min(1,MAX_OUTPUT_EDGE/Math.max(crop.width,crop.height));
    const output=document.createElement('canvas');
    output.width=Math.max(1,Math.round(crop.width*outputScale));
    output.height=Math.max(1,Math.round(crop.height*outputScale));
    const out=output.getContext('2d');
    if(!out)throw new Error('Không khởi tạo được bộ chuẩn hóa badge.');
    out.drawImage(working,crop.offsetX*outputScale,crop.offsetY*outputScale,width*outputScale,height*outputScale);
    const blob=await encodePng(output);
    return {file:new File([blob],file.name.replace(/\.[^.]+$/, '')+'-badge.png',{type:'image/png'}),normalized:true,reason:'Đã thu gọn nền trong suốt, giữ mọi pixel alpha và 8% khoảng đệm an toàn'};
  }finally{bitmap.close()}
}
