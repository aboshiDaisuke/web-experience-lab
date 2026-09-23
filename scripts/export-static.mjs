// Builds plain HTML files and gathers them into out/<base>/ ready to upload.
// Usage: NEXT_PUBLIC_BASE_PATH=/web npm run export
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
execSync('vinext build', { stdio: 'inherit', env: { ...process.env, STATIC_EXPORT: '1' } });

const built = 'dist/client';
const dest = path.join('out', base || 'site');
fs.rmSync('out', { recursive: true, force: true });
fs.cpSync(built, dest, {
  recursive: true,
  // assetPrefix already nests _next under the base; Cloudflare-only files are not needed.
  filter: (src) => {
    const rel = path.relative(built, src);
    return rel !== base.slice(1) && !['_headers', '.assetsignore', '.vite', 'vinext-client-entry-manifest.json'].includes(rel);
  },
});
if (base) fs.cpSync(path.join(built, base, '_next'), path.join(dest, '_next'), { recursive: true });

// Apache (most rental servers): open /works/casa as works/casa.html and use the custom 404.
fs.writeFileSync(
  path.join(dest, '.htaccess'),
  `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.*)$ $1.html [L]
ErrorDocument 404 ${base}/404.html
`,
);
console.log(`\nUpload ${dest}/ so that it is served at ${base || '/'}`);
