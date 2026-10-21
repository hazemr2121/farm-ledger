import * as XLSX from 'xlsx';
import type { Data } from '../hooks';
import { index } from '../hooks';
import { inRange, ownerSummary, workerBalance, type Range } from './calc';
import { toMajor } from './money';

/**
 * One workbook, one sheet per view. Amounts are written as real numbers (not
 * formatted text) so Dad can SUM, filter and pivot them in Excel himself.
 */
export function buildWorkbook(d: Data, range: Range): Blob {
  const owners = index(d.owners);
  const plots = index(d.plots);
  const cats = index(d.categories);
  const workers = index(d.workers);
  const plotOwner = (id: string) => owners.get(plots.get(id)?.ownerId ?? '')?.name ?? '';
  const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

  const summary = d.owners.map((o) => {
    const s = ownerSummary(o.id, d.plots, d.entries, d.jobs, range);
    return {
      'المالك': o.name,
      'الدخل': toMajor(s.income),
      'المصاريف': toMajor(s.expense),
      'أجور العمال': toMajor(s.labour),
      'الصافي': toMajor(s.net),
    };
  });

  const entries = d.entries.filter((e) => inRange(e.date, range)).sort(byDate).map((e) => ({
    'التاريخ': e.date,
    'النوع': e.kind === 'income' ? 'دخل' : 'مصروف',
    'المالك': plotOwner(e.plotId),
    'القطعة': plots.get(e.plotId)?.name ?? '',
    'البند': cats.get(e.categoryId)?.name ?? '',
    'المبلغ': toMajor(e.kind === 'income' ? e.amount : -e.amount),
    'ملاحظة': e.note ?? '',
  }));

  const jobs = d.jobs.filter((j) => inRange(j.date, range)).sort(byDate).map((j) => ({
    'التاريخ': j.date,
    'العامل': workers.get(j.workerId)?.name ?? '',
    'المالك': plotOwner(j.plotId),
    'القطعة': plots.get(j.plotId)?.name ?? '',
    'العمل': j.description,
    'المبلغ': toMajor(j.amount),
  }));

  const payments = d.payments.filter((p) => inRange(p.date, range)).sort(byDate).map((p) => ({
    'التاريخ': p.date,
    'العامل': workers.get(p.workerId)?.name ?? '',
    'المبلغ': toMajor(p.amount),
    'ملاحظة': p.note ?? '',
  }));

  // Balances are all-time: what is owed today doesn't depend on the report range.
  const balances = d.workers.map((w) => {
    const b = workerBalance(w.id, d.jobs, d.payments);
    return {
      'العامل': w.name,
      'الجوال': w.phone ?? '',
      'مستحق (أعمال)': toMajor(b.earned),
      'مدفوع': toMajor(b.paid),
      'المتبقي له': toMajor(b.owed),
    };
  });

  const wb = XLSX.utils.book_new();
  const add = (rows: object[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'لا توجد بيانات' }]);
    const keys = Object.keys(rows[0] ?? { '': '' });
    ws['!cols'] = keys.map((k) => ({ wch: Math.max(12, k.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(summary, 'ملخص الملاك');
  add(entries, 'الدخل والمصاريف');
  add(jobs, 'أعمال العمال');
  add(payments, 'دفعات العمال');
  add(balances, 'أرصدة العمال');
  // Open the workbook right-to-left, like an Arabic sheet he'd make himself.
  wb.Workbook = { Views: [{ RTL: true }] };

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
