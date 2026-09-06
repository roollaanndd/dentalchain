import { Link } from 'react-router-dom';
import {
  Armchair, Building2, MessageSquareWarning, Wallet, UserPlus,
  AlertTriangle, TrendingUp, TrendingDown, Clock, ArrowRight,
} from 'lucide-react';
import { Badge, Card, EmptyState, Progress, Stat } from '../../components/ui';
import { AdminHeader } from './AdminLayout';
import { useApp } from '../../context/AppContext';
import {
  bookings, can, complaints, dashboardStats, equipment, houses, ledger, profiles,
} from '../../db';
import { formatDateID, formatPeriodID, relativeID, todayISO } from '../../lib/date';
import { idr } from '../../lib/format';

export default function Overview() {
  const { profile } = useApp();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const s = dashboardStats(actor);

  const pendingBookings = can(actor, 'booking.read.all')
    ? bookings.all(actor).filter((b) => b.status === 'pending').slice(0, 5)
    : [];
  const openComplaints = can(actor, 'complaint.read.all')
    ? complaints.all(actor)
        .filter((c) => !['resolved', 'closed', 'rejected'].includes(c.status))
        .sort((a, b) => {
          const rank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
          return rank[a.priority] - rank[b.priority];
        })
        .slice(0, 5)
    : [];
  const pendingResidents = can(actor, 'resident.read.all')
    ? profiles.list(actor).filter((p) => p.status === 'pending')
    : [];

  return (
    <div>
      <AdminHeader
        title={`Selamat datang, ${profile.full_name.split(' ')[0]}`}
        subtitle={`Ringkasan operasional Burgundy Residences · ${formatDateID(todayISO(), { weekday: true })}`}
      />

      {/* Action queue — what needs a decision today. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Menunggu persetujuan" value={s.pendingBookings}
          sub="Peminjaman inventaris" tone={s.pendingBookings ? 'warn' : 'ok'}
          icon={<Armchair size={26} />}
        />
        <Stat
          label="Laporan terbuka" value={s.openComplaints}
          sub={s.urgentComplaints ? `${s.urgentComplaints} mendesak` : 'Tidak ada yang mendesak'}
          tone={s.urgentComplaints ? 'bad' : s.openComplaints ? 'warn' : 'ok'}
          icon={<MessageSquareWarning size={26} />}
        />
        <Stat
          label="Warga menunggu verifikasi" value={s.pendingResidents}
          sub={`${s.residents} warga aktif`}
          tone={s.pendingResidents ? 'brass' : 'ok'}
          icon={<UserPlus size={26} />}
        />
        <Stat
          label="Sedang dipinjam" value={s.activeLoans}
          sub={s.overdueLoans ? `${s.overdueLoans} lewat tanggal` : 'Semua tepat waktu'}
          tone={s.overdueLoans ? 'bad' : 'wine'}
          icon={<Building2 size={26} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Dues collection */}
        {can(actor, 'dues.manage') && (
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] text-wine-900">Kolektibilitas IPL</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  Periode {formatPeriodID(s.dues.period)}
                </p>
              </div>
              <Link to="/admin/keuangan">
                <Badge tone="wine" className="gap-1">Kelola <ArrowRight size={10} /></Badge>
              </Link>
            </div>

            <div className="mb-2 flex items-end justify-between gap-3">
              <span
                className="tabular font-[family-name:var(--font-display)] text-[30px] font-semibold leading-none"
                style={{ color: s.dues.rate >= 80 ? 'var(--color-ok-600)' : 'var(--color-warn-600)' }}
              >
                {s.dues.rate}%
              </span>
              <span className="tabular text-[13px] text-ink-500">
                {idr(s.dues.collected)} / {idr(s.dues.billed)}
              </span>
            </div>
            <Progress value={s.dues.rate} tone={s.dues.rate >= 80 ? 'ok' : 'warn'} />

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-cream-300 pt-3.5 text-center">
              <div>
                <p className="tabular text-[18px] font-semibold text-ok-600">{s.dues.paid}</p>
                <p className="text-[11px] text-ink-400">Lunas</p>
              </div>
              <div>
                <p className="tabular text-[18px] font-semibold text-info-600">{s.dues.pending}</p>
                <p className="text-[11px] text-ink-400">Perlu verifikasi</p>
              </div>
              <div>
                <p className="tabular text-[18px] font-semibold text-warn-600">{s.dues.unpaid}</p>
                <p className="text-[11px] text-ink-400">Belum bayar</p>
              </div>
            </div>
          </Card>
        )}

        {/* Cash position */}
        {s.balance && (
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] text-wine-900">Posisi Kas RW</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-500">Seluruh periode tercatat</p>
              </div>
              <Wallet size={22} className="text-wine-700 opacity-25" />
            </div>
            <p className="tabular font-[family-name:var(--font-display)] text-[30px] font-semibold leading-none text-wine-700">
              {idr(s.balance.balance)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-cream-300 pt-3.5">
              <div>
                <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
                  <TrendingUp size={12} className="text-ok-600" />Pemasukan
                </p>
                <p className="tabular mt-1 text-[16px] font-semibold text-ok-600">
                  {idr(s.balance.income, { compact: true })}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
                  <TrendingDown size={12} className="text-bad-600" />Pengeluaran
                </p>
                <p className="tabular mt-1 text-[16px] font-semibold text-bad-600">
                  {idr(s.balance.expense, { compact: true })}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-ink-400">
              {ledger.list(actor).length} transaksi tercatat
            </p>
          </Card>
        )}

        {/* Approval queue */}
        {can(actor, 'booking.read.all') && (
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[17px] text-wine-900">Antrean persetujuan</h2>
              <Link to="/admin/inventaris" className="text-[12.5px] font-medium text-brass-500">
                Semua
              </Link>
            </div>
            {pendingBookings.length === 0 ? (
              <EmptyState icon={<Armchair size={20} />} title="Tidak ada antrean" />
            ) : (
              <ul className="space-y-2.5">
                {pendingBookings.map((b) => {
                  const item = equipment.get(b.equipment_id);
                  const who = profiles.get(actor, b.user_id);
                  return (
                    <li key={b.id} className="flex items-center gap-3 border-b border-cream-300 pb-2.5 last:border-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-wine-900">
                          {b.qty}× {item?.name ?? 'Barang'}
                        </p>
                        <p className="truncate text-[11.5px] text-ink-500">
                          {who?.full_name ?? 'Warga'} · {formatDateID(b.start_date, { short: true })}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-ink-400">
                        {relativeID(b.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {/* Complaint triage */}
        {can(actor, 'complaint.read.all') && (
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[17px] text-wine-900">Laporan perlu tindakan</h2>
              <Link to="/admin/laporan" className="text-[12.5px] font-medium text-brass-500">
                Semua
              </Link>
            </div>
            {openComplaints.length === 0 ? (
              <EmptyState icon={<MessageSquareWarning size={20} />} title="Tidak ada laporan terbuka" />
            ) : (
              <ul className="space-y-2.5">
                {openComplaints.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-b border-cream-300 pb-2.5 last:border-0 last:pb-0">
                    {c.priority === 'urgent' && (
                      <AlertTriangle size={15} className="shrink-0 text-bad-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-wine-900">{c.title}</p>
                      <p className="truncate text-[11.5px] text-ink-500">
                        {c.category} · {c.location || 'Lokasi tidak disebut'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-400">
                      {relativeID(c.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {/* Verification queue */}
      {pendingResidents.length > 0 && (
        <Card className="mt-5 border-brass-200 bg-brass-100/40">
          <div className="flex items-start gap-3.5">
            <UserPlus size={20} className="mt-0.5 shrink-0 text-brass-500" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] text-wine-900">
                {pendingResidents.length} warga menunggu verifikasi
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                Akun baru tidak dapat mengakses layanan apa pun sampai diverifikasi bahwa
                mereka benar-benar berdomisili di sini.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {pendingResidents.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Badge tone="brass">
                      {p.full_name} · {houses.label(p.house_id)}
                    </Badge>
                  </li>
                ))}
              </ul>
              <Link to="/admin/warga" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-wine-700 hover:underline">
                Buka daftar warga <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </Card>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-ink-400">
        <Clock size={12} />
        {s.houses} rumah · {s.residents} warga aktif · {s.guestsToday} tamu terjadwal hari ini
      </p>
    </div>
  );
}
