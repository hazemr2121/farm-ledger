import { TABLES, type FarmDB } from '../db';

const FORMAT = 'farm-ledger-backup';

interface Backup {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** Full copy of every table, soft-deleted rows included, so a restore is exact. */
export async function exportJSON(db: FarmDB): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await db.table(t).toArray();
  const backup: Backup = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), tables };
  return JSON.stringify(backup);
}

/**
 * Replaces all data with the backup. Validates first, then clears and loads
 * inside ONE transaction: if anything throws halfway, IndexedDB rolls the whole
 * thing back and the old data is still there. Without the transaction, a bad
 * file could wipe the tables and then fail to load the new rows.
 */
export async function importJSON(db: FarmDB, text: string): Promise<void> {
  const data = JSON.parse(text) as Partial<Backup>;
  if (data.format !== FORMAT || data.version !== 1 || typeof data.tables !== 'object' || !data.tables) {
    throw new Error('هذا الملف ليس نسخة احتياطية من دفتر المزرعة');
  }
  for (const t of TABLES) {
    if (!Array.isArray(data.tables[t])) throw new Error(`النسخة ناقصة: ${t}`);
  }
  const tables = data.tables;
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(tables[t]);
    }
  });
}
