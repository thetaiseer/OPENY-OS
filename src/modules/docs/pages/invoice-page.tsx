'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChevronDown, ChevronUp, Moon, Plus, Trash2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type InvoiceStatus = 'Paid' | 'Unpaid';
type ClientType = 'Manual' | 'Pro icon KSA';

interface CampaignRow {
  id: string;
  adName: string;
  date: string;
  results: string;
  cost: number;
}
interface Platform {
  id: string;
  name: string;
  rows: CampaignRow[];
}
interface Branch {
  id: string;
  name: string;
  platforms: Platform[];
  isExpanded: boolean;
}
interface InvoiceState {
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  status: InvoiceStatus;
  clientType: ClientType;
  clientName: string;
  campaignMonth: string;
  branches: Branch[];
  ourFees: number;
  notes: string;
}

interface SavedInvoice {
  id: string;
  updatedAt: string;
  state: InvoiceState;
}

interface PlatformsSelect {
  instagram: boolean;
  snapchat: boolean;
  tiktok: boolean;
}

interface Html2PdfInstance {
  set: (options: unknown) => {
    from: (element: HTMLElement) => {
      save: () => Promise<void>;
    };
  };
}

const DRAFT_KEY = 'openy_docs_invoice_draft_v1';
const HISTORY_KEY = 'openy_docs_invoice_history_v1';
const UID_KEY = 'openy_docs_firebase_uid_v1';
const A4_WIDTH = 794;
const MIN_SPLIT_VARIANCE = 0.05;
const SPLIT_VARIANCE_RANGE = 0.05;
const SPLIT_DIRECTION_THRESHOLD = 0.5;
const CPA_VARIANCE_RATIO = 0.1;
const COMPANY_LINES = ['OPENY Digital Solutions', 'Riyadh, KSA', '+966 000 000 000'];

const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

