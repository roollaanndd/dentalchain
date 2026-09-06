import { useState } from 'react';
import { Building2, Check, X, Plus, Pencil, CalendarDays } from 'lucide-react';
import {
  Badge, Button, Card, EmptyState, Input, Modal, Segmented, Tabs, TabList, Tab,
  TabPanel, Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { BookingStatusBadge } from '../app/Lending';
import { useApp, useAction } from '../../context/AppContext';
import { can, facilities, houses, profiles, type Facility, type FacilityBooking } from '../../db';
import { formatDateID, relativeID } from '../../lib/date';
import { idr } from '../../lib/format';

export default function AdminFacilities() {
  const { profile } = useApp();
  const [tab, setTab] = useState('pemesanan');
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const pending = facilities.allBookings(actor).filter((b) => b.status === 'pending');

  return (
    <div>
      <AdminHeader
        title="Fasilitas Bersama"
        subtitle="Setujui pemesanan warga dan kelola daftar fasilitas beserta jam operasionalnya."
      />
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="pemesanan" count={pending.length}>Pemesanan</Tab>
          {can(actor, 'facility.manage') && <Tab id="kelola">Kelola Fasilitas</Tab>}
        </TabList>
        <TabPanel id="pemesanan"><BookingQueue /></TabPanel>
        {can(actor, 'facility.manage') && <TabPanel id="kelola"><FacilityManager /></TabPanel>}
      </Tabs>
    </div>
  );
}

function BookingQueue() {
  const { profile } = useApp();
  const run = useAction();
  const [filter, setFilter] = useState<'antrean' | 'disetujui' | 'semua'>('antrean');
  const [deciding, setDeciding] = useState<{ b: FacilityBooking; approve: boolean } | null>(null);
  const [note, setNote] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = facilities.allBookings(actor);
  const list = all.filter((b) =>
    filter === 'antrean' ? b.status === 'pending'
    : filter === 'disetujui' ? b.status === 'approved'
    : true);

  return (
    <div className="space-y-4">
      <Segmented
        size="sm" value={filter} onChange={setFilter}
        options={[
          { value: 'antrean', label: 'Antrean', count: all.filter((b) => b.status === 'pending').length },
          { value: 'disetujui', label: 'Disetujui', count: all.filter((b) => b.status === 'approved').length },
          { value: 'semua', label: 'Semua', count: all.length },
        ]}
      />

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<CalendarDays size={22} />} title="Tidak ada pemesanan" />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const f = facilities.get(b.facility_id);
            const who = profiles.get(actor, b.user_id);
            return (
              <Card key={b.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15.5px] font-medium text-wine-900">{f?.name ?? 'Fasilitas'}</h3>
                      <BookingStatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 font-mono text-[11.5px] text-ink-400">{b.code}</p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-ink-400">{relativeID(b.created_at)}</span>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-cream-300 pt-3 text-[12.5px] sm:grid-cols-2">
                  <Row label="Pemesan" value={who?.full_name ?? '—'} />
                  <Row label="Rumah" value={houses.label(who?.house_id ?? null)} />
                  <Row label="Tanggal" value={formatDateID(b.date, { weekday: true })} />
                  <Row label="Jam" value={`${b.start_time} – ${b.end_time}`} />
                  <Row label="Perkiraan hadir" value={`${b.attendees} orang`} />
                  {b.fee_amount > 0 && <Row label="Biaya" value={idr(b.fee_amount)} />}
                  <Row label="Keperluan" value={b.purpose} />
                </dl>

                {b.decision_note && (
                  <p className="mt-3 rounded-lg bg-cream-200/70 px-3 py-2 text-[12.5px] text-ink-600">
                    <span className="font-medium">Catatan: </span>{b.decision_note}
                  </p>
                )}

                {b.status === 'pending' && can(actor, 'facility.approve') && (
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" icon={<Check size={14} />}
                      onClick={() => setDeciding({ b, approve: true })}>
                      Setujui
                    </Button>
                    <Button size="sm" variant="secondary" className="text-bad-600"
                      icon={<X size={14} />} onClick={() => setDeciding({ b, approve: false })}>
                      Tolak
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!deciding} onClose={() => { setDeciding(null); setNote(''); }}
        title={deciding?.approve ? 'Setujui pemesanan' : 'Tolak pemesanan'}
        description={deciding?.b.code} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeciding(null); setNote(''); }}>Batal</Button>
            <Button
              variant={deciding?.approve ? 'primary' : 'danger'}
              onClick={() => {
                if (!deciding) return;
                const ok = run(
                  () => facilities.decide(actor, deciding.b.id, deciding.approve, note),
                  deciding.approve ? 'Pemesanan disetujui.' : 'Pemesanan ditolak.',
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
          label={deciding?.approve ? 'Catatan (opsional)' : 'Alasan penolakan'}
          rows={3} value={note} onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

function FacilityManager() {
  const { profile } = useApp();
  const [editing, setEditing] = useState<Facility | null>(null);
  const [creating, setCreating] = useState(false);

  if (!profile) return null;
  const list = facilities.list();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>Tambah Fasilitas</Button>
      </div>

      <div className="space-y-2.5">
        {list.map((f) => (
          <Card key={f.id} padded={false}>
            <div className="flex items-center gap-3.5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-sage-100 text-sage-700">
                <Building2 size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14.5px] font-medium text-wine-900">{f.name}</h3>
                  {!f.active && <Badge tone="neutral">Nonaktif</Badge>}
                </div>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  Kapasitas {f.capacity} · {f.open_time}–{f.close_time} ·
                  {f.fee_per_session > 0 ? ` ${idr(f.fee_per_session)}/sesi` : ' gratis'}
                </p>
              </div>
              <button
                type="button" onClick={() => setEditing(f)} aria-label={`Ubah ${f.name}`}
                className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-cream-200 hover:text-wine-700"
              >
                <Pencil size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {(creating || editing) && (
        <FacilityForm item={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </div>
  );
}

function FacilityForm({ item, onClose }: { item: Facility | null; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [form, setForm] = useState(() => ({
    name: item?.name ?? '',
    description: item?.description ?? '',
    capacity: item?.capacity ?? 50,
    fee_per_session: item?.fee_per_session ?? 0,
    open_time: item?.open_time ?? '06:00',
    close_time: item?.close_time ?? '22:00',
    active: item?.active ?? true,
  }));

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open onClose={onClose} title={item ? 'Ubah Fasilitas' : 'Tambah Fasilitas'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            disabled={form.name.trim().length < 2 || form.open_time >= form.close_time}
            onClick={() => {
              const ok = run(
                () => facilities.save(actor, item ? { ...form, id: item.id } : form),
                item ? 'Fasilitas diperbarui.' : 'Fasilitas ditambahkan.',
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
        <Input label="Nama fasilitas" required value={form.name}
          onChange={(e) => set('name', e.target.value)} />
        <Textarea label="Deskripsi" rows={2} value={form.description}
          onChange={(e) => set('description', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Kapasitas (orang)" type="number" min={1} value={form.capacity}
            onChange={(e) => set('capacity', Math.max(1, parseInt(e.target.value || '1', 10)))} />
          <Input label="Biaya per sesi (Rp)" type="number" min={0} step={10000}
            value={form.fee_per_session}
            onChange={(e) => set('fee_per_session', Math.max(0, parseInt(e.target.value || '0', 10)))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Jam buka" type="time" value={form.open_time}
            onChange={(e) => set('open_time', e.target.value)} />
          <Input label="Jam tutup" type="time" value={form.close_time}
            onChange={(e) => set('close_time', e.target.value)}
            {...(form.close_time <= form.open_time ? { error: 'Harus setelah jam buka' } : {})} />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
            className="h-4 w-4 accent-[var(--color-wine-700)]" />
          <span className="text-[13.5px] font-medium text-ink-900">Dapat dipesan warga</span>
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
