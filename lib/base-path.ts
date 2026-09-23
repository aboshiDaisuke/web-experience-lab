// Set NEXT_PUBLIC_BASE_PATH (e.g. "/web") at build time to serve the site under a sub-path.
export const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
export const HOME = BASE || '/';
