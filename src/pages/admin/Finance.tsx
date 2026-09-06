import { useState } from 'react';
import {
  Wallet, Plus, Check, X, TrendingUp, TrendingDown, Receipt, FileText, Trash2,
} from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, Progress, Segmented,
  Select, Stat, Tabs, TabList, Tab, TabPanel, Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { DuesBadge } from '../app/Dashboard';
import { useApp, useAction } from '../../context/AppContext';
import { can, dues, houses, ledger, type DuesInvoice, type LedgerEntry } from '../../db';
import { addDays, currentPeriod, formatDateID, formatPeriodID, todayISO } from '../../lib/date';
import { idr } from '../../lib/format';

export default function Finance() {
  const { profile } = useApp();
  const [tab, setTab] = useState('iuran');
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const pendingVerify = dues.all(actor).filter((d) => d.status === 'awaiting_verification');

  return (
    <div>
      <AdminHeader
        title="Iuran & Kas RW"
        subtitle="Terbitkan tagihan IPL, verifikasi pembayaran, dan catat arus kas."
      />
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="iuran" count={pendingVerify.length}>Iuran IPL</Tab>
          {can(actor, 'finance.manage') && <Tab id="kas">Buku Kas</Tab>}
        </TabList>
        <TabPanel id="iuran"><DuesPanel /></TabPanel>
        {can(actor, 'finance.manage') && <TabPanel id="kas"><LedgerPanel /></TabPanel>}
      </Tabs>
    </div>
  );
}

