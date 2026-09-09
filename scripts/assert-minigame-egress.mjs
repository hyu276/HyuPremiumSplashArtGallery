import { readFile } from 'node:fs/promises';

const [minigame, vercelText] = await Promise.all([
  readFile('minigame.html', 'utf8'),
  readFile('vercel.json', 'utf8')
]);

const failures = [];
const vercel = JSON.parse(vercelText);

if (vercel?.git?.deploymentEnabled !== false) {
  failures.push('vercel.json: automatic Git deployments must remain disabled');
}

const selector = minigame.match(/const imageOf=item=>\{[\s\S]*?\n      \};/)?.[0] || '';
if (!selector) failures.push('minigame.html: imageOf selector not found');
if (!selector.includes("mobile?'640':'960'")) {
  failures.push('minigame.html: roll media must select 640px on mobile and 960px on desktop');
}
for (const forbidden of ["item.thumbnail", "['1600']", 'item.image']) {
  if (selector.includes(forbidden)) failures.push(`minigame.html: roll media selector must not use ${forbidden}`);
}
if (minigame.includes("cache:'no-store'")) {
  failures.push("minigame.html: catalogue fetch must not use cache:'no-store'");
}
if (!minigame.includes("cache:'no-cache'")) {
  failures.push("minigame.html: catalogue fetch must retain conditional-cache-friendly cache:'no-cache'");
}
if (minigame.includes('new Image(')) {
  failures.push('minigame.html: artwork must load only on the active roll, without off-DOM preloading');
}

if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log('Minigame egress guard passed: Git auto-deploy disabled; roll media capped at 640/960 derivatives.');
