import { useData, useRoute } from './hooks';
import { ToastProvider } from './components/ui';
import { Home } from './screens/Home';
import { EntryForm, JobForm, PaymentForm } from './screens/Forms';
import { Report } from './screens/Report';
import { WorkerDetail, Workers } from './screens/Workers';
import { Settings } from './screens/Settings';

const NAV = [
  ['', 'الرئيسية', '🏠'],
  ['report', 'التقارير', '📈'],
  ['workers', 'العمال', '👷'],
  ['settings', 'الإعدادات', '⚙️'],
] as const;

export function App() {
  const d = useData();
  const [screen = '', a, b] = useRoute();

  if (!d) return <div className="loading">…</div>;

  // `key` on forms makes React build a fresh component per record, so the
  // useState initial values are re-read when you move from one edit to another.
  let view;
  switch (screen) {
    case 'entry':
      view = a === 'edit' ? <EntryForm key={b} d={d} id={b} /> : <EntryForm key={a} d={d} kind={a === 'income' ? 'income' : 'expense'} />;
      break;
    case 'job':
      view = a === 'for' ? <JobForm key={`n${b}`} d={d} workerId={b} /> : <JobForm key={a ?? 'new'} d={d} id={a} />;
      break;
    case 'pay':
      view = a === 'for' ? <PaymentForm key={`n${b}`} d={d} workerId={b} /> : <PaymentForm key={a ?? 'new'} d={d} id={a} />;
      break;
    case 'report':
      view = <Report key={a} d={d} ownerId={a} />;
      break;
    case 'workers':
      view = <Workers d={d} />;
      break;
    case 'worker':
      view = <WorkerDetail d={d} id={a} />;
      break;
    case 'settings':
      view = <Settings d={d} />;
      break;
    default:
      view = <Home d={d} />;
  }

  const tab = screen === 'worker' ? 'workers' : screen;
  return (
    <ToastProvider>
      {view}
      <nav className="tabs">
        {NAV.map(([path, label, icon]) => (
          <a key={path} href={`#/${path}`} className={tab === path ? 'on' : ''}>
            <span aria-hidden>{icon}</span>
            {label}
          </a>
        ))}
      </nav>
    </ToastProvider>
  );
}
