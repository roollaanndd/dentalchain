import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Menu, X, Phone, Mail, MapPin, ArrowRight, ExternalLink } from 'lucide-react';
import { Button, Logo, Spinner, Wordmark } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { site } from '../../db';
import { waNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

const Home = lazy(() => import('./Home'));
const About = lazy(() => import('./About'));
const Facilities = lazy(() => import('./Facilities'));
const Inventory = lazy(() => import('./Inventory'));
const Information = lazy(() => import('./Information'));
const Contact = lazy(() => import('./Contact'));

const NAV = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/tentang', label: 'Tentang' },
  { to: '/fasilitas', label: 'Fasilitas' },
  { to: '/inventaris', label: 'Inventaris' },
  { to: '/informasi', label: 'Informasi' },
  { to: '/kontak', label: 'Kontak' },
];

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { profile } = useApp();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the drawer on navigation, otherwise it hangs over the new page.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* The permanent brass strip — the brand's signature edge. */}
      <div className="fixed inset-x-0 top-0 z-40 h-[3px] bg-gradient-to-r from-wine-700 via-brass-500 to-wine-700" />

      <header
        className={cn(
          'fixed inset-x-0 top-[3px] z-40 transition-all duration-300',
          scrolled ? 'glass border-b border-cream-300 shadow-[var(--shadow-soft)]' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" aria-label="Burgundy Residences — beranda">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                    isActive ? 'text-wine-800' : 'text-ink-500 hover:text-wine-700',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {n.label}
                    {isActive && (
                      <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-brass-500" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/app" className="hidden sm:block">
              <Button size="sm" icon={<ArrowRight size={15} />}>
                {profile ? 'Buka Portal' : 'Masuk'}
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={open}
              className="rounded-lg p-2 text-wine-800 transition-colors hover:bg-cream-200 lg:hidden"
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-wine-950/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-x-0 top-[71px] border-b border-cream-300 bg-cream-100 px-5 pb-6 pt-4 shadow-[var(--shadow-deep)]">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'block rounded-[var(--radius-btn)] px-4 py-3 text-[15px] font-medium transition-colors',
                    isActive ? 'bg-wine-100 text-wine-800' : 'text-ink-700 hover:bg-cream-200',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
            <Link to="/app" className="mt-3 block">
              <Button block icon={<ArrowRight size={16} />}>
                {profile ? 'Buka Portal Warga' : 'Masuk Portal Warga'}
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}

function Footer() {
  const content = site.get();
  const contact = content?.contact;
  const year = new Date().getFullYear();

  return (
    <footer className="grain relative mt-24 overflow-hidden bg-wine-900 text-cream-100">
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark invert />
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-cream-100/65">
              {content?.brand.tagline ?? 'Rumah, Tetangga, Kebersamaan'}. Portal resmi warga
              di bawah pengelolaan RW 012.
            </p>
            <Link to="/app" className="mt-5 inline-block">
              <Button variant="brass" size="sm" icon={<ArrowRight size={15} />}>
                Portal Warga
              </Button>
            </Link>
          </div>

          <div>
            <h3 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
              Navigasi
            </h3>
            <ul className="space-y-2.5">
              {NAV.map((n) => (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    className="text-[13.5px] text-cream-100/70 transition-colors hover:text-brass-300"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">
              Sekretariat
            </h3>
            <ul className="space-y-3 text-[13px] text-cream-100/70">
              {contact?.address && (
                <li className="flex gap-2.5">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-brass-300" />
                  <span className="leading-relaxed">{contact.address}</span>
                </li>
              )}
              {contact?.phone && (
                <li className="flex gap-2.5">
                  <Phone size={15} className="mt-0.5 shrink-0 text-brass-300" />
                  <a href={`tel:${contact.phone}`} className="transition-colors hover:text-brass-300">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact?.email && (
                <li className="flex gap-2.5">
                  <Mail size={15} className="mt-0.5 shrink-0 text-brass-300" />
                  <a href={`mailto:${contact.email}`} className="transition-colors hover:text-brass-300">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact?.whatsapp && (
                <li className="flex gap-2.5">
                  <ExternalLink size={15} className="mt-0.5 shrink-0 text-brass-300" />
                  <a
                    href={`https://wa.me/${waNumber(contact.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-brass-300"
                  >
                    WhatsApp Pengurus
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-cream-100/12 pt-6 text-[12px] text-cream-100/45 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {content?.brand.name ?? 'Burgundy Residences'} · RW 012
          </span>
          <span>Dikelola bersama oleh warga</span>
        </div>
      </div>
    </footer>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner size={26} />
    </div>
  );
}

/** Scrolls to top on route change — otherwise you land mid-page. */
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream-100">
      <ScrollReset />
      <Header />
      <main className="flex-1 pt-[71px]">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route index element={<Home />} />
            <Route path="tentang" element={<About />} />
            <Route path="fasilitas" element={<Facilities />} />
            <Route path="inventaris" element={<Inventory />} />
            <Route path="informasi" element={<Information />} />
            <Route path="kontak" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 text-center">
      <Logo size={56} />
      <h1 className="mt-6 text-[2rem] text-wine-900">Halaman tidak ditemukan</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
        Alamat yang Anda tuju tidak tersedia. Mungkin tautannya sudah berubah.
      </p>
      <Link to="/" className="mt-7">
        <Button icon={<ArrowRight size={16} />}>Kembali ke Beranda</Button>
      </Link>
    </div>
  );
}
