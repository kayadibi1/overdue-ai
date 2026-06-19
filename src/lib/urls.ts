/** Join an origin, a base path, and a path into one absolute URL with single slashes. */
export function joinUrl(site: string, base: string, path: string): string {
  const origin = site.replace(/\/+$/, '');
  const mid = base.replace(/^\/+|\/+$/g, '');
  const tail = path.replace(/^\/+/, '');
  return [origin, mid, tail].filter(Boolean).join('/');
}

/** Astro-env wrapper: builds an absolute URL for `path` from the configured SITE + BASE_URL. */
export function absUrl(path: string): string {
  return joinUrl(import.meta.env.SITE ?? '', import.meta.env.BASE_URL ?? '/', path);
}
