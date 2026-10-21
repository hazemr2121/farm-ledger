import { index, type Data } from '../hooks';
import { workerBalance, workerTimeline } from '../lib/calc';
import { Empty, Money, Page } from '../components/ui';

export function Workers({ d }: { d: Data }) {
  const balances = d.workers.map((w) => ({ w, b: workerBalance(w.id, d.jobs, d.payments) }));
  const totalOwed = balances.reduce((t, x) => t + Math.max(0, x.b.owed), 0);

  return (
    <Page title="العمال">
      {d.workers.length === 0 ? (
        <Empty>لا يوجد عمال. أضفهم من <a href="#/settings">الإعدادات</a>.</Empty>
      ) : (
        <>
          <div className="totals one">
            <div className="net"><span>مجموع المتبقي للعمال</span><Money v={totalOwed} cur={d.currency} /></div>
          </div>
          <ul className="list">
            {balances.map(({ w, b }) => (
              <li key={w.id}>
                <a href={`#/worker/${w.id}`}>
                  <span className="li-main">
                    <span>{w.name}</span>
                    <small>{b.owed > 0 ? 'له' : b.owed < 0 ? 'عليه (سلفة)' : 'خالص'}</small>
                  </span>
                  <Money v={Math.abs(b.owed)} />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

export function WorkerDetail({ d, id }: { d: Data; id: string }) {
  const w = d.workers.find((x) => x.id === id);
  if (!w) return <Page title="العامل" showBack><Empty>العامل غير موجود.</Empty></Page>;

  const plots = index(d.plots);
  const b = workerBalance(id, d.jobs, d.payments);
  const timeline = workerTimeline(id, d.jobs, d.payments).reverse(); // newest first

  return (
    <Page title={w.name} showBack>
      {w.phone && <a className="phone" href={`tel:${w.phone}`} dir="ltr">📞 {w.phone}</a>}
      <div className="totals">
        <div><span>أعمال</span><Money v={b.earned} /></div>
        <div><span>مدفوع</span><Money v={b.paid} /></div>
        <div className="net">
          <span>{b.owed >= 0 ? 'المتبقي له' : 'عليه (سلفة)'}</span>
          <Money v={Math.abs(b.owed)} cur={d.currency} />
        </div>
      </div>

      <div className="quick two">
        <a className="q job" href={`#/job/for/${id}`}><b>🛠</b> عمل جديد</a>
        <a className="q pay" href={`#/pay/for/${id}`}><b>💵</b> دفعة</a>
      </div>

      <h2>كشف الحساب</h2>
      {timeline.length === 0 ? (
        <Empty>لا توجد أعمال أو دفعات بعد.</Empty>
      ) : (
        <ul className="list">
          {timeline.map((t) => (
            <li key={t.row.id}>
              <a href={t.type === 'job' ? `#/job/${t.row.id}` : `#/pay/${t.row.id}`}>
                <span className="li-main">
                  <span>{t.type === 'job' ? t.row.description : `دفعة${t.row.note ? ` — ${t.row.note}` : ''}`}</span>
                  <small>
                    {t.row.date}
                    {t.type === 'job' && ` · ${plots.get(t.row.plotId)?.name ?? ''}`}
                    {' · الرصيد '}<Money v={t.balance} />
                  </small>
                </span>
                <Money v={t.type === 'job' ? t.row.amount : -t.row.amount} signed />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
