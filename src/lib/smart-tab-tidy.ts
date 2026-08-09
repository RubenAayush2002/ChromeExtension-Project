import type { AiProvider } from './ai-provider';
import { withSmartFallback, type SmartResult } from './smart-call';
import { planTabGroupsByHostname, type TabGroupPlan } from './tab-tidy';
import { colorForHostname } from './domain-color';
import type { LocalStorage } from './storage-types';

export interface TitledTab {
  id: number;
  url: string;
  title: string;
}

const SYSTEM_PROMPT = [
  'You group browser tabs by what the user is actually doing with them.',
  'Input is a numbered list of tabs: "<id>. <title> — <url>".',
  'Output STRICT JSON only, no prose, no code fences:',
  '{"groups":[{"label":"Short topic","tabIds":[1,2]}]}',
  'Rules:',
  '- Label each group by intent or topic (e.g. "Flight booking", "Recipe research"),',
  '  not by website name. Group across different domains when they share a purpose.',
  '- 1-3 words per label.',
  '- Only use tab ids from the input. Never invent ids.',
  '- Every id appears in at most one group.',
  '- Omit groups with fewer than 2 tabs.',
].join('\n');

interface SmartGroupResponse {
  groups?: { label?: unknown; tabIds?: unknown }[];
}

function formatTabsForPrompt(tabs: TitledTab[]): string {
  return tabs.map((t) => `${t.id}. ${t.title} — ${t.url}`).join('\n');
}

/** Strips markdown code fences the model sometimes wraps JSON in. */
function stripCodeFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
}

/** Parses and validates the model's grouping.
 *
 *  Every id is checked against the real tab set and de-duplicated across
 *  groups — a hallucinated or repeated id would otherwise group tabs the user
 *  never had, or move one tab twice. Throws on anything unusable so the caller
 *  falls back to hostname grouping. */
export function parseSmartTabGroups(response: string, tabs: TitledTab[]): TabGroupPlan[] {
  let payload: SmartGroupResponse;
  try {
    payload = JSON.parse(stripCodeFences(response)) as SmartGroupResponse;
  } catch {
    throw new Error('Smart tab grouping returned malformed JSON.');
  }

  const validIds = new Set(tabs.map((t) => t.id));
  const claimed = new Set<number>();
  const plans: TabGroupPlan[] = [];

  for (const group of payload.groups ?? []) {
    const label = typeof group.label === 'string' ? group.label.trim() : '';
    if (!label || !Array.isArray(group.tabIds)) continue;

    const tabIds = group.tabIds.filter(
      (id): id is number => typeof id === 'number' && validIds.has(id) && !claimed.has(id),
    );
    if (tabIds.length < 2) continue;

    for (const id of tabIds) claimed.add(id);
    // Color stays deterministic, keyed off the label so a topic keeps its
    // color across sessions the way hostname grouping does.
    plans.push({ hostname: label, color: colorForHostname(label), tabIds });
  }

  if (plans.length === 0) throw new Error('Smart tab grouping produced no usable groups.');
  return plans;
}

/** §10.2 tab grouping. Smart mode clusters by topic across domains; simple
 *  mode groups by hostname. Same "Tidy tabs" button. */
export async function planTabGroupsSmart(
  storage: LocalStorage,
  provider: AiProvider,
  tabs: TitledTab[],
): Promise<SmartResult<TabGroupPlan[]>> {
  return withSmartFallback(
    storage,
    provider,
    { system: SYSTEM_PROMPT, user: formatTabsForPrompt(tabs), maxTokens: 1024 },
    (response) => parseSmartTabGroups(response, tabs),
    () => planTabGroupsByHostname(tabs),
  );
}
