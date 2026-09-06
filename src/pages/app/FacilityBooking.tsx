import { useMemo, useState } from 'react';
import { Building2, Clock, Users, ArrowRight, Ban, CalendarDays } from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, CopyButton, EmptyState, Input, Modal,
  Segmented, Textarea,
} from '../../components/ui';
import { BookingStatusBadge } from './Lending';
import { useApp, useAction } from '../../context/AppContext';
import { facilities, type Facility, type FacilityBooking as FB } from '../../db';
import { addDays, formatDateID, todayISO } from '../../lib/date';
import { idr } from '../../lib/format';
import { clean } from '../../lib/validate';

export default function FacilityBookingPage() {
  const { profile } = useApp();
  const [tab, setTab] = useState<'daftar' | 'saya'>('daftar');
  const [picked, setPicked] = useState<Facility | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const mine = facilities.mine(actor);
  const active = mine.filter((b) => ['pending', 'approved'].includes(b.status));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] text-wine-900">Fasilitas Bersama</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
          Pesan balai warga, lapangan, atau fasilitas lain. Jadwal bentrok otomatis ditolak.
        </p>
      </div>

      <Segmented
        value={tab} onChange={setTab}
        options={[
          { value: 'daftar', label: 'Fasilitas' },
          { value: 'saya', label: 'Pemesanan Saya', count: active.length },
        ]}
      />

      {tab === 'daftar' ? (
        <div className="space-y-3">
          {facilities.list({ activeOnly: true }).map((f) => (
            <Card key={f.id} padded={false} hover>
              <button type="button" onClick={() => setPicked(f)} className="w-full p-4 text-left">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-sage-100 text-sage-700">
                    <Building2 size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15.5px] font-medium leading-snug text-wine-900">{f.name}</h3>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">
                      {f.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="neutral" className="gap-1"><Users size={10} />{f.capacity}</Badge>
                      <Badge tone="neutral" className="gap-1"><Clock size={10} />{f.open_time}–{f.close_time}</Badge>
                      <Badge tone={f.fee_per_session > 0 ? 'brass' : 'ok'}>
                        {f.fee_per_session > 0 ? idr(f.fee_per_session, { compact: true }) : 'Gratis'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <MyFacilityBookings />
      )}

      {picked && (
        <BookForm
          facility={picked}
          onClose={() => setPicked(null)}
          onDone={() => { setPicked(null); setTab('saya'); }}
        />
      )}
    </div>
  );
}

function BookForm({
  facility, onClose, onDone,
}: { facility: Facility; onClose: () => void; onDone: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const today = todayISO();

  const [date, setDate] = useState(addDays(today, 2));
  const [startTime, setStart] = useState(facility.open_time);
  const [endTime, setEnd] = useState(
    facility.open_time < '19:00'
      ? `${String(Math.min(23, Number(facility.open_time.slice(0, 2)) + 3)).padStart(2, '0')}:00`
      : facility.close_time,
  );
  const [purpose, setPurpose] = useState('');
  const [attendees, setAttendees] = useState(10);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  // Slots already held for this facility on this date.
  const taken = useMemo(() => facilities.bookedSlots(facility.id, date), [facility.id, date]);
  const clashes = taken.some((b) => startTime < b.end_time && b.start_time < endTime);
  const outOfHours = startTime < facility.open_time || endTime > facility.close_time;
  const badRange = endTime <= startTime;
  const valid =
    !clashes && !outOfHours && !badRange &&
    clean(purpose, 300).length >= 3 && attendees >= 1 && attendees <= facility.capacity;

  function submit() {
    const made = run(
      () => facilities.book(actor, {
        facility_id: facility.id, date, start_time: startTime, end_time: endTime,
        purpose, attendees,
      }),
      'Pemesanan terkirim. Menunggu persetujuan pengurus.',
    );
    if (made) onDone();
  }

  return (
    <Modal
      open onClose={onClose} title={facility.name}
      description={`Kapasitas ${facility.capacity} orang · buka ${facility.open_time}–${facility.close_time}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={!valid} icon={<ArrowRight size={15} />}>
            Ajukan Pemesanan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13.5px] leading-relaxed text-ink-500">{facility.description}</p>

        <Input
          label="Tanggal" type="date" required
          min={today} max={addDays(today, 180)}
          value={date} onChange={(e) => setDate(e.target.value)}
        />

        {/* Slots already taken on the chosen day */}
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-700">
            Jadwal terpakai pada {formatDateID(date, { weekday: true })}
          </p>
          {taken.length === 0 ? (
            <p className="rounded-lg bg-ok-100 px-3 py-2 text-[12.5px] text-ok-600">
              Belum ada pemesanan — seluruh jam tersedia.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {taken.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg bg-bad-100 px-3 py-2 text-[12.5px] text-bad-600"
                >
                  <Clock size={13} className="shrink-0" />
                  <span className="tabular font-semibold">{b.start_time}–{b.end_time}</span>
                  <span className="truncate opacity-75">· {b.purpose}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Jam mulai" type="time" required
            min={facility.open_time} max={facility.close_time}
            value={startTime} onChange={(e) => setStart(e.target.value)}
          />
          <Input
            label="Jam selesai" type="time" required
            min={startTime} max={facility.close_time}
            value={endTime} onChange={(e) => setEnd(e.target.value)}
            {...(badRange ? { error: 'Harus setelah jam mulai' } : {})}
          />
        </div>

        {clashes && (
          <p className="rounded-lg bg-bad-100 px-3 py-2 text-[12.5px] text-bad-600">
            Jam yang Anda pilih bertabrakan dengan pemesanan lain. Pilih jam lain.
          </p>
        )}
        {outOfHours && (
          <p className="rounded-lg bg-warn-100 px-3 py-2 text-[12.5px] text-warn-600">
            Fasilitas hanya tersedia pukul {facility.open_time}–{facility.close_time}.
          </p>
        )}

        <Input
          label="Perkiraan jumlah hadir" type="number" required
          min={1} max={facility.capacity}
          value={attendees}
          onChange={(e) => setAttendees(Math.max(1, parseInt(e.target.value || '1', 10)))}
          hint={`Kapasitas maksimal ${facility.capacity} orang`}
          {...(attendees > facility.capacity ? { error: 'Melebihi kapasitas' } : {})}
        />

        <Textarea
          label="Keperluan" required rows={3}
          value={purpose} onChange={(e) => setPurpose(e.target.value)}
          placeholder="Contoh: Pengajian rutin, rapat RT, latihan senam…"
        />

        {facility.fee_per_session > 0 && (
          <div className="rounded-[var(--radius-btn)] bg-brass-100/60 px-3.5 py-3 text-[13px]">
            <span className="text-ink-500">Biaya pemakaian: </span>
            <span className="font-semibold text-brass-600">{idr(facility.fee_per_session)}</span>
            <span className="text-ink-500"> per sesi, dibayarkan ke bendahara.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MyFacilityBookings() {
  const { profile } = useApp();
  const run = useAction();
  const [cancelling, setCancelling] = useState<FB | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const mine = facilities.mine(actor);

  if (mine.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="Belum ada pemesanan"
          message="Pilih fasilitas dari daftar untuk membuat pemesanan."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {mine.map((b) => {
        const f = facilities.get(b.facility_id);
        return (
          <Card key={b.id}>
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-medium leading-snug text-wine-900">
                  {f?.name ?? 'Fasilitas'}
                </h3>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11.5px] text-ink-400">
                  {b.code}
                  <CopyButton text={b.code} />
                </p>
              </div>
              <BookingStatusBadge status={b.status} />
            </div>
            <dl className="space-y-1.5 border-t border-cream-300 pt-3 text-[12.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Tanggal</dt>
                <dd className="font-medium text-ink-700">{formatDateID(b.date, { weekday: true })}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Jam</dt>
                <dd className="tabular font-medium text-ink-700">{b.start_time}–{b.end_time}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">Keperluan</dt>
                <dd className="text-right font-medium text-ink-700">{b.purpose}</dd>
              </div>
              {b.fee_amount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-400">Biaya</dt>
                  <dd className="font-medium text-ink-700">{idr(b.fee_amount)}</dd>
                </div>
              )}
            </dl>
            {b.decision_note && (
              <p className="mt-3 rounded-lg bg-cream-200/70 px-3 py-2 text-[12.5px] leading-relaxed text-ink-600">
                <span className="font-medium text-ink-700">Catatan: </span>{b.decision_note}
              </p>
            )}
            {['pending', 'approved'].includes(b.status) && (
              <Button
                variant="ghost" size="sm" className="mt-3 text-bad-600 hover:bg-bad-100"
                icon={<Ban size={14} />} onClick={() => setCancelling(b)}
              >
                Batalkan
              </Button>
            )}
          </Card>
        );
      })}

      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) run(() => facilities.cancel(actor, cancelling.id), 'Pemesanan dibatalkan.');
        }}
        title="Batalkan pemesanan?"
        message="Jadwal akan dibuka kembali untuk warga lain."
        confirmLabel="Ya, batalkan"
      />
    </div>
  );
}
