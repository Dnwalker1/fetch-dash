// Lets the Wix backend files load under plain Node for the tests:
// "backend/x" -> ../backend/x.js, and the Wix packages -> fakes in ./fakes/.
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKES = { 'wix-data': 'wix-data.mjs', '@wix/media': 'wix-media.mjs', '@wix/essentials': 'wix-essentials.mjs' };

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('backend/')) {
    return { url: pathToFileURL(path.join(here, '..', `${specifier}.js`)).href, shortCircuit: true, format: 'module' };
  }
  if (FAKES[specifier]) {
    return { url: pathToFileURL(path.join(here, 'fakes', FAKES[specifier])).href, shortCircuit: true, format: 'module' };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  // The backend files are .js in a folder without "type": "module".
  if (url.includes('/wix-backend/backend/')) return { ...(await next(url, { ...context, format: 'module' })), format: 'module' };
  return next(url, context);
}
