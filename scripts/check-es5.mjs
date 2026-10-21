// Parse the TV runtime scripts as ES5 (webOS 5 runs Chromium 68; keep the runtime conservative).
// Syntax only: this does not check DOM/CSS API availability on the TV.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = join(root, 'app');

function scripts(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return scripts(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  });
}

const files = [join(app, 'main.js'), join(app, 'device.js'), ...scripts(join(app, 'assets'))];
const failures = [];
for (const file of files) {
  try {
    parse(readFileSync(file, 'utf8'), { ecmaVersion: 5, sourceType: 'script', locations: true });
  } catch (error) {
    const where = error.loc ? ':' + error.loc.line + ':' + (error.loc.column + 1) : '';
    failures.push(relative(root, file) + where + ' ' + error.message.replace(/ \(\d+:\d+\)$/, ''));
  }
}
if (failures.length) {
  console.error('Not ES5:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('ES5 syntax valid in ' + files.length + ' runtime scripts.');
