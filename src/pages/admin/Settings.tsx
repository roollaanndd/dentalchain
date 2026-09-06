import { useState } from 'react';
import {
  Settings as Cog, Save, Download, RotateCcw, Database, ShieldCheck, Plus, Trash2, ScrollText,
} from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Input, Tabs, TabList, Tab,
  TabPanel, Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { useApp, useAction } from '../../context/AppContext';
import {
  auditLog, can, IS_REMOTE, profiles, resetAndReseed, site, store, type SiteContent,
} from '../../db';
import { APP_BUILD, APP_VERSION } from '../../version';
import { formatDateTimeID } from '../../lib/date';

export default function SettingsPage() {
  const [tab, setTab] = useState('situs');
  const { profile } = useApp();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  return (
    <div>
      <AdminHeader
        title="Pengaturan"
        subtitle="Kelola konten situs publik, data sistem, dan lihat jejak audit."
      />
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="situs">Konten Situs</Tab>
          <Tab id="kontak">Kontak & Darurat</Tab>
          <Tab id="pengurus">Pengurus</Tab>
          {can(actor, 'audit.read') && <Tab id="audit">Jejak Audit</Tab>}
          <Tab id="sistem">Sistem</Tab>
        </TabList>
        <TabPanel id="situs"><SiteEditor /></TabPanel>
        <TabPanel id="kontak"><ContactEditor /></TabPanel>
        <TabPanel id="pengurus"><OfficersEditor /></TabPanel>
        {can(actor, 'audit.read') && <TabPanel id="audit"><AuditPanel /></TabPanel>}
        <TabPanel id="sistem"><SystemPanel /></TabPanel>
      </Tabs>
    </div>
  );
}

function useSite() {
  const { profile } = useApp();
  const run = useAction();
  const content = site.get();
  const actor = profile ? { id: profile.id, role: profile.role, status: profile.status } : null;
  const save = (patch: Partial<SiteContent>, message = 'Konten situs diperbarui.') => {
    if (actor) run(() => site.save(actor, patch), message);
  };
  return { content, save };
}

function SiteEditor() {
  const { content, save } = useSite();
  const [brand, setBrand] = useState(() => content?.brand ?? { name: '', tagline: '', established: '', logo_url: null });
  const [hero, setHero] = useState(() => content?.hero ?? { eyebrow: '', title: '', subtitle: '', image_url: null, cta_label: '' });
  const [about, setAbout] = useState(() => content?.about ?? { title: '', body: '', image_url: null, stats: [] });

  if (!content) return null;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <h2 className="mb-4 text-[16px] text-wine-900">Identitas</h2>
        <div className="space-y-4">
          <Input label="Nama cluster" value={brand.name}
            onChange={(e) => setBrand({ ...brand, name: e.target.value })} />
          <Input label="Tagline" value={brand.tagline}
            onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} />
          <Input label="Tahun berdiri" value={brand.established}
            onChange={(e) => setBrand({ ...brand, established: e.target.value })} />
          <Button icon={<Save size={15} />} onClick={() => save({ brand })}>Simpan Identitas</Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[16px] text-wine-900">Hero halaman depan</h2>
        <div className="space-y-4">
          <Input label="Label kecil di atas judul" value={hero.eyebrow}
            onChange={(e) => setHero({ ...hero, eyebrow: e.target.value })} />
          <Input label="Judul utama" value={hero.title}
            onChange={(e) => setHero({ ...hero, title: e.target.value })} />
          <Textarea label="Deskripsi" rows={3} value={hero.subtitle}
            onChange={(e) => setHero({ ...hero, subtitle: e.target.value })} />
          <Input label="Teks tombol utama" value={hero.cta_label}
            onChange={(e) => setHero({ ...hero, cta_label: e.target.value })} />
          <Button icon={<Save size={15} />} onClick={() => save({ hero })}>Simpan Hero</Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[16px] text-wine-900">Tentang kami</h2>
        <div className="space-y-4">
          <Input label="Judul" value={about.title}
            onChange={(e) => setAbout({ ...about, title: e.target.value })} />
          <Textarea
            label="Isi" rows={8} value={about.body}
            onChange={(e) => setAbout({ ...about, body: e.target.value })}
            hint="Pisahkan paragraf dengan baris kosong."
          />
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-700">Angka kunci</p>
            <div className="space-y-2">
              {about.stats.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={s.value} placeholder="40"
                    onChange={(e) => {
                      const next = about.stats.slice();
                      next[i] = { ...s, value: e.target.value };
                      setAbout({ ...about, stats: next });
                    }}
                    className="max-w-[110px]"
                  />
                  <Input
                    value={s.label} placeholder="Kepala Keluarga"
                    onChange={(e) => {
                      const next = about.stats.slice();
                      next[i] = { ...s, label: e.target.value };
                      setAbout({ ...about, stats: next });
                    }}
                  />
                  <button
                    type="button" aria-label="Hapus"
                    onClick={() => setAbout({ ...about, stats: about.stats.filter((_, k) => k !== i) })}
                    className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-bad-100 hover:text-bad-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              size="sm" variant="ghost" icon={<Plus size={14} />} className="mt-2"
              onClick={() => setAbout({ ...about, stats: [...about.stats, { label: '', value: '' }] })}
            >
              Tambah angka
            </Button>
          </div>
          <Button icon={<Save size={15} />} onClick={() => save({ about })}>Simpan Tentang Kami</Button>
        </div>
      </Card>
    </div>
  );
}

