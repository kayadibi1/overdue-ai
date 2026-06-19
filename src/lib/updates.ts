import type { Update } from '../data/updates';

/** Newest date first; ties broken by id descending for stable, deterministic order. */
export function sortUpdates(items: Update[]): Update[] {
  return [...items].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0,
  );
}
