import { describe, expect, it } from 'vitest';
import { monthRange, ownerSummary, today, workerBalance, workerTimeline } from '../src/lib/calc';
import type { Entry, Job, Plot, WorkerPayment } from '../src/db';

const base = (id: string, extra = {}) => ({ id, createdAt: 1, updatedAt: 1, ...extra });

const plots: Plot[] = [
  { ...base('p1'), name: 'قطعة 1', ownerId: 'A' },
  { ...base('p2'), name: 'قطعة 2', ownerId: 'A' },
  { ...base('p3'), name: 'قطعة 3', ownerId: 'B' },
];
const entries: Entry[] = [
  { ...base('e1'), date: '2026-10-01', kind: 'income', plotId: 'p1', categoryId: 'c', amount: 500000 },
  { ...base('e2'), date: '2026-10-02', kind: 'expense', plotId: 'p1', categoryId: 'c', amount: 120000 },
  { ...base('e3'), date: '2026-10-03', kind: 'expense', plotId: 'p2', categoryId: 'c', amount: 30000 },
  { ...base('e4'), date: '2026-10-03', kind: 'income', plotId: 'p3', categoryId: 'c', amount: 999900 },
  { ...base('e5', { deletedAt: 5 }), date: '2026-10-04', kind: 'expense', plotId: 'p1', categoryId: 'c', amount: 777700 },
  { ...base('e6'), date: '2026-09-15', kind: 'expense', plotId: 'p1', categoryId: 'c', amount: 10000 },
];
const jobs: Job[] = [
  { ...base('j1'), date: '2026-10-05', workerId: 'W', plotId: 'p1', description: 'تسوية بالليزر', amount: 100000 },
  { ...base('j2', { deletedAt: 9 }), date: '2026-10-06', workerId: 'W', plotId: 'p1', description: 'x', amount: 50000 },
];
const payments: WorkerPayment[] = [
  { ...base('w1'), date: '2026-10-06', workerId: 'W', amount: 40000 },
];

describe('ownerSummary', () => {
  it('sums only the owner\'s plots and counts a job once, as labour', () => {
    const s = ownerSummary('A', plots, entries, jobs, { from: '2026-10-01', to: '2026-10-31' });
    expect(s.income).toBe(500000);
    expect(s.expense).toBe(150000);
    expect(s.labour).toBe(100000); // the 400 payment is NOT added again
    expect(s.net).toBe(500000 - 150000 - 100000);
    expect(s.byPlot.map((p) => p.plotId)).toEqual(['p1', 'p2']);
  });

  it('ignores soft-deleted rows', () => {
    const s = ownerSummary('A', plots, entries, jobs);
    expect(s.expense).toBe(120000 + 30000 + 10000); // e5 (deleted) excluded, e6 included without a range
    expect(s.labour).toBe(100000); // j2 (deleted) excluded
  });

  it('respects the date range', () => {
    const s = ownerSummary('A', plots, entries, jobs, { from: '2026-09-01', to: '2026-09-30' });
    expect(s.expense).toBe(10000);
    expect(s.income).toBe(0);
  });

  it('does not leak other owners\' money', () => {
    expect(ownerSummary('B', plots, entries, jobs).net).toBe(999900);
  });
});

describe('workerBalance', () => {
  it('job 1,000 minus payment 400 leaves 600 owed', () => {
    expect(workerBalance('W', jobs, payments)).toEqual({ workerId: 'W', earned: 100000, paid: 40000, owed: 60000 });
  });

  it('an advance shows as negative owed', () => {
    expect(workerBalance('W', [], payments).owed).toBe(-40000);
  });

  it('timeline carries a running balance in date order', () => {
    const t = workerTimeline('W', jobs, payments);
    expect(t.map((i) => [i.type, i.balance])).toEqual([['job', 100000], ['payment', 60000]]);
  });
});

describe('dates', () => {
  it('uses the local date, not UTC', () => {
    expect(today(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });
  it('monthRange handles February', () => {
    expect(monthRange(new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});
