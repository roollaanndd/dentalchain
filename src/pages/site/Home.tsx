import { Link } from 'react-router-dom';
import {
  ArrowRight, Armchair, CalendarDays, Wallet, MessageSquareWarning,
  ShieldCheck, Users, Sparkles, Building2, Clock, ChevronRight,
} from 'lucide-react';
import {
  Badge, Button, Card, Logo, SectionTitle, useReveal, Wordmark,
} from '../../components/ui';
import { announcements, equipment, events, facilities, site } from '../../db';
import { formatDateID, relativeID } from '../../lib/date';
import { idr } from '../../lib/format';

const MODULES = [
  {
    icon: Armchair,
    title: 'Peminjaman Inventaris',
    body: 'Kursi, tenda, sound system, AC portable, dan puluhan barang lain milik RW. Cek ketersediaan per tanggal, ajukan, ambil di pos RW.',
    to: '/inventaris',
  },
  {
    icon: Building2,
    title: 'Pemesanan Fasilitas',
    body: 'Balai warga, lapangan serbaguna, dan musholla. Jadwal yang sudah terpakai otomatis tertutup, jadi tidak pernah bentrok.',
    to: '/fasilitas',
  },
  {
    icon: Wallet,
    title: 'Iuran & Transparansi',
    body: 'Tagihan IPL bulanan, unggah bukti bayar, dan laporan kas RW yang dapat dilihat setiap warga.',
    to: '/app/iuran',
  },
  {
    icon: MessageSquareWarning,
    title: 'Lapor Warga',
    body: 'Lampu jalan mati, sampah menumpuk, saluran tersumbat. Setiap laporan bernomor dan bisa dipantau sampai selesai.',
    to: '/app/lapor',
  },
  {
    icon: CalendarDays,
    title: 'Agenda Kegiatan',
    body: 'Kerja bakti, rapat warga, posyandu, dan perayaan. Konfirmasi kehadiran langsung dari ponsel.',
    to: '/informasi',
  },
  {
    icon: ShieldCheck,
    title: 'Tamu & Keamanan',
    body: 'Daftarkan tamu sebelum datang, dapatkan kode masuk, dan satpam mencatat kedatangan di pos jaga.',
    to: '/app/tamu',
  },
];

