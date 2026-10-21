import { useRef, useState, type FormEvent } from 'react';
import { db, newRow, type Kind } from '../db';
import { back, go, type Data } from '../hooks';
import { today } from '../lib/calc';
import { formatAmount, parseAmount } from '../lib/money';
import { Empty, Field, Page, useToast } from '../components/ui';

// Remembering the last plot/worker saves Dad a tap on almost every entry.
// It's a convenience only, so a blocked localStorage just means no default.
const remember = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* private mode etc. */ }
};
const recall = (k: string) => {
  try { return localStorage.getItem(k) ?? ''; } catch { return ''; }
};

/**
 * Runs `fn` at most once at a time. A double-tap on "save" fires two submit
 * events before the first `await` finishes; without this, that is two
 * identical expenses in the books. It's a ref, not state, because a state
 * update isn't visible until the next render, and the second tap arrives
 * before that.
 */
function useOnce() {
  const busy = useRef(false);
  return async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } finally {
      busy.current = false;
    }
  };
}

function PlotSelect({ d, value, onChange }: { d: Data; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>اختر القطعة</option>
      {d.owners.map((o) => (
        <optgroup key={o.id} label={o.name}>
          {d.plots.filter((p) => p.ownerId === o.id).map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {o.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function WorkerSelect({ d, value, onChange }: { d: Data; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>اختر العامل</option>
      {d.workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
  );
}

function AmountInput({ value, onChange, cur }: { value: string; onChange: (v: string) => void; cur: string }) {
  const bad = value !== '' && parseAmount(value) === null;
  return (
    <Field label={`المبلغ (${cur})`} hint={bad ? 'أدخل مبلغاً صحيحاً، مثل 1500 أو 1500.50' : undefined}>
      {/* type="text" + inputMode, not type="number": number inputs reject Arabic digits and commas. */}
      <input
        className={`amount ${bad ? 'invalid' : ''}`}
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        required
      />
    </Field>
  );
}

function NeedsSetup({ what }: { what: string }) {
  return (
    <Empty>
      أضف {what} أولاً من <a href="#/settings">الإعدادات</a>.
    </Empty>
  );
}

async function softDelete(table: 'entries' | 'jobs' | 'workerPayments', id: string) {
  const now = Date.now();
  await db.table(table).update(id, { deletedAt: now, updatedAt: now });
}

function Actions({ editing, onDelete }: { editing: boolean; onDelete: () => void }) {
  return (
    <div className="form-actions">
      <button type="submit" className="btn primary big">حفظ</button>
      {editing && <button type="button" className="btn danger" onClick={onDelete}>حذف</button>}
    </div>
  );
}

export function EntryForm({ d, kind: newKind, id }: { d: Data; kind?: Kind; id?: string }) {
  const toast = useToast();
  const once = useOnce();
  const existing = id ? d.entries.find((e) => e.id === id) : undefined;
  const kind = existing?.kind ?? newKind ?? 'expense';
  const [date, setDate] = useState(existing?.date ?? today());
  const [plotId, setPlotId] = useState(existing?.plotId ?? (d.plots.some((p) => p.id === recall('lastPlot')) ? recall('lastPlot') : ''));
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [amount, setAmount] = useState(existing ? formatAmount(existing.amount) : '');
  const [note, setNote] = useState(existing?.note ?? '');

  if (id && !existing) return <Page title="غير موجود" showBack><Empty>هذا القيد محذوف.</Empty></Page>;
  if (!d.plots.length) return <Page title="قيد جديد" showBack><NeedsSetup what="الملاك والقطع" /></Page>;

  const cats = d.categories.filter((c) => c.kind === kind);
  const title = `${existing ? 'تعديل' : 'تسجيل'} ${kind === 'income' ? 'دخل' : 'مصروف'}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    const minor = parseAmount(amount);
    if (minor === null) return;
    await once(async () => {
      const data = { date, kind, plotId, categoryId, amount: minor, note: note.trim() || undefined };
      if (existing) await db.entries.update(existing.id, { ...data, updatedAt: Date.now() });
      else await db.entries.add(newRow(data));
      remember('lastPlot', plotId);
      toast('تم الحفظ ✓');
      existing ? back() : go('/');
    });
  }

  async function remove() {
    if (!existing || !confirm('حذف هذا القيد؟')) return;
    await softDelete('entries', existing.id);
    toast('تم الحذف');
    back();
  }

  return (
    <Page title={title} showBack>
      <form className={`form ${kind}`} onSubmit={save}>
        <AmountInput value={amount} onChange={setAmount} cur={d.currency} />
        <Field label="القطعة"><PlotSelect d={d} value={plotId} onChange={setPlotId} /></Field>
        <Field label="البند">
          <div className="chips">
            {cats.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`chip ${categoryId === c.id ? 'on' : ''}`}
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {/* Hidden required input so the browser blocks submit until a chip is picked. */}
          <input className="sr-only" tabIndex={-1} value={categoryId} onChange={() => {}} required aria-hidden />
        </Field>
        <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="ملاحظة (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Actions editing={!!existing} onDelete={remove} />
      </form>
    </Page>
  );
}

export function JobForm({ d, id, workerId: presetWorker }: { d: Data; id?: string; workerId?: string }) {
  const toast = useToast();
  const once = useOnce();
  const existing = id ? d.jobs.find((j) => j.id === id) : undefined;
  const [date, setDate] = useState(existing?.date ?? today());
  const [workerId, setWorkerId] = useState(existing?.workerId ?? presetWorker ?? (d.workers.length === 1 ? d.workers[0].id : ''));
  const [plotId, setPlotId] = useState(existing?.plotId ?? (d.plots.some((p) => p.id === recall('lastPlot')) ? recall('lastPlot') : ''));
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? formatAmount(existing.amount) : '');

  if (id && !existing) return <Page title="غير موجود" showBack><Empty>هذا العمل محذوف.</Empty></Page>;
  if (!d.plots.length || !d.workers.length) return <Page title="عمل عامل" showBack><NeedsSetup what="القطع والعمال" /></Page>;

  // Past job descriptions as quick picks: "تسوية بالليزر" typed once, tapped forever after.
  const suggestions = [...new Set(d.jobs.map((j) => j.description))].slice(-8);

  async function save(e: FormEvent) {
    e.preventDefault();
    const minor = parseAmount(amount);
    if (minor === null) return;
    await once(async () => {
      const data = { date, workerId, plotId, description: description.trim(), amount: minor };
      if (existing) await db.jobs.update(existing.id, { ...data, updatedAt: Date.now() });
      else await db.jobs.add(newRow(data));
      remember('lastPlot', plotId);
      toast('تم الحفظ ✓');
      back();
    });
  }

  async function remove() {
    if (!existing || !confirm('حذف هذا العمل؟ سيتغير رصيد العامل.')) return;
    await softDelete('jobs', existing.id);
    toast('تم الحذف');
    back();
  }

  return (
    <Page title={existing ? 'تعديل عمل' : 'عمل عامل'} showBack>
      <form className="form job" onSubmit={save}>
        <p className="explain">العمل يُسجَّل كتكلفة على مالك القطعة، ويُضاف لرصيد العامل.</p>
        <Field label="العامل"><WorkerSelect d={d} value={workerId} onChange={setWorkerId} /></Field>
        <Field label="القطعة"><PlotSelect d={d} value={plotId} onChange={setPlotId} /></Field>
        <Field label="العمل">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثال: تسوية بالليزر" required />
          {suggestions.length > 0 && (
            <div className="chips small">
              {suggestions.map((s) => (
                <button type="button" key={s} className="chip" onClick={() => setDescription(s)}>{s}</button>
              ))}
            </div>
          )}
        </Field>
        <AmountInput value={amount} onChange={setAmount} cur={d.currency} />
        <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Actions editing={!!existing} onDelete={remove} />
      </form>
    </Page>
  );
}

export function PaymentForm({ d, id, workerId: presetWorker }: { d: Data; id?: string; workerId?: string }) {
  const toast = useToast();
  const once = useOnce();
  const existing = id ? d.payments.find((p) => p.id === id) : undefined;
  const [date, setDate] = useState(existing?.date ?? today());
  const [workerId, setWorkerId] = useState(existing?.workerId ?? presetWorker ?? (d.workers.length === 1 ? d.workers[0].id : ''));
  const [amount, setAmount] = useState(existing ? formatAmount(existing.amount) : '');
  const [note, setNote] = useState(existing?.note ?? '');

  if (id && !existing) return <Page title="غير موجود" showBack><Empty>هذه الدفعة محذوفة.</Empty></Page>;
  if (!d.workers.length) return <Page title="دفعة لعامل" showBack><NeedsSetup what="العمال" /></Page>;

  async function save(e: FormEvent) {
    e.preventDefault();
    const minor = parseAmount(amount);
    if (minor === null) return;
    await once(async () => {
      const data = { date, workerId, amount: minor, note: note.trim() || undefined };
      if (existing) await db.workerPayments.update(existing.id, { ...data, updatedAt: Date.now() });
      else await db.workerPayments.add(newRow(data));
      toast('تم الحفظ ✓');
      back();
    });
  }

  async function remove() {
    if (!existing || !confirm('حذف هذه الدفعة؟ سيتغير رصيد العامل.')) return;
    await softDelete('workerPayments', existing.id);
    toast('تم الحذف');
    back();
  }

  return (
    <Page title={existing ? 'تعديل دفعة' : 'دفعة لعامل'} showBack>
      <form className="form pay" onSubmit={save}>
        <p className="explain">الدفعة تُنقص ما عليك للعامل فقط، ولا تُحسب مصروفاً مرة ثانية.</p>
        <Field label="العامل"><WorkerSelect d={d} value={workerId} onChange={setWorkerId} /></Field>
        <AmountInput value={amount} onChange={setAmount} cur={d.currency} />
        <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="ملاحظة (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: سلفة" /></Field>
        <Actions editing={!!existing} onDelete={remove} />
      </form>
    </Page>
  );
}
