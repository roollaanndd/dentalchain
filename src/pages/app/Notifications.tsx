import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { notifications } from '../../db';
import { relativeID } from '../../lib/date';
import { cn } from '../../lib/cn';

const KIND_TONE = {
  booking: 'wine', dues: 'brass', complaint: 'warn',
  announcement: 'info', event: 'sage', guest: 'info', system: 'neutral',
} as const;

export default function Notifications() {
  const { profile } = useApp();
  if (!profile) return null;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const list = notifications.mine(actor);
  const unread = notifications.unread(actor);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-wine-900">Notifikasi</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-500">
            {unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'}
          </p>
        </div>
        {unread > 0 && (
          <Button
            size="sm" variant="secondary" icon={<CheckCheck size={15} />}
            onClick={() => notifications.markAllRead(actor)}
          >
            Tandai dibaca
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Bell size={22} />}
            title="Belum ada notifikasi"
            message="Kabar tentang peminjaman, iuran, dan laporan Anda akan muncul di sini."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((n) => {
            const body = (
              <Card
                padded={false}
                hover={!!n.link}
                className={cn(!n.read && 'border-wine-200 bg-wine-50/50')}
              >
                <div className="flex gap-3 p-4">
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-wine-600" />
                  )}
                  <div className={cn('min-w-0 flex-1', n.read && 'pl-5')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-medium text-wine-900">{n.title}</h3>
                      <Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{n.body}</p>
                    <p className="mt-1.5 text-[11.5px] text-ink-400">{relativeID(n.created_at)}</p>
                  </div>
                </div>
              </Card>
            );

            return n.link ? (
              <Link key={n.id} to={n.link} onClick={() => notifications.markRead(actor, n.id)}>
                {body}
              </Link>
            ) : (
              <button
                key={n.id} type="button" className="block w-full text-left"
                onClick={() => notifications.markRead(actor, n.id)}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
