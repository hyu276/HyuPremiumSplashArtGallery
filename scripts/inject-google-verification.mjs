import { readFile, writeFile } from 'node:fs/promises';

const INDEX_PATH = new URL('../dist/index.html', import.meta.url);
const VERIFICATION_TAG = '<meta name="google-site-verification" content="KMBRePIo30hKHau-mQc3tM_H0bELdtJRxXfo8I1PDGE" />';

const html = await readFile(INDEX_PATH, 'utf8');

if (html.includes('name="google-site-verification"')) {
  console.log('Google Search Console verification tag already present.');
  process.exit(0);
}

if (!html.includes('</head>')) {
  throw new Error('Could not inject Google verification tag: </head> not found in dist/index.html');
}

const updated = html.replace('</head>', `  ${VERIFICATION_TAG}\n</head>`);
await writeFile(INDEX_PATH, updated, 'utf8');
console.log('Injected Google Search Console verification tag into dist/index.html.');