function DuesPanel() {
  const { profile } = useApp();
  const run = useAction();
  const [period, setPeriod] = useState(currentPeriod());
  const [filter, setFilter] = useState<'semua' | 'verifikasi' | 'belum' | 'lunas'>('semua');
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState<{ d: DuesInvoice; accept: boolean } | null>(null);
  const [note, setNote] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = dues.all(actor).filter((d) => d.period === period);
  const summary = dues.summary(period);

  const list = all.filter((d) =>
    filter === 'verifikasi' ? d.status === 'awaiting_verification'
    : filter === 'belum' ? ['unpaid', 'overdue'].includes(d.status)
    : filter === 'lunas' ? ['paid', 'waived'].includes(d.status)
    : true);

  // Offer the last six periods.
  const periods: string[] = [];
  const [y, m] = currentPeriod().split('-').map(Number);
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(y!, m! - 1 - i, 1));
    periods.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Kolektibilitas" value={`${summary.rate}%`}
          sub={`${idr(summary.collected)} terkumpul`}
          tone={summary.rate >= 80 ? 'ok' : 'warn'} icon={<Wallet size={24} />} />
        <Stat label="Lunas" value={summary.paid} sub={`dari ${summary.total} rumah`} tone="ok" />
        <Stat label="Perlu verifikasi" value={summary.pending} sub="Bukti masuk" tone="brass" />
        <Stat label="Belum bayar" value={summary.unpaid} sub={idr(summary.billed - summary.collected)} tone="bad" />
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[160px]">
            <Select
              label="Periode" value={period} onChange={(e) => setPeriod(e.target.value)}
              options={periods.map((p) => ({ value: p, label: formatPeriodID(p) }))}
            />
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setGenerating(true)}>
            Terbitkan Tagihan
          </Button>
        </div>
        <div className="mt-4">
          <Progress value={summary.rate} tone={summary.rate >= 80 ? 'ok' : 'warn'} />
        </div>
      </Card>

      <Segmented
        size="sm" value={filter} onChange={setFilter}
        options={[
          { value: 'semua', label: 'Semua', count: all.length },
          { value: 'verifikasi', label: 'Perlu verifikasi', count: summary.pending },
          { value: 'belum', label: 'Belum bayar', count: summary.unpaid },
          { value: 'lunas', label: 'Lunas', count: summary.paid },
        ]}
      />

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Receipt size={22} />}
            title="Tidak ada tagihan"
            message={all.length === 0 ? 'Belum ada tagihan untuk periode ini. Terbitkan tagihan terlebih dahulu.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((d) => {
            const h = houses.get(d.house_id);
            return (
              <Card key={d.id} padded={false}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-medium text-wine-900">
                        Blok {h?.block} No. {h?.number}
                      </h3>
                      <DuesBadge status={d.status} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-500">
                      {idr(d.amount)} · jatuh tempo {formatDateID(d.due_date, { short: true })}
                      {d.method && ` · ${d.method}`}
                    </p>
                  </div>

                  {d.status === 'awaiting_verification' && (
                    <div className="flex shrink-0 gap-2">
                      {d.proof_url && (
                        <a href={d.proof_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" icon={<FileText size={14} />}>Bukti</Button>
                        </a>
                      )}
                      <Button size="sm" icon={<Check size={14} />}
                        onClick={() => setVerifying({ d, accept: true })}>
                        Terima
                      </Button>
                      <Button size="sm" variant="secondary" className="text-bad-600"
                        icon={<X size={14} />} onClick={() => setVerifying({ d, accept: false })}>
                        Tolak
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {generating && <GenerateModal period={period} onClose={() => setGenerating(false)} />}

      <Modal
        open={!!verifying} onClose={() => { setVerifying(null); setNote(''); }}
        title={verifying?.accept ? 'Terima pembayaran' : 'Tolak bukti pembayaran'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setVerifying(null); setNote(''); }}>Batal</Button>
            <Button
              variant={verifying?.accept ? 'primary' : 'danger'}
              onClick={() => {
                if (!verifying) return;
                const ok = run(
                  () => dues.verify(actor, verifying.d.id, verifying.accept, note),
                  verifying.accept ? 'Pembayaran terverifikasi dan tercatat di kas.' : 'Bukti ditolak.',
                );
                if (ok) { setVerifying(null); setNote(''); }
              }}
            >
              {verifying?.accept ? 'Terima' : 'Tolak'}
            </Button>
          </>
        }
      >
        <Textarea
          label={verifying?.accept ? 'Catatan (opsional)' : 'Alasan penolakan'}
          rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={verifying?.accept ? '' : 'Contoh: Bukti transfer tidak terbaca.'}
        />
        {verifying?.accept && (
          <p className="mt-3 rounded-lg bg-ok-100 px-3 py-2.5 text-[12.5px] leading-relaxed text-ok-600">
            Menerima pembayaran otomatis mencatat pemasukan di buku kas, sehingga laporan
            transparansi dan register iuran tidak pernah berbeda.
          </p>
        )}
      </Modal>
    </div>
  );
}

function GenerateModal({ period, onClose }: { period: string; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [amount, setAmount] = useState(150000);
  const [dueDate, setDueDate] = useState(`${period}-10`);
  const [target, setTarget] = useState(period);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  return (
    <Modal
      open onClose={onClose} title="Terbitkan Tagihan IPL"
      description="Tagihan dibuat untuk setiap rumah berpenghuni yang belum memiliki tagihan pada periode ini."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            onClick={() => {
              const n = run(
                () => dues.generate(actor, target, amount, dueDate),
                undefined,
              );
              if (n !== null) {
                onClose();
              }
            }}
          >
            Terbitkan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Periode (YYYY-MM)" required value={target}
          onChange={(e) => setTarget(e.target.value)} placeholder="2026-09"
        />
        <Input
          label="Nominal per rumah (Rp)" type="number" min={1000} step={10000} required
          value={amount}
          onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
        />
        <Input
          label="Jatuh tempo" type="date" required value={dueDate}
          min={todayISO()} max={addDays(todayISO(), 365)}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <p className="rounded-lg bg-brass-100/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-700">
          Rumah yang sudah memiliki tagihan pada periode ini akan dilewati, jadi menekan
          tombol dua kali tidak membuat tagihan ganda.
        </p>
      </div>
    </Modal>
  );
}

function LedgerPanel() {
  const { profile } = useApp();
  const run = useAction();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<LedgerEntry | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const entries = ledger.list(actor);
  const { income, expense, balance } = ledger.balance(actor);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Saldo kas" value={idr(balance, { compact: true })} tone="wine" icon={<Wallet size={24} />} />
        <Stat label="Pemasukan" value={idr(income, { compact: true })} tone="ok" icon={<TrendingUp size={24} />} />
        <Stat label="Pengeluaran" value={idr(expense, { compact: true })} tone="bad" icon={<TrendingDown size={24} />} />
      </div>

      <div className="flex justify-end">
        <Button icon={<Plus size={15} />} onClick={() => setAdding(true)}>Catat Transaksi</Button>
      </div>

      {entries.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Wallet size={22} />} title="Belum ada transaksi" />
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 80).map((e) => (
            <Card key={e.id} padded={false}>
              <div className="flex items-center gap-3 p-3.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${
                  e.kind === 'income' ? 'bg-ok-100 text-ok-600' : 'bg-bad-100 text-bad-600'
                }`}>
                  {e.kind === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink-900">{e.description}</p>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
                    {e.category} · {formatDateID(e.date, { short: true })}
                    {!e.published && <Badge tone="neutral">Tidak dipublikasi</Badge>}
                  </p>
                </div>
                <span
                  className="tabular shrink-0 text-[13.5px] font-semibold"
                  style={{ color: e.kind === 'income' ? 'var(--color-ok-600)' : 'var(--color-bad-600)' }}
                >
                  {e.kind === 'income' ? '+' : '−'}{idr(e.amount, { compact: true })}
                </span>
                <button
                  type="button" onClick={() => setRemoving(e)} aria-label="Hapus transaksi"
                  className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-bad-100 hover:text-bad-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {adding && <LedgerForm onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) run(() => ledger.remove(actor, removing.id), 'Transaksi dihapus.');
        }}
        title="Hapus transaksi?"
        message="Transaksi akan dihapus dari buku kas dan laporan transparansi warga."
        confirmLabel="Ya, hapus"
      />
    </div>
  );
}

function LedgerForm({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('Kebersihan');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(true);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  return (
    <Modal
      open onClose={onClose} title="Catat Transaksi Kas"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            disabled={amount <= 0 || description.trim().length < 3}
            onClick={() => {
              const ok = run(
                () => ledger.record(actor, {
                  kind, category, amount, date, description,
                  receipt_url: null, published,
                }),
                'Transaksi tercatat.',
              );
              if (ok) onClose();
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={kind} onChange={setKind}
          options={[
            { value: 'expense', label: 'Pengeluaran' },
            { value: 'income', label: 'Pemasukan' },
          ]}
        />
        <Input
          label="Kategori" required value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Keamanan / Kebersihan / Listrik / IPL"
        />
        <Input
          label="Nominal (Rp)" type="number" min={0} step={10000} required value={amount}
          onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
        />
        <Input
          label="Tanggal" type="date" required value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Textarea
          label="Keterangan" required rows={2} value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contoh: Honor petugas kebersihan bulan September"
        />
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox" checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--color-wine-700)]"
          />
          <span>
            <span className="block text-[13.5px] font-medium text-ink-900">
              Tampilkan di laporan transparansi warga
            </span>
            <span className="block text-[12px] leading-relaxed text-ink-500">
              Hapus centang untuk draf internal yang belum siap dipublikasikan.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
