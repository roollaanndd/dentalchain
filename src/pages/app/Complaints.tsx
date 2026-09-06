import { useState } from 'react';
import { MessageSquareWarning, Plus, Send, MapPin, Camera } from 'lucide-react';
import {
  Badge, Button, Card, CopyButton, EmptyState, Input, Modal, Segmented,
  Select, Textarea, Avatar,
} from '../../components/ui';
import { useApp, useAction } from '../../context/AppContext';
import {
  complaints, profiles, type Complaint, type ComplaintCategory, type ComplaintStatus,
} from '../../db';
import { formatDateTimeID, relativeID } from '../../lib/date';
import { clean } from '../../lib/validate';

const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  jalan: 'Jalan', sampah: 'Sampah', keamanan: 'Keamanan', air: 'Air',
  listrik: 'Listrik', saluran: 'Saluran', fasum: 'Fasilitas Umum',
  kebisingan: 'Kebisingan', lainnya: 'Lainnya',
};

const STATUS_META: Record<ComplaintStatus, { tone: 'warn' | 'info' | 'wine' | 'ok' | 'neutral' | 'bad'; label: string }> = {
  open: { tone: 'warn', label: 'Baru' },
  acknowledged: { tone: 'info', label: 'Ditanggapi' },
  in_progress: { tone: 'wine', label: 'Sedang dikerjakan' },
  resolved: { tone: 'ok', label: 'Selesai' },
  closed: { tone: 'neutral', label: 'Ditutup' },
  rejected: { tone: 'bad', label: 'Ditolak' },
};

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export default function Complaints() {
  const { profile } = useApp();
  const [filter, setFilter] = useState<'berjalan' | 'selesai'>('berjalan');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Complaint | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = complaints.mine(actor);
  const running = all.filter((c) => !['resolved', 'closed', 'rejected'].includes(c.status));
  const list = filter === 'berjalan'
    ? running
    : all.filter((c) => ['resolved', 'closed', 'rejected'].includes(c.status));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-wine-900">Lapor Warga</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
            Sampaikan masalah lingkungan. Setiap laporan bernomor dan dapat dipantau.
          </p>
        </div>
        <Button size="sm" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
          Lapor
        </Button>
      </div>

      <Segmented
        value={filter} onChange={setFilter}
        options={[
          { value: 'berjalan', label: 'Berjalan', count: running.length },
          { value: 'selesai', label: 'Selesai' },
        ]}
      />

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<MessageSquareWarning size={22} />}
            title={filter === 'berjalan' ? 'Tidak ada laporan berjalan' : 'Belum ada laporan selesai'}
            message={filter === 'berjalan' ? 'Ada lampu jalan mati atau sampah menumpuk? Laporkan di sini.' : undefined}
            action={filter === 'berjalan'
              ? <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>Buat Laporan</Button>
              : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <Card key={c.id} padded={false} hover>
              <button
                type="button"
                onClick={() => setOpen(c)}
                className="w-full p-4 text-left"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium leading-snug text-wine-900">{c.title}</h3>
                    <p className="mt-0.5 font-mono text-[11.5px] text-ink-400">{c.code}</p>
                  </div>
                  <ComplaintStatusBadge status={c.status} />
                </div>
                <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">
                  {c.description}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{CATEGORY_LABEL[c.category]}</Badge>
                  {c.priority === 'urgent' && <Badge tone="bad" dot>Mendesak</Badge>}
                  {c.priority === 'high' && <Badge tone="warn">Prioritas tinggi</Badge>}
                  <span className="text-[11.5px] text-ink-400">{relativeID(c.created_at)}</span>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {creating && <NewComplaint onClose={() => setCreating(false)} />}
      {open && <ComplaintThread complaint={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function NewComplaint({ onClose }: { onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('lainnya');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const valid = clean(title, 140).length >= 5 && clean(description, 5000).length >= 10;

  function submit() {
    const made = run(
      () => complaints.create(actor, {
        title, description, category, location,
        ...(photo ? { photo_url: photo } : {}),
        anonymous,
      }),
      'Laporan terkirim. Pengurus akan menindaklanjuti.',
    );
    if (made) onClose();
  }

  return (
    <Modal
      open onClose={onClose}
      title="Buat Laporan"
      description="Jelaskan masalahnya sejelas mungkin agar pengurus dapat bertindak cepat."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={!valid} icon={<Send size={15} />}>Kirim Laporan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Judul laporan" required
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Contoh: Lampu jalan depan Blok C mati"
          hint="Minimal 5 karakter"
        />
        <Select
          label="Kategori" required
          value={category} onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
          options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Input
          label="Lokasi"
          value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="Contoh: Jl. Burgundy C, depan rumah C-2"
          prefix={<MapPin size={15} />}
        />
        <Textarea
          label="Deskripsi" required rows={4}
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Ceritakan sejak kapan, seberapa parah, dan dampaknya bagi warga…"
          hint="Minimal 10 karakter"
        />

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink-700">Foto (opsional)</label>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-btn)] border-2 border-dashed border-cream-300 bg-cream-200/40 px-4 py-6 text-center transition-colors hover:border-wine-300 hover:bg-wine-50">
            <Camera size={20} className="text-ink-400" />
            <span className="text-[12.5px] font-medium text-ink-700">
              {photo ? 'Foto terpilih — ketuk untuk ganti' : 'Tambahkan foto'}
            </span>
            <input
              type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || f.size > 2 * 1024 * 1024) return;
                const r = new FileReader();
                r.onload = () => setPhoto(String(r.result ?? ''));
                r.readAsDataURL(f);
              }}
            />
          </label>
          {photo && (
            <img src={photo} alt="Pratinjau" className="mt-3 max-h-48 w-full rounded-[var(--radius-btn)] border border-cream-300 object-contain" />
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox" checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--color-wine-700)]"
          />
          <span>
            <span className="block text-[13.5px] font-medium text-ink-900">Laporkan tanpa nama</span>
            <span className="block text-[12px] leading-relaxed text-ink-500">
              Nama Anda disembunyikan dari warga lain. Pengurus tetap dapat melihatnya
              untuk keperluan tindak lanjut.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

function ComplaintThread({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [reply, setReply] = useState('');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const updates = complaints.updates(actor, complaint.id);

  function send() {
    const ok = run(() => complaints.comment(actor, complaint.id, reply), 'Tanggapan terkirim.');
    if (ok) setReply('');
  }

  return (
    <Modal
      open onClose={onClose} title={complaint.title}
      description={`${complaint.code} · dilaporkan ${formatDateTimeID(complaint.created_at)}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ComplaintStatusBadge status={complaint.status} />
          <Badge tone="neutral">{CATEGORY_LABEL[complaint.category]}</Badge>
          <CopyButton text={complaint.code} label="Salin nomor tiket" />
        </div>

        <p className="text-[14px] leading-relaxed text-ink-700">{complaint.description}</p>

        {complaint.location && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
            <MapPin size={13} />{complaint.location}
          </p>
        )}

        {complaint.photo_url && (
          <img
            src={complaint.photo_url} alt="Foto laporan"
            className="max-h-72 w-full rounded-[var(--radius-btn)] border border-cream-300 object-contain"
          />
        )}

        <div className="border-t border-cream-300 pt-4">
          <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Riwayat tanggapan
          </h4>
          {updates.length === 0 ? (
            <p className="text-[13px] text-ink-400">Belum ada tanggapan dari pengurus.</p>
          ) : (
            <ul className="space-y-3">
              {updates.map((u) => {
                const author = profiles.get(actor, u.author_id);
                const mine = u.author_id === profile.id;
                return (
                  <li key={u.id} className="flex gap-2.5">
                    <Avatar name={author?.full_name ?? 'Pengurus'} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-wine-900">
                          {mine ? 'Anda' : author?.full_name ?? 'Pengurus'}
                        </span>
                        <span className="text-[11px] text-ink-400">{relativeID(u.created_at)}</span>
                        {u.status_change && (
                          <Badge tone="info">{STATUS_META[u.status_change].label}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-700">{u.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!['resolved', 'closed', 'rejected'].includes(complaint.status) && (
          <div className="flex gap-2 border-t border-cream-300 pt-4">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && reply.trim()) send(); }}
              placeholder="Tulis tanggapan…"
              className="h-11 flex-1 rounded-[var(--radius-field)] border border-cream-300 bg-cream-50 px-3.5 text-[14px] focus:border-wine-600 focus:outline-none focus:ring-2 focus:ring-wine-600/15"
            />
            <Button onClick={send} disabled={reply.trim().length < 2} icon={<Send size={15} />}>
              Kirim
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
