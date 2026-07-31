export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

/** Boundaries: [5, 12) morning, [12, 18) afternoon, else evening (covers night too). */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function greetingText(hour: number, name: string): string {
  const labels: Record<TimeOfDay, string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  };
  const base = labels[timeOfDay(hour)];
  return name.trim() ? `${base}, ${name.trim()}` : base;
}
