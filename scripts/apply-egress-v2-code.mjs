import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, transform){
  const before=await readFile(path,'utf8');
  const after=transform(before);
  if(after===before)throw new Error(`${path}: no changes applied`);
  await writeFile(path,after);
  console.log(`patched ${path}`);
}
function one(text,from,to,label){
  if(!text.includes(from))throw new Error(`missing ${label}`);
  return text.replace(from,to);
}

await patch('components/GitHubAdminDashboard.tsx', text=>{
  text=one(text,
`type Choice={name:string;sort_order?:number};
type Artwork={id:string;source?:string;sourceId?:string;name:string;description:string;image:string;thumbnail?:string;tags:string[];hidden:boolean;category:string;rank:string;rankOrder?:number;credit:string;isVietnameseSkin:boolean;updatedAt?:string};`,
`type Choice={name:string;sort_order?:number};
type MediaVariant={url:string;width:number;height:number;bytes?:number;mimeType?:string};
type Artwork={id:string;source?:string;sourceId?:string;name:string;description:string;image:string;thumbnail?:string;variants?:Record<string,MediaVariant>;media?:{original?:MediaVariant};tags:string[];hidden:boolean;category:string;rank:string;rankOrder?:number;credit:string;isVietnameseSkin:boolean;updatedAt?:string};`, 'Artwork type');
  text=one(text,
`type TeamMember={id:number;name:string;image:string;sort_order:number;hidden:boolean;facebook_url:string;facebook_hidden:boolean;tiktok_url:string;tiktok_hidden:boolean;instagram_url:string;instagram_hidden:boolean;x_url:string;x_hidden:boolean;linkedin_url:string;linkedin_hidden:boolean};`,
`type TeamMember={id:number;name:string;image:string;variants?:Record<string,MediaVariant>;media?:{original?:MediaVariant};sort_order:number;hidden:boolean;facebook_url:string;facebook_hidden:boolean;tiktok_url:string;tiktok_hidden:boolean;instagram_url:string;instagram_hidden:boolean;x_url:string;x_hidden:boolean;linkedin_url:string;linkedin_hidden:boolean};`, 'TeamMember type');
  text=text.replace(/function canvasBlob\([\s\S]*?async function makeThumbnail\([\s\S]*?return\{blob,ext\};\n}\n\n/,'');
  if(text.includes('function canvasBlob(')||text.includes('async function makeThumbnail('))throw new Error('client thumbnail generator was not removed');
  text=one(text,
`function choiceByName(rows:Choice[],name:string){return rows.find(x=>x.name.toLowerCase()===name.trim().toLowerCase())}`,
`function choiceByName(rows:Choice[],name:string){return rows.find(x=>x.name.toLowerCase()===name.trim().toLowerCase())}\nfunction completeArtworkVariants(x:Artwork){return ['640','960','1600'].every(width=>Boolean(x.variants?.[width]?.url))}`,'variant helper');
  text=one(text,
`const optimized=mapped.filter(x=>x.thumbnail).length;setOptimizer({text:\`${'${optimized}'}/${'${mapped.length}'} tác phẩm đã tối ưu${'${optimized<mapped.length?` · còn ${mapped.length-optimized}`:`}'}\`,type:optimized===mapped.length?'ok':'warn'});`,
`const optimized=mapped.filter(completeArtworkVariants).length;setOptimizer({text:\`${'${optimized}'}/${'${mapped.length}'} tác phẩm có đủ derivative 640/960/1600${'${optimized<mapped.length?` · còn ${mapped.length-optimized}`:`}'}\`,type:optimized===mapped.length?'ok':'warn'});`, 'optimizer load status');
  text=text.replace(/\n  const uploadThumbnail=async\([\s\S]*?return\{\.\.\.optimized,path,url\}\};/,'');
  if(text.includes('const uploadThumbnail='))throw new Error('uploadThumbnail was not removed');
  text=one(text,
`if(item){item.image=imageUrl;try{const thumb=await uploadThumbnail(id,item.name,p.file);item.thumbnail=thumb.url}catch(e){console.warn('Thumbnail creation failed',e)}}`,
`if(item){item.image=imageUrl;item.thumbnail='';item.variants=undefined;item.media=undefined}`, 'publish client thumbnail removal');
  text=text.replace(/  const optimizeMissing=async\(\)=>\{[\s\S]*?\n\n  const resetTeamForm=/,
`  const optimizeMissing=async()=>{if(optimizing)return;try{ensureAdmin();setOptimizing(true);setOptimizer({text:'Đang kiểm tra và tái tạo derivative còn thiếu trên backend...'});await commitCatalogue(items);await loadAll();setOptimizer({text:'Backend đã kiểm tra/tái tạo derivative 640/960/1600.',type:'ok'})}catch(error:any){setOptimizer({text:error.message||'Tái tạo derivative thất bại.',type:'err'})}finally{setOptimizing(false)}};\n\n  const resetTeamForm=`);
  if(!text.includes('Backend đã kiểm tra/tái tạo derivative'))throw new Error('optimizer replacement failed');
  text=one(text,`<div className=\"admin-note\">Thẻ gallery dùng thumbnail 1600×900 WebP/JPEG trên R2; ảnh gốc vẫn giữ nguyên cho chế độ mở rộng/SEO.</div>`,`<div className=\"admin-note\">Backend tạo tự động derivative WebP 640/960/1600 trên R2; client chỉ upload original một lần.</div>`,'optimizer UI note');
  text=one(text,`onClick={optimizeMissing} disabled={!user||optimizing}>Tối ưu thumbnail còn thiếu</button>`,`onClick={optimizeMissing} disabled={!user||optimizing}>Kiểm tra / tái tạo derivative</button>`,'optimizer button');
  text=text.replace(`const n=items.filter(x=>x.thumbnail).length;setOptimizer({text:\`${'${n}'}/${'${items.length}'} tác phẩm đã tối ưu${'${n<items.length?` · còn ${items.length-n}`:`}'}\`})`,`const n=items.filter(completeArtworkVariants).length;setOptimizer({text:\`${'${n}'}/${'${items.length}'} tác phẩm có đủ derivative 640/960/1600${'${n<items.length?` · còn ${items.length-n}`:`}'}\`})`);
  text=one(text,`<img className=\"admin-thumb\" src={x.thumbnail||x.image} alt=\"\"/>`,`<img className=\"admin-thumb\" src={x.variants?.['320']?.url||x.variants?.['640']?.url||x.thumbnail||x.image} alt=\"\" loading=\"lazy\" decoding=\"async\"/>`,'admin lazy artwork image');
  text=one(text,`<img className=\"team-thumb\" src={m.image} alt=\"\"/>`,`<img className=\"team-thumb\" src={m.variants?.['320']?.url||m.image} alt=\"\" loading=\"lazy\" decoding=\"async\"/>`,'admin lazy team image');
  return text;
});

await patch('app/api/admin-backend/route.ts', text=>{
  text=one(text,`const VARIANT_WIDTHS=[640,960,1600] as const;`,`const VARIANT_WIDTHS=[640,960,1600] as const;\nconst TEAM_VARIANT_WIDTHS=[320,640] as const;`,'team widths');
  text=one(text,
`function mediaKey(id:string,source:string,width:number){const safe=String(id||'art').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'art';const hash=createHash('sha1').update(source).digest('hex').slice(0,12);return \`artworks/variants/${'${safe}'}-${'${hash}'}-${'${width}'}.webp\`}`,
`function mediaKey(id:string,source:string,width:number){const safe=String(id||'art').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'art';const hash=createHash('sha1').update(source).digest('hex').slice(0,12);return \`artworks/variants/${'${safe}'}-${'${hash}'}-${'${width}'}.webp\`}\nfunction teamMediaKey(id:string|number,source:string,width:number){const safe=String(id||'member').toLowerCase().replace(/[^a-z0-9]+/g,'-')||'member';const hash=createHash('sha1').update(source).digest('hex').slice(0,12);return \`team/variants/${'${safe}'}-${'${hash}'}-${'${width}'}.webp\`}`,'team media key');
  text=one(text,
`async function createBlob(token:string,content:string){`,
`async function enrichTeamMember(member:any,storageBase:string,token:string){\n  const next={...(member||{})};if(!next.image)return next;\n  const complete=TEAM_VARIANT_WIDTHS.every(width=>next?.variants?.[String(width)]?.url);if(complete&&next.media?.original?.url)return next;\n  const response=await fetch(String(next.image),{cache:'no-store',headers:{Accept:'image/*'}});if(!response.ok)throw new Error(\`Không tải được ảnh đội ngũ ${'${next.id}'} (${ '${response.status}' }).\`);\n  const input=Buffer.from(await response.arrayBuffer());const originalMeta=await sharp(input,{animated:false}).metadata();const variants:Record<string,MediaVariant>={...(next.variants||{})};\n  for(const width of TEAM_VARIANT_WIDTHS){if(variants[String(width)]?.url)continue;const {data,info}=await sharp(input,{animated:false}).rotate().resize({width,withoutEnlargement:true}).webp({quality:width===320?76:80,effort:4}).toBuffer({resolveWithObject:true});const key=teamMediaKey(next.id,String(next.image),width);const url=await putR2(storageBase,token,key,data);variants[String(width)]={url,width:info.width,height:info.height,bytes:data.length,mimeType:'image/webp'};}\n  next.variants=variants;next.media={...(next.media||{}),original:{url:String(next.image),width:Number(originalMeta.width)||0,height:Number(originalMeta.height)||0,bytes:input.length,mimeType:String(response.headers.get('content-type')||originalMeta.format||'application/octet-stream').split(';')[0]}};return next;\n}\n\nasync function createBlob(token:string,content:string){`,'team enrich function');
  text=one(text,
`const files:Record<string,unknown>={[\`${'${DATA_ROOT}'}/catalogue.json\`]:catalogue,[\`${'${DATA_ROOT}'}/team.json\`]:Array.isArray(payload.team)?payload.team:currentTeam,[\`${'${DATA_ROOT}'}/seo.json\`]:payload.seo!==undefined?payload.seo:currentSeo};`,
`const requestedTeam=Array.isArray(payload.team)?payload.team:currentTeam;const enrichedTeam=[];for(const member of requestedTeam)enrichedTeam.push(await enrichTeamMember(member,storageBase,token));\n    const files:Record<string,unknown>={[\`${'${DATA_ROOT}'}/catalogue.json\`]:catalogue,[\`${'${DATA_ROOT}'}/team.json\`]:enrichedTeam,[\`${'${DATA_ROOT}'}/seo.json\`]:payload.seo!==undefined?payload.seo:currentSeo};`,'team persistence');
  return text;
});

console.log('egress v2 code patch complete');
