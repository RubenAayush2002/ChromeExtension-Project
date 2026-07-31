const TAB_GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

export type TabGroupColor = (typeof TAB_GROUP_COLORS)[number];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic color per hostname — same domain always maps to the same color. */
export function colorForHostname(hostname: string): TabGroupColor {
  const index = hashString(hostname.toLowerCase()) % TAB_GROUP_COLORS.length;
  return TAB_GROUP_COLORS[index] as TabGroupColor;
}
