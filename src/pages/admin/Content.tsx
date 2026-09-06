import { useState } from 'react';
import { Megaphone, CalendarDays, Plus, Pencil, Trash2, Pin, Eye, EyeOff } from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, Select, Tabs,
  TabList, Tab, TabPanel, Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { useApp, useAction } from '../../context/AppContext';
import {
  announcements, events, profiles,
  type Announcement, type AnnouncementCategory, type CommunityEvent,
} from '../../db';
import { addDays, formatDateID, relativeID, todayISO } from '../../lib/date';

const ANN_CATEGORIES: { value: AnnouncementCategory; label: string }[] = [
  { value: 'umum', label: 'Umum' }, { value: 'keamanan', label: 'Keamanan' },
  { value: 'kebersihan', label: 'Kebersihan' }, { value: 'kegiatan', label: 'Kegiatan' },
  { value: 'darurat', label: 'Darurat' }, { value: 'keuangan', label: 'Keuangan' },
];

const EVENT_CATEGORIES: { value: CommunityEvent['category']; label: string }[] = [
  { value: 'kerja_bakti', label: 'Kerja Bakti' }, { value: 'rapat', label: 'Rapat' },
  { value: 'perayaan', label: 'Perayaan' }, { value: 'olahraga', label: 'Olahraga' },
  { value: 'posyandu', label: 'Posyandu' }, { value: 'keagamaan', label: 'Keagamaan' },
  { value: 'lainnya', label: 'Lainnya' },
];

export default function Content() {
  const [tab, setTab] = useState('pengumuman');
  return (
    <div>
      <AdminHeader
        title="Konten & Agenda"
        subtitle="Terbitkan pengumuman dan jadwalkan kegiatan warga. Konten terbit langsung tampil di situs publik dan portal."
      />
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="pengumuman">Pengumuman</Tab>
          <Tab id="agenda">Agenda Kegiatan</Tab>
        </TabList>
        <TabPanel id="pengumuman"><Announcements /></TabPanel>
        <TabPanel id="agenda"><Events /></TabPanel>
      </Tabs>
    </div>
  );
}

