import { useState } from 'react';
import { index, type Data } from '../hooks';
import { inRange, monthRange, ownerSummary, today, type Range } from '../lib/calc';
import { shareOrDownload } from '../lib/share';
import { Empty, Field, Money, Page, useToast } from '../components/ui';

// SheetJS is most of the bundle. Load it on the first export, not on every app start.
// The service worker still precaches the chunk, so exporting works offline.
const loadExcel = () => import('../lib/excel').then((m) => m.buildWorkbook);

function presets(): { label: string; range: Range }[] {
  const now = new Date();
  const y = now.getFullYear();
  return [
    { label: 'هذا الشهر', range: monthRange(now) },
    { label: 'الشهر الماضي', range: monthRange(new Date(y, now.getMonth() - 1, 1)) },
    { label: 'هذه السنة', range: { from: `${y}-01-01`, to: `${y}-12-31` } },
    { label: 'الكل', range: {} },
  ];
}

export function Report({ d, ownerId: initialOwner }: { d: Data; ownerId?: string }) {
  const toast = useToast();
  const [ownerId, setOwnerId] = useState(initialOwner ?? d.owners[0]?.id ?? '');
  const [range, setRange] = useState<Range>(monthRange());
  const [busy, setBusy] = useState(false);

  const plots = index(d.plots);
  const cats = index(d.categories);
  const workers = index(d.workers);

  async function exportExcel() {
    setBusy(true);
    try {
      const name = `دفتر-المزرعة_${range.from ?? 'البداية'}_${range.to ?? today()}.xlsx`;
      const r = await shareOrDownload((await loadExcel())(d, range), name);
      if (r !== 'cancelled') toast('تم تصدير ملف Excel ✓');
    } finally {
      setBusy(false);
    }
  }

  const s = ownerId ? ownerSummary(ownerId, d.plots, d.entries, d.jobs, range) : null;
  const ownerPlots = new Set(s?.byPlot.map((p) => p.plotId));
  const lines = [
    ...d.entries.filter((e) => ownerPlots.has(e.plotId) && inRange(e.date, range)).map((e) => ({
      id: e.id, date: e.date, href: `#/entry/edit/${e.id}`,
      title: cats.get(e.categoryId)?.name ?? '', sub: plots.get(e.plotId)?.name ?? '',
      amount: e.kind === 'income' ? e.amount : -e.amount,
    })),
    ...d.jobs.filter((j) => ownerPlots.has(j.plotId) && inRange(j.date, range)).map((j) => ({
      id: j.id, date: j.date, href: `#/job/${j.id}`,
      title: `${j.description} — ${workers.get(j.workerId)?.name ?? ''}`, sub: plots.get(j.plotId)?.name ?? '',
      amount: -j.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Page title="التقارير">
      <div className="filters">
        <Field label="المالك">
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {d.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <div className="chips">
          {presets().map((p) => (
            <button
              key={p.label}
              className={`chip ${p.range.from === range.from && p.range.to === range.to ? 'on' : ''}`}
              onClick={() => setRange(p.range)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="row2">
          <Field label="من"><input type="date" value={range.from ?? ''} onChange={(e) => setRange({ ...range, from: e.target.value || undefined })} /></Field>
          <Field label="إلى"><input type="date" value={range.to ?? ''} onChange={(e) => setRange({ ...range, to: e.target.value || undefined })} /></Field>
        </div>
      </div>

      <button className="btn excel big" onClick={exportExcel} disabled={busy || !d.owners.length}>
        📊 تصدير Excel (كل الملاك لهذه الفترة)
      </button>

      {!s ? (
        <Empty>أضف الملاك من الإعدادات.</Empty>
      ) : (
        <>
          <div className="totals">
            <div><span>الدخل</span><Money v={s.income} /></div>
            <div><span>المصاريف</span><Money v={s.expense} /></div>
            <div><span>أجور العمال</span><Money v={s.labour} /></div>
            <div className="net"><span>الصافي</span><Money v={s.net} cur={d.currency} signed /></div>
          </div>

          <h2>حسب القطعة</h2>
          {s.byPlot.length === 0 ? (
            <Empty>لا توجد قطع لهذا المالك.</Empty>
          ) : (
            <table className="tbl">
              <thead><tr><th>القطعة</th><th>دخل</th><th>تكاليف</th><th>صافي</th></tr></thead>
              <tbody>
                {s.byPlot.map((p) => (
                  <tr key={p.plotId}>
                    <td>{plots.get(p.plotId)?.name}</td>
                    <td><Money v={p.income} /></td>
                    <td><Money v={p.expense + p.labour} /></td>
                    <td><Money v={p.net} signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>التفاصيل ({lines.length})</h2>
          {lines.length === 0 ? (
            <Empty>لا توجد قيود في هذه الفترة.</Empty>
          ) : (
            <ul className="list">
              {lines.map((l) => (
                <li key={l.id}>
                  <a href={l.href}>
                    <span className="li-main"><span>{l.title}</span><small>{l.date} · {l.sub}</small></span>
                    <Money v={l.amount} signed />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  );
}
