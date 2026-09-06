import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, UserPlus, Info } from 'lucide-react';
import { Button, Card, Input, Logo, Select, Badge } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { auth, houses, DEMO_PASSWORD } from '../../db';
import { passwordProblems, passwordScore } from '../../lib/crypto';
import { cn } from '../../lib/cn';

type Mode = 'signin' | 'register';

const DEMO_ACCOUNTS = [
  { email: 'warga@burgundy.id', label: 'Warga', desc: 'Penghuni biasa' },
  { email: 'rt@burgundy.id', label: 'Ketua RT', desc: 'Persetujuan & laporan' },
  { email: 'bendahara@burgundy.id', label: 'Bendahara', desc: 'Iuran & keuangan' },
  { email: 'satpam@burgundy.id', label: 'Satpam', desc: 'Pos jaga & tamu' },
  { email: 'admin@burgundy.id', label: 'Administrator', desc: 'Akses penuh' },
];

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const navigate = useNavigate();
  const { signIn, toast } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [houseId, setHouseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const houseOptions = houses.list().map((h) => ({
    value: h.id,
    label: `Blok ${h.block} No. ${h.number}`,
  }));

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const p = await signIn(email, password);
      toast(`Selamat datang, ${p.full_name.split(' ')[0]}.`);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await auth.register({
        full_name: fullName, email, phone, password,
        house_id: houseId || null,
      });
      toast('Pendaftaran berhasil. Menunggu verifikasi pengurus.', 'info');
      setMode('signin');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mendaftar.');
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  }

  const pwProblems = mode === 'register' && password ? passwordProblems(password) : [];
  const score = passwordScore(password);

  return (
    <div className="grain relative min-h-screen bg-wine-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{ background: 'radial-gradient(circle at 70% 8%, var(--color-brass-400), transparent 55%)' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 self-start text-[13px] text-cream-100/60 transition-colors hover:text-brass-300"
        >
          <ArrowLeft size={15} />
          Kembali ke situs
        </Link>

        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-cream-100/10 backdrop-blur-sm">
              <Logo size={38} mono />
            </span>
          </div>
          <h1 className="text-[26px] text-cream-100">
            {mode === 'signin' ? 'Portal Warga' : 'Daftar Akun Warga'}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-cream-100/60">
            {mode === 'signin'
              ? 'Masuk untuk mengakses peminjaman, iuran, dan layanan warga lainnya.'
              : 'Isi data Anda. Pengurus RT/RW akan memverifikasi sebelum akun aktif.'}
          </p>
        </div>

        <Card className="bg-cream-50">
          <form onSubmit={mode === 'signin' ? handleSignIn : handleRegister} className="space-y-4">
            {mode === 'register' && (
              <>
                <Input
                  label="Nama lengkap" required autoComplete="name"
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama sesuai KTP"
                />
                <Input
                  label="Nomor HP" required autoComplete="tel" inputMode="tel"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="081234567890"
                />
                <Select
                  label="Alamat rumah" required
                  value={houseId} onChange={(e) => setHouseId(e.target.value)}
                  options={houseOptions}
                  placeholder="Pilih blok dan nomor"
                  hint="Pilih rumah tempat Anda tinggal di cluster ini."
                />
              </>
            )}

            <Input
              label="Email" type="email" required
              autoComplete={mode === 'signin' ? 'username' : 'email'}
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />

            <div>
              <Input
                label="Kata sandi" type="password" required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {mode === 'register' && password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          i < score
                            ? score <= 2 ? 'bg-bad-600' : score === 3 ? 'bg-warn-600' : 'bg-ok-600'
                            : 'bg-cream-300',
                        )}
                      />
                    ))}
                  </div>
                  {pwProblems.length > 0 && (
                    <p className="mt-1.5 text-[12px] text-ink-500">
                      Perlu: {pwProblems.join(', ').toLowerCase()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-[var(--radius-btn)] border border-bad-600/25 bg-bad-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-bad-600">
                {error}
              </div>
            )}

            <Button
              type="submit" block size="lg" loading={busy}
              icon={mode === 'signin' ? <KeyRound size={16} /> : <UserPlus size={16} />}
            >
              {mode === 'signin' ? 'Masuk' : 'Daftar Sekarang'}
            </Button>
          </form>

          <div className="mt-5 border-t border-cream-300 pt-4 text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setError(''); }}
              className="text-[13px] text-ink-500 transition-colors hover:text-wine-700"
            >
              {mode === 'signin' ? (
                <>Belum punya akun? <span className="font-semibold text-wine-700">Daftar di sini</span></>
              ) : (
                <>Sudah punya akun? <span className="font-semibold text-wine-700">Masuk</span></>
              )}
            </button>
          </div>
        </Card>

        {/* Demo accounts — this is a preview build, so make it easy to explore. */}
        {mode === 'signin' && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-300">
              <Info size={13} />
              Akun demo — ketuk untuk mengisi
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => fillDemo(d.email)}
                  className="rounded-[var(--radius-btn)] border border-cream-100/12 bg-cream-100/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-cream-100/12"
                >
                  <span className="block text-[12.5px] font-semibold text-cream-100">{d.label}</span>
                  <span className="block text-[10.5px] text-cream-100/50">{d.desc}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-cream-100/40">
              Kata sandi semua akun demo: <span className="font-mono text-cream-100/65">{DEMO_PASSWORD}</span>
            </p>
            <div className="mt-3 flex justify-center">
              <Badge tone="brass">Data demo tersimpan di perangkat ini saja</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
