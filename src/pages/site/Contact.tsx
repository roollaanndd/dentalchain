import { Phone, MapPin, Clock, MessageCircle, ExternalLink, ShieldAlert } from 'lucide-react';
import { Button, Card, SectionTitle, useReveal } from '../../components/ui';
import { PageHero } from './About';
import { site } from '../../db';
import { waNumber } from '../../lib/format';

export default function Contact() {
  const ref = useReveal<HTMLDivElement>();
  const content = site.get();
  const c = content?.contact;

  return (
    <div ref={ref}>
      <PageHero
        eyebrow="Kontak"
        title="Hubungi Sekretariat RW"
        subtitle="Untuk pertanyaan administrasi, keluhan lingkungan, atau keperluan surat pengantar."
      />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div data-reveal className="space-y-4">
            {c?.address && (
              <ContactCard icon={<MapPin size={19} />} title="Alamat Sekretariat">
                <p className="text-[13.5px] leading-relaxed text-ink-700">{c.address}</p>
                {c.maps_url && (
                  <a href={c.maps_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
                    <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}>
                      Buka di Peta
                    </Button>
                  </a>
                )}
              </ContactCard>
            )}

            <ContactCard icon={<Phone size={19} />} title="Telepon & Email">
              <ul className="space-y-2.5 text-[13.5px]">
                {c?.phone && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-ink-500">Telepon</span>
                    <a href={`tel:${c.phone}`} className="tabular font-semibold text-wine-700 hover:underline">
                      {c.phone}
                    </a>
                  </li>
                )}
                {c?.email && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-ink-500">Email</span>
                    <a href={`mailto:${c.email}`} className="font-semibold text-wine-700 hover:underline">
                      {c.email}
                    </a>
                  </li>
                )}
              </ul>
              {c?.whatsapp && (
                <a
                  href={`https://wa.me/${waNumber(c.whatsapp)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-4 block"
                >
                  <Button block icon={<MessageCircle size={15} />}>Chat WhatsApp Pengurus</Button>
                </a>
              )}
            </ContactCard>

            {c?.office_hours && (
              <ContactCard icon={<Clock size={19} />} title="Jam Layanan">
                <p className="text-[13.5px] leading-relaxed text-ink-700">{c.office_hours}</p>
                <p className="mt-2 text-[12.5px] text-ink-400">
                  Di luar jam tersebut, keperluan mendesak dapat disampaikan ke pos satpam yang
                  berjaga 24 jam.
                </p>
              </ContactCard>
            )}
          </div>

          <div data-reveal data-reveal-delay="100">
            <Card className="grain relative h-full overflow-hidden bg-wine-900">
              <div className="relative z-10">
                <div className="mb-5 flex items-center gap-2.5">
                  <ShieldAlert size={20} className="text-brass-300" />
                  <h2 className="text-[19px] text-cream-100">Nomor Darurat</h2>
                </div>
                <p className="mb-6 text-[13px] leading-relaxed text-cream-100/60">
                  Untuk keadaan mendesak, hubungi langsung nomor di bawah ini. Pos satpam
                  berjaga 24 jam dan dapat menghubungkan Anda ke pengurus.
                </p>
                <ul className="space-y-2">
                  {(content?.emergency ?? []).map((e) => (
                    <li key={e.label}>
                      <a
                        href={`tel:${e.phone}`}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-btn)] border border-cream-100/10 bg-cream-100/[0.06] px-4 py-3 transition-colors hover:bg-cream-100/12"
                      >
                        <span className="text-[13.5px] font-medium text-cream-100">{e.label}</span>
                        <span className="tabular flex items-center gap-1.5 text-[13.5px] font-semibold text-brass-300">
                          <Phone size={12} />{e.phone}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </div>

        <div data-reveal className="mt-14">
          <SectionTitle
            eyebrow="Punya keluhan lingkungan?"
            title="Gunakan menu Lapor di Portal Warga"
            subtitle="Laporan yang masuk lewat portal mendapat nomor tiket dan dapat Anda pantau statusnya sampai selesai — lebih terlacak daripada pesan WhatsApp yang mudah tenggelam."
          />
        </div>
      </section>
    </div>
  );
}

function ContactCard({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-3.5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-wine-100 text-wine-700">
          {icon}
        </span>
        <h2 className="text-[16.5px] text-wine-900">{title}</h2>
      </div>
      {children}
    </Card>
  );
}
