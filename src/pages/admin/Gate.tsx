import { useState } from 'react';
import {
  ShieldCheck, Search, LogIn, LogOut, UserPlus, Car, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  Badge, Button, Card, EmptyState, Input, Modal, Segmented, Tabs, TabList, Tab,
  TabPanel, Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { useApp, useAction } from '../../context/AppContext';
import { can, guests, houses, profiles, type GuestPass } from '../../db';
import { formatDateID, formatDateTimeID, relativeID, todayISO } from '../../lib/date';
import { clean } from '../../lib/validate';

export default function Gate() {
  const [tab, setTab] = useState('verifikasi');
  return (
    <div>
      <AdminHeader
        title="Pos Jaga"
        subtitle="Verifikasi kode tamu, catat keluar-masuk, dan lihat riwayat gerbang."
      />
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="verifikasi">Verifikasi Tamu</Tab>
          <Tab id="terjadwal">Terjadwal Hari Ini</Tab>
          <Tab id="riwayat">Riwayat Gerbang</Tab>
        </TabList>
        <TabPanel id="verifikasi"><Verify /></TabPanel>
        <TabPanel id="terjadwal"><Scheduled /></TabPanel>
        <TabPanel id="riwayat"><GateLog /></TabPanel>
      </Tabs>
    </div>
  );
}

function Verify() {
  const { profile } = useApp();
  const run = useAction();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ReturnType<typeof guests.lookup> | 'none' | null>(null);
  const [walkIn, setWalkIn] = useState(false);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  function lookup() {
    const v = clean(code, 24);
    if (!v) return;
    setResult(guests.lookup(v) ?? 'none');
  }

  const found = result && result !== 'none' ? result : null;
  const pass = found?.pass ?? null;
  const valid = pass?.status === 'active' && pass.visit_date === todayISO();

  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <h2 className="text-[16px] text-wine-900">Masukkan kode tamu</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
          Ketik atau pindai kode yang ditunjukkan tamu, contoh BR-T-4KX92.
        </p>
        <div className="mt-4 flex gap-2">
          <div className="flex-1">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
              placeholder="BR-T-XXXXX"
              className="font-mono text-[17px] tracking-wider"
              aria-label="Kode tamu"
            />
          </div>
          <Button icon={<Search size={15} />} onClick={lookup} disabled={!code.trim()}>
            Cek
          </Button>
        </div>
      </Card>

      {result === 'none' && (
        <Card className="border-bad-600/25 bg-bad-100/50">
          <div className="flex items-center gap-3">
            <XCircle size={22} className="shrink-0 text-bad-600" />
            <div>
              <h3 className="text-[15px] font-semibold text-bad-600">Kode tidak ditemukan</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-600">
                Periksa kembali penulisan kode, atau catat sebagai tamu tanpa undangan.
              </p>
            </div>
          </div>
        </Card>
      )}

      {pass && found && (
        <Card className={valid ? 'border-ok-600/25 bg-ok-100/40' : 'border-warn-600/25 bg-warn-100/40'}>
          <div className="mb-4 flex items-start gap-3">
            {valid
              ? <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-ok-600" />
              : <XCircle size={22} className="mt-0.5 shrink-0 text-warn-600" />}
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] text-wine-900">{pass.guest_name}</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-600">
                {valid
                  ? 'Undangan sah untuk hari ini.'
                  : pass.status === 'revoked' ? 'Undangan telah dibatalkan tuan rumah.'
                  : pass.status === 'used' ? 'Tamu ini sudah tercatat masuk.'
                  : pass.visit_date !== todayISO()
                    ? `Undangan berlaku untuk ${formatDateID(pass.visit_date, { weekday: true })}.`
                    : 'Undangan tidak berlaku.'}
              </p>
            </div>
            <PassBadge status={pass.status} />
          </div>

          <dl className="grid gap-x-6 gap-y-2 border-t border-cream-300 pt-3.5 text-[13px] sm:grid-cols-2">
            <Row label="Tuan rumah" value={found.host?.full_name ?? '—'} />
            <Row label="Rumah" value={found.house ? `Blok ${found.house.block} No. ${found.house.number}` : '—'} />
            <Row label="Berlaku" value={`${pass.valid_from} – ${pass.valid_until}`} />
            <Row label="Jumlah" value={`${pass.party_size} orang`} />
            {pass.vehicle_plate && <Row label="Kendaraan" value={pass.vehicle_plate} />}
            <Row label="Keperluan" value={pass.purpose || '—'} />
          </dl>

          {can(actor, 'gate.log') && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                icon={<LogIn size={15} />}
                disabled={!valid}
                onClick={() => {
                  const ok = run(
                    () => guests.checkIn(actor, pass.id, 'in'),
                    'Kedatangan tercatat. Tuan rumah diberi notifikasi.',
                  );
                  if (ok) { setResult(guests.lookup(pass.code) ?? 'none'); }
                }}
              >
                Catat Masuk
              </Button>
              <Button
                variant="secondary" icon={<LogOut size={15} />}
                disabled={pass.status !== 'used'}
                onClick={() => {
                  const ok = run(() => guests.checkIn(actor, pass.id, 'out'), 'Kepergian tercatat.');
                  if (ok) setResult(guests.lookup(pass.code) ?? 'none');
                }}
              >
                Catat Keluar
              </Button>
            </div>
          )}
        </Card>
      )}

      {can(actor, 'gate.log') && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] text-wine-900">Tamu tanpa undangan</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-500">
                Catat manual bila tamu datang tanpa kode dari warga.
              </p>
            </div>
            <Button variant="secondary" icon={<UserPlus size={15} />} onClick={() => setWalkIn(true)}>
              Catat Manual
            </Button>
          </div>
        </Card>
      )}

      {walkIn && <WalkInModal onClose={() => setWalkIn(false)} />}
    </div>
  );
}

