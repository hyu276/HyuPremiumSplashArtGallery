import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, transform){
  const before=await readFile(path,'utf8');
  const after=transform(before);
  if(after===before)throw new Error(`${path}: no changes applied`);
  await writeFile(path,after);
  console.log(`patched ${path}`);
}
function must(text,re,replacement,label){
  const next=text.replace(re,replacement);
  if(next===text)throw new Error(`missing ${label}`);
  return next;
}

await patch('components/GitHubAdminDashboard.tsx', text=>{
  text=must(text,
    /type Choice=\{name:string;sort_order\?:number\};\ntype Artwork=\{[^\n]+\};/,
    `type Choice={name:string;sort_order?:number};\ntype MediaVariant={url:string;width:number;height:number;bytes?:number;mimeType?:string};\ntype Artwork={id:string;source?:string;sourceId?:string;name:string;description:string;image:string;thumbnail?:string;variants?:Record<string,MediaVariant>;media?:{original?:MediaVariant};tags:string[];hidden:boolean;category:string;rank:string;rankOrder?:number;credit:string;isVietnameseSkin:boolean;updatedAt?:string};`,
    'Artwork type');
  text=must(text,
    /type TeamMember=\{[^\n]+\};/,
    `type TeamMember={id:number;name:string;image:string;variants?:Record<string,MediaVariant>;media?:{original?:MediaVariant};sort_order:number;hidden:boolean;facebook_url:string;facebook_hidden:boolean;tiktok_url:string;tiktok_hidden:boolean;instagram_url:string;instagram_hidden:boolean;x_url:string;x_hidden:boolean;linkedin_url:string;linkedin_hidden:boolean};`,
    'TeamMember type');

  text=must(text,
    /function canvasBlob\([\s\S]*?async function makeThumbnail\([\s\S]*?return\{blob,ext\};\n}\n/,
    '',
    'client thumbnail generator');

  text=must(text,
    /function choiceByName\(rows:Choice\[],name:string\)\{return rows\.find\(x=>x\.name\.toLowerCase\(\)===name\.trim\(\)\.toLowerCase\(\)\)\}/,
    `function choiceByName(rows:Choice[],name:string){return rows.find(x=>x.name.toLowerCase()===name.trim().toLowerCase())}\nfunction completeArtworkVariants(x:Artwork){return ['640','960','1600'].every(width=>Boolean(x.variants?.[width]?.url))}`,
    'variant helper');

  text=must(text,
    /const optimized=mapped\.filter\(x=>x\.thumbnail\)\.length;/,
    `const optimized=mapped.filter(completeArtworkVariants).length;`,
    'optimizer count');
  text=text.replace(/tác phẩm đã tối ưu/g,'tác phẩm có đủ derivative 640/960/1600');

  text=must(text,
    /\n  const uploadThumbnail=async\([\s\S]*?\};\n  const commitCatalogue=/,
    `\n  const commitCatalogue=`,
    'uploadThumbnail');

  text=must(text,
    /if\(item\)\{item\.image=imageUrl;try\{const thumb=await uploadThumbnail\(id,item\.name,p\.file\);item\.thumbnail=thumb\.url\}catch\(e\)\{console\.warn\('Thumbnail creation failed',e\)\}\}/,
    `if(item){item.image=imageUrl;item.thumbnail='';item.variants=undefined;item.media=undefined}`,
    'publish client thumbnail');

  text=must(text,
    /  const optimizeMissing=async\(\)=>\{[\s\S]*?\n\n  const resetTeamForm=/,
    `  const optimizeMissing=async()=>{if(optimizing)return;try{ensureAdmin();setOptimizing(true);setOptimizer({text:'Đang kiểm tra và tái tạo derivative còn thiếu trên backend...'});await commitCatalogue(items);await loadAll();setOptimizer({text:'Backend đã kiểm tra/tái tạo derivative 640/960/1600.',type:'ok'})}catch(error:any){setOptimizer({text:error.message||'Tái tạo derivative thất bại.',type:'err'})}finally{setOptimizing(false)}};\n\n  const resetTeamForm=`,
    'optimizer function');

  text=text.replace('Thẻ gallery dùng thumbnail 1600×900 WebP/JPEG trên R2; ảnh gốc vẫn giữ nguyên cho chế độ mở rộng/SEO.','Backend tạo tự động derivative WebP 640/960/1600 trên R2; client chỉ upload original một lần.');
  text=text.replace('>Tối ưu thumbnail còn thiếu</button>','>Kiểm tra / tái tạo derivative</button>');
  text=text.replace(/const n=items\.filter\(x=>x\.thumbnail\)\.length;/g,'const n=items.filter(completeArtworkVariants).length;');

  text=must(text,
    /<img className="admin-thumb" src=\{x\.thumbnail\|\|x\.image\} alt=""\/>/,
    `<img className="admin-thumb" src={x.variants?.['640']?.url||x.thumbnail||x.image} alt="" loading="lazy" decoding="async"/>`,
    'admin lazy artwork');
  text=must(text,
    /<img className="team-thumb" src=\{m\.image\} alt=""\/>/,
    `<img className="team-thumb" src={m.variants?.['320']?.url||m.image} alt="" loading="lazy" decoding="async"/>`,
    'admin lazy team');
  return text;
});

await patch('app/api/admin-backend/route.ts', text=>{
  text=must(text,/const VARIANT_WIDTHS=\[640,960,1600\] as const;/,
    `const VARIANT_WIDTHS=[640,960,1600] as const;\nconst TEAM_VARIANT_WIDTHS=[320,640] as const;`,'team widths');

  text=must(text,
    /(function mediaKey\([^\n]+\n)/,
    `$1function teamMediaKey(id:string|number,source:string,width:number){const safe=String(id||'member').toLowerCase().replace(/[^a-z0-9]+/g,'-')||'member';const hash=createHash('sha1').update(source).digest('hex').slice(0,12);return \`team/variants/\${safe}-\${hash}-\${width}.webp\`}\n`,
    'team media key');

  text=must(text,
    /\nasync function createBlob\(token:string,content:string\)\{/,
    `\nasync function enrichTeamMember(member:any,storageBase:string,token:string){\n  const next={...(member||{})};if(!next.image)return next;\n  const complete=TEAM_VARIANT_WIDTHS.every(width=>next?.variants?.[String(width)]?.url);if(complete&&next.media?.original?.url)return next;\n  const response=await fetch(String(next.image),{cache:'no-store',headers:{Accept:'image/*'}});if(!response.ok)throw new Error(\`Không tải được ảnh đội ngũ \${next.id} (\${response.status}).\`);\n  const input=Buffer.from(await response.arrayBuffer());const originalMeta=await sharp(input,{animated:false}).metadata();const variants:Record<string,MediaVariant>={...(next.variants||{})};\n  for(const width of TEAM_VARIANT_WIDTHS){if(variants[String(width)]?.url)continue;const {data,info}=await sharp(input,{animated:false}).rotate().resize({width,withoutEnlargement:true}).webp({quality:width===320?76:80,effort:4}).toBuffer({resolveWithObject:true});const key=teamMediaKey(next.id,String(next.image),width);const url=await putR2(storageBase,token,key,data);variants[String(width)]={url,width:info.width,height:info.height,bytes:data.length,mimeType:'image/webp'};}\n  next.variants=variants;next.media={...(next.media||{}),original:{url:String(next.image),width:Number(originalMeta.width)||0,height:Number(originalMeta.height)||0,bytes:input.length,mimeType:String(response.headers.get('content-type')||originalMeta.format||'application/octet-stream').split(';')[0]}};return next;\n}\n\nasync function createBlob(token:string,content:string){`,
    'team enrich function');

  text=must(text,
    /const files:Record<string,unknown>=\{\[`\$\{DATA_ROOT\}\/catalogue\.json`\]:catalogue,\[`\$\{DATA_ROOT\}\/team\.json`\]:Array\.isArray\(payload\.team\)\?payload\.team:currentTeam,\[`\$\{DATA_ROOT\}\/seo\.json`\]:payload\.seo!==undefined\?payload\.seo:currentSeo\};/,
    `const requestedTeam=Array.isArray(payload.team)?payload.team:currentTeam;const enrichedTeam=[];for(const member of requestedTeam)enrichedTeam.push(await enrichTeamMember(member,storageBase,token));\n    const files:Record<string,unknown>={[\`\${DATA_ROOT}/catalogue.json\`]:catalogue,[\`\${DATA_ROOT}/team.json\`]:enrichedTeam,[\`\${DATA_ROOT}/seo.json\`]:payload.seo!==undefined?payload.seo:currentSeo};`,
    'team persistence');
  return text;
});

console.log('egress v2 code patch complete');
