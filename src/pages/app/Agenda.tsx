import { CalendarDays, MapPin, Clock, Users, Check, X, HelpCircle } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { useApp, useAction } from '../../context/AppContext';
import { events, type CommunityEvent } from '../../db';
import { formatDateID } from '../../lib/date';

const CATEGORY_LABEL: Record<CommunityEvent['category'], string> = {
  kerja_bakti: 'Kerja Bakti', rapat: 'Rapat', perayaan: 'Perayaan',
  olahraga: 'Olahraga', posyandu: 'Posyandu', keagamaan: 'Keagamaan', lainnya: 'Lainnya',
};

export default function Agenda() {
  const { profile } = useApp();
  const run = useAction();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const list = events.list({ publishedOnly: true, upcomingOnly: true });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] text-wine-900">Agenda Kegiatan</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
          Konfirmasi kehadiran Anda agar pengurus dapat menyiapkan konsumsi dan tempat.
        </p>
      </div>

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<CalendarDays size={22} />} title="Belum ada agenda mendatang" />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((ev) => {
            const rsvps = events.rsvps(ev.id);
            const mine = events.myRsvp(actor, ev.id);
            const going = rsvps.filter((r) => r.status === 'going')
              .reduce((s, r) => s + 1 + r.guests, 0);
            const full = ev.capacity !== null && going >= ev.capacity && mine?.status !== 'going';

            return (
              <Card key={ev.id}>
                <div className="flex gap-4">
                  <div className="arch-sm flex h-[62px] w-[54px] shrink-0 flex-col items-center justify-center bg-wine-700 pt-1 text-cream-50">
                    <span className="text-[9.5px] font-medium uppercase tracking-wide opacity-75">
                      {formatDateID(ev.date, { short: true }).split(' ')[1]}
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-[22px] font-semibold leading-none">
                      {formatDateID(ev.date).split(' ')[0]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge tone="sage" className="mb-1.5">{CATEGORY_LABEL[ev.category]}</Badge>
                    <h2 className="text-[16.5px] leading-snug text-wine-900">{ev.title}</h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{ev.description}</p>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-500">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} />{ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}
                      </span>
                      <span className="flex items-center gap-1.5"><MapPin size={12} />{ev.location}</span>
                      {ev.rsvp_enabled && (
                        <span className="flex items-center gap-1.5">
                          <Users size={12} />
                          {going} hadir{ev.capacity ? ` / ${ev.capacity}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {ev.rsvp_enabled && (
                  <div className="mt-4 border-t border-cream-300 pt-3.5">
                    <p className="mb-2.5 text-[12.5px] font-medium text-ink-700">
                      {mine ? 'Konfirmasi Anda:' : 'Apakah Anda hadir?'}
                    </p>
                    <div className="flex gap-2">
                      {([
                        ['going', 'Hadir', Check],
                        ['maybe', 'Mungkin', HelpCircle],
                        ['not_going', 'Tidak', X],
                      ] as const).map(([status, label, Icon]) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={mine?.status === status ? 'primary' : 'secondary'}
                          icon={<Icon size={13} />}
                          disabled={status === 'going' && full}
                          onClick={() => run(
                            () => events.rsvp(actor, ev.id, status),
                            status === 'going' ? 'Kehadiran dikonfirmasi.' : 'Konfirmasi diperbarui.',
                          )}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    {full && (
                      <p className="mt-2 text-[12px] text-warn-600">
                        Kuota kegiatan ini sudah penuh.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
