import { useState } from 'react';
import {
  Home, Users, Car, Plus, Trash2, Save, KeyRound, LogOut, Phone, Briefcase,
} from 'lucide-react';
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, Select, Tabs,
  TabList, Tab, TabPanel,
} from '../../components/ui';
import { useApp, useAction } from '../../context/AppContext';
import {
  auth, household, houses, profiles, ROLE_LABEL,
  type HouseholdMember, type Relation, type Vehicle,
} from '../../db';
import { formatDateID } from '../../lib/date';

const RELATION_LABEL: Record<Relation, string> = {
  kepala_keluarga: 'Kepala Keluarga', istri: 'Istri', suami: 'Suami', anak: 'Anak',
  orang_tua: 'Orang Tua', kerabat: 'Kerabat', art: 'Asisten Rumah Tangga', lainnya: 'Lainnya',
};

export default function Profile() {
  const { profile, signOut } = useApp();
  const [tab, setTab] = useState('profil');
  if (!profile) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={profile.full_name} url={profile.avatar_url} size={62} />
        <div className="min-w-0">
          <h1 className="truncate text-[21px] leading-tight text-wine-900">{profile.full_name}</h1>
          <p className="mt-1 text-[13px] text-ink-500">{houses.label(profile.house_id)}</p>
          <Badge tone={profile.role === 'resident' ? 'neutral' : 'brass'} className="mt-1.5">
            {ROLE_LABEL[profile.role]}
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="profil">Data Diri</Tab>
          <Tab id="keluarga">Keluarga</Tab>
          <Tab id="kendaraan">Kendaraan</Tab>
          <Tab id="akun">Akun</Tab>
        </TabList>

        <TabPanel id="profil"><PersonalDetails /></TabPanel>
        <TabPanel id="keluarga"><Household /></TabPanel>
        <TabPanel id="kendaraan"><Vehicles /></TabPanel>
        <TabPanel id="akun">
          <div className="space-y-4">
            <ChangePassword />
            <Card>
              <h3 className="text-[15px] text-wine-900">Keluar dari akun</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
                Anda akan diminta masuk kembali untuk mengakses portal.
              </p>
              <Button
                variant="secondary" className="mt-4 text-bad-600"
                icon={<LogOut size={15} />} onClick={signOut}
              >
                Keluar
              </Button>
            </Card>
            <p className="pb-2 text-center text-[11.5px] text-ink-400">
              Terdaftar sejak {formatDateID(profile.created_at.slice(0, 10))}
              {profile.verified_at && ' · Terverifikasi'}
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

function PersonalDetails() {
  const { profile } = useApp();
  const run = useAction();
  const [form, setForm] = useState(() => ({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    occupation: profile?.occupation ?? '',
    emergency_name: profile?.emergency_name ?? '',
    emergency_phone: profile?.emergency_phone ?? '',
  }));

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <h3 className="mb-4 text-[15px] text-wine-900">Data diri</h3>
      <div className="space-y-4">
        <Input label="Nama lengkap" value={form.full_name} onChange={set('full_name')} required />
        <Input
          label="Nomor HP" value={form.phone} onChange={set('phone')}
          inputMode="tel" prefix={<Phone size={15} />} required
        />
        <Input
          label="Pekerjaan" value={form.occupation} onChange={set('occupation')}
          prefix={<Briefcase size={15} />} placeholder="Opsional"
        />
        <Input
          label="Email" value={profile.email} disabled
          hint="Email tidak dapat diubah sendiri. Hubungi pengurus bila perlu diperbarui."
        />

        <div className="border-t border-cream-300 pt-4">
          <h4 className="mb-3 text-[13px] font-semibold text-ink-700">Kontak darurat</h4>
          <div className="space-y-4">
            <Input label="Nama" value={form.emergency_name} onChange={set('emergency_name')} placeholder="Nama kerabat" />
            <Input label="Nomor HP" value={form.emergency_phone} onChange={set('emergency_phone')} inputMode="tel" placeholder="08…" />
          </div>
        </div>

        <Button
          icon={<Save size={15} />}
          onClick={() => run(() => profiles.updateOwn(actor, form), 'Data diri diperbarui.')}
        >
          Simpan Perubahan
        </Button>
      </div>
    </Card>
  );
}

function Household() {
  const { profile } = useApp();
  const run = useAction();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<HouseholdMember | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  if (!profile.house_id) {
    return (
      <Card padded={false}>
        <EmptyState icon={<Home size={22} />} title="Rumah belum terdata"
          message="Hubungi pengurus RT untuk menghubungkan akun Anda ke sebuah rumah." />
      </Card>
    );
  }
  const members = household.members(actor, profile.house_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-500">{members.length} anggota terdata</p>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>Tambah</Button>
      </div>

      {members.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Users size={22} />} title="Belum ada anggota keluarga" />
        </Card>
      ) : (
        members.map((m) => (
          <Card key={m.id} padded={false}>
            <div className="flex items-center gap-3.5 p-4">
              <Avatar name={m.full_name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium text-wine-900">{m.full_name}</p>
                <p className="text-[12px] text-ink-500">
                  {RELATION_LABEL[m.relation]} · {m.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                  {m.birth_date && ` · ${formatDateID(m.birth_date, { short: true })}`}
                </p>
                {m.nik_last4 && (
                  <p className="mt-0.5 font-mono text-[11px] text-ink-400">NIK ••••{m.nik_last4}</p>
                )}
              </div>
              {m.relation !== 'kepala_keluarga' && (
                <button
                  type="button" onClick={() => setRemoving(m)} aria-label={`Hapus ${m.full_name}`}
                  className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-bad-100 hover:text-bad-600"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </Card>
        ))
      )}

      {adding && <AddMember houseId={profile.house_id} onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) run(() => household.removeMember(actor, removing.id), 'Anggota dihapus.');
        }}
        title="Hapus anggota keluarga?"
        message={`Data ${removing?.full_name ?? ''} akan dihapus dari kartu keluarga di portal ini.`}
        confirmLabel="Ya, hapus"
      />
    </div>
  );
}

