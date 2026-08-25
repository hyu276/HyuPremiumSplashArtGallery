import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const dir=path.join(root,'data/backend');
const owner={url:'https://zkrhwqgmynbbmoktokdq.supabase.co',key:'sb_publishable_Fqcxk9-U1qalClQZjKcrhA_U822LTIq'};
async function rest(route){const response=await fetch(`${owner.url}/rest/v1/${route}`,{headers:{apikey:owner.key}});if(!response.ok)throw new Error(`Owner REST ${response.status}: ${await response.text()}`);return response.json()}
const [categories,ranks,credits]=await Promise.all([
  rest('categories?select=name&order=name.asc'),
  rest('ranks?select=name,sort_order&order=sort_order.asc'),
  rest('image_credits?select=name&order=name.asc')
]);
const [catalogue,storage,seo,audit]=await Promise.all([
  fs.readFile(path.join(dir,'catalogue.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(dir,'storage.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(dir,'seo.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(dir,'seo-audit-seed.json'),'utf8').then(JSON.parse)
]);
catalogue.ready=true;
catalogue.ownerOptions={
  categories:categories.map(x=>String(x.name)),
  ranks:ranks.map(x=>String(x.name)),
  credits:credits.map(x=>String(x.name).trim().toLowerCase()==='uncredited'?'Chưa có credit':String(x.name))
};
storage.ready=true;
seo.logs=Array.isArray(seo.logs)?seo.logs:Array.isArray(audit)?audit:[];
await Promise.all([
  fs.writeFile(path.join(dir,'catalogue.json'),JSON.stringify(catalogue,null,2)+'\n'),
  fs.writeFile(path.join(dir,'storage.json'),JSON.stringify(storage,null,2)+'\n'),
  fs.writeFile(path.join(dir,'seo.json'),JSON.stringify(seo,null,2)+'\n')
]);
console.log(JSON.stringify({ready:true,ownerOptions:{categories:catalogue.ownerOptions.categories.length,ranks:catalogue.ownerOptions.ranks.length,credits:catalogue.ownerOptions.credits.length},seoLogs:seo.logs.length,storage:storage.publicBaseUrl},null,2));
