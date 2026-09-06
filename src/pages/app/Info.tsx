import { useState } from 'react';
import { Megaphone, Phone, TrendingUp, TrendingDown, Wallet, ShieldAlert } from 'lucide-react';
import { Badge, Card, EmptyState, Segmented } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { announcements, ledger, site } from '../../db';
import { formatDateID, formatPeriodID, relativeID } from '../../lib/date';
import { idr } from '../../lib/format';

export default function Info() {
  const { profile } = useApp();
  const [view, setView] = useState<'pengumuman' | 'keuangan' | 'darurat'>('pengumuman');
  const content = site.get();

  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const news = announcements.list({ publishedOnly: true });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] text-wine-900">Informasi</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
          Pengumuman pengurus, transparansi kas RW, dan nomor darurat.
        </p>
      </div>

      <Segmented
        value={view} onChange={setView}
        options={[
          { value: 'pengumuman', label: 'Pengumuman', count: news.length },
          { value: 'keuangan', label: 'Kas RW' },
          { value: 'darurat', label: 'Darurat' },
        ]}
      />

      {view === 'pengumuman' && (
        <div className="space-y-3">
          {news.length === 0 && (
            <Card padded={false}>
              <EmptyState icon={<Megaphone size={22} />} title="Belum ada pengumuman" />
            </Card>
          )}
          {news.map((a) => (
            <Card key={a.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={a.pinned ? 'brass' : 'wine'}>{a.category}</Badge>
                {a.pinned && <Badge tone="warn" dot>Penting</Badge>}
                <span className="text-[11.5px] text-ink-400">
                  {relativeID(a.published_at ?? a.created_at)}
                </span>
              </div>
              <h2 className="text-[16.5px] leading-snug text-wine-900">{a.title}</h2>
              <div className="mt-2 space-y-2.5">
                {a.body.split('\n\n').map((p, i) => (
                  <p key={i} className="text-[13.5px] leading-[1.7] text-ink-700">{p}</p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === 'keuangan' && <FinanceReport actor={actor} />}

      {view === 'darurat' && (
        <div className="space-y-3">
          <Card className="border-bad-600/20 bg-bad-100/40">
            <div className="flex gap-3">
              <ShieldAlert size={19} className="mt-0.5 shrink-0 text-bad-600" />
              <p className="text-[13px] leading-relaxed text-ink-700">
                Untuk keadaan darurat, hubungi langsung nomor di bawah. Pos satpam berjaga
                24 jam dan dapat menghubungkan Anda ke pengurus.
              </p>
            </div>
          </Card>
          <div className="space-y-2.5">
            {(content?.emergency ?? []).map((e) => (
              <a key={e.label} href={`tel:${e.phone}`}>
                <Card hover padded={false}>
                  <div className="flex items-center gap-3.5 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-bad-100 text-bad-600">
                      <Phone size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-wine-900">{e.label}</p>
                      <p className="tabular text-[13px] text-ink-500">{e.phone}</p>
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceReport({ actor }: { actor: { id: string; role: never | string; status: string } }) {
  // Residents see published entries only — the repository enforces that.
  const a = actor as Parameters<typeof ledger.list>[0];
  const entries = ledger.list(a);
  const { income, expense, balance } = ledger.balance(a);
  const monthly = ledger.monthly(a, 6);
  const peak = Math.max(1, ...monthly.map((m) => Math.max(m.income, m.expense)));

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              Saldo kas RW
            </p>
            <p className="tabular mt-1.5 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-none text-wine-700">
              {idr(balance)}
            </p>
          </div>
          <Wallet size={28} className="shrink-0 text-wine-700 opacity-20" />
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-cream-300 pt-3.5">
          <div>
            <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
              <TrendingUp size={12} className="text-ok-600" />Pemasukan
            </p>
            <p className="tabular mt-1 text-[16px] font-semibold text-ok-600">{idr(income)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
              <TrendingDown size={12} className="text-bad-600" />Pengeluaran
            </p>
            <p className="tabular mt-1 text-[16px] font-semibold text-bad-600">{idr(expense)}</p>
          </div>
        </div>
      </Card>

      {/* Six-month bar pair. Bars are labelled and share one scale, so the
          comparison between months is honest. */}
      <Card>
        <h3 className="mb-4 text-[14.5px] text-wine-900">Enam bulan terakhir</h3>
        <div className="flex items-end justify-between gap-2" style={{ height: 132 }}>
          {monthly.map((m) => (
            <div key={m.period} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-end justify-center gap-1" style={{ height: 100 }}>
                <div
                  className="w-full max-w-[14px] rounded-t-[3px] bg-ok-600 transition-all"
                  style={{ height: `${Math.max(2, (m.income / peak) * 100)}%` }}
                  title={`Masuk ${idr(m.income)}`}
                />
                <div
                  className="w-full max-w-[14px] rounded-t-[3px] bg-bad-600/75 transition-all"
                  style={{ height: `${Math.max(2, (m.expense / peak) * 100)}%` }}
                  title={`Keluar ${idr(m.expense)}`}
                />
              </div>
              <span className="text-[9.5px] text-ink-400">
                {formatPeriodID(m.period).split(' ')[0]?.slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-4 border-t border-cream-300 pt-3 text-[11.5px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-ok-600" />
            <span className="text-ink-500">Pemasukan</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-bad-600/75" />
            <span className="text-ink-500">Pengeluaran</span>
          </span>
        </div>
      </Card>

      <div>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Rincian transaksi
        </h3>
        {entries.length === 0 ? (
          <Card padded={false}>
            <EmptyState icon={<Wallet size={22} />} title="Belum ada transaksi" />
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 40).map((e) => (
              <Card key={e.id} padded={false}>
                <div className="flex items-center gap-3 p-3.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${
                      e.kind === 'income' ? 'bg-ok-100 text-ok-600' : 'bg-bad-100 text-bad-600'
                    }`}
                  >
                    {e.kind === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink-900">{e.description}</p>
                    <p className="text-[11.5px] text-ink-400">
                      {e.category} · {formatDateID(e.date, { short: true })}
                    </p>
                  </div>
                  <span
                    className="tabular shrink-0 text-[13.5px] font-semibold"
                    style={{ color: e.kind === 'income' ? 'var(--color-ok-600)' : 'var(--color-bad-600)' }}
                  >
                    {e.kind === 'income' ? '+' : '−'}{idr(e.amount, { compact: true })}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
