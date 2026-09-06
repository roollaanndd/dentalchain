import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Home, Armchair, Wallet, MessageSquareWarning, User, Bell, LogOut,
  Building2, CalendarDays, UserPlus, ShieldCheck, ChevronLeft, LayoutDashboard,
} from 'lucide-react';
import { Avatar, Badge, Button, Spinner, Wordmark } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { hasBackofficeAccess, notifications } from '../../db';
import { cn } from '../../lib/cn';

const SignIn = lazy(() => import('./SignIn'));
const Dashboard = lazy(() => import('./Dashboard'));
const Lending = lazy(() => import('./Lending'));
const FacilityBooking = lazy(() => import('./FacilityBooking'));
const Dues = lazy(() => import('./Dues'));
const Complaints = lazy(() => import('./Complaints'));
const Guests = lazy(() => import('./Guests'));
const Agenda = lazy(() => import('./Agenda'));
const Info = lazy(() => import('./Info'));
const Profile = lazy(() => import('./Profile'));
const Notifications = lazy(() => import('./Notifications'));

/** Bottom bar — the five things residents actually do. */
const TABS = [
  { to: '/app', icon: Home, label: 'Beranda', end: true },
  { to: '/app/pinjam', icon: Armchair, label: 'Pinjam' },
  { to: '/app/iuran', icon: Wallet, label: 'Iuran' },
  { to: '/app/lapor', icon: MessageSquareWarning, label: 'Lapor' },
  { to: '/app/profil', icon: User, label: 'Profil' },
];

/** Everything else lives in the dashboard grid and the header. */
export const MORE_LINKS = [
  { to: '/app/fasilitas', icon: Building2, label: 'Fasilitas' },
  { to: '/app/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/app/tamu', icon: UserPlus, label: 'Tamu' },
  { to: '/app/info', icon: ShieldCheck, label: 'Informasi' },
];

function Header() {
  const { profile, signOut } = useApp();
  const location = useLocation();
  const unread = profile
    ? notifications.unread({ id: profile.id, role: profile.role, status: profile.status })
    : 0;

  const isRoot = location.pathname === '/app' || location.pathname === '/app/';

  return (
    <header className="sticky top-0 z-30 border-b border-cream-300 bg-cream-100/92 backdrop-blur-md">
      <div className="h-[3px] bg-gradient-to-r from-wine-700 via-brass-500 to-wine-700" />
      <div className="mx-auto flex h-[58px] max-w-3xl items-center justify-between gap-3 px-4">
        {isRoot ? (
          <Link to="/"><Wordmark /></Link>
        ) : (
          <Link
            to="/app"
            className="-ml-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[14px] font-medium text-wine-800 transition-colors hover:bg-cream-200"
          >
            <ChevronLeft size={18} />
            Kembali
          </Link>
        )}

        <div className="flex items-center gap-1">
          {profile && hasBackofficeAccess(profile.role) && (
            <Link
              to="/admin"
              className="mr-1 hidden rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-wine-700 transition-colors hover:bg-cream-200 sm:flex sm:items-center sm:gap-1.5"
            >
              <LayoutDashboard size={14} />
              Konsol
            </Link>
          )}
          <Link
            to="/app/notifikasi"
            aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
            className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-cream-200 hover:text-wine-800"
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-bad-600 px-1 text-[9.5px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Keluar"
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-cream-200 hover:text-bad-600"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-300 bg-cream-100/95 backdrop-blur-md pb-safe">
      <div className="mx-auto flex max-w-3xl">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors',
                isActive ? 'text-wine-700' : 'text-ink-400',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-x-[30%] top-0 h-[2.5px] rounded-full bg-brass-500" />
                )}
                <t.icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
                <span className={cn('text-[10.5px]', isActive && 'font-semibold')}>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size={24} />
    </div>
  );
}

/** Signed-out and pending accounts never reach a data screen. */
function Guard({ children }: { children: React.ReactNode }) {
  const { profile } = useApp();
  const location = useLocation();

  if (!profile) {
    return <Navigate to="/app/masuk" replace state={{ from: location.pathname }} />;
  }
  if (profile.status !== 'active') {
    return <PendingNotice />;
  }
  return <>{children}</>;
}

function PendingNotice() {
  const { profile, signOut } = useApp();
  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-warn-100 text-warn-600">
        <ShieldCheck size={26} />
      </div>
      <h1 className="text-[22px] text-wine-900">Menunggu verifikasi pengurus</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-500">
        Akun <strong className="text-ink-700">{profile?.full_name}</strong> sudah terdaftar dan
        sedang menunggu verifikasi Ketua RT/RW bahwa Anda memang berdomisili di Burgundy
        Residences. Anda akan mendapat notifikasi begitu akun diaktifkan.
      </p>
      <div className="mt-7 flex flex-col gap-2">
        <Link to="/kontak"><Button block variant="secondary">Hubungi Pengurus</Button></Link>
        <Button block variant="ghost" onClick={signOut}>Keluar</Button>
      </div>
    </div>
  );
}

/** The greeting strip that opens the dashboard. */
export function ResidentGreeting() {
  const { profile } = useApp();
  const [greeting, setGreeting] = useState('Selamat datang');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam',
    );
  }, []);

  if (!profile) return null;
  return (
    <div className="flex items-center gap-3.5">
      <Avatar name={profile.full_name} url={profile.avatar_url} size={46} />
      <div className="min-w-0">
        <p className="text-[12.5px] text-ink-400">{greeting},</p>
        <p className="truncate text-[16.5px] font-semibold text-wine-900">{profile.full_name}</p>
      </div>
      {profile.role !== 'resident' && (
        <Badge tone="brass" className="ml-auto shrink-0">{profile.role}</Badge>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { profile } = useApp();
  const location = useLocation();
  const onSignIn = location.pathname.startsWith('/app/masuk');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  // The sign-in screen is its own full-bleed layout with no chrome.
  if (onSignIn || !profile) {
    return (
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="masuk" element={<SignIn />} />
          <Route path="*" element={<Navigate to="/app/masuk" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 pb-[68px]">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="masuk" element={<Navigate to="/app" replace />} />
            <Route index element={<Guard><Dashboard /></Guard>} />
            <Route path="pinjam/*" element={<Guard><Lending /></Guard>} />
            <Route path="fasilitas" element={<Guard><FacilityBooking /></Guard>} />
            <Route path="iuran" element={<Guard><Dues /></Guard>} />
            <Route path="lapor/*" element={<Guard><Complaints /></Guard>} />
            <Route path="tamu" element={<Guard><Guests /></Guard>} />
            <Route path="agenda" element={<Guard><Agenda /></Guard>} />
            <Route path="info" element={<Guard><Info /></Guard>} />
            <Route path="profil" element={<Guard><Profile /></Guard>} />
            <Route path="notifikasi" element={<Guard><Notifications /></Guard>} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </main>
      {profile.status === 'active' && <BottomNav />}
    </div>
  );
}
