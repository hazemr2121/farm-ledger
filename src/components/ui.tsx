import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { back } from '../hooks';
import { formatAmount } from '../lib/money';

export function Page({ title, children, showBack = false }: { title: string; children: ReactNode; showBack?: boolean }) {
  return (
    <main className="page">
      <header className="top">
        {showBack && (
          <button className="icon-btn" onClick={back} aria-label="رجوع">
            →
          </button>
        )}
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Amount with sign colouring. `signed` shows positives green and negatives red. */
export function Money({ v, cur, signed = false }: { v: number; cur?: string; signed?: boolean }) {
  const cls = signed ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';
  return (
    <span className={`money ${cls}`} dir="ltr">
      {formatAmount(v)}
      {cur && <small> {cur}</small>}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
