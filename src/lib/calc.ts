// Pure accounting functions. No database, no React: arrays in, numbers out.
// That separation is what makes them easy to test (see tests/calc.test.ts).
//
// The rule (confirmed with Dad before trusting the numbers):
//   - A Job is the cost. It hits the plot's owner on the job date (accrual).
//   - A WorkerPayment only settles the worker's balance. It is NOT an expense,
//     otherwise the same work would be counted twice.

import type { Base, Entry, ISODate, Job, Minor, Plot, WorkerPayment } from '../db';

export interface Range { from?: ISODate; to?: ISODate }

export const inRange = (date: ISODate, r: Range = {}) =>
  (!r.from || date >= r.from) && (!r.to || date <= r.to);

const live = <T extends Base>(rows: T[]) => rows.filter((r) => !r.deletedAt);
const sum = (rows: { amount: Minor }[]) => rows.reduce((t, r) => t + r.amount, 0);

export interface PlotTotals {
  plotId: string;
  income: Minor;
  expense: Minor;
  labour: Minor;
  net: Minor;
}

export interface OwnerSummary extends Omit<PlotTotals, 'plotId'> {
  ownerId: string;
  byPlot: PlotTotals[];
}

export function plotTotals(plotId: string, entries: Entry[], jobs: Job[], range?: Range): PlotTotals {
  const es = live(entries).filter((e) => e.plotId === plotId && inRange(e.date, range));
  const income = sum(es.filter((e) => e.kind === 'income'));
  const expense = sum(es.filter((e) => e.kind === 'expense'));
  const labour = sum(live(jobs).filter((j) => j.plotId === plotId && inRange(j.date, range)));
  return { plotId, income, expense, labour, net: income - expense - labour };
}

export function ownerSummary(
  ownerId: string,
  plots: Plot[],
  entries: Entry[],
  jobs: Job[],
  range?: Range,
): OwnerSummary {
  const byPlot = live(plots)
    .filter((p) => p.ownerId === ownerId)
    .map((p) => plotTotals(p.id, entries, jobs, range));
  const total = (k: keyof Omit<PlotTotals, 'plotId'>) => byPlot.reduce((t, p) => t + p[k], 0);
  return {
    ownerId,
    byPlot,
    income: total('income'),
    expense: total('expense'),
    labour: total('labour'),
    net: total('net'),
  };
}

export interface WorkerBalance { workerId: string; earned: Minor; paid: Minor; owed: Minor }

/** Positive `owed` = Dad still owes the worker. Negative = worker was paid ahead (an advance). */
export function workerBalance(workerId: string, jobs: Job[], payments: WorkerPayment[]): WorkerBalance {
  const earned = sum(live(jobs).filter((j) => j.workerId === workerId));
  const paid = sum(live(payments).filter((p) => p.workerId === workerId));
  return { workerId, earned, paid, owed: earned - paid };
}

export type TimelineItem =
  | { type: 'job'; row: Job; balance: Minor }
  | { type: 'payment'; row: WorkerPayment; balance: Minor };

/** Jobs and payments in date order with a running balance, like a ledger account. */
export function workerTimeline(workerId: string, jobs: Job[], payments: WorkerPayment[]): TimelineItem[] {
  const items = [
    ...live(jobs).filter((j) => j.workerId === workerId).map((row) => ({ type: 'job' as const, row })),
    ...live(payments).filter((p) => p.workerId === workerId).map((row) => ({ type: 'payment' as const, row })),
  ].sort((a, b) => a.row.date.localeCompare(b.row.date) || a.row.createdAt - b.row.createdAt);

  let balance = 0;
  return items.map((it) => {
    balance += it.type === 'job' ? it.row.amount : -it.row.amount;
    return { ...it, balance } as TimelineItem;
  });
}

/** Local date as YYYY-MM-DD. `toISOString()` would give the UTC date, which is
 *  yesterday for an entry made just after midnight in UTC+3. */
export function today(d = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function monthRange(d = new Date()): Range {
  const t = today(d);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { from: `${t.slice(0, 8)}01`, to: `${t.slice(0, 8)}${String(last).padStart(2, '0')}` };
}