function Announcements() {
  const { profile } = useApp();
  const run = useAction();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Announcement | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const list = announcements.list();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>Tulis Pengumuman</Button>
      </div>

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Megaphone size={22} />} title="Belum ada pengumuman" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((a) => {
            const author = profiles.get(actor, a.author_id);
            return (
              <Card key={a.id} padded={false}>
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned && <Pin size={13} className="shrink-0 text-brass-500" />}
                      <h3 className="text-[14.5px] font-medium text-wine-900">{a.title}</h3>
                      <Badge tone="wine">{a.category}</Badge>
                      {!a.published && <Badge tone="neutral">Draf</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">
                      {a.body}
                    </p>
                    <p className="mt-1.5 text-[11.5px] text-ink-400">
                      {author?.full_name ?? 'Pengurus'} · {relativeID(a.published_at ?? a.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button" onClick={() => setEditing(a)} aria-label={`Ubah ${a.title}`}
                      className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-cream-200 hover:text-wine-700"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button" onClick={() => setRemoving(a)} aria-label={`Hapus ${a.title}`}
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
      )}

      {(creating || editing) && (
        <AnnouncementForm item={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) run(() => announcements.remove(actor, removing.id), 'Pengumuman dihapus.');
        }}
        title="Hapus pengumuman?"
        message="Pengumuman akan hilang dari situs publik dan portal warga."
        confirmLabel="Ya, hapus"
      />
    </div>
  );
}

function AnnouncementForm({ item, onClose }: { item: Announcement | null; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [form, setForm] = useState(() => ({
    title: item?.title ?? '',
    body: item?.body ?? '',
    category: item?.category ?? ('umum' as AnnouncementCategory),
    pinned: item?.pinned ?? false,
    published: item?.published ?? true,
  }));

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open onClose={onClose} size="lg"
      title={item ? 'Ubah Pengumuman' : 'Tulis Pengumuman'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            disabled={form.title.trim().length < 3 || form.body.trim().length < 10}
            onClick={() => {
              const ok = run(
                () => announcements.save(actor, item ? { ...form, id: item.id } : form),
                item ? 'Pengumuman diperbarui.' : 'Pengumuman diterbitkan.',
              );
              if (ok) onClose();
            }}
          >
            {form.published ? 'Terbitkan' : 'Simpan Draf'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Judul" required value={form.title}
          onChange={(e) => set('title', e.target.value)} />
        <Select label="Kategori" value={form.category}
          onChange={(e) => set('category', e.target.value as AnnouncementCategory)}
          options={ANN_CATEGORIES} />
        <Textarea
          label="Isi pengumuman" required rows={9} value={form.body}
          onChange={(e) => set('body', e.target.value)}
          hint="Pisahkan paragraf dengan baris kosong agar mudah dibaca."
        />
        <div className="flex flex-wrap gap-5">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.pinned}
              onChange={(e) => set('pinned', e.target.checked)}
              className="h-4 w-4 accent-[var(--color-wine-700)]" />
            <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-900">
              <Pin size={13} />Sematkan di atas
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.published}
              onChange={(e) => set('published', e.target.checked)}
              className="h-4 w-4 accent-[var(--color-wine-700)]" />
            <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-900">
              {form.published ? <Eye size={13} /> : <EyeOff size={13} />}
              Terbitkan sekarang
            </span>
          </label>
        </div>
        {form.published && !item && (
          <p className="rounded-lg bg-brass-100/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-700">
            Menerbitkan akan mengirim notifikasi ke seluruh warga aktif.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Events() {
  const { profile } = useApp();
  const run = useAction();
  const [editing, setEditing] = useState<CommunityEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<CommunityEvent | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const list = events.list();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>Jadwalkan Kegiatan</Button>
      </div>

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<CalendarDays size={22} />} title="Belum ada kegiatan terjadwal" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((ev) => {
            const rsvps = events.rsvps(ev.id);
            const going = rsvps.filter((r) => r.status === 'going').reduce((s, r) => s + 1 + r.guests, 0);
            const past = ev.date < todayISO();
            return (
              <Card key={ev.id} padded={false}>
                <div className="flex flex-wrap items-start gap-3.5 p-4">
                  <div className="arch-sm flex h-[52px] w-[46px] shrink-0 flex-col items-center justify-center bg-wine-700 pt-1 text-cream-50">
                    <span className="text-[9px] font-medium uppercase opacity-75">
                      {formatDateID(ev.date, { short: true }).split(' ')[1]}
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-[18px] font-semibold leading-none">
                      {formatDateID(ev.date).split(' ')[0]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-medium text-wine-900">{ev.title}</h3>
                      {!ev.published && <Badge tone="neutral">Draf</Badge>}
                      {past && <Badge tone="neutral">Selesai</Badge>}
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-500">
                      {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''} · {ev.location}
                      {ev.rsvp_enabled && ` · ${going} hadir${ev.capacity ? `/${ev.capacity}` : ''}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button" onClick={() => setEditing(ev)} aria-label={`Ubah ${ev.title}`}
                      className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-cream-200 hover:text-wine-700"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button" onClick={() => setRemoving(ev)} aria-label={`Hapus ${ev.title}`}
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
      )}

      {(creating || editing) && (
        <EventForm item={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      <ConfirmDialog
        open={!!removing} onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) run(() => events.remove(actor, removing.id), 'Kegiatan dihapus.');
        }}
        title="Hapus kegiatan?"
        message="Kegiatan dan seluruh konfirmasi kehadiran warga akan dihapus."
        confirmLabel="Ya, hapus"
      />
    </div>
  );
}

function EventForm({ item, onClose }: { item: CommunityEvent | null; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [form, setForm] = useState(() => ({
    title: item?.title ?? '',
    description: item?.description ?? '',
    category: item?.category ?? ('lainnya' as CommunityEvent['category']),
    date: item?.date ?? addDays(todayISO(), 7),
    start_time: item?.start_time ?? '08:00',
    end_time: item?.end_time ?? '',
    location: item?.location ?? '',
    rsvp_enabled: item?.rsvp_enabled ?? true,
    capacity: item?.capacity ?? 0,
    published: item?.published ?? true,
  }));

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const badRange = !!form.end_time && form.end_time <= form.start_time;

  return (
    <Modal
      open onClose={onClose} size="lg"
      title={item ? 'Ubah Kegiatan' : 'Jadwalkan Kegiatan'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            disabled={form.title.trim().length < 3 || badRange}
            onClick={() => {
              const ok = run(
                () => events.save(actor, {
                  ...form,
                  end_time: form.end_time || null,
                  capacity: form.capacity > 0 ? form.capacity : null,
                  ...(item ? { id: item.id } : {}),
                }),
                item ? 'Kegiatan diperbarui.' : 'Kegiatan dijadwalkan.',
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
        <Input label="Judul kegiatan" required value={form.title}
          onChange={(e) => set('title', e.target.value)} />
        <Select label="Kategori" value={form.category}
          onChange={(e) => set('category', e.target.value as CommunityEvent['category'])}
          options={EVENT_CATEGORIES} />
        <Textarea label="Deskripsi" rows={3} value={form.description}
          onChange={(e) => set('description', e.target.value)} />
        <Input label="Tanggal" type="date" required value={form.date}
          onChange={(e) => set('date', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Jam mulai" type="time" required value={form.start_time}
            onChange={(e) => set('start_time', e.target.value)} />
          <Input label="Jam selesai" type="time" value={form.end_time}
            onChange={(e) => set('end_time', e.target.value)}
            {...(badRange ? { error: 'Harus setelah jam mulai' } : {})} />
        </div>
        <Input label="Lokasi" value={form.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="Balai Warga / Lapangan Serbaguna" />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Kuota peserta" type="number" min={0} value={form.capacity}
            onChange={(e) => set('capacity', Math.max(0, parseInt(e.target.value || '0', 10)))}
            hint="0 = tanpa batas"
          />
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.rsvp_enabled}
              onChange={(e) => set('rsvp_enabled', e.target.checked)}
              className="h-4 w-4 accent-[var(--color-wine-700)]" />
            <span className="text-[13.5px] font-medium text-ink-900">Minta konfirmasi kehadiran</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={form.published}
              onChange={(e) => set('published', e.target.checked)}
              className="h-4 w-4 accent-[var(--color-wine-700)]" />
            <span className="text-[13.5px] font-medium text-ink-900">Tampilkan ke warga</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
