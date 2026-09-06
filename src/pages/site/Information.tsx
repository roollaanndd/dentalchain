import { useState } from 'react';
import { CalendarDays, ChevronDown, Megaphone, MapPin, Clock } from 'lucide-react';
import { Badge, Card, EmptyState, Segmented, useReveal } from '../../components/ui';
import { PageHero } from './About';
import { announcements, events, site } from '../../db';
import { formatDateID, relativeID } from '../../lib/date';
import { cn } from '../../lib/cn';

type View = 'pengumuman' | 'agenda' | 'faq';

export default function Information() {
  const ref = useReveal<HTMLDivElement>();
  const [view, setView] = useState<View>('pengumuman');
  const content = site.get();

  const news = announcements.list({ publishedOnly: true });
  const agenda = events.list({ publishedOnly: true, upcomingOnly: true });
  const faq = content?.faq ?? [];

  return (
    <div ref={ref}>
      <PageHero
        eyebrow="Informasi"
        title="Pengumuman, agenda, dan tanya jawab"
        subtitle="Semua kabar resmi dari pengurus RW 012, terbuka untuk siapa saja."
      />

      <section className="mx-auto max-w-4xl px-5 py-12">
        <div data-reveal className="mb-8">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'pengumuman', label: 'Pengumuman', count: news.length },
              { value: 'agenda', label: 'Agenda', count: agenda.length },
              { value: 'faq', label: 'Tanya Jawab', count: faq.length },
            ]}
          />
        </div>

        {view === 'pengumuman' && (
          <div className="space-y-4">
            {news.length === 0 && (
              <Card padded={false}>
                <EmptyState icon={<Megaphone size={24} />} title="Belum ada pengumuman" />
              </Card>
            )}
            {news.map((a, i) => (
              <div key={a.id} data-reveal data-reveal-delay={Math.min(i, 6) * 60}>
                <Card>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone={a.pinned ? 'brass' : 'wine'}>{a.category}</Badge>
                    {a.pinned && <Badge tone="warn" dot>Penting</Badge>}
                    <span className="text-[11.5px] text-ink-400">
                      {relativeID(a.published_at ?? a.created_at)}
                    </span>
                  </div>
                  <h2 className="text-[19px] leading-snug text-wine-900">{a.title}</h2>
                  <div className="mt-3 space-y-3">
                    {a.body.split('\n\n').map((p, k) => (
                      <p key={k} className="text-[14px] leading-[1.72] text-ink-700">{p}</p>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {view === 'agenda' && (
          <div className="space-y-3">
            {agenda.length === 0 && (
              <Card padded={false}>
                <EmptyState icon={<CalendarDays size={24} />} title="Belum ada agenda mendatang" />
              </Card>
            )}
            {agenda.map((ev, i) => (
              <div key={ev.id} data-reveal data-reveal-delay={Math.min(i, 6) * 60}>
                <Card padded={false}>
                  <div className="flex gap-4 p-5">
                    <div className="arch-sm flex h-[68px] w-[60px] shrink-0 flex-col items-center justify-center bg-wine-700 pt-1 text-cream-50">
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-75">
                        {formatDateID(ev.date, { short: true }).split(' ')[1]}
                      </span>
                      <span className="font-[family-name:var(--font-display)] text-[24px] font-semibold leading-none">
                        {formatDateID(ev.date).split(' ')[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Badge tone="sage" className="mb-2">{ev.category.replace('_', ' ')}</Badge>
                      <h2 className="text-[17px] leading-snug text-wine-900">{ev.title}</h2>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">{ev.description}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-500">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin size={12} />{ev.location}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {view === 'faq' && (
          <div className="space-y-2.5">
            {faq.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} index={i} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-reveal data-reveal-delay={Math.min(index, 6) * 50}>
      <Card padded={false} className="overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-cream-200/50"
        >
          <span className="text-[14.5px] font-medium text-wine-900">{q}</span>
          <ChevronDown
            size={17}
            className={cn('shrink-0 text-brass-500 transition-transform duration-300', open && 'rotate-180')}
          />
        </button>
        {open && (
          <p className="border-t border-cream-300 px-5 py-4 text-[13.5px] leading-[1.72] text-ink-700">
            {a}
          </p>
        )}
      </Card>
    </div>
  );
}
