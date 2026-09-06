import { useMemo, useState } from 'react';
import {
  Armchair, Search, PackageOpen, Clock, ArrowRight, Info, Ban,
} from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, CopyButton, EmptyState, Input, Modal,
  Segmented, Textarea,
} from '../../components/ui';
import { useApp, useAction } from '../../context/AppContext';
import {
  bookings, equipment, type BookingStatus, type Equipment, type EquipmentBooking,
} from '../../db';
import { addDays, daysBetween, formatDateID, todayISO } from '../../lib/date';
import { idr } from '../../lib/format';
import { clean } from '../../lib/validate';
import { cn } from '../../lib/cn';

const STATUS_META: Record<BookingStatus, { tone: 'ok' | 'warn' | 'bad' | 'info' | 'wine' | 'neutral'; label: string }> = {
  pending: { tone: 'warn', label: 'Menunggu persetujuan' },
  approved: { tone: 'info', label: 'Disetujui' },
  picked_up: { tone: 'wine', label: 'Sedang dipinjam' },
  returned: { tone: 'ok', label: 'Selesai' },
  rejected: { tone: 'bad', label: 'Ditolak' },
  cancelled: { tone: 'neutral', label: 'Dibatalkan' },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export default function Lending() {
  const { profile } = useApp();
  const [tab, setTab] = useState<'katalog' | 'saya'>('katalog');
  const [picked, setPicked] = useState<Equipment | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const mine = bookings.mine(actor);
  const active = mine.filter((b) => ['pending', 'approved', 'picked_up'].includes(b.status));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] text-wine-900">Peminjaman Inventaris</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
          Barang milik RW yang dapat dipinjam warga. Ketersediaan dihitung per tanggal.
        </p>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'katalog', label: 'Katalog' },
          { value: 'saya', label: 'Peminjaman Saya', count: active.length },
        ]}
      />

      {tab === 'katalog' ? <Catalogue onPick={setPicked} /> : <MyBookings />}

      {picked && (
        <BookingForm
          item={picked}
          onClose={() => setPicked(null)}
          onDone={() => { setPicked(null); setTab('saya'); }}
        />
      )}
    </div>
  );
}

// ── Catalogue ───────────────────────────────────────────────────────────

