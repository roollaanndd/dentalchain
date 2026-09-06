import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Armchair, Building2, Wallet, MessageSquareWarning,
  Megaphone, CalendarDays, ShieldCheck, Settings, Menu, X, LogOut, Smartphone,
} from 'lucide-react';
import { Avatar, Badge, Spinner, Wordmark } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import {
  can, dashboardStats, hasBackofficeAccess, ROLE_LABEL, type Capability,
} from '../../db';
import { cn } from '../../lib/cn';

const Overview = lazy(() => import('./Overview'));
const Residents = lazy(() => import('./Residents'));
const Inventory = lazy(() => import('./Inventory'));
const Facilities = lazy(() => import('./Facilities'));
const Finance = lazy(() => import('./Finance'));
const Reports = lazy(() => import('./Reports'));
const Content = lazy(() => import('./Content'));
const Gate = lazy(() => import('./Gate'));
const SettingsPage = lazy(() => import('./Settings'));

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  cap: Capability;
  badge?: (s: ReturnType<typeof dashboardStats>) => number;
}

const NAV: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Ringkasan', cap: 'announcement.read' },
  {
    to: '/admin/warga', icon: Users, label: 'Warga', cap: 'resident.read.all',
    badge: (s) => s.pendingResidents,
  },
  {
    to: '/admin/inventaris', icon: Armchair, label: 'Inventaris', cap: 'booking.read.all',
    badge: (s) => s.pendingBookings,
  },
  {
    to: '/admin/fasilitas', icon: Building2, label: 'Fasilitas', cap: 'booking.read.all',
    badge: (s) => s.pendingFacility,
  },
  { to: '/admin/keuangan', icon: Wallet, label: 'Iuran & Kas', cap: 'dues.manage' },
  {
    to: '/admin/laporan', icon: MessageSquareWarning, label: 'Laporan Warga',
    cap: 'complaint.read.all', badge: (s) => s.openComplaints,
  },
  { to: '/admin/konten', icon: Megaphone, label: 'Konten & Agenda', cap: 'announcement.manage' },
  { to: '/admin/pos', icon: ShieldCheck, label: 'Pos Jaga', cap: 'guest.read.all' },
  { to: '/admin/pengaturan', icon: Settings, label: 'Pengaturan', cap: 'site.manage' },
];

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size={24} />
    </div>
  );
}

export default function AdminLayout() {
  const { profile, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  if (!profile) return <Navigate to="/app/masuk" replace />;

  // Residents have no console at all — send them back to their portal.
  if (!hasBackofficeAccess(profile.role) || profile.status !== 'active') {
    return <Navigate to="/app" replace />;
  }

  const actor = { id: profile.id, role: profile.role, status: profile.status };
  const stats = dashboardStats(actor);
  const visible = NAV.filter((n) => can(actor, n.cap));

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-cream-300 bg-wine-900">
        <div className="h-[3px] bg-gradient-to-r from-brass-500 via-brass-300 to-brass-500" />
        <div className="flex h-[58px] items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Tutup menu' : 'Buka menu'}
              className="rounded-lg p-2 text-cream-100 transition-colors hover:bg-cream-100/12 lg:hidden"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link to="/admin" className="flex items-center gap-2.5">
              <Wordmark invert />
              <Badge tone="brass" className="hidden sm:inline-flex">Konsol</Badge>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/app"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-cream-100/70 transition-colors hover:bg-cream-100/12 hover:text-cream-100 sm:flex"
            >
              <Smartphone size={14} />
              Portal Warga
            </Link>
            <div className="flex items-center gap-2.5 border-l border-cream-100/12 pl-3">
              <Avatar name={profile.full_name} url={profile.avatar_url} size={30} />
              <div className="hidden leading-tight sm:block">
                <p className="text-[12.5px] font-medium text-cream-100">
                  {profile.full_name.split(' ')[0]}
                </p>
                <p className="text-[10.5px] text-brass-300">{ROLE_LABEL[profile.role]}</p>
              </div>
            </div>
            <button
              type="button" onClick={signOut} aria-label="Keluar"
              className="rounded-lg p-2 text-cream-100/60 transition-colors hover:bg-cream-100/12 hover:text-cream-100"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-[248px] shrink-0 border-r border-cream-300 bg-cream-50',
            'transition-transform duration-300 lg:sticky lg:top-[61px] lg:z-auto lg:h-[calc(100vh-61px)] lg:translate-x-0',
            open ? 'translate-x-0 pt-[61px] shadow-[var(--shadow-deep)]' : '-translate-x-full pt-[61px] lg:pt-0',
          )}
        >
          <nav className="space-y-1 overflow-y-auto p-3">
            {visible.map((n) => {
              const count = n.badge?.(stats) ?? 0;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/admin'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-[var(--radius-btn)] px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                      isActive
                        ? 'bg-wine-700 text-cream-50 shadow-[var(--shadow-soft)]'
                        : 'text-ink-700 hover:bg-cream-200',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <n.icon size={17} className="shrink-0" />
                      <span className="flex-1 truncate">{n.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            'tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold',
                            isActive ? 'bg-cream-50/25 text-cream-50' : 'bg-bad-600 text-white',
                          )}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-cream-300 p-3">
            <Link
              to="/"
              className="flex items-center gap-3 rounded-[var(--radius-btn)] px-3 py-2.5 text-[13px] text-ink-500 transition-colors hover:bg-cream-200"
            >
              <CalendarDays size={16} />
              Situs Publik
            </Link>
          </div>
        </aside>

        {open && (
          <div
            className="fixed inset-0 z-30 bg-wine-950/40 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <main className="min-w-0 flex-1 p-4 lg:p-7">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route index element={<Overview />} />
              <Route path="warga" element={<Gated cap="resident.read.all"><Residents /></Gated>} />
              <Route path="inventaris" element={<Gated cap="booking.read.all"><Inventory /></Gated>} />
              <Route path="fasilitas" element={<Gated cap="booking.read.all"><Facilities /></Gated>} />
              <Route path="keuangan" element={<Gated cap="dues.manage"><Finance /></Gated>} />
              <Route path="laporan" element={<Gated cap="complaint.read.all"><Reports /></Gated>} />
              <Route path="konten" element={<Gated cap="announcement.manage"><Content /></Gated>} />
              <Route path="pos" element={<Gated cap="guest.read.all"><Gate /></Gated>} />
              <Route path="pengaturan" element={<Gated cap="site.manage"><SettingsPage /></Gated>} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/**
 * Route-level capability gate. The repository refuses the work regardless;
 * this stops an unauthorised officer landing on a screen full of empty
 * panels and error toasts.
 */
function Gated({ cap, children }: { cap: Capability; children: React.ReactNode }) {
  const { profile } = useApp();
  if (!profile) return <Navigate to="/app/masuk" replace />;
  const actor = { id: profile.id, role: profile.role, status: profile.status };
  if (!can(actor, cap)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex h-13 w-13 items-center justify-center rounded-2xl bg-bad-100 text-bad-600">
          <ShieldCheck size={24} />
        </div>
        <h1 className="text-[20px] text-wine-900">Akses ditolak</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          Peran {ROLE_LABEL[profile.role]} tidak memiliki izin untuk membuka halaman ini.
        </p>
        <Link to="/admin" className="mt-5 inline-block text-[13.5px] font-medium text-wine-700 hover:underline">
          Kembali ke Ringkasan
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

/** Shared page header for admin screens. */
export function AdminHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[26px] text-wine-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
