import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, '.stage');
const zip = path.join(root, 'netlify-ready-game.zip');

console.log('Building...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage);

// no node_modules, caches or logs
for (const item of ['netlify.toml', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'README.md', 'src', 'lib', 'netlify', 'scripts', 'dist']) {
  const from = path.join(root, item);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(stage, item), { recursive: true });
}

fs.rmSync(zip, { force: true });
// tar (bsdtar, bundled with Windows 10+) writes forward-slash paths, which Netlify needs inside a zip
execSync(`tar -a -c -f "${zip}" *`, { cwd: stage, stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });

console.log(`\nWrote ${zip} (${(fs.statSync(zip).size / 1024).toFixed(0)} KB)`);
