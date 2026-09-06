import { useMemo, useState } from 'react';
import {
  Armchair, Plus, Check, X, PackageCheck, PackageOpen, Search, Pencil, Trash2, AlertTriangle,
} from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, Select,
  Textarea, Tabs, TabList, Tab, TabPanel,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { BookingStatusBadge } from '../app/Lending';
import { useApp, useAction } from '../../context/AppContext';
import {
  bookings, can, equipment, houses, profiles,
  type Condition, type Equipment, type EquipmentBooking, type EquipmentCategory,
} from '../../db';
import { formatDateID, relativeID, todayISO } from '../../lib/date';
import { idr } from '../../lib/format';
import { clean } from '../../lib/validate';

const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'kursi', label: 'Kursi' }, { value: 'meja', label: 'Meja' },
  { value: 'karpet', label: 'Karpet' }, { value: 'tenda', label: 'Tenda' },
  { value: 'audio', label: 'Audio' }, { value: 'pendingin', label: 'Pendingin' },
  { value: 'dapur', label: 'Dapur' }, { value: 'kebersihan', label: 'Kebersihan' },
  { value: 'olahraga', label: 'Olahraga' }, { value: 'lainnya', label: 'Lainnya' },
];

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'baik', label: 'Baik' }, { value: 'layak', label: 'Layak pakai' },
  { value: 'perlu_perbaikan', label: 'Perlu perbaikan' }, { value: 'rusak', label: 'Rusak' },
];

export default function AdminInventory() {
  const { profile } = useApp();
  const [tab, setTab] = useState('antrean');
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = bookings.all(actor);
  const pending = all.filter((b) => b.status === 'pending');

  return (
    <div>
      <AdminHeader
        title="Inventaris & Peminjaman"
        subtitle="Setujui pengajuan warga, catat serah terima, dan kelola stok barang RW."
      />
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="antrean" count={pending.length}>Antrean</Tab>
          <Tab id="berjalan">Berjalan</Tab>
          <Tab id="riwayat">Riwayat</Tab>
          {can(actor, 'equipment.manage') && <Tab id="stok">Kelola Stok</Tab>}
        </TabList>

        <TabPanel id="antrean"><Queue filter="pending" /></TabPanel>
        <TabPanel id="berjalan"><Queue filter="active" /></TabPanel>
        <TabPanel id="riwayat"><Queue filter="done" /></TabPanel>
        {can(actor, 'equipment.manage') && <TabPanel id="stok"><StockManager /></TabPanel>}
      </Tabs>
    </div>
  );
}

