const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAM_EXACT = new Set([
  'fbclid',
  'gclid',
  'msclkid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'yclid',
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return TRACKING_PARAM_EXACT.has(lower) || TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Normalizes a URL for duplicate-detection purposes: strips tracking params,
 * sorts remaining query params, drops trailing slash, lowercases the host.
 * Returns the original string if it isn't a parseable URL.
 */
export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const kept = [...url.searchParams.entries()].filter(([key]) => !isTrackingParam(key));
  kept.sort(([a], [b]) => a.localeCompare(b));

  const search = new URLSearchParams(kept).toString();
  const path = url.pathname.endsWith('/') && url.pathname !== '/'
    ? url.pathname.slice(0, -1)
    : url.pathname;

  const host = url.host.toLowerCase();
  return `${url.protocol}//${host}${path}${search ? `?${search}` : ''}`;
}

export function areDuplicateUrls(a: string, b: string): boolean {
  return normalizeUrl(a) === normalizeUrl(b);
}

export function extractHostname(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}
