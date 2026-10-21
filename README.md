# دفتر المزرعة — Farm Ledger

A phone app for Dad to log the farm's books instead of using paper: income and costs per plot
(each plot belongs to one of the 4 owners), plus worker jobs, payments, and what's still owed.
Arabic UI, works offline, exports to Excel.

It's a PWA, a website that installs to the home screen. **All data lives on the phone**
(IndexedDB). There is no server and no account.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # accounting, money parsing, backup, Excel export
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ (service worker active here, not in dev)
```

## The accounting rule (check with Dad)

- **Job** = the cost. It's charged to the plot's owner on the job date.
- **Payment** to a worker only reduces what he's owed. It is *not* a second expense.
- Owner net = income − expenses − jobs, over that owner's plots.
- Worker balance = jobs − payments (negative = he was paid an advance).

All of this is in `src/lib/calc.ts` as pure functions, tested in `tests/calc.test.ts`.

## Where things are

| File | What |
|---|---|
| `src/db.ts` | Dexie schema, seeded categories, `newRow()` |
| `src/lib/calc.ts` | Owner P&L, worker balance/timeline, date helpers |
| `src/lib/money.ts` | Parse "١٬٢٠٠٫٥" → 120050 minor units; format back |
| `src/lib/excel.ts` | Workbook export (lazy-loaded; SheetJS is big) |
| `src/lib/backup.ts` | JSON backup/restore (restore is one transaction) |
| `src/screens/*` | Home, Forms (entry/job/payment), Report, Workers, Settings |
| `src/hooks.ts` | `useData()` (live query of everything), hash router |

## Design decisions worth knowing

- **Money is integer minor units** (halalas). `parseFloat('1.15') * 100` is `114.999…`.
- **Soft deletes** (`deletedAt`): rows are hidden, not destroyed. You can't delete an owner, plot,
  worker or category that has entries pointing at it, because the reports would silently lose money.
- **UUID ids**, so adding cloud sync later won't produce id collisions.
- **Double-tap guard** on every save (`useOnce` in `Forms.tsx`), so a double tap can't record an expense twice.

## Getting it onto Dad's phone

1. Deploy `dist/` to any free static HTTPS host (Cloudflare Pages, Netlify). Build command
   `npm run build`, output `dist`. HTTPS is required to install a PWA.
2. Open the URL on his phone →
   - **Android/Chrome:** menu ⋮ → *Install app* / *Add to Home screen*.
   - **iPhone/Safari:** Share → *Add to Home Screen*. **This step matters on iPhone:** Safari can delete
     data for sites that aren't installed and haven't been used for 7 days.
3. In الإعدادات, add the owners, plots and workers. Check that "حماية البيانات" shows ✅.
4. Show him **💾 حفظ نسخة احتياطية** → send it to himself on WhatsApp. The home screen nags after 7 days.

## Later, if needed

- Cloud sync (e.g. Supabase) so the owners can see their own reports.
- Changing a plot's owner (currently fixed at creation, on purpose: it would rewrite history).
