import type { NextConfig } from 'next';

const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
// STATIC_EXPORT=1 writes plain HTML files to dist/client for servers that cannot run the Worker.
// vinext's prerender does not handle basePath, so the export only prefixes assets and links.
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = staticExport
  ? { output: 'export', assetPrefix: base || undefined }
  : { basePath: base };

export default nextConfig;
