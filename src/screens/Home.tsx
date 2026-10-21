import { index, type Data } from '../hooks';
import { monthRange, ownerSummary } from '../lib/calc';
import { Empty, Money, Page } from '../components/ui';
import { formatAmount } from '../lib/money';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function Home({ d }: { d: Data }) {
  const month = monthRange();
  const plots = index(d.plots);
  const owners = index(d.owners);
  const workers = index(d.workers);
  const cats = index(d.categories);
  const hasData = d.entries.length + d.jobs.length + d.payments.length > 0;
  const needsBackup = hasData && (!d.lastBackupAt || Date.now() - d.lastBackupAt > WEEK);

  const recent = [
    ...d.entries.map((r) => ({
      key: r.id, at: r.createdAt, date: r.date, href: `#/entry/edit/${r.id}`,
      title: cats.get(r.categoryId)?.name ?? '',
      sub: `${plots.get(r.plotId)?.name ?? ''} · ${owners.get(plots.get(r.plotId)?.ownerId ?? '')?.name ?? ''}`,
      amount: r.kind === 'income' ? r.amount : -r.amount,
      neutral: false,
    })),
    ...d.jobs.map((r) => ({
      key: r.id, at: r.createdAt, date: r.date, href: `#/job/${r.id}`,
      title: `${r.description} — ${workers.get(r.workerId)?.name ?? ''}`,
      sub: plots.get(r.plotId)?.name ?? '',
      amount: -r.amount,
      neutral: false,
    })),
    ...d.payments.map((r) => ({
      key: r.id, at: r.createdAt, date: r.date, href: `#/pay/${r.id}`,
      title: `دفعة — ${workers.get(r.workerId)?.name ?? ''}`,
      sub: r.note ?? 'من رصيد العامل',
      amount: r.amount,
      neutral: true, // a payment settles a worker balance; it isn't income or expense

    })),
  ].sort((a, b) => b.at - a.at).slice(0, 15);

  return (
    <Page title="دفتر المزرعة">
      {needsBackup && (
        <a className="banner warn" href="#/settings">
          ⚠️ لم تحفظ نسخة احتياطية منذ أكثر من أسبوع. اضغط هنا لحفظها.
        </a>
      )}

      {!d.plots.length && (
        <a className="banner" href="#/settings">
          👋 أهلاً! ابدأ بإضافة الملاك وقطع الأرض والعمال من الإعدادات.
        </a>
      )}

      <div className="quick">
        <a className="q income" href="#/entry/income"><b>＋</b> دخل</a>
        <a className="q expense" href="#/entry/expense"><b>－</b> مصروف</a>
        <a className="q job" href="#/job"><b>🛠</b> عمل عامل</a>
        <a className="q pay" href="#/pay"><b>💵</b> دفعة لعامل</a>
      </div>

      <h2>هذا الشهر</h2>
      {d.owners.length === 0 ? (
        <Empty>لا يوجد ملاك بعد.</Empty>
      ) : (
        <div className="cards">
          {d.owners.map((o) => {
            const s = ownerSummary(o.id, d.plots, d.entries, d.jobs, month);
            return (
              <a key={o.id} className="card" href={`#/report/${o.id}`}>
                <span className="card-title">{o.name}</span>
                <Money v={s.net} cur={d.currency} signed />
                <span className="card-sub">
                  دخل <Money v={s.income} /> · تكاليف <Money v={s.expense + s.labour} />
                </span>
              </a>
            );
          })}
        </div>
      )}

      <h2>آخر القيود</h2>
      {recent.length === 0 ? (
        <Empty>لم تسجل شيئاً بعد.</Empty>
      ) : (
        <ul className="list">
          {recent.map((r) => (
            <li key={r.key}>
              <a href={r.href}>
                <span className="li-main">
                  <span>{r.title}</span>
                  <small>{r.date} · {r.sub}</small>
                </span>
                {r.neutral ? <span className="money muted" dir="ltr">{formatAmount(r.amount)}</span> : <Money v={r.amount} signed />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
