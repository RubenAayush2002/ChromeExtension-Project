import { extractHostname } from './url-normalize';

/** Matches a hostname against the blocklist: exact match, or a subdomain of
 *  a blocklisted host (www.example.com and mail.example.com both match a
 *  blocklisted "example.com" entry). Blocklist entries are normalized the
 *  same way (lowercased, leading "www." stripped) before comparing. */
export function isHostBlocked(hostname: string, blocklist: string[]): boolean {
  const normalizedHost = normalizeHost(hostname);

  return blocklist.some((entry) => {
    const normalizedEntry = normalizeHost(entry);
    return normalizedHost === normalizedEntry || normalizedHost.endsWith(`.${normalizedEntry}`);
  });
}

export function isUrlBlocked(url: string, blocklist: string[]): boolean {
  const hostname = extractHostname(url);
  if (!hostname) return false;
  return isHostBlocked(hostname, blocklist);
}

function normalizeHost(host: string): string {
  const lower = host.toLowerCase().trim();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}
