import {readFile,writeFile} from 'node:fs/promises';
const path='app/api/admin-backend/route.ts';
let text=await readFile(path,'utf8');
const from="function corsHeaders(request:Request){const origin=request.headers.get('origin')||'';return origin===ADMIN_ORIGIN?{'Access-Control-Allow-Origin':ADMIN_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'}:{}}\nfunction responseHeaders(request:Request){return {'Cache-Control':'no-store',...corsHeaders(request)}}";
const to="function corsHeaders(request:Request):Record<string,string>{const origin=request.headers.get('origin')||'';return origin===ADMIN_ORIGIN?{'Access-Control-Allow-Origin':ADMIN_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'}:{}}\nfunction responseHeaders(request:Request):Record<string,string>{return {'Cache-Control':'no-store',...corsHeaders(request)}}";
if(!text.includes(from))throw new Error('CORS helper target not found');
text=text.replace(from,to);
await writeFile(path,text);