function ContactEditor() {
  const { content, save } = useSite();
  const [contact, setContact] = useState(() => content?.contact ?? {
    address: '', phone: '', email: '', whatsapp: '', maps_url: '', office_hours: '',
  });
  const [emergency, setEmergency] = useState(() => content?.emergency ?? []);
  const [payment, setPayment] = useState(() => content?.payment ?? {
    bank: '', account_no: '', account_name: '', qris_url: null,
  });

  if (!content) return null;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <h2 className="mb-4 text-[16px] text-wine-900">Kontak sekretariat</h2>
        <div className="space-y-4">
          <Textarea label="Alamat" rows={2} value={contact.address}
            onChange={(e) => setContact({ ...contact, address: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Telepon" value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            <Input label="Email" value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            <Input label="WhatsApp" value={contact.whatsapp}
              onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })} />
            <Input label="Tautan Google Maps" value={contact.maps_url}
              onChange={(e) => setContact({ ...contact, maps_url: e.target.value })} />
          </div>
          <Input label="Jam layanan" value={contact.office_hours}
            onChange={(e) => setContact({ ...contact, office_hours: e.target.value })} />
          <Button icon={<Save size={15} />} onClick={() => save({ contact })}>Simpan Kontak</Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[16px] text-wine-900">Nomor darurat</h2>
        <div className="space-y-2">
          {emergency.map((e, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={e.label} placeholder="Pos Satpam"
                onChange={(ev) => {
                  const next = emergency.slice();
                  next[i] = { ...e, label: ev.target.value };
                  setEmergency(next);
                }}
              />
              <Input
                value={e.phone} placeholder="0812…" className="max-w-[160px]"
                onChange={(ev) => {
                  const next = emergency.slice();
                  next[i] = { ...e, phone: ev.target.value };
                  setEmergency(next);
                }}
              />
              <button
                type="button" aria-label="Hapus"
                onClick={() => setEmergency(emergency.filter((_, k) => k !== i))}
                className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-bad-100 hover:text-bad-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ghost" icon={<Plus size={14} />}
            onClick={() => setEmergency([...emergency, { label: '', phone: '' }])}>
            Tambah nomor
          </Button>
          <Button size="sm" icon={<Save size={15} />} onClick={() => save({ emergency })}>
            Simpan
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-[16px] text-wine-900">Rekening kas RW</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nama bank" value={payment.bank}
              onChange={(e) => setPayment({ ...payment, bank: e.target.value })} />
            <Input label="Nomor rekening" value={payment.account_no}
              onChange={(e) => setPayment({ ...payment, account_no: e.target.value })} />
          </div>
          <Input label="Atas nama" value={payment.account_name}
            onChange={(e) => setPayment({ ...payment, account_name: e.target.value })} />
          <Button icon={<Save size={15} />} onClick={() => save({ payment })}>Simpan Rekening</Button>
        </div>
      </Card>
    </div>
  );
}

function OfficersEditor() {
  const { content, save } = useSite();
  const [officers, setOfficers] = useState(() => content?.officers ?? []);
  if (!content) return null;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <h2 className="mb-1 text-[16px] text-wine-900">Susunan pengurus</h2>
        <p className="mb-4 text-[12.5px] text-ink-500">
          Ditampilkan di halaman Tentang pada situs publik.
        </p>
        <div className="space-y-3">
          {officers.map((o, i) => (
            <div key={i} className="rounded-[var(--radius-btn)] border border-cream-300 p-3.5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Nama" value={o.name}
                  onChange={(e) => {
                    const next = officers.slice();
                    next[i] = { ...o, name: e.target.value };
                    setOfficers(next);
                  }}
                />
                <Input
                  label="Jabatan" value={o.position}
                  onChange={(e) => {
                    const next = officers.slice();
                    next[i] = { ...o, position: e.target.value };
                    setOfficers(next);
                  }}
                />
                <Input
                  label="Telepon" value={o.phone}
                  onChange={(e) => {
                    const next = officers.slice();
                    next[i] = { ...o, phone: e.target.value };
                    setOfficers(next);
                  }}
                />
              </div>
              <Button
                size="sm" variant="ghost" className="mt-2 text-bad-600"
                icon={<Trash2 size={14} />}
                onClick={() => setOfficers(officers.filter((_, k) => k !== i))}
              >
                Hapus
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm" variant="ghost" icon={<Plus size={14} />}
            onClick={() => setOfficers([...officers, { name: '', position: '', phone: '', photo_url: null }])}
          >
            Tambah pengurus
          </Button>
          <Button size="sm" icon={<Save size={15} />} onClick={() => save({ officers })}>
            Simpan
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AuditPanel() {
  const { profile } = useApp();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const log = auditLog.list(actor, 150);

  return (
    <div className="max-w-3xl">
      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <ScrollText size={19} className="text-wine-700" />
          <div>
            <h2 className="text-[16px] text-wine-900">Jejak audit</h2>
            <p className="text-[12.5px] text-ink-500">
              Setiap tindakan pengurus tercatat di sini.
            </p>
          </div>
        </div>
        {log.length === 0 ? (
          <EmptyState icon={<ScrollText size={22} />} title="Belum ada aktivitas tercatat" />
        ) : (
          <ul className="space-y-1.5">
            {log.map((l) => {
              const who = l.actor_id ? profiles.get(actor, l.actor_id) : null;
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-cream-300 py-2 text-[12.5px] last:border-0"
                >
                  <Badge tone="neutral" className="font-mono">{l.action}</Badge>
                  <span className="text-ink-700">{who?.full_name ?? 'Sistem'}</span>
                  <span className="text-ink-400">{l.entity}</span>
                  <span className="ml-auto text-[11.5px] text-ink-400">
                    {formatDateTimeID(l.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SystemPanel() {
  const { toast } = useApp();
  const [resetting, setResetting] = useState(false);

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `burgundy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Cadangan data diunduh.');
    } catch {
      toast('Gagal membuat cadangan.', 'error');
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <Database size={19} className="text-wine-700" />
          <h2 className="text-[16px] text-wine-900">Penyimpanan data</h2>
        </div>
        <div className="flex items-start gap-3 rounded-[var(--radius-btn)] bg-cream-200/60 p-3.5">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-wine-700" />
          <div className="text-[12.5px] leading-relaxed text-ink-700">
            {IS_REMOTE ? (
              <>
                Terhubung ke basis data Supabase. Seluruh aturan akses dijalankan
                di server melalui Row Level Security.
              </>
            ) : (
              <>
                <strong>Mode demo.</strong> Data tersimpan di peramban perangkat ini
                saja dan tidak dibagikan ke perangkat lain. Skema basis data lengkap
                beserta aturan keamanannya sudah tersedia di{' '}
                <code className="rounded bg-cream-300 px-1 py-0.5 font-mono text-[11.5px]">
                  supabase/migrations/
                </code>{' '}
                — cukup jalankan migrasi dan isi dua variabel lingkungan untuk beralih
                ke basis data sungguhan.
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Download size={15} />} onClick={exportData}>
            Unduh Cadangan
          </Button>
          <Button
            variant="ghost" className="text-bad-600 hover:bg-bad-100"
            icon={<RotateCcw size={15} />} onClick={() => setResetting(true)}
          >
            Reset Data Demo
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2.5">
          <Cog size={19} className="text-wine-700" />
          <h2 className="text-[16px] text-wine-900">Tentang aplikasi</h2>
        </div>
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-400">Versi</dt>
            <dd className="tabular font-medium text-ink-700">{APP_VERSION}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">Build</dt>
            <dd className="tabular font-medium text-ink-700">{APP_BUILD}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">Mode data</dt>
            <dd className="font-medium text-ink-700">{IS_REMOTE ? 'Supabase' : 'Lokal (demo)'}</dd>
          </div>
        </dl>
      </Card>

      <ConfirmDialog
        open={resetting} onClose={() => setResetting(false)}
        onConfirm={() => {
          resetAndReseed()
            .then(() => { window.location.href = '/app/masuk'; })
            .catch(() => toast('Gagal mereset data.', 'error'));
        }}
        title="Reset seluruh data demo?"
        message="Semua perubahan yang Anda buat akan dihapus dan data contoh dimuat ulang dari awal. Anda akan keluar dari akun. Tindakan ini tidak dapat diurungkan."
        confirmLabel="Ya, reset semuanya"
      />
    </div>
  );
}
