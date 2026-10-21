import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { db, newRow, setSetting, type Kind } from '../db';
import type { Data } from '../hooks';
import { exportJSON, importJSON } from '../lib/backup';
import { today } from '../lib/calc';
import { shareOrDownload } from '../lib/share';
import { Field, Page, useToast } from '../components/ui';

// SheetJS is most of the bundle. Load it on the first export, not on every app start.
// The service worker still precaches the chunk, so exporting works offline.
const loadExcel = () => import('../lib/excel').then((m) => m.buildWorkbook);

type Table = 'owners' | 'plots' | 'workers' | 'categories';

/**
 * A row can only be deleted when nothing points at it. Otherwise old entries
 * would show a blank owner/plot and the reports would silently lose money.
 * Renaming is always safe because everything references the id, not the name.
 */
function inUse(d: Data, table: Table, id: string): string | null {
  if (table === 'owners' && d.plots.some((p) => p.ownerId === id)) return 'لهذا المالك قطع. احذف قطعه أو انقلها أولاً.';
  if (table === 'plots' && (d.entries.some((e) => e.plotId === id) || d.jobs.some((j) => j.plotId === id)))
    return 'على هذه القطعة قيود مسجلة، لا يمكن حذفها.';
  if (table === 'workers' && (d.jobs.some((j) => j.workerId === id) || d.payments.some((p) => p.workerId === id)))
    return 'لهذا العامل أعمال أو دفعات مسجلة، لا يمكن حذفه.';
  if (table === 'categories' && d.entries.some((e) => e.categoryId === id)) return 'هذا البند مستخدم في قيود، لا يمكن حذفه.';
  return null;
}

function Row({ d, table, id, name, sub, children }: {
  d: Data; table: Table; id: string; name: string; sub?: string; children?: ReactNode;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    await db.table(table).update(id, { name: value.trim(), updatedAt: Date.now() });
    setEditing(false);
  }

  async function remove() {
    const reason = inUse(d, table, id);
    if (reason) return toast(reason);
    if (!confirm(`حذف «${name}»؟`)) return;
    const now = Date.now();
    await db.table(table).update(id, { deletedAt: now, updatedAt: now });
  }

  if (editing)
    return (
      <li className="edit-row">
        <form onSubmit={rename}>
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          {children}
          <button className="btn primary">حفظ</button>
          <button type="button" className="btn" onClick={() => { setValue(name); setEditing(false); }}>إلغاء</button>
        </form>
      </li>
    );

  return (
    <li className="set-row">
      <span className="li-main"><span>{name}</span>{sub && <small>{sub}</small>}</span>
      <button className="icon-btn" onClick={() => setEditing(true)} aria-label="تعديل">✏️</button>
      <button className="icon-btn" onClick={remove} aria-label="حذف">🗑</button>
    </li>
  );
}

