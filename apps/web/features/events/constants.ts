// Gradient covers instead of external images: no hosting, no broken links.
export const EVENT_COVERS = [
  'from-brand-600 via-fuchsia-500 to-orange-400',
  'from-sky-600 via-cyan-500 to-emerald-400',
  'from-rose-600 via-pink-500 to-amber-400',
  'from-indigo-700 via-brand-500 to-sky-400',
] as const;

export function eventCover(eventId: number): string {
  return EVENT_COVERS[eventId % EVENT_COVERS.length];
}
