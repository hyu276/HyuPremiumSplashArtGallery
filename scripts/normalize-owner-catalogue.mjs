import fs from 'node:fs/promises';

const file='data/backend/catalogue.json';
const raw=JSON.parse(await fs.readFile(file,'utf8'));
const items=Array.isArray(raw.items)?raw.items:[];
const before={
  total:items.length,
  collaborator:items.filter(item=>String(item?.source||'owner').toLowerCase()!=='owner').length,
  sourceOptions:Object.keys(raw.sourceOptions||{})
};

const cleanItems=items.map(item=>{
  const {source: _source, sourceId: _sourceId, ...rest}=item||{};
  return rest;
});

const alpha=(a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base',numeric:true});
const unique=values=>[...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))].sort(alpha);
const categories=unique([...(raw.categories||[]),...cleanItems.map(item=>item.category)]);
const credits=unique([...(raw.credits||[]),...cleanItems.map(item=>item.credit)]);
const ranks=[];
for(const name of [...(raw.ownerOptions?.ranks||[]),...(raw.ranks||[])].map(String).filter(Boolean))if(!ranks.includes(name))ranks.push(name);
for(const item of [...cleanItems].sort((a,b)=>Number(a?.rankOrder||0)-Number(b?.rankOrder||0))){const name=String(item?.rank||'').trim();if(name&&!ranks.includes(name))ranks.push(name)}

const next={...raw,generatedAt:new Date().toISOString(),items:cleanItems,categories,ranks,credits,ownerOptions:{categories,ranks,credits}};
delete next.sourceOptions;
await fs.writeFile(file,JSON.stringify(next,null,2)+'\n','utf8');
console.log(JSON.stringify({before,after:{total:cleanItems.length,collaborator:0,sourceOptions:[],categories:categories.length,ranks:ranks.length,credits:credits.length}},null,2));
if(cleanItems.length!==before.total)throw new Error('Artwork count changed during normalization.');