function Catalogue({ onPick }: { onPick: (e: Equipment) => void }) {
  const [query, setQuery] = useState('');
  const items = equipment.list({ activeOnly: true });

  const filtered = useMemo(() => {
    const q = clean(query, 60).toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Cari barang…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        prefix={<Search size={16} />}
        aria-label="Cari barang"
      />

      {filtered.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<PackageOpen size={22} />}
            title="Tidak ditemukan"
            message="Coba kata kunci lain."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            // Availability for the next 7 days, as an at-a-glance signal.
            const week = equipment.availability(e.id, todayISO(), addDays(todayISO(), 6));
            const free = week.available;
            return (
              <Card key={e.id} padded={false} hover>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex w-full items-start gap-3.5 p-4 text-left"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-wine-100 text-wine-700">
                    <Armchair size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15px] font-medium leading-snug text-wine-900">{e.name}</h3>
                      <Badge tone={free === 0 ? 'bad' : free < e.total_qty * 0.3 ? 'warn' : 'ok'}>
                        {free}/{e.total_qty}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">
                      {e.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-400">
                      <span>Maks. {e.max_days} hari</span>
                      {e.deposit > 0 && <span>Deposit {idr(e.deposit, { compact: true })}</span>}
                      {e.fee_per_day > 0
                        ? <span>{idr(e.fee_per_day, { compact: true })}/hari</span>
                        : <span className="font-semibold text-ok-600">Gratis</span>}
                    </div>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Booking form ────────────────────────────────────────────────────────

function BookingForm({
  item, onClose, onDone,
}: { item: Equipment; onClose: () => void; onDone: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const today = todayISO();

  const [start, setStart] = useState(addDays(today, 1));
  const [end, setEnd] = useState(addDays(today, 1));
  const [qty, setQty] = useState(1);
  const [purpose, setPurpose] = useState('');

  const actor = profile
    ? { id: profile.id, role: profile.role, status: profile.status }
    : null;

  // Live availability for exactly the window the resident has chosen.
  const availability = useMemo(
    () => equipment.availability(item.id, start, end <= start ? start : end),
    [item.id, start, end],
  );

  const days = end >= start ? daysBetween(start, end) : 0;
  const deposit = item.deposit * qty;
  const fee = item.fee_per_day * qty * days;
  const overCapacity = qty > availability.available;
  const rangeInvalid = end < start;
  const tooLong = days > item.max_days;
  const canSubmit =
    !!actor && !overCapacity && !rangeInvalid && !tooLong && qty >= 1 &&
    clean(purpose, 300).length >= 3;

  function submit() {
    if (!actor) return;
    const created = run(
      () => bookings.create(actor, {
        equipment_id: item.id, qty, start_date: start, end_date: end, purpose,
      }),
      'Pengajuan peminjaman terkirim. Menunggu persetujuan pengurus.',
    );
    if (created) onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      description={`${item.total_qty} ${item.unit} dimiliki RW · maksimal ${item.max_days} hari`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={!canSubmit} icon={<ArrowRight size={15} />}>
            Ajukan Peminjaman
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-ink-500">{item.description}</p>
        {item.notes && (
          <div className="flex gap-2.5 rounded-[var(--radius-btn)] bg-brass-100/60 px-3.5 py-2.5">
            <Info size={15} className="mt-px shrink-0 text-brass-500" />
            <p className="text-[12.5px] leading-relaxed text-ink-700">{item.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tanggal mulai" type="date" required
            min={today} max={addDays(today, 180)}
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              setStart(v);
              if (end < v) setEnd(v);
            }}
          />
          <Input
            label="Tanggal selesai" type="date" required
            min={start} max={addDays(start, item.max_days - 1)}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            {...(rangeInvalid ? { error: 'Sebelum tanggal mulai' } : {})}
          />
        </div>

        {/* Availability strip — the peak-concurrency result, per day. */}
        {!rangeInvalid && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-700">Ketersediaan per hari</span>
              <span className={cn(
                'text-[12.5px] font-semibold',
                availability.available === 0 ? 'text-bad-600' : 'text-ok-600',
              )}>
                {availability.available} dari {item.total_qty} tersedia
              </span>
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              {availability.byDay.slice(0, 31).map((d) => {
                const ratio = item.total_qty ? d.available / item.total_qty : 0;
                return (
                  <div
                    key={d.date}
                    title={`${formatDateID(d.date, { short: true })}: ${d.available} tersedia`}
                    className="flex min-w-[42px] flex-1 flex-col items-center gap-1 rounded-lg bg-cream-200/70 px-1 py-2"
                  >
                    <span className="text-[9.5px] font-medium text-ink-400">
                      {formatDateID(d.date, { short: true }).split(' ')[0]}
                    </span>
                    <span
                      className="tabular text-[13px] font-bold"
                      style={{
                        color: d.available === 0
                          ? 'var(--color-bad-600)'
                          : ratio < 0.34 ? 'var(--color-warn-600)' : 'var(--color-ok-600)',
                      }}
                    >
                      {d.available}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Input
          label="Jumlah" type="number" required
          min={1} max={Math.max(1, availability.available)}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
          hint={`Satuan: ${item.unit}`}
          {...(overCapacity
            ? { error: availability.available === 0
                ? 'Semua unit sudah dipesan pada tanggal tersebut.'
                : `Maksimal ${availability.available} unit pada rentang ini.` }
            : {})}
        />

        <Textarea
          label="Keperluan" required rows={3}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Contoh: Syukuran rumah baru, pengajian rutin, kerja bakti…"
          hint="Pengurus memakai keterangan ini untuk menyetujui pengajuan."
        />

        {tooLong && (
          <p className="text-[12.5px] text-bad-600">
            Peminjaman {days} hari melebihi batas {item.max_days} hari untuk barang ini.
          </p>
        )}

        {/* Cost summary */}
        {(deposit > 0 || fee > 0) && !rangeInvalid && (
          <div className="rounded-[var(--radius-btn)] border border-cream-300 bg-cream-200/50 p-3.5">
            <h4 className="mb-2.5 text-[13px] font-semibold text-wine-900">Rincian biaya</h4>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-500">Lama pinjam</dt>
                <dd className="font-medium text-ink-700">{days} hari</dd>
              </div>
              {deposit > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Deposit (dikembalikan)</dt>
                  <dd className="font-medium text-ink-700">{idr(deposit)}</dd>
                </div>
              )}
              {fee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Biaya sewa</dt>
                  <dd className="font-medium text-ink-700">{idr(fee)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-cream-300 pt-1.5">
                <dt className="font-semibold text-wine-900">Dibayar saat ambil</dt>
                <dd className="font-bold text-wine-700">{idr(deposit + fee)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── My bookings ─────────────────────────────────────────────────────────

function MyBookings() {
  const { profile } = useApp();
  const run = useAction();
  const [filter, setFilter] = useState<'aktif' | 'riwayat'>('aktif');
  const [cancelling, setCancelling] = useState<EquipmentBooking | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = bookings.mine(actor);
  const list = filter === 'aktif'
    ? all.filter((b) => ['pending', 'approved', 'picked_up'].includes(b.status))
    : all.filter((b) => ['returned', 'rejected', 'cancelled'].includes(b.status));

  return (
    <div className="space-y-4">
      <Segmented
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'aktif', label: 'Aktif', count: all.filter((b) => ['pending', 'approved', 'picked_up'].includes(b.status)).length },
          { value: 'riwayat', label: 'Riwayat' },
        ]}
      />

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Armchair size={22} />}
            title={filter === 'aktif' ? 'Belum ada peminjaman aktif' : 'Belum ada riwayat'}
            message={filter === 'aktif' ? 'Pilih barang dari katalog untuk mengajukan peminjaman.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const item = equipment.get(b.equipment_id);
            const overdue = b.status === 'picked_up' && b.end_date < todayISO();
            return (
              <Card key={b.id}>
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium leading-snug text-wine-900">
                      {item?.name ?? 'Barang'}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-400">
                      <span className="font-mono">{b.code}</span>
                      <CopyButton text={b.code} />
                    </p>
                  </div>
                  <BookingStatusBadge status={b.status} />
                </div>

                <dl className="space-y-1.5 border-t border-cream-300 pt-3 text-[12.5px]">
                  <Row label="Jumlah" value={`${b.qty} ${item?.unit ?? 'unit'}`} />
                  <Row
                    label="Tanggal"
                    value={`${formatDateID(b.start_date, { short: true })} – ${formatDateID(b.end_date, { short: true })}`}
                  />
                  <Row label="Keperluan" value={b.purpose} />
                  {b.deposit_amount + b.fee_amount > 0 && (
                    <Row label="Deposit + biaya" value={idr(b.deposit_amount + b.fee_amount)} />
                  )}
                </dl>

                {overdue && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-bad-100 px-3 py-2 text-[12.5px] text-bad-600">
                    <Clock size={14} className="shrink-0" />
                    Sudah melewati tanggal kembali. Mohon segera dikembalikan.
                  </div>
                )}

                {b.decision_note && (
                  <div className="mt-3 rounded-lg bg-cream-200/70 px-3 py-2 text-[12.5px] leading-relaxed text-ink-600">
                    <span className="font-medium text-ink-700">Catatan pengurus: </span>
                    {b.decision_note}
                  </div>
                )}

                {['pending', 'approved'].includes(b.status) && (
                  <Button
                    variant="ghost" size="sm" className="mt-3 text-bad-600 hover:bg-bad-100"
                    icon={<Ban size={14} />}
                    onClick={() => setCancelling(b)}
                  >
                    Batalkan
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) {
            run(() => bookings.cancel(actor, cancelling.id), 'Peminjaman dibatalkan.');
          }
        }}
        title="Batalkan peminjaman?"
        message={`Peminjaman ${cancelling?.code ?? ''} akan dibatalkan dan unit dikembalikan ke stok. Tindakan ini tidak dapat diurungkan.`}
        confirmLabel="Ya, batalkan"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className="text-right font-medium text-ink-700">{value}</dd>
    </div>
  );
}
