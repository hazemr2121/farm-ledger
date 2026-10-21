import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook } from '../src/lib/excel';
import type { Data } from '../src/hooks';

const b = (id: string) => ({ id, createdAt: 1, updatedAt: 1 });
const d: Data = {
  owners: [{ ...b('A'), name: 'أبو محمد' }],
  plots: [{ ...b('p1'), name: 'الشمالية', ownerId: 'A' }],
  categories: [{ ...b('c1'), name: 'سماد', kind: 'expense' }, { ...b('c2'), name: 'بيع محصول', kind: 'income' }],
  entries: [
    { ...b('e1'), date: '2026-10-01', kind: 'income', plotId: 'p1', categoryId: 'c2', amount: 500000 },
    { ...b('e2'), date: '2026-10-02', kind: 'expense', plotId: 'p1', categoryId: 'c1', amount: 120050 },
  ],
  workers: [{ ...b('W'), name: 'سعيد' }],
  jobs: [{ ...b('j1'), date: '2026-10-03', workerId: 'W', plotId: 'p1', description: 'تسوية بالليزر', amount: 100000 }],
  payments: [{ ...b('w1'), date: '2026-10-04', workerId: 'W', amount: 40000 }],
  currency: 'ر.س',
  lastBackupAt: undefined,
};

describe('buildWorkbook', () => {
  it('writes numeric amounts Excel can SUM, one sheet per view', async () => {
    const wb = XLSX.read(await buildWorkbook(d, {}).arrayBuffer());
    expect(wb.SheetNames).toEqual(['ملخص الملاك', 'الدخل والمصاريف', 'أعمال العمال', 'دفعات العمال', 'أرصدة العمال']);

    const [summary] = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['ملخص الملاك']);
    expect(summary).toMatchObject({ 'المالك': 'أبو محمد', 'الدخل': 5000, 'المصاريف': 1200.5, 'أجور العمال': 1000, 'الصافي': 2799.5 });

    const entries = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['الدخل والمصاريف']);
    expect(entries.map((e) => e['المبلغ'])).toEqual([5000, -1200.5]); // expenses negative so a column SUM = net
    expect(wb.Sheets['الدخل والمصاريف']['F2'].t).toBe('n'); // a number cell, not text

    const [bal] = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['أرصدة العمال']);
    expect(bal['المتبقي له']).toBe(600);
  });

  it('filters by range but keeps worker balances all-time', async () => {
    const wb = XLSX.read(await buildWorkbook(d, { from: '2026-10-02', to: '2026-10-02' }).arrayBuffer());
    expect(XLSX.utils.sheet_to_json(wb.Sheets['الدخل والمصاريف'])).toHaveLength(1);
    const [bal] = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['أرصدة العمال']);
    expect(bal['المتبقي له']).toBe(600);
  });
});
