import { Link } from 'react-router-dom';
import {
  Armchair, Building2, Wallet, MessageSquareWarning, UserPlus, CalendarDays,
  ShieldCheck, ChevronRight, AlertTriangle, Megaphone, Clock,
} from 'lucide-react';
import { Badge, Card, EmptyState, Progress } from '../../components/ui';
import { ResidentGreeting } from './AppLayout';
import { useApp } from '../../context/AppContext';
import {
  announcements, bookings, complaints, dues, events, facilities, guests, houses,
} from '../../db';
import { formatDateID, formatPeriodID, relativeID, todayISO } from '../../lib/date';
import { idr } from '../../lib/format';

const SHORTCUTS = [
  { to: '/app/pinjam', icon: Armchair, label: 'Pinjam Barang', tone: 'wine' },
  { to: '/app/fasilitas', icon: Building2, label: 'Pesan Fasilitas', tone: 'sage' },
  { to: '/app/iuran', icon: Wallet, label: 'Iuran IPL', tone: 'brass' },
  { to: '/app/lapor', icon: MessageSquareWarning, label: 'Lapor Warga', tone: 'warn' },
  { to: '/app/tamu', icon: UserPlus, label: 'Undang Tamu', tone: 'info' },
  { to: '/app/agenda', icon: CalendarDays, label: 'Agenda', tone: 'ok' },
] as const;

/** Human labels — the raw enum must never reach a resident's screen. */
const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  open: 'Baru dilaporkan',
  acknowledged: 'Sudah ditanggapi',
  in_progress: 'Sedang dikerjakan',
  resolved: 'Selesai',
  closed: 'Ditutup',
  rejected: 'Ditolak',
};

const TONE_BG = {
  wine: 'bg-wine-100 text-wine-700',
  sage: 'bg-sage-100 text-sage-700',
  brass: 'bg-brass-100 text-brass-600',
  warn: 'bg-warn-100 text-warn-600',
  info: 'bg-info-100 text-info-600',
  ok: 'bg-ok-100 text-ok-600',
} as const;

