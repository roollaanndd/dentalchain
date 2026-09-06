import { useMemo, useState } from 'react';
import { MessageSquareWarning, Search, Send, AlertTriangle, MapPin, Lock } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, EmptyState, Input, Modal, Segmented, Select, Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { ComplaintStatusBadge } from '../app/Complaints';
import { useApp, useAction } from '../../context/AppContext';
import {
  can, complaints, profiles,
  type Complaint, type ComplaintStatus, type Priority,
} from '../../db';
import { formatDateTimeID, relativeID } from '../../lib/date';
import { clean } from '../../lib/validate';

const STATUSES: { value: ComplaintStatus; label: string }[] = [
  { value: 'open', label: 'Baru' }, { value: 'acknowledged', label: 'Ditanggapi' },
  { value: 'in_progress', label: 'Sedang dikerjakan' }, { value: 'resolved', label: 'Selesai' },
  { value: 'closed', label: 'Ditutup' }, { value: 'rejected', label: 'Ditolak' },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Rendah' }, { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Tinggi' }, { value: 'urgent', label: 'Mendesak' },
];

export default function Reports() {
  const { profile } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'terbuka' | 'selesai' | 'semua'>('terbuka');
  const [open, setOpen] = useState<Complaint | null>(null);

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const all = complaints.all(actor);
  const openCount = all.filter((c) => !['resolved', 'closed', 'rejected'].includes(c.status)).length;

  const list = useMemo(() => {
    const q = clean(query, 60).toLowerCase();
    const rank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
    return all
      .filter((c) => {
        const done = ['resolved', 'closed', 'rejected'].includes(c.status);
        if (filter === 'terbuka' && done) return false;
        if (filter === 'selesai' && !done) return false;
        if (!q) return true;
        return c.title.toLowerCase().includes(q)
          || c.description.toLowerCase().includes(q)
          || c.code.toLowerCase().includes(q);
      })
      .sort((a, b) => rank[a.priority] - rank[b.priority] || b.created_at.localeCompare(a.created_at));
  }, [all, query, filter]);

  return (
    <div>
      <AdminHeader
        title="Laporan Warga"
        subtitle="Tanggapi keluhan lingkungan, tetapkan prioritas, dan tutup laporan yang selesai."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Cari judul atau nomor tiket…" value={query}
            onChange={(e) => setQuery(e.target.value)} prefix={<Search size={15} />}
          />
        </div>
        <Segmented
          size="sm" value={filter} onChange={setFilter}
          options={[
            { value: 'terbuka', label: 'Terbuka', count: openCount },
            { value: 'selesai', label: 'Selesai' },
            { value: 'semua', label: 'Semua', count: all.length },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<MessageSquareWarning size={22} />} title="Tidak ada laporan" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((c) => {
            const who = c.anonymous ? null : profiles.get(actor, c.user_id);
            return (
              <Card key={c.id} padded={false} hover>
                <button type="button" onClick={() => setOpen(c)} className="w-full p-4 text-left">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.priority === 'urgent' && (
                          <AlertTriangle size={15} className="shrink-0 text-bad-600" />
                        )}
                        <h3 className="text-[14.5px] font-medium text-wine-900">{c.title}</h3>
                        <ComplaintStatusBadge status={c.status} />
                        {c.priority === 'urgent' && <Badge tone="bad">Mendesak</Badge>}
                        {c.priority === 'high' && <Badge tone="warn">Prioritas tinggi</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-500">{c.description}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-400">
                        <span className="font-mono">{c.code}</span>
                        <span>{c.category}</span>
                        {c.location && (
                          <span className="flex items-center gap-1"><MapPin size={10} />{c.location}</span>
                        )}
                        <span>{c.anonymous ? 'Anonim' : who?.full_name ?? 'Warga'}</span>
                        <span>{relativeID(c.created_at)}</span>
                      </p>
                    </div>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {open && <TriageModal complaint={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TriageModal({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const { profile } = useApp();
  const run = useAction();
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState<ComplaintStatus | ''>('');
  const [priority, setPriority] = useState<Priority>(complaint.priority);
  const [assignee, setAssignee] = useState(complaint.assignee_id ?? '');

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const updates = complaints.updates(actor, complaint.id);
  const reporter = complaint.anonymous ? null : profiles.get(actor, complaint.user_id);
  const officers = profiles.list(actor).filter((p) => p.role !== 'resident' && p.status === 'active');

  return (
    <Modal
      open onClose={onClose} title={complaint.title}
      description={`${complaint.code} · ${formatDateTimeID(complaint.created_at)}`}
      size="lg"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <ComplaintStatusBadge status={complaint.status} />
          <Badge tone="neutral">{complaint.category}</Badge>
          {complaint.anonymous && <Badge tone="wine">Laporan anonim</Badge>}
        </div>

        <p className="text-[14px] leading-relaxed text-ink-700">{complaint.description}</p>

        <dl className="grid gap-x-6 gap-y-2 rounded-[var(--radius-btn)] bg-cream-200/50 p-3.5 text-[12.5px] sm:grid-cols-2">
          <div>
            <dt className="text-ink-400">Pelapor</dt>
            <dd className="mt-0.5 font-medium text-ink-700">
              {complaint.anonymous ? 'Dirahasiakan dari warga lain' : reporter?.full_name ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400">Kontak</dt>
            <dd className="mt-0.5 font-medium text-ink-700">{reporter?.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Lokasi</dt>
            <dd className="mt-0.5 font-medium text-ink-700">{complaint.location || '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Terakhir diperbarui</dt>
            <dd className="mt-0.5 font-medium text-ink-700">{relativeID(complaint.updated_at)}</dd>
          </div>
        </dl>

        {complaint.photo_url && (
          <img
            src={complaint.photo_url} alt="Foto laporan"
            className="max-h-72 w-full rounded-[var(--radius-btn)] border border-cream-300 object-contain"
          />
        )}

        {/* Triage controls */}
        {can(actor, 'complaint.triage') && (
          <section className="grid gap-3 border-t border-cream-300 pt-4 sm:grid-cols-2">
            <Select
              label="Prioritas" value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              options={PRIORITIES}
            />
            <Select
              label="Ditugaskan ke" value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Belum ditugaskan"
              options={officers.map((o) => ({ value: o.id, label: o.full_name }))}
            />
            <div className="sm:col-span-2">
              <Button
                variant="secondary"
                disabled={priority === complaint.priority && assignee === (complaint.assignee_id ?? '')}
                onClick={() => run(
                  () => complaints.triage(actor, complaint.id, {
                    priority, assignee_id: assignee || null,
                  }),
                  'Laporan diperbarui.',
                )}
              >
                Simpan Prioritas & Penugasan
              </Button>
            </div>
          </section>
        )}

        {/* Thread */}
        <section className="border-t border-cream-300 pt-4">
          <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Riwayat tanggapan
          </h4>
          {updates.length === 0 ? (
            <p className="text-[13px] text-ink-400">Belum ada tanggapan.</p>
          ) : (
            <ul className="space-y-3">
              {updates.map((u) => {
                const author = profiles.get(actor, u.author_id);
                return (
                  <li key={u.id} className="flex gap-2.5">
                    <Avatar name={author?.full_name ?? '?'} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-wine-900">
                          {author?.full_name ?? 'Pengguna'}
                        </span>
                        <span className="text-[11px] text-ink-400">{relativeID(u.created_at)}</span>
                        {u.internal && (
                          <Badge tone="neutral" className="gap-1">
                            <Lock size={9} />Internal
                          </Badge>
                        )}
                        {u.status_change && <Badge tone="info">{u.status_change}</Badge>}
                      </div>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-700">{u.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Reply */}
        {can(actor, 'complaint.triage') && (
          <section className="space-y-3 border-t border-cream-300 pt-4">
            <Textarea
              label="Tanggapan" rows={3} value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Tulis tanggapan untuk warga…"
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1">
                <Select
                  label="Ubah status menjadi" value={status}
                  onChange={(e) => setStatus(e.target.value as ComplaintStatus | '')}
                  placeholder="Tidak diubah"
                  options={STATUSES}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 pb-3">
                <input
                  type="checkbox" checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-wine-700)]"
                />
                <span className="text-[12.5px] text-ink-700">Catatan internal</span>
              </label>
              <Button
                className="mb-3"
                disabled={reply.trim().length < 2}
                icon={<Send size={14} />}
                onClick={() => {
                  const ok = run(
                    () => complaints.comment(actor, complaint.id, reply, {
                      internal, ...(status ? { status } : {}),
                    }),
                    'Tanggapan terkirim.',
                  );
                  if (ok) { setReply(''); setStatus(''); setInternal(false); }
                }}
              >
                Kirim
              </Button>
            </div>
            {internal && (
              <p className="rounded-lg bg-cream-200/70 px-3 py-2 text-[12px] leading-relaxed text-ink-500">
                Catatan internal hanya terlihat oleh pengurus — pelapor tidak akan melihatnya.
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
