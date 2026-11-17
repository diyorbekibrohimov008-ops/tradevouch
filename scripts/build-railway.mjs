import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { rolldown } from 'rolldown';

const root = process.cwd();
const clientDir = fs.existsSync(path.join(root, 'dist', 'client', 'index.html'))
  ? path.join(root, 'dist', 'client')
  : path.join(root, 'dist');
const indexPath = path.join(clientDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('dist/index.html missing — run vite build first.');
}

let html = fs.readFileSync(indexPath, 'utf8');

// Inline CSS link tag
const cssMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/i);
if (cssMatch) {
  const cssRel = cssMatch[1].replace(/^\/+/, '');
  const cssFile = path.join(clientDir, cssRel);
  const cssContent = fs.readFileSync(cssFile, 'utf8');
  html = html.replace(cssMatch[0], () => `<style>${cssContent}</style>`);
}

// Inline module script tag safely (using function replacement & escaping </script>)
const jsMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/i);
if (jsMatch) {
  const jsRel = jsMatch[1].replace(/^\/+/, '');
  const jsFile = path.join(clientDir, jsRel);
  const jsContent = fs.readFileSync(jsFile, 'utf8').replace(/<\/script>/gi, '<\\/script>');
  html = html.replace(jsMatch[0], () => `<script type="module">${jsContent}</script>`);
}

fs.writeFileSync(path.join(root, 'dist', 'spa-single.html'), html, 'utf8');
const gzipB64 = zlib.gzipSync(Buffer.from(html, 'utf8'), { level: 9 }).toString('base64');

const bundle = await rolldown({
  input: path.join(root, 'server', 'railwayEntry.ts'),
  external: ['hono', 'zod', 'postgres', 'node:crypto', 'node:zlib'],
});

const { output } = await bundle.generate({
  format: 'esm',
  minify: false,
});
await bundle.close();

let code = output[0].code;

// Pin major package versions for Railway Bun Function auto-installer
code = code
  .replace(/from\s+["']hono["']/g, 'from "hono@4"')
  .replace(/from\s+["']zod["']/g, 'from "zod@4"')
  .replace(/from\s+["']postgres["']/g, 'from "postgres@3"');

code = code.replace(/['"]__TRADEVOUCH_SPA_GZIP_B64__['"]/g, () => JSON.stringify(gzipB64));

if (code.includes('__TRADEVOUCH_SPA_GZIP_B64__')) {
  throw new Error('Failed to replace SPA placeholder in dist/railway-function.tsx');
}
if (!code.includes('gunzipSync') || Buffer.byteLength(code, 'utf8') < gzipB64.length) {
  throw new Error('SPA payload or gunzipSync was tree-shaken from dist/railway-function.tsx');
}

const outFile = path.join(root, 'dist', 'railway-function.tsx');
fs.writeFileSync(outFile, code, 'utf8');

console.log(
  `Built ${outFile} (${(Buffer.byteLength(code, 'utf8') / 1024).toFixed(1)} KB; SPA gzipped b64: ${(gzipB64.length / 1024).toFixed(1)} KB)`,
);
