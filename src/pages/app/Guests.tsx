import { useState } from 'react';
import { UserPlus, QrCode, Ban, Car, Clock, Users } from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, CopyButton, EmptyState, Input, Modal, Textarea,
} from '../../components/ui';
import { useApp, useAction } from '../../context/AppContext';
import { guests, type GuestPass } from '../../db';
import { addDays, formatDateID, todayISO } from '../../lib/date';
import { clean } from '../../lib/validate';
import { QrBlock } from '../../components/ui/QrBlock';

export default function Guests() {
  const { profile } = useApp();
  const [creating, setCreating] = useState(false);
  const [showing, setShowing] = useState<GuestPass | null>(null);
  const [revoking, setRevoking] = useState<GuestPass | null>(null);
  const run = useAction();

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const mine = guests.mine(actor);
  const upcoming = mine.filter((g) => g.status === 'active' && g.visit_date >= todayISO());
  const past = mine.filter((g) => !(g.status === 'active' && g.visit_date >= todayISO()));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-wine-900">Undangan Tamu</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
            Daftarkan tamu sebelum datang. Tunjukkan kode di pos jaga agar masuk lebih cepat.
          </p>
        </div>
        <Button size="sm" icon={<UserPlus size={15} />} onClick={() => setCreating(true)}>
          Undang
        </Button>
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<UserPlus size={22} />}
            title="Belum ada undangan tamu"
            message="Buat undangan agar satpam dapat memverifikasi tamu Anda dengan cepat."
            action={<Button icon={<UserPlus size={15} />} onClick={() => setCreating(true)}>Undang Tamu</Button>}
          />
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                Akan datang
              </h2>
              <div className="space-y-3">
                {upcoming.map((g) => (
                  <GuestCard
                    key={g.id} pass={g}
                    onShow={() => setShowing(g)}
                    onRevoke={() => setRevoking(g)}
                  />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                Riwayat
              </h2>
              <div className="space-y-3">
                {past.slice(0, 10).map((g) => (
                  <GuestCard key={g.id} pass={g} onShow={() => setShowing(g)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {creating && <NewGuest onClose={() => setCreating(false)} />}
      {showing && <PassModal pass={showing} onClose={() => setShowing(null)} />}

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) run(() => guests.revoke(actor, revoking.id), 'Undangan dibatalkan.');
        }}
        title="Batalkan undangan?"
        message={`Kode untuk ${revoking?.guest_name ?? 'tamu ini'} tidak akan berlaku lagi di pos jaga.`}
        confirmLabel="Ya, batalkan"
      />
    </div>
  );
}

const PASS_TONE = {
  active: ['ok', 'Aktif'], used: ['info', 'Sudah masuk'],
  expired: ['neutral', 'Kedaluwarsa'], revoked: ['bad', 'Dibatalkan'],
} as const;

function GuestCard({
  pass, onShow, onRevoke,
}: { pass: GuestPass; onShow: () => void; onRevoke?: () => void }) {
  const [tone, label] = PASS_TONE[pass.status];
  return (
    <Card>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium leading-snug text-wine-900">{pass.guest_name}</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-500">{pass.purpose}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-cream-300 pt-3 text-[12.5px] text-ink-500">
        <span className="flex items-center gap-1.5">
          <Clock size={12} />
          {formatDateID(pass.visit_date, { short: true })} · {pass.valid_from}–{pass.valid_until}
        </span>
        <span className="flex items-center gap-1.5"><Users size={12} />{pass.party_size} orang</span>
        {pass.vehicle_plate && (
          <span className="flex items-center gap-1.5"><Car size={12} />{pass.vehicle_plate}</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="secondary" icon={<QrCode size={14} />} onClick={onShow}>
          Tampilkan Kode
        </Button>
        {onRevoke && pass.status === 'active' && (
          <Button
            size="sm" variant="ghost" className="text-bad-600 hover:bg-bad-100"
            icon={<Ban size={14} />} onClick={onRevoke}
          >
            Batalkan
          </Button>
        )}
      </div>
    </Card>
  );
}

function NewGuest({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const today = todayISO();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [size, setSize] = useState(1);
  const [plate, setPlate] = useState('');
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState('09:00');
  const [until, setUntil] = useState('18:00');
  const [purpose, setPurpose] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const badRange = until <= from;
  const valid = clean(name, 80).length >= 2 && !badRange;

  function submit() {
    const made = run(
      () => guests.create(actor, {
        guest_name: name,
        ...(phone ? { guest_phone: phone } : {}),
        party_size: size,
        ...(plate ? { vehicle_plate: plate } : {}),
        visit_date: date, valid_from: from, valid_until: until, purpose,
      }),
      'Undangan tamu dibuat.',
    );
    if (made) onClose();
  }

  return (
    <Modal
      open onClose={onClose} title="Undang Tamu"
      description="Tamu menunjukkan kode di pos jaga. Satpam mencatat kedatangan otomatis."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={!valid} icon={<UserPlus size={15} />}>Buat Undangan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nama tamu" required value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap tamu"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nomor HP tamu" value={phone} inputMode="tel"
            onChange={(e) => setPhone(e.target.value)} placeholder="08…"
          />
          <Input
            label="Jumlah orang" type="number" min={1} max={50} value={size}
            onChange={(e) => setSize(Math.max(1, parseInt(e.target.value || '1', 10)))}
          />
        </div>
        <Input
          label="Nomor polisi kendaraan" value={plate}
          onChange={(e) => setPlate(e.target.value)} placeholder="B 1234 ABC"
          hint="Opsional — membantu satpam mengenali kendaraan tamu."
        />
        <Input
          label="Tanggal kunjungan" type="date" required
          min={today} max={addDays(today, 90)}
          value={date} onChange={(e) => setDate(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Berlaku dari" type="time" required value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input
            label="Sampai" type="time" required value={until}
            onChange={(e) => setUntil(e.target.value)}
            {...(badRange ? { error: 'Harus setelah jam mulai' } : {})}
          />
        </div>
        <Textarea
          label="Keperluan" rows={2} value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Contoh: Silaturahmi keluarga, servis AC, pengiriman barang…"
        />
      </div>
    </Modal>
  );
}

function PassModal({ pass, onClose }: { pass: GuestPass; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Kode Tamu" description={pass.guest_name} size="sm">
      <div className="text-center">
        <div className="mx-auto inline-block rounded-[var(--radius-card)] border border-cream-300 bg-white p-5">
          <QrBlock value={pass.code} size={188} />
        </div>
        <p className="mt-4 font-mono text-[24px] font-bold tracking-[0.12em] text-wine-800">
          {pass.code}
        </p>
        <div className="mt-1.5 flex justify-center">
          <CopyButton text={pass.code} label="Salin kode" />
        </div>
        <div className="mt-5 space-y-1.5 rounded-[var(--radius-btn)] bg-cream-200/60 px-4 py-3 text-left text-[12.5px]">
          <Row label="Tanggal" value={formatDateID(pass.visit_date, { weekday: true })} />
          <Row label="Berlaku" value={`${pass.valid_from} – ${pass.valid_until}`} />
          <Row label="Jumlah" value={`${pass.party_size} orang`} />
          {pass.vehicle_plate && <Row label="Kendaraan" value={pass.vehicle_plate} />}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-400">
          Kirimkan kode ini ke tamu Anda. Cukup tunjukkan atau sebutkan di pos jaga.
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-400">{label}</span>
      <span className="font-medium text-ink-700">{value}</span>
    </div>
  );
}
