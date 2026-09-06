import { useState } from 'react';
import { Wallet, Upload, Building, Copy, Check, Receipt } from 'lucide-react';
import {
  Badge, Button, Card, EmptyState, Modal, Progress, Select,
} from '../../components/ui';
import { DuesBadge } from './Dashboard';
import { useApp, useAction } from '../../context/AppContext';
import { dues, houses, site, type DuesInvoice } from '../../db';
import { formatDateID, formatPeriodID, todayISO } from '../../lib/date';
import { idr } from '../../lib/format';

export default function Dues() {
  const { profile } = useApp();
  const [paying, setPaying] = useState<DuesInvoice | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  if (!profile.house_id) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={<Building size={22} />}
          title="Rumah belum terdata"
          message="Akun Anda belum terhubung ke sebuah rumah. Hubungi pengurus RT untuk melengkapi data."
        />
      </Card>
    );
  }

  const invoices = dues.forHouse(actor, profile.house_id);
  const outstanding = invoices.filter((d) => d.status === 'unpaid' || d.status === 'overdue');
  const total = outstanding.reduce((s, d) => s + d.amount, 0);
  const paid = invoices.filter((d) => d.status === 'paid' || d.status === 'waived').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] text-wine-900">Iuran IPL</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
          {houses.label(profile.house_id)} · Iuran Pengelolaan Lingkungan
        </p>
      </div>

      {/* Summary */}
      <Card className={outstanding.length ? 'border-warn-600/25 bg-warn-100/40' : 'border-ok-600/25 bg-ok-100/40'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              Total tunggakan
            </p>
            <p
              className="tabular mt-1.5 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-none"
              style={{ color: outstanding.length ? 'var(--color-warn-600)' : 'var(--color-ok-600)' }}
            >
              {idr(total)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-500">
              {outstanding.length === 0
                ? 'Semua tagihan sudah lunas. Terima kasih.'
                : `${outstanding.length} periode belum dibayar`}
            </p>
          </div>
          <Wallet
            size={30}
            className="shrink-0 opacity-20"
            style={{ color: outstanding.length ? 'var(--color-warn-600)' : 'var(--color-ok-600)' }}
          />
        </div>
        {invoices.length > 0 && (
          <div className="mt-4">
            <Progress
              value={(paid / invoices.length) * 100}
              tone={paid === invoices.length ? 'ok' : 'wine'}
            />
            <p className="mt-2 text-[12px] text-ink-500">
              {paid} dari {invoices.length} periode tercatat lunas
            </p>
          </div>
        )}
      </Card>

      <PaymentDetails />

      {/* Invoice list */}
      <div>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Riwayat tagihan
        </h2>
        {invoices.length === 0 ? (
          <Card padded={false}>
            <EmptyState icon={<Receipt size={22} />} title="Belum ada tagihan" />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {invoices.map((d) => {
              const late = d.status === 'overdue' || (d.status === 'unpaid' && d.due_date < todayISO());
              return (
                <Card key={d.id} padded={false}>
                  <div className="flex items-center gap-3.5 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-medium text-wine-900">
                          {formatPeriodID(d.period)}
                        </h3>
                        <DuesBadge status={d.status} />
                      </div>
                      <p className="mt-1 text-[12.5px] text-ink-500">
                        Jatuh tempo {formatDateID(d.due_date, { short: true })}
                        {d.paid_at && ' · Lunas'}
                      </p>
                      {d.note && (
                        <p className="mt-1 text-[12px] italic text-ink-400">{d.note}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="tabular text-[15px] font-semibold"
                        style={{ color: late ? 'var(--color-bad-600)' : 'var(--color-ink-700)' }}
                      >
                        {idr(d.amount)}
                      </p>
                      {(d.status === 'unpaid' || d.status === 'overdue') && (
                        <Button size="sm" className="mt-2" onClick={() => setPaying(d)}>
                          Bayar
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PaymentDetails() {
  const [copied, setCopied] = useState(false);
  const content = site.get();
  const p = content?.payment;
  if (!p?.account_no) return null;

  return (
    <Card className="bg-wine-900 text-cream-100">
      <h2 className="text-[15.5px] text-cream-100">Rekening Kas RW</h2>
      <p className="mt-1 text-[12.5px] text-cream-100/55">
        Transfer ke rekening resmi berikut, lalu unggah bukti melalui tombol Bayar.
      </p>
      <div className="mt-4 rounded-[var(--radius-btn)] border border-cream-100/12 bg-cream-100/[0.06] p-3.5">
        <p className="text-[11.5px] text-cream-100/50">{p.bank}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="tabular text-[18px] font-semibold text-brass-300">{p.account_no}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(p.account_no.replace(/\D/g, ''));
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              } catch { /* clipboard unavailable */ }
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cream-100/10 px-2.5 py-1.5 text-[11.5px] font-medium text-cream-100 transition-colors hover:bg-cream-100/18"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-cream-100/60">a.n. {p.account_name}</p>
      </div>
    </Card>
  );
}

function PayModal({ invoice, onClose }: { invoice: DuesInvoice; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [method, setMethod] = useState<'transfer' | 'tunai' | 'qris'>('transfer');
  const [proof, setProof] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  function submit() {
    const ok = run(
      () => dues.submitPayment(actor, invoice.id, method, proof || undefined),
      'Bukti pembayaran terkirim. Menunggu verifikasi bendahara.',
    );
    if (ok) onClose();
  }

  return (
    <Modal
      open onClose={onClose}
      title={`Bayar IPL ${formatPeriodID(invoice.period)}`}
      description={`Nominal ${idr(invoice.amount)} · jatuh tempo ${formatDateID(invoice.due_date)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} icon={<Upload size={15} />}>Kirim Konfirmasi</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Metode pembayaran"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          options={[
            { value: 'transfer', label: 'Transfer bank' },
            { value: 'tunai', label: 'Tunai ke bendahara' },
            { value: 'qris', label: 'QRIS' },
          ]}
        />

        {method !== 'tunai' && (
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Bukti pembayaran
            </label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-btn)] border-2 border-dashed border-cream-300 bg-cream-200/40 px-4 py-7 text-center transition-colors hover:border-wine-300 hover:bg-wine-50">
              <Upload size={22} className="text-ink-400" />
              <span className="text-[13px] font-medium text-ink-700">
                {proof ? 'Bukti terpilih — ketuk untuk ganti' : 'Pilih foto bukti transfer'}
              </span>
              <span className="text-[11.5px] text-ink-400">JPG atau PNG, maksimal 2 MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setProof('');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setProof(String(reader.result ?? ''));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {proof && (
              <img
                src={proof}
                alt="Pratinjau bukti pembayaran"
                className="mt-3 max-h-52 w-full rounded-[var(--radius-btn)] border border-cream-300 object-contain"
              />
            )}
          </div>
        )}

        <div className="flex gap-2.5 rounded-[var(--radius-btn)] bg-brass-100/60 px-3.5 py-3">
          <Badge tone="brass" className="h-fit shrink-0">Catatan</Badge>
          <p className="text-[12.5px] leading-relaxed text-ink-700">
            Tagihan akan berstatus <strong>menunggu verifikasi</strong> sampai bendahara
            memeriksa bukti. Anda tidak dapat menandai tagihan lunas sendiri.
          </p>
        </div>
      </div>
    </Modal>
  );
}