function AddMember({ houseId, onClose }: { houseId: string; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('anak');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [birth, setBirth] = useState('');
  const [nik, setNik] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  function submit() {
    const made = run(
      () => household.addMember(actor, houseId, {
        full_name: name, relation, gender, birth_date: birth || null,
        phone: null, ...(nik ? { nik } : {}),
      }),
      'Anggota keluarga ditambahkan.',
    );
    if (made) onClose();
  }

  return (
    <Modal
      open onClose={onClose} title="Tambah Anggota Keluarga"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={name.trim().length < 2}>Tambahkan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Nama lengkap" required value={name} onChange={(e) => setName(e.target.value)} />
        <Select
          label="Hubungan" value={relation}
          onChange={(e) => setRelation(e.target.value as Relation)}
          options={Object.entries(RELATION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Jenis kelamin" value={gender}
          onChange={(e) => setGender(e.target.value as 'L' | 'P')}
          options={[{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]}
        />
        <Input
          label="Tanggal lahir" type="date" value={birth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirth(e.target.value)}
        />
        <Input
          label="NIK" value={nik} onChange={(e) => setNik(e.target.value)}
          inputMode="numeric" placeholder="16 digit"
          hint="Hanya 4 digit terakhir yang disimpan. NIK lengkap tidak pernah tersimpan di portal."
        />
      </div>
    </Modal>
  );
}

function Vehicles() {
  const { profile } = useApp();
  const run = useAction();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Vehicle | null>(null);

  if (!profile?.house_id) {
    return (
      <Card padded={false}>
        <EmptyState icon={<Car size={22} />} title="Rumah belum terdata" />
      </Card>
    );
  }
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const list = household.vehicles(actor, profile.house_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-500">{list.length} kendaraan terdaftar</p>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>Tambah</Button>
      </div>

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Car size={22} />} title="Belum ada kendaraan terdaftar"
            message="Daftarkan kendaraan agar satpam mengenali kendaraan penghuni." />
        </Card>
      ) : (
        list.map((v) => (
          <Card key={v.id} padded={false}>
            <div className="flex items-center gap-3.5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-cream-200 text-wine-700">
                <Car size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[15px] font-semibold text-wine-900">{v.plate}</p>
                <p className="text-[12px] text-ink-500">
                  {v.kind}{v.brand ? ` · ${v.brand}` : ''}{v.color ? ` · ${v.color}` : ''}
                </p>
              </div>
              <button
                type="button" onClick={() => setRemoving(v)} aria-label={`Hapus ${v.plate}`}
                className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-bad-100 hover:text-bad-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))
      )}

      {adding && <AddVehicle houseId={profile.house_id} onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) run(() => household.removeVehicle(actor, removing.id), 'Kendaraan dihapus.');
        }}
        title="Hapus kendaraan?"
        message={`${removing?.plate ?? ''} akan dihapus dari daftar kendaraan rumah Anda.`}
        confirmLabel="Ya, hapus"
      />
    </div>
  );
}

function AddVehicle({ houseId, onClose }: { houseId: string; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [plate, setPlate] = useState('');
  const [kind, setKind] = useState<Vehicle['kind']>('mobil');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  function submit() {
    const made = run(
      () => household.addVehicle(actor, houseId, {
        plate, kind, brand: brand || null, color: color || null, sticker_no: null,
      }),
      'Kendaraan ditambahkan.',
    );
    if (made) onClose();
  }

  return (
    <Modal
      open onClose={onClose} title="Tambah Kendaraan"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={plate.trim().length < 3}>Tambahkan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nomor polisi" required value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="B 1234 ABC" className="font-mono"
        />
        <Select
          label="Jenis" value={kind}
          onChange={(e) => setKind(e.target.value as Vehicle['kind'])}
          options={[
            { value: 'mobil', label: 'Mobil' }, { value: 'motor', label: 'Motor' },
            { value: 'sepeda', label: 'Sepeda' }, { value: 'lainnya', label: 'Lainnya' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Merek" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Toyota" />
          <Input label="Warna" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Hitam" />
        </div>
      </div>
    </Modal>
  );
}

function ChangePassword() {
  const { profile, toast } = useApp();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!profile) return null;

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await auth.changePassword(profile!.id, oldPw, newPw);
      toast('Kata sandi diperbarui.');
      setOldPw(''); setNewPw('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah kata sandi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-4 text-[15px] text-wine-900">Ubah kata sandi</h3>
      <div className="space-y-4">
        <Input
          label="Kata sandi saat ini" type="password" autoComplete="current-password"
          value={oldPw} onChange={(e) => setOldPw(e.target.value)}
        />
        <Input
          label="Kata sandi baru" type="password" autoComplete="new-password"
          value={newPw} onChange={(e) => setNewPw(e.target.value)}
          hint="Minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka."
          {...(error ? { error } : {})}
        />
        <Button
          icon={<KeyRound size={15} />} loading={busy}
          disabled={!oldPw || !newPw} onClick={submit}
        >
          Perbarui Kata Sandi
        </Button>
      </div>
    </Card>
  );
}
