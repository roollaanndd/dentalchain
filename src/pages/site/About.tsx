import { Link } from 'react-router-dom';
import { ArrowRight, Phone, ShieldCheck, Heart, Recycle, HandHeart } from 'lucide-react';
import { Avatar, Badge, Button, Card, Rule, SectionTitle, useReveal } from '../../components/ui';
import { site } from '../../db';
import { waNumber } from '../../lib/format';

const VALUES = [
  {
    icon: HandHeart,
    title: 'Gotong Royong',
    body: 'Kerja bakti bulanan, saling bantu saat ada hajatan atau musibah. Inventaris RW ada supaya warga tidak perlu menyewa.',
  },
  {
    icon: ShieldCheck,
    title: 'Aman Bersama',
    body: 'Keamanan 24 jam dengan tiga petugas bergiliran, gerbang terkontrol, dan pencatatan tamu yang tertib.',
  },
  {
    icon: Recycle,
    title: 'Lingkungan Terjaga',
    body: 'Pengangkutan sampah rutin, perawatan taman dan saluran air, serta penghijauan di sepanjang jalan cluster.',
  },
  {
    icon: Heart,
    title: 'Terbuka & Transparan',
    body: 'Laporan kas RW dapat dilihat setiap warga kapan saja, lengkap dengan rincian pemasukan dan pengeluaran.',
  },
];

export default function About() {
  const ref = useReveal<HTMLDivElement>();
  const content = site.get();

  return (
    <div ref={ref}>
      <PageHero
        eyebrow="Tentang Kami"
        title={content?.about.title ?? 'Tentang Burgundy Residences'}
        subtitle={content?.brand.tagline}
      />

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div data-reveal>
            {(content?.about.body ?? '').split('\n\n').map((para, i) => (
              <p key={i} className="mb-5 text-[15.5px] leading-[1.75] text-ink-700 last:mb-0">
                {para}
              </p>
            ))}

            <Rule />

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {(content?.about.stats ?? []).map((s) => (
                <div key={s.label}>
                  <div className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-none text-wine-700">
                    {s.value}
                  </div>
                  <div className="mt-2 text-[12px] leading-tight text-ink-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal data-reveal-delay="120">
            <Card className="bg-wine-900 text-cream-100">
              <h3 className="text-[17px] text-cream-100">Nomor Penting</h3>
              <p className="mt-1.5 text-[12.5px] text-cream-100/55">
                Simpan nomor ini. Dapat dihubungi kapan saja bila terjadi keadaan darurat.
              </p>
              <ul className="mt-5 space-y-2.5">
                {(content?.emergency ?? []).map((e) => (
                  <li key={e.label} className="flex items-center justify-between gap-3 border-b border-cream-100/10 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-[13px] text-cream-100/75">{e.label}</span>
                    <a
                      href={`tel:${e.phone}`}
                      className="tabular flex items-center gap-1.5 text-[13px] font-semibold text-brass-300 transition-opacity hover:opacity-80"
                    >
                      <Phone size={12} />
                      {e.phone}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-cream-300 bg-cream-200/45 py-18">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div data-reveal>
            <SectionTitle
              eyebrow="Prinsip"
              title="Yang kami jaga bersama"
              align="center"
            />
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <div key={v.title} data-reveal data-reveal-delay={i * 70}>
                <Card className="h-full">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-brass-100 text-brass-500">
                    <v.icon size={20} />
                  </div>
                  <h3 className="text-[16px] text-wine-900">{v.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{v.body}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Officers */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div data-reveal>
          <SectionTitle
            eyebrow="Kepengurusan"
            title="Pengurus RW 012"
            subtitle="Warga yang dipercaya menjalankan roda organisasi lingkungan. Silakan hubungi sesuai bidangnya."
            align="center"
          />
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(content?.officers ?? []).map((o, i) => (
            <div key={o.name} data-reveal data-reveal-delay={i * 60}>
              <Card hover className="h-full">
                <div className="flex items-center gap-4">
                  <Avatar name={o.name} url={o.photo_url} size={52} />
                  <div className="min-w-0">
                    <h3 className="truncate text-[15.5px] leading-snug text-wine-900">{o.name}</h3>
                    <Badge tone="brass" className="mt-1.5">{o.position}</Badge>
                  </div>
                </div>
                {o.phone && (
                  <div className="mt-4 flex gap-2 border-t border-cream-300 pt-3.5">
                    <a href={`tel:${o.phone}`} className="flex-1">
                      <Button variant="secondary" size="sm" block icon={<Phone size={13} />}>
                        Telepon
                      </Button>
                    </a>
                    <a
                      href={`https://wa.me/${waNumber(o.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="ghost" size="sm" block>WhatsApp</Button>
                    </a>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>

        <div data-reveal className="mt-14 text-center">
          <Link to="/kontak">
            <Button size="lg" icon={<ArrowRight size={17} />}>Hubungi Sekretariat</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Shared page header for every inner site page. */
export function PageHero({
  eyebrow, title, subtitle,
}: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <section className="grain relative overflow-hidden bg-wine-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ background: 'radial-gradient(circle at 78% 20%, var(--color-brass-400), transparent 58%)' }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-14">
        <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-300">
          {eyebrow}
        </div>
        <h1 className="max-w-3xl text-[clamp(2rem,5vw,3.1rem)] leading-[1.08] text-cream-100">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-cream-100/65">{subtitle}</p>
        )}
      </div>
      <svg
        className="relative z-10 block w-full"
        viewBox="0 0 1440 40"
        preserveAspectRatio="none"
        style={{ height: 32 }}
        aria-hidden="true"
      >
        <path d="M0 40V20c240-16 480-20 720-20s480 4 720 20v20z" fill="var(--color-cream-100)" />
      </svg>
    </section>
  );
}
