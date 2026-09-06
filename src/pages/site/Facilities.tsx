import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Users, Wallet, Building2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, SectionTitle, useReveal } from '../../components/ui';
import { PageHero } from './About';
import { facilities, site } from '../../db';
import { idr } from '../../lib/format';

export default function Facilities() {
  const ref = useReveal<HTMLDivElement>();
  const content = site.get();
  const items = facilities.list({ activeOnly: true });

  return (
    <div ref={ref}>
      <PageHero
        eyebrow="Fasilitas Umum"
        title={content?.facilities_intro.title ?? 'Fasilitas Bersama'}
        subtitle={content?.facilities_intro.body}
      />

      <section className="mx-auto max-w-6xl px-5 py-14">
        {items.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon={<Building2 size={24} />}
              title="Belum ada fasilitas terdaftar"
              message="Pengurus belum menambahkan data fasilitas ke portal."
            />
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((f, i) => (
              <div key={f.id} data-reveal data-reveal-delay={i * 70}>
                <Card hover className="flex h-full flex-col overflow-hidden" padded={false}>
                  {/* Arched header block, in place of a photo */}
                  <div className="grain relative flex h-[110px] items-end overflow-hidden bg-wine-800 px-5 pb-4">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-20"
                      style={{ background: 'radial-gradient(circle at 80% 10%, var(--color-brass-400), transparent 60%)' }}
                    />
                    <svg
                      aria-hidden="true"
                      className="absolute -right-4 -top-6 h-[150px] w-[110px] opacity-[0.13]"
                      viewBox="0 0 110 150" fill="none"
                    >
                      <path d="M5 150V55a50 50 0 0 1 100 0v95" stroke="var(--color-brass-300)" strokeWidth="2" />
                      <path d="M32 150V70a23 23 0 0 1 46 0v80" stroke="var(--color-brass-300)" strokeWidth="2" />
                    </svg>
                    <h3 className="relative z-10 text-[20px] text-cream-100">{f.name}</h3>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="flex-1 text-[13.5px] leading-relaxed text-ink-500">{f.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="wine" className="gap-1.5">
                        <Users size={11} /> {f.capacity} orang
                      </Badge>
                      <Badge tone="neutral" className="gap-1.5">
                        <Clock size={11} /> {f.open_time}–{f.close_time}
                      </Badge>
                      <Badge tone={f.fee_per_session > 0 ? 'brass' : 'ok'} className="gap-1.5">
                        <Wallet size={11} />
                        {f.fee_per_session > 0 ? idr(f.fee_per_session) : 'Gratis'}
                      </Badge>
                    </div>

                    <Link to="/app/fasilitas" className="mt-5">
                      <Button variant="secondary" block icon={<ArrowRight size={15} />}>
                        Pesan fasilitas ini
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        <div data-reveal className="mt-14">
          <Card className="border-brass-200 bg-brass-100/45">
            <SectionTitle
              eyebrow="Ketentuan"
              title="Aturan pemakaian fasilitas"
            />
            <ul className="mt-5 grid gap-3 text-[13.5px] leading-relaxed text-ink-700 sm:grid-cols-2">
              {[
                'Pemesanan diajukan minimal 2 hari sebelum pemakaian melalui Portal Warga.',
                'Jadwal yang telah dipesan warga lain otomatis tertutup — sistem menolak jadwal bentrok.',
                'Kebersihan setelah pemakaian menjadi tanggung jawab pemesan.',
                'Kerusakan yang timbul selama pemakaian ditanggung pemesan.',
                'Kegiatan yang menimbulkan kebisingan dibatasi sampai pukul 22.00.',
                'Pembatalan mohon disampaikan paling lambat 1 hari sebelumnya.',
              ].map((rule, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass-500" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
