import { extractHostname } from './url-normalize';

/** Simple-mode label: hostname/domain grouping (e.g. all github.com bookmarks -> "GitHub"). */
export function labelForUrl(url: string): string {
  const hostname = extractHostname(url);
  if (!hostname) return 'Other';

  const withoutWww = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  const mainPart = withoutWww.split('.')[0] ?? withoutWww;
  return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
}