export default function Home() {
  const ref = useReveal<HTMLDivElement>();
  const content = site.get();
  const news = announcements.list({ publishedOnly: true }).slice(0, 3);
  const upcoming = events.list({ publishedOnly: true, upcomingOnly: true }).slice(0, 3);
  const items = equipment.list({ activeOnly: true });
  const facs = facilities.list({ activeOnly: true });
  const totalUnits = items.reduce((s, e) => s + e.total_qty, 0);

  return (
    <div ref={ref}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="grain relative overflow-hidden bg-wine-900">
        {/* Arch silhouettes — the architectural motif, at scale. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-16 h-[420px] w-[420px] rounded-full opacity-[0.13]"
               style={{ background: 'radial-gradient(circle at 30% 30%, var(--color-brass-400), transparent 62%)' }} />
          <div className="absolute -bottom-40 -left-20 h-[380px] w-[380px] rounded-full opacity-[0.10]"
               style={{ background: 'radial-gradient(circle at 50% 50%, var(--color-wine-400), transparent 65%)' }} />
          <svg className="absolute bottom-0 right-[6%] hidden h-[300px] w-[220px] opacity-[0.07] lg:block"
               viewBox="0 0 220 300" fill="none" aria-hidden="true">
            <path d="M10 300V110a100 100 0 0 1 200 0v190" stroke="var(--color-brass-300)" strokeWidth="2" />
            <path d="M55 300V125a55 55 0 0 1 110 0v175" stroke="var(--color-brass-300)" strokeWidth="2" />
            <path d="M97 300V150a13 13 0 0 1 26 0v150" stroke="var(--color-brass-300)" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.15fr_1fr] lg:py-28">
          <div>
            <div data-reveal className="mb-6 inline-flex items-center gap-2 rounded-full border border-brass-300/25 bg-brass-300/10 px-3.5 py-1.5">
              <Sparkles size={13} className="text-brass-300" />
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-300">
                {content?.hero.eyebrow ?? 'Cluster Hunian · RW 012'}
              </span>
            </div>

            <h1
              data-reveal
              data-reveal-delay="80"
              className="text-[clamp(2.3rem,6vw,4rem)] leading-[1.06] text-cream-100"
            >
              {content?.hero.title ?? 'Lingkungan yang dirawat bersama'}
            </h1>

            <p
              data-reveal
              data-reveal-delay="160"
              className="mt-6 max-w-xl text-[16px] leading-relaxed text-cream-100/70"
            >
              {content?.hero.subtitle}
            </p>

            <div data-reveal data-reveal-delay="240" className="mt-9 flex flex-wrap gap-3">
              <Link to="/app">
                <Button variant="brass" size="lg" icon={<ArrowRight size={17} />}>
                  {content?.hero.cta_label ?? 'Masuk Portal Warga'}
                </Button>
              </Link>
              <Link to="/inventaris">
                <Button
                  size="lg"
                  className="border border-cream-100/25 bg-cream-100/8 text-cream-100 hover:bg-cream-100/15"
                >
                  Lihat Inventaris RW
                </Button>
              </Link>
            </div>

            {/* Trust bar */}
            <div
              data-reveal
              data-reveal-delay="320"
              className="mt-12 grid max-w-lg grid-cols-2 gap-x-8 gap-y-5 border-t border-cream-100/12 pt-7 sm:grid-cols-4"
            >
              {(content?.about.stats ?? []).map((s) => (
                <div key={s.label}>
                  <div className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none text-brass-300">
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-[11.5px] leading-tight text-cream-100/55">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating card — the "at a glance" panel */}
          <div data-reveal data-reveal-delay="200" className="relative hidden justify-self-center lg:block">
            <div
              className="relative overflow-hidden border border-cream-100/12 bg-cream-100/[0.07] p-7 backdrop-blur-sm"
              style={{ width: 'min(100%, 384px)', borderRadius: '192px 192px 24px 24px' }}
            >
              <div className="mb-6 flex justify-center pt-2">
                <Logo size={46} />
              </div>
              <div className="space-y-4">
                <PanelRow
                  icon={<Armchair size={16} />}
                  label="Inventaris tersedia"
                  value={`${totalUnits} unit`}
                  sub={`${items.length} jenis barang`}
                />
                <PanelRow
                  icon={<Building2 size={16} />}
                  label="Fasilitas bersama"
                  value={`${facs.length} tempat`}
                  sub="Dapat dipesan warga"
                />
                <PanelRow
                  icon={<CalendarDays size={16} />}
                  label="Agenda mendatang"
                  value={`${upcoming.length} kegiatan`}
                  sub={upcoming[0] ? upcoming[0].title : 'Belum ada jadwal'}
                />
                <PanelRow
                  icon={<Users size={16} />}
                  label="Kepala keluarga"
                  value={content?.about.stats?.[0]?.value ?? '40'}
                  sub="Terdaftar di RW 012"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom edge — a soft arch that hands off to the cream page */}
        <svg
          className="relative z-10 block w-full"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          style={{ height: 48 }}
          aria-hidden="true"
        >
          <path d="M0 60V32c240-24 480-32 720-32s480 8 720 32v28z" fill="var(--color-cream-100)" />
        </svg>
      </section>

      {/* ── What the portal does ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div data-reveal>
          <SectionTitle
            eyebrow="Satu Portal"
            title="Semua urusan warga, di satu tempat"
            subtitle="Enam layanan yang sehari-hari dipakai warga dan pengurus — dirancang supaya cukup dibuka dari ponsel."
            align="center"
          />
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <Link key={m.title} to={m.to} data-reveal data-reveal-delay={i * 60}>
              <Card hover className="group h-full">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-wine-100 text-wine-700 transition-colors group-hover:bg-wine-700 group-hover:text-cream-50">
                  <m.icon size={20} />
                </div>
                <h3 className="text-[17px] text-wine-900">{m.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{m.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brass-500">
                  Selengkapnya
                  <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Equipment strip ──────────────────────────────────────────── */}
      <section className="border-y border-cream-300 bg-cream-200/45 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-5">
            <SectionTitle
              eyebrow="Inventaris RW"
              title="Dipinjamkan gratis untuk warga"
              subtitle="Sebagian besar barang tanpa biaya. Barang bernilai tinggi dikenakan deposit yang dikembalikan penuh."
            />
            <Link to="/inventaris">
              <Button variant="secondary" icon={<ArrowRight size={15} />}>Lihat semua</Button>
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.slice(0, 4).map((e, i) => (
              <Card key={e.id} hover data-reveal className="h-full" >
                <div data-reveal data-reveal-delay={i * 60}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Badge tone="wine">{e.category}</Badge>
                    <span className="tabular text-[12px] font-semibold text-ink-400">
                      {e.total_qty} {e.unit}
                    </span>
                  </div>
                  <h3 className="text-[15.5px] leading-snug text-wine-900">{e.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">
                    {e.description}
                  </p>
                  <div className="mt-3.5 border-t border-cream-300 pt-3 text-[12px]">
                    {e.deposit > 0 ? (
                      <span className="text-ink-500">
                        Deposit <span className="font-semibold text-wine-700">{idr(e.deposit, { compact: true })}</span>
                      </span>
                    ) : (
                      <span className="font-semibold text-ok-600">Tanpa deposit</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── News + agenda ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div data-reveal>
              <SectionTitle eyebrow="Pengumuman" title="Kabar terbaru dari pengurus" />
            </div>
            <div className="mt-8 space-y-4">
              {news.length === 0 && (
                <p className="text-[14px] text-ink-400">Belum ada pengumuman.</p>
              )}
              {news.map((a, i) => (
                <Card key={a.id} hover data-reveal>
                  <div data-reveal data-reveal-delay={i * 70}>
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <Badge tone={a.pinned ? 'brass' : 'wine'}>{a.category}</Badge>
                      {a.pinned && <Badge tone="warn" dot>Penting</Badge>}
                      <span className="text-[11.5px] text-ink-400">
                        {relativeID(a.published_at ?? a.created_at)}
                      </span>
                    </div>
                    <h3 className="text-[17px] leading-snug text-wine-900">{a.title}</h3>
                    <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-ink-500">
                      {a.body}
                    </p>
                  </div>
                </Card>
              ))}
              <Link to="/informasi" className="inline-block pt-1">
                <Button variant="ghost" icon={<ArrowRight size={15} />}>Semua pengumuman</Button>
              </Link>
            </div>
          </div>

          <div>
            <div data-reveal>
              <SectionTitle eyebrow="Agenda" title="Kegiatan mendatang" />
            </div>
            <div className="mt-8 space-y-3">
              {upcoming.length === 0 && (
                <p className="text-[14px] text-ink-400">Belum ada agenda terjadwal.</p>
              )}
              {upcoming.map((ev, i) => (
                <Card key={ev.id} hover padded={false} data-reveal>
                  <div data-reveal data-reveal-delay={i * 70} className="flex gap-4 p-4">
                    <div className="arch-sm flex h-[58px] w-[52px] shrink-0 flex-col items-center justify-center bg-wine-700 pt-1 text-cream-50">
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-75">
                        {formatDateID(ev.date, { short: true }).split(' ')[1]}
                      </span>
                      <span className="font-[family-name:var(--font-display)] text-[20px] font-semibold leading-none">
                        {formatDateID(ev.date).split(' ')[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14.5px] leading-snug text-wine-900">{ev.title}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-500">
                        <Clock size={12} />
                        {ev.start_time}
                        {ev.end_time ? `–${ev.end_time}` : ''} · {ev.location}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-4">
        <div
          data-reveal
          className="grain relative overflow-hidden rounded-[28px] bg-wine-800 px-8 py-14 text-center"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{ background: 'radial-gradient(circle at 50% 0%, var(--color-brass-400), transparent 60%)' }}
          />
          <div className="relative z-10 mx-auto max-w-xl">
            <div className="mb-5 flex justify-center">
              <Wordmark invert />
            </div>
            <h2 className="text-[clamp(1.5rem,3.5vw,2.2rem)] text-cream-100">
              Sudah tinggal di sini? Aktifkan akun Anda
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-cream-100/65">
              Daftar sekali, verifikasi oleh pengurus RT/RW, lalu semua layanan warga
              terbuka dari ponsel Anda.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/app">
                <Button variant="brass" size="lg" icon={<ArrowRight size={17} />}>
                  Masuk atau Daftar
                </Button>
              </Link>
              <Link to="/kontak">
                <Button
                  size="lg"
                  className="border border-cream-100/25 bg-transparent text-cream-100 hover:bg-cream-100/12"
                >
                  Hubungi Pengurus
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PanelRow({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-cream-100/10 pb-4 last:border-0 last:pb-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brass-300/15 text-brass-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11.5px] text-cream-100/50">{label}</div>
        <div className="truncate text-[13.5px] font-semibold text-cream-100">{value}</div>
        <div className="truncate text-[11px] text-cream-100/40">{sub}</div>
      </div>
    </div>
  );
}
