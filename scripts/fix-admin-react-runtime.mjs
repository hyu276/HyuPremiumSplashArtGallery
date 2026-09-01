import {readFile,writeFile} from 'node:fs/promises';

const dashboardPath='components/GitHubAdminDashboard.tsx';
let dashboard=await readFile(dashboardPath,'utf8');
const oldImport="import { useCallback, useEffect, useMemo, useRef, useState } from 'react';";
const newImport="import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';";
if(dashboard.includes(oldImport))dashboard=dashboard.replace(oldImport,newImport);
else if(!dashboard.includes(newImport))throw new Error('Unexpected React import in admin dashboard.');
await writeFile(dashboardPath,dashboard);

const guardPath='scripts/assert-egress-safety.mjs';
let guard=await readFile(guardPath,'utf8');
const anchor="if(!adminDashboard.includes(\"window.location.hostname==='hyu276.github.io'?'https://hyupremium.vercel.app/api/admin-backend':'/api/admin-backend'\"))failures.push('GitHub Pages admin must use the Vercel API backend only as a cross-origin API');";
const added=anchor+"\nif(!adminDashboard.includes(\"import React, { useCallback\"))failures.push('static GitHub Pages admin must import the React runtime explicitly for its standalone bundle');";
if(guard.includes(anchor)&&!guard.includes("static GitHub Pages admin must import the React runtime explicitly"))guard=guard.replace(anchor,added);
else if(!guard.includes("static GitHub Pages admin must import the React runtime explicitly"))throw new Error('Missing admin guard anchor.');
await writeFile(guardPath,guard);

console.log('Static admin React runtime source guard applied.');
