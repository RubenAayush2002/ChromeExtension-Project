import { extractHostname } from './url-normalize';
import { colorForHostname, type TabGroupColor } from './domain-color';

export interface TidyableTab {
  id: number;
  url: string;
}

export interface TabGroupPlan {
  hostname: string;
  color: TabGroupColor;
  tabIds: number[];
}

/**
 * Groups tabs by hostname for the simple (non-Groq) tidy mode. Tabs whose
 * hostname only appears once are skipped — no point creating a single-tab group.
 */
export function planTabGroupsByHostname(tabs: TidyableTab[]): TabGroupPlan[] {
  const byHost = new Map<string, number[]>();

  for (const tab of tabs) {
    const hostname = extractHostname(tab.url);
    if (!hostname) continue;
    const existing = byHost.get(hostname);
    if (existing) {
      existing.push(tab.id);
    } else {
      byHost.set(hostname, [tab.id]);
    }
  }

  const plans: TabGroupPlan[] = [];
  for (const [hostname, tabIds] of byHost) {
    if (tabIds.length < 2) continue;
    plans.push({ hostname, color: colorForHostname(hostname), tabIds });
  }
  return plans;
}
