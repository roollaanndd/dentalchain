import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, PackageOpen, Info } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, SectionTitle, Segmented, useReveal } from '../../components/ui';
import { PageHero } from './About';
import { equipment, type EquipmentCategory } from '../../db';
import { idr } from '../../lib/format';
import { clean } from '../../lib/validate';

const CATEGORY_LABEL: Record<EquipmentCategory | 'all', string> = {
  all: 'Semua',
  kursi: 'Kursi',
  meja: 'Meja',
  karpet: 'Karpet',
  tenda: 'Tenda',
  audio: 'Audio',
  pendingin: 'Pendingin',
  dapur: 'Dapur',
  kebersihan: 'Kebersihan',
  olahraga: 'Olahraga',
  lainnya: 'Lainnya',
};

const CONDITION_TONE = {
  baik: 'ok', layak: 'info', perlu_perbaikan: 'warn', rusak: 'bad',
} as const;

const CONDITION_LABEL = {
  baik: 'Kondisi baik', layak: 'Layak pakai',
  perlu_perbaikan: 'Perlu perbaikan', rusak: 'Rusak',
} as const;

export default function Inventory() {
  const ref = useReveal<HTMLDivElement>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');

  const items = equipment.list({ activeOnly: true });

  const categories = useMemo(() => {
    const present = new Set(items.map((i) => i.category));
    return (['all', ...Object.keys(CATEGORY_LABEL).filter((c) => c !== 'all')] as (EquipmentCategory | 'all')[])
      .filter((c) => c === 'all' || present.has(c as EquipmentCategory))
      .map((c) => ({
        value: c,
        label: CATEGORY_LABEL[c],
        count: c === 'all' ? items.length : items.filter((i) => i.category === c).length,
      }));
  }, [items]);

  const filtered = useMemo(() => {
    const q = clean(query, 60).toLowerCase();
    return items.filter((i) => {
      if (category !== 'all' && i.category !== category) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
    });
  }, [items, query, category]);

  const totalUnits = items.reduce((s, e) => s + e.total_qty, 0);
  const freeItems = items.filter((e) => e.deposit === 0 && e.fee_per_day === 0).length;

  return (
    <div ref={ref}>
      <PageHero
        eyebrow="Inventaris RW"
        title="Barang milik bersama, dipinjamkan untuk warga"
        subtitle={`${items.length} jenis barang, total ${totalUnits} unit. ${freeItems} di antaranya sepenuhnya gratis — tanpa deposit maupun biaya harian.`}
      />

      <section className="mx-auto max-w-6xl px-5 py-12">
        {/* How it works */}
        <div data-reveal className="mb-10">
          <Card className="border-brass-200 bg-brass-100/45">
            <div className="flex gap-3.5">
              <Info size={18} className="mt-0.5 shrink-0 text-brass-500" />
              <div>
                <h3 className="text-[15px] text-wine-900">Cara meminjam</h3>
                <ol className="mt-2.5 grid gap-2 text-[13px] leading-relaxed text-ink-700 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    'Masuk ke Portal Warga dengan akun terverifikasi.',
                    'Pilih barang, jumlah, dan rentang tanggal peminjaman.',
                    'Tunggu persetujuan pengurus, biasanya 1x24 jam.',
                    'Ambil di pos RW dengan menunjukkan kode peminjaman.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-brass-500 text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div data-reveal className="mb-8 flex flex-col gap-4">
          <div className="max-w-sm">
            <Input
              placeholder="Cari barang…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              prefix={<Search size={16} />}
              aria-label="Cari inventaris"
            />
          </div>
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
            <Segmented value={category} onChange={setCategory} options={categories} size="sm" />
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon={<PackageOpen size={24} />}
              title="Tidak ada barang yang cocok"
              message="Coba kata kunci lain atau pilih kategori yang berbeda."
              action={
                <Button variant="secondary" onClick={() => { setQuery(''); setCategory('all'); }}>
                  Reset pencarian
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e, i) => (
              <div key={e.id} data-reveal data-reveal-delay={Math.min(i, 8) * 50}>
                <Card hover className="flex h-full flex-col">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Badge tone="wine">{CATEGORY_LABEL[e.category]}</Badge>
                    <Badge tone={CONDITION_TONE[e.condition]}>{CONDITION_LABEL[e.condition]}</Badge>
                  </div>

                  <h3 className="text-[16.5px] leading-snug text-wine-900">{e.name}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-500">{e.description}</p>

                  {e.notes && (
                    <p className="mt-2.5 rounded-lg bg-cream-200/70 px-3 py-2 text-[12px] leading-relaxed text-ink-500">
                      {e.notes}
                    </p>
                  )}

                  <dl className="mt-4 space-y-1.5 border-t border-cream-300 pt-3.5 text-[12.5px]">
                    <Row label="Tersedia" value={`${e.total_qty} ${e.unit}`} />
                    <Row label="Maks. pinjam" value={`${e.max_days} hari`} />
                    <Row
                      label="Deposit"
                      value={e.deposit > 0 ? idr(e.deposit) : '—'}
                      strong={e.deposit > 0}
                    />
                    <Row
                      label="Biaya / hari"
                      value={e.fee_per_day > 0 ? idr(e.fee_per_day) : 'Gratis'}
                      strong={e.fee_per_day === 0}
                      tone={e.fee_per_day === 0 ? 'ok' : undefined}
                    />
                  </dl>
                </Card>
              </div>
            ))}
          </div>
        )}

        <div data-reveal className="mt-14">
          <Card className="grain relative overflow-hidden bg-wine-800 text-center">
            <div className="relative z-10 py-6">
              <SectionTitle
                title="Siap meminjam?"
                subtitle="Masuk ke Portal Warga untuk melihat ketersediaan per tanggal dan mengajukan peminjaman."
                align="center"
                invert
              />
              <Link to="/app/pinjam" className="mt-7 inline-block">
                <Button variant="brass" size="lg" icon={<ArrowRight size={17} />}>
                  Ajukan Peminjaman
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Row({
  label, value, strong, tone,
}: { label: string; value: string; strong?: boolean; tone?: 'ok' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-400">{label}</dt>
      <dd
        className={strong ? 'font-semibold' : 'font-medium'}
        style={{ color: tone === 'ok' ? 'var(--color-ok-600)' : 'var(--color-ink-700)' }}
      >
        {value}
      </dd>
    </div>
  );
}
