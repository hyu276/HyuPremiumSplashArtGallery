import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';

function replaceExact(text,from,to,label){if(!text.includes(from))throw new Error(`Missing patch target: ${label}`);return text.replace(from,to)}

// 1) Make the shared dashboard browser bundle use the public Vercel API only when hosted on GitHub Pages.
const dashboardPath='components/GitHubAdminDashboard.tsx';
let dashboard=await readFile(dashboardPath,'utf8');
dashboard=replaceExact(dashboard,
"const EMPTY_TEAM:TeamForm={id:'',name:'',order:'0',hidden:false,image:'',facebook:'',facebookHidden:false,tiktok:'',tiktokHidden:false,instagram:'',instagramHidden:false,x:'',xHidden:false,linkedin:'',linkedinHidden:false};",
"const EMPTY_TEAM:TeamForm={id:'',name:'',order:'0',hidden:false,image:'',facebook:'',facebookHidden:false,tiktok:'',tiktokHidden:false,instagram:'',instagramHidden:false,x:'',xHidden:false,linkedin:'',linkedinHidden:false};\nconst ADMIN_BACKEND=typeof window!=='undefined'&&window.location.hostname==='hyu276.github.io'?'https://hyupremium.vercel.app/api/admin-backend':'/api/admin-backend';",
'admin backend constant');
dashboard=replaceExact(dashboard,
"fetch('/api/admin-backend',{method,headers:{...authHeaders(pat),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'})",
"fetch(ADMIN_BACKEND,{method,headers:{...authHeaders(pat),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'})",
'backend fetch');
dashboard=dashboard.replace('Next.js · GitHub metadata · Cloudflare R2 · Vercel','GitHub Pages · GitHub metadata · Cloudflare R2 · Vercel API');
dashboard=dashboard.replace('href="/character/"','href="https://hyupremium.vercel.app/character/"');
await writeFile(dashboardPath,dashboard);

// 2) CORS: allow only the GitHub Pages origin to call the Vercel admin API.
const apiPath='app/api/admin-backend/route.ts';
let api=await readFile(apiPath,'utf8');
api=replaceExact(api,
"type AdminPayload={ownerItems?:any[];categories?:string[];ranks?:string[];credits?:string[];team?:any[];seo?:any};",
"type AdminPayload={ownerItems?:any[];categories?:string[];ranks?:string[];credits?:string[];team?:any[];seo?:any};\n\nconst ADMIN_ORIGIN='https://hyu276.github.io';\nfunction corsHeaders(request:Request){const origin=request.headers.get('origin')||'';return origin===ADMIN_ORIGIN?{'Access-Control-Allow-Origin':ADMIN_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'}:{}}\nfunction responseHeaders(request:Request){return {'Cache-Control':'no-store',...corsHeaders(request)}}\nexport async function OPTIONS(request:Request){return new Response(null,{status:204,headers:responseHeaders(request)})}",
'admin CORS helpers');
api=api.replaceAll("headers:{'Cache-Control':'no-store'}","headers:responseHeaders(request)");
await writeFile(apiPath,api);

// 3) GitHub Pages entrypoint. No redirect to Vercel /admin.
const adminHtml=`<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="robots" content="noindex,nofollow,noarchive">\n<meta name="referrer" content="no-referrer">\n<title>HYU PREMIUM — Dashboard quản trị</title>\n<link rel="stylesheet" href="./app/admin/admin.css">\n</head>\n<body>\n<div id="root"></div>\n<noscript>Dashboard quản trị cần JavaScript.</noscript>\n<script src="./assets/js/admin-github.bundle.js" defer></script>\n</body>\n</html>\n`;
await writeFile('admin.html',adminHtml);

// 4) Static bundle entry. The same dashboard source powers GitHub Pages, but Vercel no longer exposes /admin.
await mkdir('admin-src',{recursive:true});
await writeFile('admin-src/entry.tsx',`import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport GitHubAdminDashboard from '../components/GitHubAdminDashboard';\n\nconst root=document.getElementById('root');\nif(!root)throw new Error('Admin root element missing.');\ncreateRoot(root).render(<GitHubAdminDashboard/>);\n`);

// 5) Remove only the Next.js page route; keep its CSS as the GitHub Pages stylesheet.
await rm('app/admin/page.tsx');

// 6) Guard against accidentally reintroducing the Vercel admin page or redirect.
const guardPath='scripts/assert-egress-safety.mjs';
let guard=await readFile(guardPath,'utf8');
const marker="const pkg=JSON.parse(await readFile(join(ROOT,'package.json'),'utf8'));";
const checks=`const adminHtml=await readFile(join(ROOT,'admin.html'),'utf8');\nif(adminHtml.includes('hyupremium.vercel.app/admin'))failures.push('GitHub Pages admin must not redirect to Vercel /admin');\nif(!adminHtml.includes('admin-github.bundle.js'))failures.push('GitHub Pages admin must load the static dashboard bundle');\ntry{await readFile(join(ROOT,'app/admin/page.tsx'),'utf8');failures.push('Vercel /admin page route must not exist')}catch{}\nconst adminDashboard=await readFile(join(ROOT,'components/GitHubAdminDashboard.tsx'),'utf8');\nif(!adminDashboard.includes(\"window.location.hostname==='hyu276.github.io'?'https://hyupremium.vercel.app/api/admin-backend':'/api/admin-backend'\"))failures.push('GitHub Pages admin must use the Vercel API backend only as a cross-origin API');\nconst adminApi=await readFile(join(ROOT,'app/api/admin-backend/route.ts'),'utf8');\nif(!adminApi.includes(\"const ADMIN_ORIGIN='https://hyu276.github.io'\"))failures.push('admin API CORS must be restricted to the GitHub Pages origin');\nif(!adminApi.includes('export async function OPTIONS'))failures.push('admin API must support CORS preflight for GitHub Pages');\n\n`;
if(!guard.includes(marker))throw new Error('Missing egress guard insertion marker');
guard=guard.replace(marker,checks+marker);
await writeFile(guardPath,guard);

console.log('GitHub Pages admin-only patch applied.');
