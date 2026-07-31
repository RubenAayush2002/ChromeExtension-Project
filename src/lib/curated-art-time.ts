export type CuratedArtTimeSlot = 'daytime' | 'sunset' | 'nighttime';

/** Picks which curated-art image to show based on local hour, mirroring the
 *  weather-scenery day/evening/night split: sunset covers the dusk window,
 *  nighttime covers the rest of the dark hours, daytime covers the rest. */
export function curatedArtSlotForHour(hour: number): CuratedArtTimeSlot {
  if ((hour >= 18 && hour < 20) || (hour >= 5 && hour < 6)) return 'sunset';
  if (hour >= 6 && hour < 18) return 'daytime';
  return 'nighttime';
}