const uid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11));
const today = () => new Date().toISOString().slice(0, 10);
const campaignMonthNow = () => new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
const money = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(n || 0);
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const invoiceNumber = () => `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;

function splitBudget(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (parts === 1) return [total];
  let splits: number[] = [], remaining = total;
  for (let i = 0; i < parts - 1; i++) {
    let avg = remaining / (parts - i);
    let variance = avg * (Math.random() * SPLIT_VARIANCE_RANGE + MIN_SPLIT_VARIANCE) * (Math.random() > SPLIT_DIRECTION_THRESHOLD ? 1 : -1);
    let current = Math.round(avg + variance);
    splits.push(current);
    remaining -= current;
  }
  splits.push(remaining);
  return splits.sort((a, b) => b - a);
}

const row = (): CampaignRow => ({ id: uid(), adName: '', date: today(), results: '', cost: 0 });
const platform = (name = 'Instagram'): Platform => ({ id: uid(), name, rows: [row()] });
const branch = (name = 'Main Branch'): Branch => ({ id: uid(), name, platforms: [platform()], isExpanded: true });

const initialInvoice = (): InvoiceState => ({
  invoiceNumber: invoiceNumber(),
  invoiceDate: today(),
  currency: 'EGP',
  status: 'Unpaid',
  clientType: 'Manual',
  clientName: 'Client Name',
  campaignMonth: campaignMonthNow(),
  branches: [branch('Riyadh Branch'), branch('Jeddah Branch'), branch('Khobar Branch')],
  ourFees: 500,
  notes: '',
});

const branchSubtotal = (b: Branch) => b.platforms.reduce((s, p) => s + p.rows.reduce((a, r) => a + n(r.cost), 0), 0);
const finalBudget = (inv: InvoiceState) => inv.branches.reduce((s, b) => s + branchSubtotal(b), 0);
const grandTotal = (inv: InvoiceState) => finalBudget(inv) + n(inv.ourFees);

function parseMonth(value: string) {
  const [mon, year] = value.split('-');
  return { month: months[mon] ?? new Date().getMonth(), year: Number(year) || new Date().getFullYear() };
}

function generateProIcon(total: number, month: string, count: number, selected: PlatformsSelect): Branch[] {
  const netBudget = Math.max(0, Math.round(total - 500));
  const bNames = ['Riyadh Branch', 'Jeddah Branch', 'Khobar Branch'];
  const bBudgets = splitBudget(netBudget, 3);
  const chosen = [
    { key: 'instagram' as const, name: 'Instagram', pct: 0.5, min: 20, max: 25 },
    { key: 'snapchat' as const, name: 'Snapchat', pct: 0.3, min: 18, max: 23 },
    { key: 'tiktok' as const, name: 'TikTok', pct: 0.2, min: 15, max: 20 },
  ].filter((x) => selected[x.key]);
  const active = chosen.length ? chosen : [{ key: 'instagram' as const, name: 'Instagram', pct: 1, min: 20, max: 25 }];
  const sumPct = active.reduce((s, p) => s + p.pct, 0);
  const { month: m, year: y } = parseMonth(month);
  const rowsCount = Math.max(1, count);

  return bNames.map((name, bi) => ({
    id: uid(),
    name,
    isExpanded: true,
    platforms: active.map((p) => {
      const pBudget = Math.round((bBudgets[bi] || 0) * (p.pct / sumPct));
      const rowCosts = splitBudget(pBudget, rowsCount);
      return {
        id: uid(),
        name: p.name,
        rows: rowCosts.map((cost, i) => {
          const baseDay = Math.round(1 + (i * (14 / Math.max(1, rowsCount - 1))));
          const day = Math.min(15, Math.max(1, baseDay + (Math.floor(Math.random() * 3) - 1)));
          const date = new Date(y, m, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
          const linear = p.min + ((p.max - p.min) * (rowsCount === 1 ? 0 : (i / (rowsCount - 1))));
          const finalCpa = Math.max(1, linear + (linear * ((Math.random() * (CPA_VARIANCE_RATIO * 2)) - CPA_VARIANCE_RATIO)));
          return { id: uid(), adName: `${p.name} Campaign ${i + 1}`, date, results: `${Math.floor(cost / finalCpa)} Messages`, cost };
        }),
      };
    }),
  }));
}

function flatten(invoice: InvoiceState) {
  const list: Array<{ id: string; branch: string; platform: string; adName: string; date: string; results: string; cost: number; branchFirst: boolean; platformFirst: boolean }> = [];
  invoice.branches.forEach((b) => b.platforms.forEach((p) => p.rows.forEach((r) => list.push({ id: r.id, branch: b.name, platform: p.name, adName: r.adName, date: r.date, results: r.results, cost: n(r.cost), branchFirst: false, platformFirst: false }))));
  let prevB = '';
  let prevP = '';
  list.forEach((x) => {
    x.branchFirst = x.branch !== prevB;
    x.platformFirst = x.platform !== prevP || x.branchFirst;
    prevB = x.branch;
    prevP = x.platform;
  });
  return list;
}

async function firebaseSync(history: SavedInvoice[]) {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId || !history.length) return;

  const [{ getApps, initializeApp }, { getAuth, signInAnonymously }, { getFirestore, doc, setDoc }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const app = getApps()[0] ?? initializeApp(cfg);
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  const user = auth.currentUser;
  if (!user) return;
  const db = getFirestore(app);
  const prev = localStorage.getItem(UID_KEY);
  await Promise.all(history.map((h) => setDoc(doc(db, `users/${user.uid}/inv_history/${h.id}`), h)));
  if (prev !== user.uid) localStorage.setItem(UID_KEY, user.uid);
}

export default function InvoicePage() {
  const [tab, setTab] = useState<'Editor' | 'History'>('Editor');
  const [invoice, setInvoice] = useState<InvoiceState>(initialInvoice);
  const [history, setHistory] = useState<SavedInvoice[]>([]);
  const [exportMode, setExportMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [totalBudget, setTotalBudget] = useState(15000);
  const [campaignCount, setCampaignCount] = useState(3);
  const [platforms, setPlatforms] = useState<PlatformsSelect>({ instagram: true, snapchat: true, tiktok: true });
  const [scale, setScale] = useState(1);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const syncRef = useRef<number | null>(null);

  const final = useMemo(() => finalBudget(invoice), [invoice]);
  const grand = useMemo(() => grandTotal(invoice), [invoice]);

  useEffect(() => {
    const d = localStorage.getItem(DRAFT_KEY);
    const h = localStorage.getItem(HISTORY_KEY);
    if (d) try { setInvoice(JSON.parse(d) as InvoiceState); } catch { /* empty */ }
    if (h) try { setHistory(JSON.parse(h) as SavedInvoice[]); } catch { /* empty */ }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(invoice)), 300);
    return () => window.clearTimeout(t);
  }, [invoice]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    if (syncRef.current) window.clearTimeout(syncRef.current);
    syncRef.current = window.setTimeout(() => { void firebaseSync(history); }, 450);
    return () => { if (syncRef.current) window.clearTimeout(syncRef.current); };
  }, [history]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = () => setScale(Math.min(1, Math.max(0.55, (host.clientWidth - 24) / A4_WIDTH)));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const setField = useCallback(<K extends keyof InvoiceState>(k: K, v: InvoiceState[K]) => setInvoice((p) => ({ ...p, [k]: v })), []);
  const editBranches = useCallback((updater: (b: Branch[]) => Branch[]) => setInvoice((p) => ({ ...p, branches: updater(p.branches) })), []);

  const saveSnapshot = () => setHistory((p) => [{ id: uid(), updatedAt: new Date().toISOString(), state: invoice }, ...p]);
  const loadSnapshot = (id: string) => {
    const found = history.find((h) => h.id === id);
    if (found) setInvoice(found.state);
    setTab('Editor');
  };

  const exportExcel = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('OPENY DOCS');
      ws.columns = [
        { header: 'Branch', key: 'branch', width: 20 },
        { header: 'Platform', key: 'platform', width: 20 },
        { header: 'Ad Name', key: 'adName', width: 24 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Results', key: 'results', width: 18 },
        { header: 'Cost', key: 'cost', width: 14 },
      ];
      ws.getRow(1).eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
        c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      });

      let r = 2;
      invoice.branches.forEach((b) => {
        const bs = r;
        b.platforms.forEach((p) => {
          const ps = r;
          p.rows.forEach((x) => { ws.addRow({ branch: b.name, platform: p.name, adName: x.adName, date: x.date, results: x.results, cost: n(x.cost) }); r += 1; });
          if (r - 1 > ps) ws.mergeCells(`B${ps}:B${r - 1}`);
        });
        if (r - 1 > bs) ws.mergeCells(`A${bs}:A${r - 1}`);
      });
      ws.addRow({});
      ws.addRow({ results: 'Final Budget', cost: final });
      ws.addRow({ results: 'Our Fees', cost: n(invoice.ourFees) });
      ws.addRow({ results: 'Grand Total', cost: grand });

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `${invoice.invoiceNumber}.xlsx`);
    } finally {
      setBusy(false);
    }
  }, [busy, final, grand, invoice]);

  const exportPdf = useCallback(async () => {
    if (!exportRef.current || busy) return;
    setBusy(true);
    setExportMode(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const mod = await import('html2pdf.js');
      const html2pdf = ((mod as unknown as { default?: unknown }).default ?? mod) as () => Html2PdfInstance;
      await html2pdf().set({
        margin: 12,
        filename: `${invoice.invoiceNumber}.pdf`,
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.avoid-break'] },
      }).from(exportRef.current).save();
    } finally {
      setExportMode(false);
      setBusy(false);
    }
  }, [busy, invoice.invoiceNumber]);

  return (
    <div className="min-h-full p-4 lg:p-6" style={{ background: '#f8fafc', backgroundImage: 'radial-gradient(circle at 14% 18%, rgba(59,130,246,.16), transparent 30%), radial-gradient(circle at 88% 8%, rgba(139,92,246,.16), transparent 28%)' }}>
      <div className="max-w-[1700px] mx-auto space-y-4">
        <header className="rounded-2xl border px-4 py-3" style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(24px)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-black text-white grid place-items-center font-black">O</div>
              <div><p className="text-sm font-black">OPENY</p><p className="text-[11px] text-slate-500 font-semibold">OPENY DOCS</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/os/dashboard" className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">Go to OS</Link>
              <button type="button" className="h-8 w-8 rounded-lg bg-white/75 border grid place-items-center"><Moon size={14} /></button>
            </div>
          </div>
          <div className="mt-3 inline-flex rounded-xl bg-white/75 p-1 border">
            {(['Editor', 'History'] as const).map((x) => (
              <button key={x} onClick={() => setTab(x)} className={clsx('px-4 py-1.5 text-sm font-semibold rounded-lg', tab === x ? 'bg-black text-white' : 'text-slate-600 hover:bg-white')}>{x}</button>
            ))}
          </div>
        </header>

        {tab === 'History' ? (
          <section className="rounded-3xl border p-5" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.8), rgba(255,255,255,.45))', backdropFilter: 'blur(24px)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black">History</h2>
              <button onClick={saveSnapshot} className="px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold">Save Snapshot</button>
            </div>
            <div className="space-y-2">
              {!history.length && <p className="text-sm text-slate-500">No snapshots.</p>}
              {history.map((h) => (
                <div key={h.id} className="rounded-xl border border-slate-200 bg-white/70 p-3 flex items-center justify-between">
                  <div><p className="text-sm font-semibold">{h.state.invoiceNumber} · {h.state.clientName}</p><p className="text-xs text-slate-500">{new Date(h.updatedAt).toLocaleString()}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => loadSnapshot(h.id)} className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold">Load</button>
                    <button onClick={() => setHistory((p) => p.filter((x) => x.id !== h.id))} className="px-3 py-1.5 rounded-md bg-red-50 text-red-600 text-xs font-semibold">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[45%_55%] gap-4 min-h-[calc(100vh-180px)]">
            <div className="overflow-y-auto pr-1 space-y-4">
              <Card title="Document Setup">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input value={invoice.invoiceNumber} onChange={(e) => setField('invoiceNumber', e.target.value)} placeholder="Invoice Number" />
                  <Input type="date" value={invoice.invoiceDate} onChange={(e) => setField('invoiceDate', e.target.value)} />
                  <Input value={invoice.currency} onChange={(e) => setField('currency', e.target.value)} placeholder="Currency" />
                  <Select value={invoice.status} onChange={(e) => setField('status', e.target.value as InvoiceStatus)} options={['Paid', 'Unpaid']} />
                </div>
              </Card>

              <Card title="Client Information">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Select value={invoice.clientType} onChange={(e) => setField('clientType', e.target.value as ClientType)} options={['Manual', 'Pro icon KSA']} />
                  <Input value={invoice.clientName} onChange={(e) => setField('clientName', e.target.value)} placeholder="Client Name" />
                  <Input value={invoice.campaignMonth} onChange={(e) => setField('campaignMonth', e.target.value)} placeholder="Mar-2026" className="sm:col-span-2" />
                </div>
                {invoice.clientType === 'Pro icon KSA' && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input type="number" value={String(totalBudget)} onChange={(e) => setTotalBudget(n(e.target.value))} placeholder="Total Budget" />
                      <Input type="number" value={String(campaignCount)} onChange={(e) => setCampaignCount(Math.max(1, n(e.target.value)))} placeholder="Campaign Count" />
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm font-medium">
                      {([['instagram', 'Instagram (50%)'], ['snapchat', 'Snapchat (30%)'], ['tiktok', 'TikTok (20%)']] as const).map(([k, label]) => (
                        <label key={k} className="inline-flex items-center gap-2"><input type="checkbox" checked={platforms[k]} onChange={(e) => setPlatforms((p) => ({ ...p, [k]: e.target.checked }))} />{label}</label>
                      ))}
                    </div>
                    <button onClick={() => setInvoice((p) => ({ ...p, clientType: 'Pro icon KSA', ourFees: 500, branches: generateProIcon(totalBudget, p.campaignMonth, campaignCount, platforms) }))} className="px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold">Auto Generate</button>
                  </div>
                )}
              </Card>

              <Card title="Branches Builder">
                <div className="space-y-3">
                  {invoice.branches.map((b, bi) => (
                    <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => editBranches((all) => all.map((x, i) => i === bi ? { ...x, isExpanded: !x.isExpanded } : x))}>{b.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                        <input value={b.name} onChange={(e) => editBranches((all) => all.map((x, i) => i === bi ? { ...x, name: e.target.value } : x))} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-semibold">Branch Subtotal: {money(branchSubtotal(b), invoice.currency)}</span>
                        <button onClick={() => editBranches((all) => all.filter((_, i) => i !== bi))}><Trash2 size={14} className="text-red-500" /></button>
                      </div>
                      {b.isExpanded && (
                        <div className="mt-3 space-y-3">
                          {b.platforms.map((p, pi) => (
                            <div key={p.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <input value={p.name} onChange={(e) => editBranches((all) => all.map((x, i) => i === bi ? { ...x, platforms: x.platforms.map((z, j) => j === pi ? { ...z, name: e.target.value } : z) } : x))} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                                <button onClick={() => editBranches((all) => all.map((x, i) => i === bi ? { ...x, platforms: x.platforms.filter((_, j) => j !== pi) } : x))}><Trash2 size={14} className="text-red-500" /></button>
                              </div>
                              <RowsEditor branchIndex={bi} platformIndex={pi} platform={p} invoice={invoice} editBranches={editBranches} />
                              <div className="mt-2 flex items-center justify-between">
                                <button onClick={() => editBranches((all) => all.map((x, i) => i === bi ? { ...x, platforms: x.platforms.map((z, j) => j === pi ? { ...z, rows: [...z.rows, row()] } : z) } : x))} className="text-xs font-semibold text-blue-700 inline-flex items-center gap-1"><Plus size={12} /> Add Row</button>
                                <span className="text-xs font-semibold text-slate-600">Platform Subtotal: {money(p.rows.reduce((s, r) => s + n(r.cost), 0), invoice.currency)}</span>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => editBranches((all) => all.map((x, i) => i === bi ? { ...x, platforms: [...x.platforms, platform('New Platform')] } : x))} className="text-xs font-semibold text-blue-700 inline-flex items-center gap-1"><Plus size={12} /> Add Platform</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => editBranches((all) => [...all, branch('New Branch')])} className="mt-3 text-sm font-semibold text-blue-700 inline-flex items-center gap-1"><Plus size={14} /> Add Branch</button>
              </Card>

              <Card title="Totals Summary">
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <Stat label="Final Budget" value={money(final, invoice.currency)} />
                  <div><label className="text-xs text-slate-500">Our Fees</label><Input type="number" value={String(invoice.ourFees)} onChange={(e) => setField('ourFees', n(e.target.value))} className="mt-1" /></div>
                  <div className="rounded-xl bg-black text-white p-3"><p className="text-xs text-white/70">Grand Total</p><p className="font-black mt-1">{money(grand, invoice.currency)}</p></div>
                </div>
                <textarea value={invoice.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Notes" rows={3} className="mt-3 w-full rounded-xl border border-slate-200 bg-white/85 px-3 py-2" />
              </Card>

              <div className="sticky bottom-2 z-20 rounded-2xl border border-white/70 p-3 bg-white/70 backdrop-blur-xl flex gap-2">
                <button onClick={exportExcel} disabled={busy} className="flex-1 rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-semibold">Download Excel</button>
                <button onClick={exportPdf} disabled={busy} className="flex-1 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-semibold">Download PDF</button>
              </div>
            </div>

            <section ref={hostRef} className="overflow-y-auto rounded-[20px] border border-white/70 bg-white/55 backdrop-blur-xl p-3">
              <div className="flex justify-center">
                <div style={{ transform: exportMode ? 'none' : `scale(${scale})`, transformOrigin: 'top center', width: exportMode ? '186mm' : '210mm' }}>
                  <div ref={exportRef}>
                    <div className="a4-page page-content bg-white shadow mx-auto" style={{ width: '210mm', padding: '12mm', fontFamily: 'Inter, Tajawal, sans-serif' }}>
                      <PreviewHeader invoice={invoice} />
                      <PreviewTable invoice={invoice} />
                      <PreviewFooter invoice={invoice} final={final} grand={grand} />
                    </div>
                    {exportMode && invoice.branches[1] && <div className="html2pdf__page-break" />}
                    {exportMode && invoice.branches[2] && <div className="html2pdf__page-break" />}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-[20px] p-4 shadow-[0_10px_40px_rgba(31,38,135,.08)]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.8), rgba(255,255,255,.45))', backdropFilter: 'blur(24px)' }}><h3 className="font-black mb-3">{title}</h3>{children}</div>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={clsx('rounded-xl border border-slate-200 bg-white/85 px-3 py-2 focus:bg-white focus:ring-2 focus:ring-blue-300', props.className)} />; }
function Select({ options, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) { return <select {...rest} className={clsx('rounded-xl border border-slate-200 bg-white/85 px-3 py-2 focus:bg-white focus:ring-2 focus:ring-blue-300', rest.className)}>{options.map((x) => <option key={x} value={x}>{x}</option>)}</select>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/85 border border-slate-200 p-3"><p className="text-slate-500 text-xs">{label}</p><p className="font-black mt-1">{value}</p></div>; }

function RowsEditor({ invoice, platform, branchIndex, platformIndex, editBranches }: {
  invoice: InvoiceState;
  platform: Platform;
  branchIndex: number;
  platformIndex: number;
  editBranches: (updater: (b: Branch[]) => Branch[]) => void;
}) {
  const setRow = (ri: number, key: keyof CampaignRow, value: string | number) => editBranches((all) => all.map((b, i) => i === branchIndex ? {
    ...b, platforms: b.platforms.map((p, j) => j === platformIndex ? { ...p, rows: p.rows.map((r, k) => k === ri ? { ...r, [key]: value } : r) } : p),
  } : b));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead><tr><th className="text-left p-2 border border-slate-300">Ad Name</th><th className="text-left p-2 border border-slate-300">Date</th><th className="text-left p-2 border border-slate-300">Results</th><th className="text-left p-2 border border-slate-300">Cost</th><th className="text-left p-2 border border-slate-300" /></tr></thead>
        <tbody>
          {platform.rows.map((r, ri) => (
            <tr key={r.id}>
              <td className="border border-slate-300 p-1"><input value={r.adName} onChange={(e) => setRow(ri, 'adName', e.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-1" /></td>
              <td className="border border-slate-300 p-1"><input value={r.date} onChange={(e) => setRow(ri, 'date', e.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-1" /></td>
              <td className="border border-slate-300 p-1"><input value={r.results} onChange={(e) => setRow(ri, 'results', e.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-1" /></td>
              <td className="border border-slate-300 p-1"><input type="number" value={r.cost} onChange={(e) => setRow(ri, 'cost', n(e.target.value))} className="w-full rounded-md border border-slate-200 px-2 py-1" /></td>
              <td className="border border-slate-300 p-1 text-center"><button onClick={() => editBranches((all) => all.map((b, i) => i === branchIndex ? { ...b, platforms: b.platforms.map((p, j) => j === platformIndex ? { ...p, rows: p.rows.filter((_, k) => k !== ri) } : p) } : b))}><Trash2 size={12} className="text-red-500" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!platform.rows.length && <p className="text-xs text-slate-500">No rows.</p>}
      <p className="sr-only">{money(platform.rows.reduce((s, r) => s + n(r.cost), 0), invoice.currency)}</p>
    </div>
  );
}

function PreviewHeader({ invoice }: { invoice: InvoiceState }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-black">
        <div><div className="flex items-center gap-2"><div className="h-9 w-9 bg-black text-white grid place-items-center font-black">O</div><span className="font-black text-xl">OPENY</span></div><p style={{ fontSize: 11 }} className="mt-2">{COMPANY_LINES.map((line) => <span key={line}>{line}<br /></span>)}</p></div>
        <div className="text-right"><div style={{ fontSize: 31, fontWeight: 900 }}>INVOICE</div><p style={{ fontSize: 11 }} className="mt-2">Ref: {invoice.invoiceNumber}</p><p style={{ fontSize: 11 }}>Date: {invoice.invoiceDate}</p></div>
      </div>
      <div className="mt-4"><span className="inline-block bg-black text-white px-2 py-1 text-[10px] font-bold">BILLED TO</span><h2 className="mt-2" style={{ fontSize: 18, fontWeight: 900 }}>{invoice.clientName || 'Client Name'}</h2><p style={{ fontSize: 12 }}>{invoice.campaignMonth}</p></div>
    </>
  );
}

function PreviewTable({ invoice }: { invoice: InvoiceState }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead><tr>{['Branch', 'Platform', 'Ad Name', 'Date', 'Results', 'Cost'].map((h) => <th key={h} style={{ background: '#111', color: '#fff', fontSize: 10, fontWeight: 800, padding: 12, border: '1px solid #111', borderRight: '1px solid white', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
        <tbody>
          {flatten(invoice).map((x) => (
            <tr key={x.id}>
              <td style={{ border: '1px solid #111', borderTopColor: x.branchFirst ? '#111' : 'transparent', padding: 6, fontSize: 11, background: '#fff' }}>{x.branchFirst ? x.branch : ''}</td>
              <td style={{ border: '1px solid #111', borderTopColor: x.platformFirst ? '#111' : 'transparent', padding: 6, fontSize: 11, background: '#fff' }}>{x.platformFirst ? x.platform : ''}</td>
              <td style={{ border: '1px solid #111', padding: 6, fontSize: 11, background: '#fff' }}>{x.adName}</td>
              <td style={{ border: '1px solid #111', padding: 6, fontSize: 11, background: '#fff', whiteSpace: 'nowrap' }}>{x.date}</td>
              <td style={{ border: '1px solid #111', padding: 6, fontSize: 11, background: '#fff', whiteSpace: 'nowrap' }}>{x.results}</td>
              <td style={{ border: '1px solid #111', padding: 6, fontSize: 11, background: '#fff', whiteSpace: 'nowrap' }}>{money(x.cost, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewFooter({ invoice, final, grand }: { invoice: InvoiceState; final: number; grand: number }) {
  return (
    <div className="avoid-break mt-4 ml-auto w-[300px]">
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr><td className="border border-black p-2 font-semibold">Final Budget</td><td className="border border-black p-2 text-right">{money(final, invoice.currency)}</td></tr>
          <tr><td className="border border-black p-2 font-semibold">Our Fees</td><td className="border border-black p-2 text-right">{money(invoice.ourFees, invoice.currency)}</td></tr>
          <tr className="bg-black text-white"><td className="border border-black p-2 font-black">GRAND TOTAL</td><td className="border border-black p-2 text-right font-black">{money(grand, invoice.currency)}</td></tr>
        </tbody>
      </table>
      {invoice.notes && <div className="mt-4"><p className="text-[10px] uppercase font-bold">Notes</p><p className="text-[11px] mt-1">{invoice.notes}</p></div>}
    </div>
  );
}