function AddForm({ onAdd, children, placeholder }: { onAdd: (name: string) => Promise<unknown>; children?: ReactNode; placeholder: string }) {
  const [name, setName] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    // Clear BEFORE the await. Clearing after it leaves a gap where the old
    // text is still in the box: a double-tap adds the row twice, and anything
    // typed in that gap gets glued onto the previous name.
    setName('');
    await onAdd(v);
  }
  return (
    <form className="add-form" onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} required />
      {children}
      <button className="btn primary">إضافة</button>
    </form>
  );
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  // Freeze the first value. If `open` followed the data, adding the first
  // owner would flip it to false and slam the section shut mid-typing.
  const [initiallyOpen] = useState(open);
  return (
    <details className="section" open={initiallyOpen}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function Settings({ d }: { d: Data }) {
  const toast = useToast();
  const [plotOwner, setPlotOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [catKind, setCatKind] = useState<Kind>('expense');
  const [currency, setCurrency] = useState(d.currency);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const owners = new Map(d.owners.map((o) => [o.id, o.name]));
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  async function backupJSON() {
    const blob = new Blob([await exportJSON(db)], { type: 'application/json' });
    const r = await shareOrDownload(blob, `نسخة-دفتر-المزرعة_${today()}.json`);
    if (r === 'cancelled') return;
    await setSetting('lastBackupAt', Date.now());
    toast('تم حفظ النسخة الاحتياطية ✓');
  }

  async function restore(file: File) {
    if (!confirm('سيتم استبدال كل البيانات الحالية بالنسخة الاحتياطية. متابعة؟')) return;
    try {
      await importJSON(db, await file.text());
      toast('تمت الاستعادة ✓');
    } catch (e) {
      toast(e instanceof SyntaxError ? 'الملف تالف أو ليس JSON' : (e as Error).message);
    }
  }

  async function exportAll() {
    const r = await shareOrDownload((await loadExcel())(d, {}), `دفتر-المزرعة_الكل_${today()}.xlsx`);
    if (r !== 'cancelled') toast('تم تصدير ملف Excel ✓');
  }

  async function requestPersist() {
    const ok = await navigator.storage?.persist?.();
    setPersisted(!!ok);
    toast(ok ? 'البيانات محمية من الحذف التلقائي ✓' : 'المتصفح رفض. ثبّت التطبيق على الشاشة الرئيسية ثم حاول مرة أخرى.');
  }

  return (
    <Page title="الإعدادات">
      <Section title={`الملاك (${d.owners.length})`} open={!d.owners.length}>
        <ul className="list plain">
          {d.owners.map((o) => <Row key={o.id} d={d} table="owners" id={o.id} name={o.name} />)}
        </ul>
        <AddForm placeholder="اسم المالك" onAdd={(name) => db.owners.add(newRow({ name }))} />
      </Section>

      <Section title={`قطع الأرض (${d.plots.length})`} open={!d.plots.length}>
        <ul className="list plain">
          {d.plots.map((p) => (
            <Row key={p.id} d={d} table="plots" id={p.id} name={p.name} sub={owners.get(p.ownerId)} />
          ))}
        </ul>
        {d.owners.length ? (
          <AddForm
            placeholder="اسم القطعة"
            onAdd={async (name) => {
              const ownerId = plotOwner || d.owners[0].id;
              await db.plots.add(newRow({ name, ownerId }));
            }}
          >
            <select value={plotOwner || d.owners[0].id} onChange={(e) => setPlotOwner(e.target.value)} aria-label="المالك">
              {d.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </AddForm>
        ) : (
          <p className="explain">أضف الملاك أولاً.</p>
        )}
      </Section>

      <Section title={`العمال (${d.workers.length})`} open={!d.workers.length}>
        <ul className="list plain">
          {d.workers.map((w) => <Row key={w.id} d={d} table="workers" id={w.id} name={w.name} sub={w.phone} />)}
        </ul>
        <AddForm
          placeholder="اسم العامل"
          onAdd={async (name) => {
            await db.workers.add(newRow({ name, phone: phone.trim() || undefined }));
            setPhone('');
          }}
        >
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الجوال (اختياري)" inputMode="tel" dir="ltr" />
        </AddForm>
      </Section>

      <Section title="بنود الدخل والمصاريف">
        <ul className="list plain">
          {d.categories.map((c) => (
            <Row key={c.id} d={d} table="categories" id={c.id} name={c.name} sub={c.kind === 'income' ? 'دخل' : 'مصروف'} />
          ))}
        </ul>
        <AddForm placeholder="اسم البند" onAdd={(name) => db.categories.add(newRow({ name, kind: catKind }))}>
          <select value={catKind} onChange={(e) => setCatKind(e.target.value as Kind)} aria-label="النوع">
            <option value="expense">مصروف</option>
            <option value="income">دخل</option>
          </select>
        </AddForm>
      </Section>

      <Section title="العملة">
        <form className="add-form" onSubmit={async (e) => { e.preventDefault(); await setSetting('currency', currency.trim()); toast('تم الحفظ ✓'); }}>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="مثال: ر.س أو ج.م" />
          <button className="btn primary">حفظ</button>
        </form>
      </Section>

      <Section title="🛟 النسخ الاحتياطي" open>
        <p className="explain">
          البيانات محفوظة على هذا الجوال فقط. لو ضاع الجوال أو مُسحت بيانات المتصفح تضيع معه.
          احفظ نسخة كل أسبوع وأرسلها لنفسك على واتساب أو Drive.
        </p>
        <p className="explain">
          آخر نسخة: <b>{d.lastBackupAt ? new Date(d.lastBackupAt).toLocaleDateString('ar') : 'لم تُحفظ بعد'}</b>
        </p>
        <div className="stack">
          <button className="btn primary big" onClick={backupJSON}>💾 حفظ نسخة احتياطية</button>
          <button className="btn excel big" onClick={exportAll}>📊 تصدير كل البيانات إلى Excel</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>♻️ استعادة من نسخة احتياطية</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) restore(f);
            }}
          />
        </div>
      </Section>

      <Section title="حماية البيانات">
        <Field label="التثبيت على الشاشة الرئيسية">
          <span>{standalone ? '✅ مثبّت' : '⚠️ غير مثبّت. من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية». على الآيفون هذا ضروري حتى لا يحذف Safari البيانات.'}</span>
        </Field>
        <Field label="منع الحذف التلقائي">
          <span>{persisted === null ? 'غير معروف' : persisted ? '✅ محمي' : '⚠️ غير محمي'}</span>
        </Field>
        {!persisted && <button className="btn" onClick={requestPersist}>طلب الحماية</button>}
      </Section>
    </Page>
  );
}