function Queue({ filter }: { filter: 'pending' | 'active' | 'done' }) {
  const { profile } = useApp();
  const run = useAction();
  const [deciding, setDeciding] = useState<{ b: EquipmentBooking; approve: boolean } | null>(null);
  const [handing, setHanding] = useState<EquipmentBooking | null>(null);
  const [note, setNote] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = bookings.all(actor);
  const list = all.filter((b) =>
    filter === 'pending' ? b.status === 'pending'
    : filter === 'active' ? ['approved', 'picked_up'].includes(b.status)
    : ['returned', 'rejected', 'cancelled'].includes(b.status));

  if (list.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={<PackageOpen size={22} />}
          title={filter === 'pending' ? 'Tidak ada antrean' : filter === 'active' ? 'Tidak ada peminjaman berjalan' : 'Belum ada riwayat'}
          message={filter === 'pending' ? 'Semua pengajuan sudah diproses.' : undefined}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((b) => {
        const item = equipment.get(b.equipment_id);
        const who = profiles.get(actor, b.user_id);
        const overdue = b.status === 'picked_up' && b.end_date < todayISO();
        return (
          <Card key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15.5px] font-medium text-wine-900">
                    {b.qty}× {item?.name ?? 'Barang'}
                  </h3>
                  <BookingStatusBadge status={b.status} />
                  {overdue && <Badge tone="bad" dot>Lewat tanggal</Badge>}
                </div>
                <p className="mt-1 font-mono text-[11.5px] text-ink-400">{b.code}</p>
              </div>
              <span className="shrink-0 text-[11.5px] text-ink-400">{relativeID(b.created_at)}</span>
            </div>

            <dl className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-cream-300 pt-3 text-[12.5px] sm:grid-cols-2">
              <Row label="Peminjam" value={who?.full_name ?? '—'} />
              <Row label="Rumah" value={houses.label(b.house_id)} />
              <Row
                label="Tanggal"
                value={`${formatDateID(b.start_date, { short: true })} – ${formatDateID(b.end_date, { short: true })}`}
              />
              <Row label="Kontak" value={who?.phone ?? '—'} />
              <Row label="Keperluan" value={b.purpose} />
              {b.deposit_amount + b.fee_amount > 0 && (
                <Row label="Deposit + biaya" value={idr(b.deposit_amount + b.fee_amount)} />
              )}
            </dl>

            {b.decision_note && (
              <p className="mt-3 rounded-lg bg-cream-200/70 px-3 py-2 text-[12.5px] text-ink-600">
                <span className="font-medium">Catatan: </span>{b.decision_note}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {b.status === 'pending' && can(actor, 'booking.approve') && (
                <>
                  <Button size="sm" icon={<Check size={14} />}
                    onClick={() => setDeciding({ b, approve: true })}>
                    Setujui
                  </Button>
                  <Button size="sm" variant="secondary" className="text-bad-600"
                    icon={<X size={14} />} onClick={() => setDeciding({ b, approve: false })}>
                    Tolak
                  </Button>
                </>
              )}
              {b.status === 'approved' && can(actor, 'booking.handover') && (
                <Button size="sm" icon={<PackageCheck size={14} />} onClick={() => setHanding(b)}>
                  Catat Pengambilan
                </Button>
              )}
              {b.status === 'picked_up' && can(actor, 'booking.handover') && (
                <Button size="sm" variant="brass" icon={<PackageCheck size={14} />}
                  onClick={() => setHanding(b)}>
                  Catat Pengembalian
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      {/* Approve / reject */}
      <Modal
        open={!!deciding} onClose={() => { setDeciding(null); setNote(''); }}
        title={deciding?.approve ? 'Setujui peminjaman' : 'Tolak peminjaman'}
        description={deciding?.b.code}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeciding(null); setNote(''); }}>Batal</Button>
            <Button
              variant={deciding?.approve ? 'primary' : 'danger'}
              onClick={() => {
                if (!deciding) return;
                const ok = run(
                  () => bookings.decide(actor, deciding.b.id, deciding.approve, note),
                  deciding.approve ? 'Peminjaman disetujui.' : 'Peminjaman ditolak.',
                );
                if (ok) { setDeciding(null); setNote(''); }
              }}
            >
              {deciding?.approve ? 'Setujui' : 'Tolak'}
            </Button>
          </>
        }
      >
        <Textarea
          label={deciding?.approve ? 'Catatan untuk peminjam (opsional)' : 'Alasan penolakan'}
          rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={deciding?.approve
            ? 'Contoh: Ambil di pos RW mulai pukul 08.00.'
            : 'Jelaskan alasannya agar warga memahami keputusan ini.'}
        />
        {deciding?.approve && (
          <p className="mt-3 flex gap-2 rounded-lg bg-brass-100/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-700">
            <AlertTriangle size={14} className="mt-px shrink-0 text-brass-500" />
            Ketersediaan diperiksa ulang saat menyetujui — bila stok sudah habis dipesan
            warga lain, persetujuan akan ditolak sistem.
          </p>
        )}
      </Modal>

      {handing && <HandoverModal booking={handing} onClose={() => setHanding(null)} />}
    </div>
  );
}

function HandoverModal({ booking, onClose }: { booking: EquipmentBooking; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [condition, setCondition] = useState<Condition>('baik');
  const [depositBack, setDepositBack] = useState(true);
  const [note, setNote] = useState('');
  const out = booking.status === 'approved';

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const item = equipment.get(booking.equipment_id);

  return (
    <Modal
      open onClose={onClose}
      title={out ? 'Catat Pengambilan' : 'Catat Pengembalian'}
      description={`${booking.qty}× ${item?.name ?? 'barang'} · ${booking.code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            onClick={() => {
              const ok = out
                ? run(() => bookings.handover(actor, booking.id, condition), 'Pengambilan tercatat.')
                : run(
                    () => bookings.receive(actor, booking.id, condition, depositBack, note),
                    'Pengembalian tercatat.',
                  );
              if (ok) onClose();
            }}
          >
            {out ? 'Catat Pengambilan' : 'Catat Pengembalian'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={out ? 'Kondisi saat diserahkan' : 'Kondisi saat dikembalikan'}
          value={condition} onChange={(e) => setCondition(e.target.value as Condition)}
          options={CONDITIONS}
          hint={!out ? 'Kondisi rusak atau perlu perbaikan akan memperbarui status barang di katalog.' : undefined}
        />

        {!out && booking.deposit_amount > 0 && (
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox" checked={depositBack}
              onChange={(e) => setDepositBack(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--color-wine-700)]"
            />
            <span>
              <span className="block text-[13.5px] font-medium text-ink-900">
                Deposit {idr(booking.deposit_amount)} dikembalikan
              </span>
              <span className="block text-[12px] text-ink-500">
                Hapus centang bila deposit ditahan karena kerusakan.
              </span>
            </span>
          </label>
        )}

        {!out && (
          <Textarea
            label="Catatan (opsional)" rows={2} value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Dua kursi penyok ringan, masih layak pakai."
          />
        )}
      </div>
    </Modal>
  );
}

function StockManager() {
  const { profile } = useApp();
  const run = useAction();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Equipment | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const items = equipment.list();
  const filtered = useMemo(() => {
    const q = clean(query, 60).toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder="Cari barang…" value={query}
            onChange={(e) => setQuery(e.target.value)} prefix={<Search size={15} />}
          />
        </div>
        <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>Tambah Barang</Button>
      </div>

      <div className="space-y-2.5">
        {filtered.map((e) => {
          const week = equipment.availability(e.id, todayISO(), todayISO());
          return (
            <Card key={e.id} padded={false}>
              <div className="flex items-center gap-3.5 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-wine-100 text-wine-700">
                  <Armchair size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14.5px] font-medium text-wine-900">{e.name}</h3>
                    {!e.active && <Badge tone="neutral">Nonaktif</Badge>}
                    {e.condition !== 'baik' && (
                      <Badge tone={e.condition === 'rusak' ? 'bad' : 'warn'}>{e.condition}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-500">
                    {e.total_qty} {e.unit} · tersedia hari ini {week.available} ·
                    {e.deposit > 0 ? ` deposit ${idr(e.deposit, { compact: true })}` : ' tanpa deposit'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button" onClick={() => setEditing(e)} aria-label={`Ubah ${e.name}`}
                    className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-cream-200 hover:text-wine-700"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button" onClick={() => setRemoving(e)} aria-label={`Hapus ${e.name}`}
                    className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-bad-100 hover:text-bad-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {(creating || editing) && (
        <EquipmentForm
          item={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) run(() => equipment.remove(actor, removing.id), 'Barang dihapus.');
        }}
        title="Hapus barang?"
        message={`${removing?.name ?? ''} akan dihapus dari katalog. Barang dengan peminjaman aktif tidak dapat dihapus.`}
        confirmLabel="Ya, hapus"
      />
    </div>
  );
}

function EquipmentForm({ item, onClose }: { item: Equipment | null; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [form, setForm] = useState(() => ({
    name: item?.name ?? '',
    category: item?.category ?? ('lainnya' as EquipmentCategory),
    description: item?.description ?? '',
    total_qty: item?.total_qty ?? 1,
    unit: item?.unit ?? 'buah',
    deposit: item?.deposit ?? 0,
    fee_per_day: item?.fee_per_day ?? 0,
    condition: item?.condition ?? ('baik' as Condition),
    max_days: item?.max_days ?? 7,
    active: item?.active ?? true,
    notes: item?.notes ?? '',
  }));

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open onClose={onClose}
      title={item ? 'Ubah Barang' : 'Tambah Barang'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            disabled={form.name.trim().length < 2}
            onClick={() => {
              const ok = run(
                () => equipment.save(actor, item ? { ...form, id: item.id } : form),
                item ? 'Barang diperbarui.' : 'Barang ditambahkan.',
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
        <Input label="Nama barang" required value={form.name}
          onChange={(e) => set('name', e.target.value)} />
        <Select label="Kategori" value={form.category}
          onChange={(e) => set('category', e.target.value as EquipmentCategory)}
          options={CATEGORIES} />
        <Textarea label="Deskripsi" rows={2} value={form.description}
          onChange={(e) => set('description', e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Jumlah unit" type="number" min={1} value={form.total_qty}
            onChange={(e) => set('total_qty', Math.max(1, parseInt(e.target.value || '1', 10)))}
            hint="Tidak dapat dikurangi di bawah unit yang sedang dipesan." />
          <Input label="Satuan" value={form.unit}
            onChange={(e) => set('unit', e.target.value)} placeholder="buah / set" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Deposit (Rp)" type="number" min={0} step={10000} value={form.deposit}
            onChange={(e) => set('deposit', Math.max(0, parseInt(e.target.value || '0', 10)))} />
          <Input label="Biaya per hari (Rp)" type="number" min={0} step={10000} value={form.fee_per_day}
            onChange={(e) => set('fee_per_day', Math.max(0, parseInt(e.target.value || '0', 10)))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Kondisi" value={form.condition}
            onChange={(e) => set('condition', e.target.value as Condition)} options={CONDITIONS} />
          <Input label="Maks. hari pinjam" type="number" min={1} max={90} value={form.max_days}
            onChange={(e) => set('max_days', Math.max(1, parseInt(e.target.value || '1', 10)))} />
        </div>

        <Textarea label="Catatan untuk peminjam" rows={2} value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Contoh: Wajib dibersihkan sebelum dikembalikan." />

        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
            className="h-4 w-4 accent-[var(--color-wine-700)]" />
          <span className="text-[13.5px] font-medium text-ink-900">
            Dapat dipinjam warga
          </span>
        </label>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className="truncate text-right font-medium text-ink-700">{value}</dd>
    </div>
  );
}
