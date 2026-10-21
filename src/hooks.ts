import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { alive, db, type Base } from './db';

export type Data = NonNullable<ReturnType<typeof useData>>;

/**
 * Loads every live row. A farm ledger is a few thousand rows at most, so
 * reading it all and computing in memory is simpler than per-screen queries,
 * and `useLiveQuery` re-runs this whenever any of these tables change.
 */
export function useData() {
  return useLiveQuery(async () => {
    const [owners, plots, categories, entries, workers, jobs, payments, settings] = await Promise.all([
      db.owners.toArray(),
      db.plots.toArray(),
      db.categories.toArray(),
      db.entries.toArray(),
      db.workers.toArray(),
      db.jobs.toArray(),
      db.workerPayments.toArray(),
      db.settings.toArray(),
    ]);
    const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));
    const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'ar');
    return {
      owners: owners.filter(alive).sort(byName),
      plots: plots.filter(alive).sort(byName),
      categories: categories.filter(alive).sort((a, b) => a.createdAt - b.createdAt),
      entries: entries.filter(alive),
      workers: workers.filter(alive).sort(byName),
      jobs: jobs.filter(alive),
      payments: payments.filter(alive),
      currency: (s.currency as string | undefined) ?? 'ر.س',
      lastBackupAt: s.lastBackupAt as number | undefined,
    };
  }, []);
}

export function index<T extends Base>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Tiny hash router: "#/worker/abc" → ['worker', 'abc']. Using the hash means
 * every screen is a real history entry, so Android's back button works, and a
 * static host needs no rewrite rules.
 */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => (location.hash = path);
export const back = () => (history.length > 1 ? history.back() : go('/'));
