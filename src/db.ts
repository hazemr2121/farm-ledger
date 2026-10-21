import Dexie, { type EntityTable } from 'dexie';

// Every row carries these. `deletedAt` is a soft delete: the row stays in the
// database (audit trail, and a future sync can tell "deleted" from "never existed")
// but every query filters it out.
export interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export type Kind = 'income' | 'expense';

/** Money is always an integer in minor units (halalas, piastres…), never a float. */
export type Minor = number;

/** Dates are stored as 'YYYY-MM-DD' strings so they sort and compare as text. */
export type ISODate = string;

export interface Owner extends Base { name: string }
export interface Plot extends Base { name: string; ownerId: string; notes?: string }
export interface Category extends Base { name: string; kind: Kind }
export interface Entry extends Base {
  date: ISODate;
  kind: Kind;
  plotId: string;
  categoryId: string;
  amount: Minor;
  note?: string;
}
export interface Worker extends Base { name: string; phone?: string }
/** Work a worker did on a plot for an agreed price. This is the cost. */
export interface Job extends Base {
  date: ISODate;
  workerId: string;
  plotId: string;
  description: string;
  amount: Minor;
}
/** Cash handed to a worker. Settles what is owed; it is not a second expense. */
export interface WorkerPayment extends Base {
  date: ISODate;
  workerId: string;
  amount: Minor;
  note?: string;
}
export interface Setting { key: string; value: unknown }

export class FarmDB extends Dexie {
  owners!: EntityTable<Owner, 'id'>;
  plots!: EntityTable<Plot, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  workers!: EntityTable<Worker, 'id'>;
  jobs!: EntityTable<Job, 'id'>;
  workerPayments!: EntityTable<WorkerPayment, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'farm-ledger') {
    super(name);
    // Only indexed fields are listed here; other fields are stored but not indexed.
    this.version(1).stores({
      owners: 'id',
      plots: 'id, ownerId',
      categories: 'id, kind',
      entries: 'id, date, plotId, categoryId',
      workers: 'id',
      jobs: 'id, date, workerId, plotId',
      workerPayments: 'id, date, workerId',
      settings: 'key',
    });
    this.on('populate', (tx) => {
      const now = Date.now();
      const seed: [string, Kind][] = [
        ['بيع محصول', 'income'],
        ['إيجار', 'income'],
        ['دخل آخر', 'income'],
        ['سماد', 'expense'],
        ['بذور وشتلات', 'expense'],
        ['مبيدات', 'expense'],
        ['ديزل / وقود', 'expense'],
        ['ري وكهرباء', 'expense'],
        ['صيانة ومعدات', 'expense'],
        ['نقل', 'expense'],
        ['مصروف آخر', 'expense'],
      ];
      tx.table('categories').bulkAdd(
        // now + i keeps the seed order when categories are sorted by createdAt.
        seed.map(([name, kind], i) => ({ id: crypto.randomUUID(), name, kind, createdAt: now + i, updatedAt: now + i })),
      );
    });
  }
}

export const db = new FarmDB();

export const TABLES = ['owners', 'plots', 'categories', 'entries', 'workers', 'jobs', 'workerPayments'] as const;
export type TableName = (typeof TABLES)[number];

export function newRow<T extends object>(data: T): T & Base {
  const now = Date.now();
  return { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

export const alive = <T extends Base>(r: T) => !r.deletedAt;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}
