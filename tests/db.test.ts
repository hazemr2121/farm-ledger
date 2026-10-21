import { describe, expect, it } from 'vitest';
import { FarmDB, newRow } from '../src/db';
import { exportJSON, importJSON } from '../src/lib/backup';

describe('database', () => {
  it('seeds categories on first open', async () => {
    const db = new FarmDB('t-seed');
    expect(await db.categories.count()).toBeGreaterThan(5);
    db.close();
  });

  it('JSON backup round-trips and restore replaces everything', async () => {
    const a = new FarmDB('t-backup-a');
    await a.owners.add(newRow({ name: 'أبو محمد' }));
    const json = await exportJSON(a);

    const b = new FarmDB('t-backup-b');
    await b.owners.add(newRow({ name: 'سيُمسح' }));
    await importJSON(b, json);
    expect((await b.owners.toArray()).map((o) => o.name)).toEqual(['أبو محمد']);
    expect(await b.categories.count()).toBe(await a.categories.count());
    a.close(); b.close();
  });

  it('rejects a file that is not a backup, leaving data untouched', async () => {
    const db = new FarmDB('t-bad');
    await db.owners.add(newRow({ name: 'باقٍ' }));
    await expect(importJSON(db, '{"hello":1}')).rejects.toThrow();
    expect(await db.owners.count()).toBe(1);
    db.close();
  });
});
