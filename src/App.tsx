import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Logo, Spinner, ToastStack } from './components/ui';

// Each surface is its own chunk — a resident on a phone never downloads the
// admin console, and the public site stays light for first paint.
const SiteLayout = lazy(() => import('./pages/site/SiteLayout'));
const AppLayout = lazy(() => import('./pages/app/AppLayout'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));

function Booting() {
  return (
    <div className="grain relative flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100">
      <Logo size={52} />
      <Spinner />
      <p className="text-[13px] text-ink-400">Memuat…</p>
    </div>
  );
}

function Shell() {
  const { ready, toasts, dismissToast } = useApp();

  // Nothing renders until the store has been seeded and the session restored,
  // which avoids a flash of the signed-out state for a logged-in resident.
  if (!ready) return <Booting />;

  return (
    <>
      <Suspense fallback={<Booting />}>
        <Routes>
          <Route path="/*" element={<SiteLayout />} />
          <Route path="/app/*" element={<AppLayout />} />
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Shell />
      </BrowserRouter>
    </AppProvider>
  );
}