export default function Dashboard() {
  const { profile } = useApp();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };

  const myBookings = bookings.mine(actor);
  const activeBookings = myBookings.filter((b) =>
    ['pending', 'approved', 'picked_up'].includes(b.status));
  const myComplaints = complaints.mine(actor).filter((c) =>
    !['resolved', 'closed', 'rejected'].includes(c.status));
  const myDues = profile.house_id ? dues.forHouse(actor, profile.house_id) : [];
  const outstanding = myDues.filter((d) => d.status === 'unpaid' || d.status === 'overdue');
  const overdue = myDues.filter((d) => d.status === 'overdue');
  const upcoming = events.list({ publishedOnly: true, upcomingOnly: true }).slice(0, 2);
  const pinned = announcements.list({ publishedOnly: true }).filter((a) => a.pinned).slice(0, 1);
  const myGuests = guests.mine(actor).filter((g) => g.status === 'active' && g.visit_date >= todayISO());
  const dueTotal = outstanding.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-5">
      <ResidentGreeting />

      <p className="-mt-1 text-[12.5px] text-ink-400">
        {houses.label(profile.house_id)}
      </p>

      {/* ── Attention strip ─────────────────────────────────────────── */}
      {(overdue.length > 0 || myComplaints.length > 0) && (
        <div className="space-y-2.5">
          {overdue.length > 0 && (
            <Link to="/app/iuran">
              <Card className="border-bad-600/25 bg-bad-100/60" padded={false}>
                <div className="flex items-center gap-3 p-4">
                  <AlertTriangle size={19} className="shrink-0 text-bad-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-bad-600">
                      {overdue.length} tagihan IPL lewat jatuh tempo
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      Total {idr(overdue.reduce((s, d) => s + d.amount, 0))} — segera lakukan pembayaran.
                    </p>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-bad-600/60" />
                </div>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* ── At a glance ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          to="/app/pinjam"
          label="Peminjaman aktif"
          value={activeBookings.length}
          sub={activeBookings[0]
            ? activeBookings[0].status === 'pending' ? 'Menunggu persetujuan' : 'Sedang berjalan'
            : 'Tidak ada'}
          tone="wine"
        />
        <MiniStat
          to="/app/iuran"
          label="Tagihan belum lunas"
          value={outstanding.length}
          sub={dueTotal > 0 ? idr(dueTotal, { compact: true }) : 'Semua lunas'}
          tone={overdue.length ? 'bad' : outstanding.length ? 'warn' : 'ok'}
        />
        <MiniStat
          to="/app/lapor"
          label="Laporan berjalan"
          value={myComplaints.length}
          sub={myComplaints[0] ? COMPLAINT_STATUS_LABEL[myComplaints[0].status] ?? '—' : 'Tidak ada'}
          tone="warn"
        />
        <MiniStat
          to="/app/tamu"
          label="Tamu terjadwal"
          value={myGuests.length}
          sub={myGuests[0] ? formatDateID(myGuests[0].visit_date, { short: true }) : 'Tidak ada'}
          tone="info"
        />
      </div>

      {/* ── Shortcuts ───────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Layanan
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {SHORTCUTS.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card
                hover
                padded={false}
                className="flex h-full flex-col items-center gap-2 px-2 py-4 text-center"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${TONE_BG[s.tone]}`}>
                  <s.icon size={19} />
                </span>
                <span className="text-[11.5px] font-medium leading-tight text-ink-700">{s.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Dues progress ───────────────────────────────────────────── */}
      {myDues.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15.5px] text-wine-900">Iuran IPL</h2>
            <Link to="/app/iuran" className="text-[12.5px] font-medium text-brass-500">
              Lihat semua
            </Link>
          </div>
          {(() => {
            const recent = myDues.slice(0, 6);
            const paid = recent.filter((d) => d.status === 'paid' || d.status === 'waived').length;
            return (
              <>
                <Progress
                  value={(paid / recent.length) * 100}
                  tone={paid === recent.length ? 'ok' : 'wine'}
                />
                <p className="mt-2.5 text-[12.5px] text-ink-500">
                  {paid} dari {recent.length} periode terakhir sudah lunas
                </p>
                <div className="mt-3.5 space-y-2 border-t border-cream-300 pt-3">
                  {myDues.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-ink-700">{formatPeriodID(d.period)}</span>
                      <DuesBadge status={d.status} />
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </Card>
      )}

      {/* ── Pinned announcement ─────────────────────────────────────── */}
      {pinned.map((a) => (
        <Link key={a.id} to="/app/info">
          <Card hover className="border-brass-200 bg-brass-100/40">
            <div className="mb-2 flex items-center gap-2">
              <Megaphone size={15} className="text-brass-500" />
              <Badge tone="brass">Penting</Badge>
              <span className="text-[11.5px] text-ink-400">
                {relativeID(a.published_at ?? a.created_at)}
              </span>
            </div>
            <h3 className="text-[15.5px] leading-snug text-wine-900">{a.title}</h3>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-500">{a.body}</p>
          </Card>
        </Link>
      ))}

      {/* ── Upcoming events ─────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Agenda mendatang
          </h2>
          <Link to="/app/agenda" className="text-[12.5px] font-medium text-brass-500">Semua</Link>
        </div>
        {upcoming.length === 0 ? (
          <Card padded={false}>
            <EmptyState icon={<CalendarDays size={22} />} title="Belum ada agenda" />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((ev) => (
              <Link key={ev.id} to="/app/agenda">
                <Card hover padded={false}>
                  <div className="flex items-center gap-3.5 p-3.5">
                    <div className="arch-sm flex h-[52px] w-[46px] shrink-0 flex-col items-center justify-center bg-wine-700 pt-1 text-cream-50">
                      <span className="text-[9px] font-medium uppercase tracking-wide opacity-75">
                        {formatDateID(ev.date, { short: true }).split(' ')[1]}
                      </span>
                      <span className="font-[family-name:var(--font-display)] text-[18px] font-semibold leading-none">
                        {formatDateID(ev.date).split(' ')[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[14px] font-medium text-wine-900">{ev.title}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-500">
                        <Clock size={11} />{ev.start_time} · {ev.location}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-ink-400" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link to="/app/info">
        <Card hover padded={false}>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-cream-200 text-wine-700">
              <ShieldCheck size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-wine-900">Informasi & Nomor Darurat</p>
              <p className="text-[12px] text-ink-500">Pengumuman, transparansi kas, kontak penting</p>
            </div>
            <ChevronRight size={17} className="shrink-0 text-ink-400" />
          </div>
        </Card>
      </Link>

      <p className="pb-2 pt-2 text-center text-[11px] text-ink-400">
        {facilities.list({ activeOnly: true }).length} fasilitas · Burgundy Residences RW 012
      </p>
    </div>
  );
}

function MiniStat({
  to, label, value, sub, tone,
}: {
  to: string; label: string; value: number; sub: string;
  tone: 'wine' | 'brass' | 'ok' | 'warn' | 'bad' | 'info';
}) {
  const color = {
    wine: 'var(--color-wine-700)', brass: 'var(--color-brass-500)',
    ok: 'var(--color-ok-600)', warn: 'var(--color-warn-600)',
    bad: 'var(--color-bad-600)', info: 'var(--color-info-600)',
  }[tone];

  return (
    <Link to={to}>
      <Card hover padded={false} className="relative h-full overflow-hidden">
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color, opacity: 0.85 }} />
        <div className="p-3.5">
          <div className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-ink-400">
            {label}
          </div>
          <div
            className="tabular mt-1.5 font-[family-name:var(--font-display)] text-[24px] font-semibold leading-none"
            style={{ color }}
          >
            {value}
          </div>
          <div className="mt-1 truncate text-[11.5px] text-ink-500">{sub}</div>
        </div>
      </Card>
    </Link>
  );
}

export function DuesBadge({ status }: { status: string }) {
  const map = {
    paid: ['ok', 'Lunas'],
    waived: ['sage', 'Dibebaskan'],
    unpaid: ['warn', 'Belum bayar'],
    overdue: ['bad', 'Terlambat'],
    awaiting_verification: ['info', 'Menunggu verifikasi'],
  } as const;
  const entry = map[status as keyof typeof map] ?? (['neutral', status] as const);
  return <Badge tone={entry[0]}>{entry[1]}</Badge>;
}
