import { useMemo, useState } from 'react';
import {
  Users, Search, ShieldCheck, Ban, KeyRound, Home, Phone, Check, UserCog,
} from 'lucide-react';
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, Segmented, Select,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { useApp, useAction } from '../../context/AppContext';
import {
  assignableRoles, auth, can, household, houses, profiles, ROLE_LABEL,
  type Profile, type Role,
} from '../../db';
import { formatDateID } from '../../lib/date';
import { clean } from '../../lib/validate';

export default function Residents() {
  const { profile } = useApp();
  const run = useAction();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'semua' | 'pending' | 'aktif' | 'nonaktif'>('semua');
  const [detail, setDetail] = useState<Profile | null>(null);
  const [suspending, setSuspending] = useState<Profile | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = profiles.list(actor);

  const counts = {
    semua: all.length,
    pending: all.filter((p) => p.status === 'pending').length,
    aktif: all.filter((p) => p.status === 'active').length,
    nonaktif: all.filter((p) => p.status === 'suspended').length,
  };

  const filtered = useMemo(() => {
    const q = clean(query, 60).toLowerCase();
    return all.filter((p) => {
      if (filter === 'pending' && p.status !== 'pending') return false;
      if (filter === 'aktif' && p.status !== 'active') return false;
      if (filter === 'nonaktif' && p.status !== 'suspended') return false;
      if (!q) return true;
      return p.full_name.toLowerCase().includes(q)
        || p.email.toLowerCase().includes(q)
        || p.phone.includes(q)
        || houses.label(p.house_id).toLowerCase().includes(q);
    });
  }, [all, query, filter]);

  return (
    <div>
      <AdminHeader
        title="Data Warga"
        subtitle="Verifikasi pendaftar baru, kelola peran, dan lihat data keluarga tiap rumah."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Cari nama, email, atau blok…" value={query}
            onChange={(e) => setQuery(e.target.value)} prefix={<Search size={15} />}
          />
        </div>
        <Segmented
          size="sm" value={filter} onChange={setFilter}
          options={[
            { value: 'semua', label: 'Semua', count: counts.semua },
            { value: 'pending', label: 'Menunggu', count: counts.pending },
            { value: 'aktif', label: 'Aktif', count: counts.aktif },
            { value: 'nonaktif', label: 'Nonaktif', count: counts.nonaktif },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Users size={22} />} title="Tidak ada warga yang cocok" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <Card key={p.id} padded={false}>
              <div className="flex flex-wrap items-center gap-3.5 p-4">
                <Avatar name={p.full_name} url={p.avatar_url} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14.5px] font-medium text-wine-900">{p.full_name}</h3>
                    <StatusBadge status={p.status} />
                    {p.role !== 'resident' && <Badge tone="brass">{ROLE_LABEL[p.role]}</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-ink-500">
                    {houses.label(p.house_id)} · {p.phone || 'Tanpa nomor'} · {p.email}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {p.status === 'pending' && can(actor, 'resident.verify') && (
                    <Button
                      size="sm" icon={<Check size={14} />}
                      onClick={() => run(() => profiles.verify(actor, p.id), `${p.full_name} diverifikasi.`)}
                    >
                      Verifikasi
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setDetail(p)}>
                    Detail
                  </Button>
                  {can(actor, 'user.manage') && p.id !== profile.id && (
                    <Button
                      size="sm" variant="ghost"
                      className={p.status === 'suspended' ? 'text-ok-600' : 'text-bad-600'}
                      icon={<Ban size={14} />}
                      onClick={() => setSuspending(p)}
                    >
                      {p.status === 'suspended' ? 'Aktifkan' : 'Nonaktifkan'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {detail && <ResidentDetail person={detail} onClose={() => setDetail(null)} />}

      <ConfirmDialog
        open={!!suspending} onClose={() => setSuspending(null)}
        danger={suspending?.status !== 'suspended'}
        onConfirm={() => {
          if (!suspending) return;
          const next = suspending.status === 'suspended' ? 'active' : 'suspended';
          run(
            () => profiles.setStatus(actor, suspending.id, next),
            next === 'suspended' ? 'Akun dinonaktifkan.' : 'Akun diaktifkan kembali.',
          );
        }}
        title={suspending?.status === 'suspended' ? 'Aktifkan akun?' : 'Nonaktifkan akun?'}
        message={
          suspending?.status === 'suspended'
            ? `${suspending?.full_name ?? ''} akan dapat masuk kembali ke portal.`
            : `${suspending?.full_name ?? ''} akan langsung kehilangan akses ke seluruh layanan portal, termasuk sesi yang sedang berjalan.`
        }
        confirmLabel={suspending?.status === 'suspended' ? 'Ya, aktifkan' : 'Ya, nonaktifkan'}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Profile['status'] }) {
  const map = {
    active: ['ok', 'Aktif'], pending: ['warn', 'Menunggu verifikasi'],
    suspended: ['bad', 'Nonaktif'],
  } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function ResidentDetail({ person, onClose }: { person: Profile; onClose: () => void }) {
  const { profile, toast } = useApp();
  const run = useAction();
  const [role, setRole] = useState<Role>(person.role);
  const [tempPw, setTempPw] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const members = person.house_id ? household.members(actor, person.house_id) : [];
  const vehicles = person.house_id ? household.vehicles(actor, person.house_id) : [];
  const grantable = assignableRoles(actor);

  return (
    <Modal open onClose={onClose} title={person.full_name} description={person.email} size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={person.full_name} url={person.avatar_url} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={person.status} />
              <Badge tone={person.role === 'resident' ? 'neutral' : 'brass'}>
                {ROLE_LABEL[person.role]}
              </Badge>
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-500">
              Terdaftar {formatDateID(person.created_at.slice(0, 10), { short: true })}
              {person.verified_at && ` · diverifikasi ${formatDateID(person.verified_at.slice(0, 10), { short: true })}`}
            </p>
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-2 border-t border-cream-300 pt-4 text-[13px] sm:grid-cols-2">
          <Field icon={<Home size={13} />} label="Rumah" value={houses.label(person.house_id)} />
          <Field icon={<Phone size={13} />} label="Telepon" value={person.phone || '—'} />
          <Field label="Pekerjaan" value={person.occupation || '—'} />
          <Field
            label="Kontak darurat"
            value={person.emergency_name ? `${person.emergency_name} (${person.emergency_phone ?? '—'})` : '—'}
          />
        </dl>

        {members.length > 0 && (
          <section className="border-t border-cream-300 pt-4">
            <h4 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              Anggota keluarga ({members.length})
            </h4>
            <ul className="space-y-1.5">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink-700">{m.full_name}</span>
                  <span className="text-ink-400">{m.relation.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {vehicles.length > 0 && (
          <section className="border-t border-cream-300 pt-4">
            <h4 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              Kendaraan ({vehicles.length})
            </h4>
            <ul className="flex flex-wrap gap-2">
              {vehicles.map((v) => (
                <li key={v.id}>
                  <Badge tone="neutral" className="font-mono">{v.plate}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Role assignment — only for those who may grant, and never to self. */}
        {grantable.length > 0 && person.id !== profile.id && (
          <section className="border-t border-cream-300 pt-4">
            <h4 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              <UserCog size={13} />Peran akun
            </h4>
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="min-w-[180px] flex-1">
                <Select
                  value={role} onChange={(e) => setRole(e.target.value as Role)}
                  options={grantable.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                />
              </div>
              <Button
                disabled={role === person.role}
                onClick={() => run(
                  () => profiles.setRole(actor, person.id, role),
                  `Peran diubah menjadi ${ROLE_LABEL[role]}.`,
                )}
              >
                Ubah Peran
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] text-ink-400">
              Anda hanya dapat memberikan peran di bawah peran Anda sendiri.
            </p>
          </section>
        )}

        {can(actor, 'user.manage') && person.id !== profile.id && (
          <section className="border-t border-cream-300 pt-4">
            <h4 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              <KeyRound size={13} />Reset kata sandi
            </h4>
            {tempPw ? (
              <div className="rounded-[var(--radius-btn)] border border-warn-600/25 bg-warn-100 p-3.5">
                <p className="text-[12.5px] text-ink-700">
                  Kata sandi sementara — sampaikan langsung ke warga, lalu minta segera diganti:
                </p>
                <p className="mt-2 font-mono text-[17px] font-bold text-wine-800">{tempPw}</p>
              </div>
            ) : (
              <Button
                variant="secondary" icon={<ShieldCheck size={14} />}
                onClick={async () => {
                  try {
                    setTempPw(await auth.resetPasswordFor(person.id));
                    toast('Kata sandi sementara dibuat.');
                  } catch {
                    toast('Gagal membuat kata sandi sementara.', 'error');
                  }
                }}
              >
                Buat Kata Sandi Sementara
              </Button>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

function Field({
  icon, label, value,
}: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11.5px] text-ink-400">{icon}{label}</dt>
      <dd className="mt-0.5 font-medium text-ink-700">{value}</dd>
    </div>
  );
}
