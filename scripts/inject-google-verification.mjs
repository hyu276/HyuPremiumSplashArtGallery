import { readFile, writeFile } from 'node:fs/promises';

const TARGETS = [
  new URL('../dist/index.html', import.meta.url),
  new URL('../dist/character/index.html', import.meta.url)
];
const VERIFICATION_TAG = '<meta name="google-site-verification" content="KMBRePIo30hKHau-mQc3tM_H0bELdtJRxXfo8I1PDGE" />';

let injected = 0;
for (const target of TARGETS) {
  const html = await readFile(target, 'utf8');
  if (html.includes('name="google-site-verification"')) continue;
  if (!html.includes('</head>')) {
    throw new Error(`Could not inject Google verification tag: </head> not found in ${target.pathname}`);
  }
  const updated = html.replace('</head>', `  ${VERIFICATION_TAG}\n</head>`);
  await writeFile(target, updated, 'utf8');
  injected++;
}

console.log(`Google Search Console verification ready on ${TARGETS.length} entry pages (${injected} newly injected).`);