function WalkInModal({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [note, setNote] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  return (
    <Modal
      open onClose={onClose} title="Catat Tamu Manual"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            disabled={name.trim().length < 2}
            onClick={() => {
              const ok = run(
                () => guests.logWalkIn(actor, {
                  guest_name: name, vehicle_plate: plate || undefined,
                  note: note || undefined, direction,
                }),
                'Tercatat di buku gerbang.',
              );
              if (ok) onClose();
            }}
          >
            Catat
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={direction} onChange={setDirection}
          options={[{ value: 'in', label: 'Masuk' }, { value: 'out', label: 'Keluar' }]}
        />
        <Input label="Nama tamu" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Nomor polisi" value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="B 1234 ABC" className="font-mono"
        />
        <Textarea
          label="Keterangan" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Contoh: Tamu Blok A-3, dikonfirmasi lewat telepon."
        />
      </div>
    </Modal>
  );
}

function Scheduled() {
  const { profile } = useApp();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const today = todayISO();
  const list = guests.all(actor)
    .filter((g) => g.visit_date === today && g.status !== 'revoked')
    .sort((a, b) => a.valid_from.localeCompare(b.valid_from));

  if (list.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState icon={<ShieldCheck size={22} />} title="Belum ada tamu terjadwal hari ini" />
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {list.map((g) => {
        const host = profiles.get(actor, g.host_id);
        return (
          <Card key={g.id} padded={false}>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14.5px] font-medium text-wine-900">{g.guest_name}</h3>
                  <PassBadge status={g.status} />
                  <span className="font-mono text-[11.5px] text-ink-400">{g.code}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  {host?.full_name ?? 'Warga'} · {houses.label(g.house_id)} · {g.valid_from}–{g.valid_until}
                  {g.vehicle_plate && ` · ${g.vehicle_plate}`}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function GateLog() {
  const { profile } = useApp();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const log = guests.gateLog(actor, 120);

  if (log.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState icon={<Clock size={22} />} title="Buku gerbang masih kosong" />
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {log.map((l) => {
        const officer = l.officer_id ? profiles.get(actor, l.officer_id) : null;
        return (
          <Card key={l.id} padded={false}>
            <div className="flex items-center gap-3 p-3.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${
                l.direction === 'in' ? 'bg-ok-100 text-ok-600' : 'bg-cream-200 text-ink-500'
              }`}>
                {l.direction === 'in' ? <LogIn size={16} /> : <LogOut size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink-900">{l.guest_name}</p>
                <p className="flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-ink-400">
                  <span>{l.direction === 'in' ? 'Masuk' : 'Keluar'}</span>
                  {l.vehicle_plate && (
                    <span className="flex items-center gap-1"><Car size={10} />{l.vehicle_plate}</span>
                  )}
                  {officer && <span>· petugas {officer.full_name.split(' ')[0]}</span>}
                  {!l.pass_id && <Badge tone="neutral">Manual</Badge>}
                </p>
                {l.note && <p className="mt-0.5 truncate text-[11.5px] italic text-ink-400">{l.note}</p>}
              </div>
              <span className="shrink-0 text-right text-[11px] text-ink-400">
                {relativeID(l.at)}
                <span className="block">{formatDateTimeID(l.at).split(' · ')[1]}</span>
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PassBadge({ status }: { status: GuestPass['status'] }) {
  const map = {
    active: ['ok', 'Aktif'], used: ['info', 'Sudah masuk'],
    expired: ['neutral', 'Kedaluwarsa'], revoked: ['bad', 'Dibatalkan'],
  } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className="truncate text-right font-medium text-ink-700">{value}</dd>
    </div>
  );
}
