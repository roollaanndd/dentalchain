/**
 * Demo data.
 *
 * Seeded once on first load so the app is explorable immediately. Everything
 * here is fictional. Dates are generated relative to today so the dashboard
 * always shows a live-looking mix of upcoming, overdue and settled records
 * rather than a snapshot that rots.
 */

import { store } from './store';
import { auth } from './auth';
import type {
  Announcement, Complaint, ComplaintUpdate, CommunityEvent, DuesInvoice, Equipment,
  EquipmentBooking, EventRsvp, Facility, FacilityBooking, GuestPass, House,
  HouseholdMember, LedgerEntry, Profile, Role, SiteContent, Vehicle,
} from './schema';
import { refCode, uid } from '../lib/id';
import { addDays, currentPeriod, todayISO } from '../lib/date';

export const SCHEMA_VERSION = 1;

/** Password for every demo account. Shown on the login screen. */
export const DEMO_PASSWORD = 'Burgundy2026!';

const now = () => new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const BLOCKS = ['A', 'B', 'C', 'D'] as const;

function makeHouses(): House[] {
  const out: House[] = [];
  for (const block of BLOCKS) {
    const count = block === 'A' ? 12 : block === 'B' ? 10 : block === 'C' ? 10 : 8;
    for (let n = 1; n <= count; n++) {
      out.push({
        id: `house-${block}-${n}`,
        block, number: String(n),
        street: `Jl. Burgundy ${block}`,
        rt: block === 'A' || block === 'B' ? '001' : '002',
        rw: '012',
        tenure: n % 5 === 0 ? 'tenant' : 'owner',
        occupied: n % 11 !== 0, // a couple of empty houses, as in real life
        created_at: ago(400),
      });
    }
  }
  return out;
}

interface SeedPerson {
  id: string; name: string; email: string; phone: string;
  role: Role; house: string; occupation: string;
}

const PEOPLE: SeedPerson[] = [
  { id: 'u-admin', name: 'Rolland Wijaya', email: 'admin@burgundy.id', phone: '081234567001', role: 'admin', house: 'house-A-1', occupation: 'Wiraswasta' },
  { id: 'u-rw', name: 'H. Bambang Sutrisno', email: 'rw@burgundy.id', phone: '081234567002', role: 'rw', house: 'house-A-2', occupation: 'Pensiunan' },
  { id: 'u-rt', name: 'Slamet Riyadi', email: 'rt@burgundy.id', phone: '081234567003', role: 'rt', house: 'house-B-3', occupation: 'Guru' },
  { id: 'u-treasurer', name: 'Sri Wahyuni', email: 'bendahara@burgundy.id', phone: '081234567004', role: 'treasurer', house: 'house-A-5', occupation: 'Akuntan' },
  { id: 'u-security', name: 'Joko Prasetyo', email: 'satpam@burgundy.id', phone: '081234567005', role: 'security', house: 'house-D-8', occupation: 'Petugas Keamanan' },
  { id: 'u-warga', name: 'Dewi Lestari', email: 'warga@burgundy.id', phone: '081234567006', role: 'resident', house: 'house-C-2', occupation: 'Desainer' },
  { id: 'u-w2', name: 'Andi Nugroho', email: 'andi@burgundy.id', phone: '081234567007', role: 'resident', house: 'house-A-7', occupation: 'Software Engineer' },
  { id: 'u-w3', name: 'Maria Simatupang', email: 'maria@burgundy.id', phone: '081234567008', role: 'resident', house: 'house-B-4', occupation: 'Dokter' },
  { id: 'u-w4', name: 'Rizky Ramadhan', email: 'rizky@burgundy.id', phone: '081234567009', role: 'resident', house: 'house-C-6', occupation: 'Konsultan' },
  { id: 'u-w5', name: 'Ratna Kusuma', email: 'ratna@burgundy.id', phone: '081234567010', role: 'resident', house: 'house-D-2', occupation: 'Ibu Rumah Tangga' },
  { id: 'u-w6', name: 'Hendra Gunawan', email: 'hendra@burgundy.id', phone: '081234567011', role: 'resident', house: 'house-B-8', occupation: 'Arsitek' },
];

/** One account left pending so the verification queue isn't empty. */
const PENDING_PERSON: SeedPerson = {
  id: 'u-pending', name: 'Fitri Handayani', email: 'fitri@burgundy.id',
  phone: '081234567012', role: 'resident', house: 'house-C-9', occupation: 'Apoteker',
};

const EQUIPMENT: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Kursi Lipat Chitose', category: 'kursi', description: 'Kursi lipat besi rangka kuat, cocok untuk hajatan dan rapat warga.', total_qty: 120, unit: 'buah', deposit: 0, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 5, active: true, notes: 'Harap dikembalikan dalam keadaan terlipat rapi.' },
  { name: 'Meja Panjang Lipat', category: 'meja', description: 'Meja panjang 180cm, permukaan HPL, kaki lipat.', total_qty: 24, unit: 'buah', deposit: 0, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 5, active: true, notes: null },
  { name: 'Karpet Masjid Hijau', category: 'karpet', description: 'Karpet gulung 3 x 5 meter untuk acara pengajian dan tahlilan.', total_qty: 8, unit: 'gulung', deposit: 100_000, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 3, active: true, notes: 'Wajib dibersihkan sebelum dikembalikan.' },
  { name: 'Tenda Terpal 4x6', category: 'tenda', description: 'Tenda lengkap dengan rangka pipa dan tali. Perlu 4 orang untuk memasang.', total_qty: 4, unit: 'set', deposit: 250_000, fee_per_day: 50_000, condition: 'layak', image_url: null, max_days: 3, active: true, notes: 'Pemasangan dibantu petugas RW.' },
  { name: 'Sound System Portable', category: 'audio', description: 'Speaker aktif 12 inci + 2 mikrofon wireless + stand. Daya 300W.', total_qty: 3, unit: 'set', deposit: 500_000, fee_per_day: 75_000, condition: 'baik', image_url: null, max_days: 2, active: true, notes: 'Tidak untuk penggunaan di luar ruangan saat hujan.' },
  { name: 'Megaphone TOA', category: 'audio', description: 'Pengeras suara jinjing untuk kerja bakti dan pengumuman keliling.', total_qty: 4, unit: 'buah', deposit: 50_000, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 3, active: true, notes: null },
  { name: 'AC Portable 1 PK', category: 'pendingin', description: 'Pendingin ruangan portable dengan selang pembuangan 1,5 meter.', total_qty: 2, unit: 'unit', deposit: 750_000, fee_per_day: 100_000, condition: 'baik', image_url: null, max_days: 2, active: true, notes: 'Butuh stop kontak khusus 900W.' },
  { name: 'Kipas Angin Berdiri', category: 'pendingin', description: 'Kipas angin tinggi 1,4 meter, 3 kecepatan.', total_qty: 10, unit: 'buah', deposit: 0, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 5, active: true, notes: null },
  { name: 'Panci Presto Besar', category: 'dapur', description: 'Panci presto 20 liter untuk masak bersama acara warga.', total_qty: 3, unit: 'buah', deposit: 100_000, fee_per_day: 0, condition: 'layak', image_url: null, max_days: 3, active: true, notes: null },
  { name: 'Termos Air Panas 20L', category: 'dapur', description: 'Termos stainless kapasitas besar untuk acara warga.', total_qty: 6, unit: 'buah', deposit: 0, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 3, active: true, notes: null },
  { name: 'Genset 2200 Watt', category: 'lainnya', description: 'Generator bensin untuk acara malam atau saat pemadaman listrik.', total_qty: 1, unit: 'unit', deposit: 1_000_000, fee_per_day: 150_000, condition: 'layak', image_url: null, max_days: 2, active: true, notes: 'Bahan bakar ditanggung peminjam.' },
  { name: 'Tandu Lipat', category: 'lainnya', description: 'Tandu darurat untuk keperluan evakuasi medis.', total_qty: 2, unit: 'buah', deposit: 0, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 1, active: true, notes: 'Prioritas keadaan darurat.' },
  { name: 'Gerobak Sampah', category: 'kebersihan', description: 'Gerobak dorong untuk kerja bakti lingkungan.', total_qty: 5, unit: 'buah', deposit: 0, fee_per_day: 0, condition: 'perlu_perbaikan', image_url: null, max_days: 2, active: true, notes: 'Satu unit rodanya perlu diganti.' },
  { name: 'Net Bulutangkis', category: 'olahraga', description: 'Net lengkap dengan tiang portable untuk lapangan serbaguna.', total_qty: 2, unit: 'set', deposit: 0, fee_per_day: 0, condition: 'baik', image_url: null, max_days: 7, active: true, notes: null },
];

const FACILITIES: Omit<Facility, 'id' | 'created_at'>[] = [
  { name: 'Balai Warga', description: 'Aula serbaguna berkapasitas 120 orang, dilengkapi AC dan panggung kecil.', capacity: 120, image_url: null, fee_per_session: 250_000, open_time: '07:00', close_time: '22:00', active: true },
  { name: 'Lapangan Serbaguna', description: 'Lapangan beton untuk futsal, bulutangkis, dan senam pagi.', capacity: 80, image_url: null, fee_per_session: 0, open_time: '05:00', close_time: '21:00', active: true },
  { name: 'Musholla Al-Ikhlas', description: 'Musholla cluster dengan kapasitas 60 jamaah.', capacity: 60, image_url: null, fee_per_session: 0, open_time: '04:00', close_time: '21:00', active: true },
  { name: 'Taman Bermain Anak', description: 'Area bermain dengan ayunan, perosotan, dan bangku taman.', capacity: 30, image_url: null, fee_per_session: 0, open_time: '06:00', close_time: '18:00', active: true },
  { name: 'Kolam Renang Cluster', description: 'Kolam renang dewasa dan anak, kedalaman 0,6-1,5 meter.', capacity: 40, image_url: null, fee_per_session: 0, open_time: '06:00', close_time: '19:00', active: true },
];

const SITE: SiteContent = {
  id: 'default',
  schema_version: SCHEMA_VERSION,
  brand: {
    name: 'Burgundy Residences',
    tagline: 'Rumah, Tetangga, Kebersamaan',
    established: '2011',
    logo_url: null,
  },
  hero: {
    eyebrow: 'Cluster Hunian · RW 012',
    title: 'Lingkungan yang dirawat bersama',
    subtitle: 'Portal resmi warga Burgundy Residences. Pinjam inventaris RW, bayar iuran, laporkan masalah lingkungan, dan ikuti kegiatan warga — semuanya dari satu tempat.',
    image_url: null,
    cta_label: 'Masuk Portal Warga',
  },
  about: {
    title: 'Tentang Burgundy Residences',
    body: 'Burgundy Residences adalah cluster hunian di bawah RW 012 yang dihuni 40 kepala keluarga sejak 2011. Kami percaya lingkungan yang baik dibangun dari hal sederhana: saling kenal, saling bantu, dan gotong royong yang tidak pernah putus.\n\nPengurus RW mengelola inventaris bersama, fasilitas umum, keamanan 24 jam, serta kegiatan rutin warga. Portal ini dibuat agar semua itu transparan dan mudah diakses siapa pun yang tinggal di sini.',
    image_url: null,
    stats: [
      { label: 'Kepala Keluarga', value: '40' },
      { label: 'Tahun Berdiri', value: '2011' },
      { label: 'Fasilitas Umum', value: '5' },
      { label: 'Keamanan', value: '24 Jam' },
    ],
  },
  facilities_intro: {
    title: 'Fasilitas Bersama',
    body: 'Dirawat dari iuran warga, terbuka untuk semua penghuni. Pemesanan dilakukan lewat portal agar jadwal tidak bentrok.',
  },
  contact: {
    address: 'Jl. Burgundy Raya No. 1, Cluster Burgundy Residences, RW 012, Kec. Serpong, Tangerang Selatan 15310',
    phone: '021-5566-7788',
    email: 'sekretariat@burgundy.id',
    whatsapp: '081234567002',
    maps_url: 'https://maps.google.com/?q=-6.3086,106.6737',
    office_hours: 'Senin - Jumat 09.00 - 17.00 · Sabtu 09.00 - 13.00',
  },
  emergency: [
    { label: 'Pos Satpam', phone: '081234567005' },
    { label: 'Ketua RW', phone: '081234567002' },
    { label: 'Ambulans', phone: '118' },
    { label: 'Pemadam Kebakaran', phone: '113' },
    { label: 'Polisi', phone: '110' },
    { label: 'PLN Gangguan', phone: '123' },
  ],
  officers: [
    { name: 'H. Bambang Sutrisno', position: 'Ketua RW 012', phone: '081234567002', photo_url: null },
    { name: 'Slamet Riyadi', position: 'Ketua RT 001', phone: '081234567003', photo_url: null },
    { name: 'Sri Wahyuni', position: 'Bendahara', phone: '081234567004', photo_url: null },
    { name: 'Rolland Wijaya', position: 'Sekretaris', phone: '081234567001', photo_url: null },
    { name: 'Joko Prasetyo', position: 'Koordinator Keamanan', phone: '081234567005', photo_url: null },
  ],
  gallery: [],
  faq: [
    { q: 'Bagaimana cara meminjam inventaris RW?', a: 'Masuk ke Portal Warga, buka menu Peminjaman, pilih barang dan tanggal. Pengurus akan menyetujui dalam 1x24 jam. Barang diambil di pos RW dengan menunjukkan kode peminjaman.' },
    { q: 'Apakah peminjaman dikenakan biaya?', a: 'Sebagian besar inventaris gratis untuk warga. Barang bernilai tinggi seperti sound system, AC portable, tenda, dan genset dikenakan deposit yang dikembalikan penuh bila barang kembali dalam kondisi baik.' },
    { q: 'Berapa iuran IPL per bulan?', a: 'Iuran Pengelolaan Lingkungan sebesar Rp150.000 per bulan per rumah, jatuh tempo tanggal 10. Pembayaran dapat dilakukan lewat transfer bank atau tunai ke bendahara.' },
    { q: 'Ke mana melaporkan lampu jalan mati atau sampah menumpuk?', a: 'Gunakan menu Lapor di Portal Warga. Setiap laporan mendapat nomor tiket dan dapat Anda pantau statusnya sampai selesai.' },
    { q: 'Bagaimana aturan tamu menginap?', a: 'Tamu yang menginap lebih dari 1x24 jam wajib dilaporkan ke pengurus RT melalui menu Tamu di portal, sesuai ketentuan administrasi kependudukan.' },
    { q: 'Bagaimana cara memesan Balai Warga?', a: 'Buka menu Fasilitas di Portal Warga, pilih tanggal dan jam. Jadwal yang sudah dipesan warga lain akan otomatis tertutup sehingga tidak terjadi bentrok.' },
  ],
  payment: {
    bank: 'Bank Mandiri',
    account_no: '123-00-4567890-1',
    account_name: 'Kas RW 012 Burgundy Residences',
    qris_url: null,
  },
  updated_at: now(),
};

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

export async function seedIfEmpty(): Promise<void> {
  if (store.isBooted) return;

  // ── Houses ──
  const houses = makeHouses();
  store.insertMany('houses', houses);

  // ── Accounts ──
  for (const p of PEOPLE) {
    const profile: Profile = {
      id: p.id, email: p.email, full_name: p.name, phone: p.phone,
      role: p.role, status: 'active', house_id: p.house,
      avatar_url: null, occupation: p.occupation,
      emergency_name: 'Kontak Darurat Keluarga', emergency_phone: '081200000000',
      verified_at: ago(300), created_at: ago(320), updated_at: ago(30),
    };
    await auth.seedAccount(profile, DEMO_PASSWORD);
  }
  await auth.seedAccount({
    id: PENDING_PERSON.id, email: PENDING_PERSON.email, full_name: PENDING_PERSON.name,
    phone: PENDING_PERSON.phone, role: 'resident', status: 'pending',
    house_id: PENDING_PERSON.house, avatar_url: null, occupation: PENDING_PERSON.occupation,
    emergency_name: null, emergency_phone: null, verified_at: null,
    created_at: ago(2), updated_at: ago(2),
  }, DEMO_PASSWORD);

  // ── Household members & vehicles ──
  const members: HouseholdMember[] = [];
  const vehicles: Vehicle[] = [];
  const familyNames = ['Putri', 'Adi', 'Sari', 'Bayu', 'Nadia', 'Fajar'];
  PEOPLE.forEach((p, i) => {
    members.push({
      id: uid(), house_id: p.house, full_name: p.name, relation: 'kepala_keluarga',
      gender: i % 3 === 0 ? 'P' : 'L', birth_date: `19${70 + (i % 25)}-0${(i % 9) + 1}-1${i % 9}`,
      nik_last4: String(1000 + i * 7).slice(-4), phone: p.phone, created_at: ago(300),
    });
    if (i % 2 === 0) {
      members.push({
        id: uid(), house_id: p.house, full_name: `${pick(familyNames, i)} ${p.name.split(' ')[1] ?? ''}`.trim(),
        relation: i % 4 === 0 ? 'istri' : 'anak', gender: i % 2 === 0 ? 'P' : 'L',
        birth_date: `20${String(10 + (i % 12)).padStart(2, '0')}-0${(i % 9) + 1}-0${(i % 8) + 1}`,
        nik_last4: null, phone: null, created_at: ago(300),
      });
    }
    vehicles.push({
      id: uid(), house_id: p.house, kind: i % 3 === 0 ? 'motor' : 'mobil',
      plate: `B ${1000 + i * 137} ${['ABC', 'BRG', 'XYZ', 'KMP'][i % 4]}`,
      brand: pick(['Toyota', 'Honda', 'Daihatsu', 'Yamaha', 'Suzuki'], i),
      color: pick(['Hitam', 'Putih', 'Silver', 'Merah'], i),
      sticker_no: `BR-${String(100 + i)}`, created_at: ago(280),
    });
  });
  store.insertMany('household_members', members);
  store.insertMany('vehicles', vehicles);

  // ── Equipment ──
  const equipment: Equipment[] = EQUIPMENT.map((e, i) => ({
    ...e, id: `eq-${i + 1}`, created_at: ago(300), updated_at: ago(20),
  }));
  store.insertMany('equipment', equipment);

  // ── Facilities ──
  const facilities: Facility[] = FACILITIES.map((f, i) => ({
    ...f, id: `fac-${i + 1}`, created_at: ago(300),
  }));
  store.insertMany('facilities', facilities);

  // ── Equipment bookings: a realistic spread across the lifecycle ──
  const t = todayISO();
  const bookings: EquipmentBooking[] = [
    { eq: 'eq-1', user: 'u-warga', qty: 40, start: addDays(t, 3), end: addDays(t, 4), status: 'pending', purpose: 'Syukuran rumah baru' },
    { eq: 'eq-5', user: 'u-w2', qty: 1, start: addDays(t, 3), end: addDays(t, 3), status: 'pending', purpose: 'Acara ulang tahun anak' },
    { eq: 'eq-3', user: 'u-w3', qty: 4, start: addDays(t, 6), end: addDays(t, 7), status: 'approved', purpose: 'Pengajian rutin ibu-ibu' },
    { eq: 'eq-2', user: 'u-w4', qty: 8, start: addDays(t, 1), end: addDays(t, 2), status: 'approved', purpose: 'Rapat koordinasi RT 002' },
    { eq: 'eq-1', user: 'u-w5', qty: 60, start: addDays(t, -1), end: addDays(t, 1), status: 'picked_up', purpose: 'Hajatan pernikahan' },
    { eq: 'eq-8', user: 'u-w6', qty: 4, start: addDays(t, -2), end: addDays(t, -1), status: 'picked_up', purpose: 'Kerja bakti blok B' },
    { eq: 'eq-4', user: 'u-w2', qty: 2, start: addDays(t, -12), end: addDays(t, -10), status: 'returned', purpose: 'Bazar warga' },
    { eq: 'eq-6', user: 'u-warga', qty: 2, start: addDays(t, -20), end: addDays(t, -19), status: 'returned', purpose: 'Kerja bakti bulanan' },
    { eq: 'eq-7', user: 'u-w3', qty: 1, start: addDays(t, -30), end: addDays(t, -29), status: 'returned', purpose: 'Arisan RT' },
    { eq: 'eq-11', user: 'u-w4', qty: 1, start: addDays(t, -8), end: addDays(t, -7), status: 'rejected', purpose: 'Acara pribadi di luar cluster' },
  ].map((b, i) => {
    const item = equipment.find((e) => e.id === b.eq)!;
    const days = Math.round((Date.parse(`${b.end}T12:00:00Z`) - Date.parse(`${b.start}T12:00:00Z`)) / 86_400_000) + 1;
    const decided = b.status !== 'pending';
    return {
      id: uid(), code: refCode('P'), equipment_id: b.eq, user_id: b.user,
      house_id: PEOPLE.find((p) => p.id === b.user)?.house ?? null,
      qty: b.qty, start_date: b.start, end_date: b.end, purpose: b.purpose,
      status: b.status as EquipmentBooking['status'],
      deposit_amount: item.deposit * b.qty,
      fee_amount: item.fee_per_day * b.qty * days,
      deposit_returned: b.status === 'returned',
      condition_out: ['picked_up', 'returned'].includes(b.status) ? 'baik' : null,
      condition_in: b.status === 'returned' ? (i === 6 ? 'layak' : 'baik') : null,
      handled_by: decided ? 'u-rt' : null,
      decided_at: decided ? ago(5 + i) : null,
      picked_up_at: ['picked_up', 'returned'].includes(b.status) ? ago(3 + i) : null,
      returned_at: b.status === 'returned' ? ago(1 + i) : null,
      decision_note: b.status === 'rejected' ? 'Inventaris RW hanya untuk kegiatan di dalam lingkungan cluster.' : null,
      created_at: ago(10 + i), updated_at: ago(1 + i),
    } satisfies EquipmentBooking;
  });
  store.insertMany('equipment_bookings', bookings);

  // ── Facility bookings ──
  store.insertMany('facility_bookings', [
    { id: uid(), code: refCode('F'), facility_id: 'fac-1', user_id: 'u-w3', date: addDays(t, 5), start_time: '09:00', end_time: '13:00', purpose: 'Pengajian rutin ibu-ibu', attendees: 45, status: 'approved', fee_amount: 250_000, handled_by: 'u-rt', decision_note: null, created_at: ago(4), updated_at: ago(3) },
    { id: uid(), code: refCode('F'), facility_id: 'fac-2', user_id: 'u-w2', date: addDays(t, 2), start_time: '16:00', end_time: '18:00', purpose: 'Futsal warga blok A', attendees: 20, status: 'pending', fee_amount: 0, handled_by: null, decision_note: null, created_at: ago(1), updated_at: ago(1) },
    { id: uid(), code: refCode('F'), facility_id: 'fac-1', user_id: 'u-w5', date: addDays(t, 12), start_time: '18:00', end_time: '22:00', purpose: 'Resepsi pernikahan keluarga', attendees: 100, status: 'pending', fee_amount: 250_000, handled_by: null, decision_note: null, created_at: ago(0), updated_at: ago(0) },
  ] satisfies FacilityBooking[]);

  // ── Dues: last 3 periods ──
  const invoices: DuesInvoice[] = [];
  const [cy, cm] = currentPeriod().split('-').map(Number);
  for (let back = 2; back >= 0; back--) {
    const d = new Date(Date.UTC(cy!, cm! - 1 - back, 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    houses.filter((h) => h.occupied).forEach((h, i) => {
      // Older periods are mostly settled; the current one is still coming in.
      const settled = back > 0 ? i % 12 !== 0 : i % 3 === 0;
      const awaiting = back === 0 && i % 7 === 0;
      invoices.push({
        id: uid(), house_id: h.id, period, amount: 150_000,
        status: settled ? 'paid' : awaiting ? 'awaiting_verification' : 'unpaid',
        due_date: `${period}-10`,
        paid_at: settled ? ago(back * 30 + 3) : null,
        method: settled ? (i % 2 === 0 ? 'transfer' : 'tunai') : null,
        proof_url: null, verified_by: settled ? 'u-treasurer' : null,
        note: null, created_at: ago(back * 30 + 25), updated_at: ago(back * 30 + 3),
      });
    });
  }
  store.insertMany('dues_invoices', invoices);

  // ── Ledger: income from settled dues + real operating costs ──
  const ledger: LedgerEntry[] = [];
  for (const inv of invoices.filter((i) => i.status === 'paid')) {
    const h = houses.find((x) => x.id === inv.house_id);
    ledger.push({
      id: uid(), kind: 'income', category: 'IPL', amount: inv.amount,
      date: `${inv.period}-08`,
      description: `IPL ${inv.period} — Blok ${h?.block} No. ${h?.number}`,
      receipt_url: null, published: true, created_by: 'u-treasurer', created_at: inv.paid_at ?? ago(30),
    });
  }
  const expenses = [
    { cat: 'Keamanan', desc: 'Honor 3 petugas keamanan', amount: 6_000_000 },
    { cat: 'Kebersihan', desc: 'Honor petugas kebersihan & angkut sampah', amount: 2_400_000 },
    { cat: 'Listrik', desc: 'Listrik penerangan jalan umum', amount: 850_000 },
    { cat: 'Pemeliharaan', desc: 'Perbaikan pompa air taman', amount: 450_000 },
    { cat: 'Kegiatan', desc: 'Konsumsi kerja bakti bulanan', amount: 300_000 },
  ];
  for (let back = 2; back >= 0; back--) {
    const d = new Date(Date.UTC(cy!, cm! - 1 - back, 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    for (const e of expenses) {
      if (back === 0 && e.cat === 'Pemeliharaan') continue; // not yet spent this month
      ledger.push({
        id: uid(), kind: 'expense', category: e.cat, amount: e.amount,
        date: `${period}-25`, description: e.desc, receipt_url: null,
        published: true, created_by: 'u-treasurer', created_at: ago(back * 30 + 5),
      });
    }
  }
  store.insertMany('ledger_entries', ledger);

  // ── Announcements ──
  store.insertMany('announcements', [
    { id: uid(), title: 'Kerja Bakti Bulanan Minggu Ini', body: 'Assalamualaikum warga Burgundy Residences.\n\nKerja bakti bulanan akan dilaksanakan hari Minggu pukul 07.00 WIB, dimulai dari lapangan serbaguna. Fokus bulan ini adalah pembersihan saluran air di Blok C dan D yang sempat tersumbat saat hujan deras minggu lalu.\n\nMohon setiap rumah mengirimkan minimal satu perwakilan. Peralatan kebersihan sudah disiapkan pengurus, konsumsi disediakan.\n\nTerima kasih atas gotong royongnya.', category: 'kebersihan', pinned: true, published: true, image_url: null, author_id: 'u-rw', published_at: ago(2), created_at: ago(2), updated_at: ago(2) },
    { id: uid(), title: 'Penyesuaian Jam Operasional Gerbang', body: 'Mulai tanggal 1 bulan depan, gerbang utama akan ditutup pukul 23.00 dan dibuka kembali pukul 05.00. Di luar jam tersebut, akses melalui gerbang samping dengan menunjukkan kartu warga kepada petugas.\n\nKebijakan ini diambil setelah rapat pengurus menanggapi beberapa laporan kendaraan asing masuk larut malam. Bagi warga yang bekerja shift malam, silakan menghubungi koordinator keamanan untuk pendataan.', category: 'keamanan', pinned: true, published: true, image_url: null, author_id: 'u-rw', published_at: ago(5), created_at: ago(5), updated_at: ago(5) },
    { id: uid(), title: 'Laporan Keuangan RW Triwulan Ini', body: 'Laporan keuangan RW untuk triwulan berjalan sudah dapat dilihat warga melalui menu Transparansi Keuangan di portal.\n\nRingkasan: pemasukan didominasi IPL dengan tingkat kolektibilitas 87%. Pengeluaran terbesar tetap pada honor keamanan dan kebersihan. Saldo kas dalam kondisi sehat.\n\nPertanyaan dapat disampaikan ke Bendahara.', category: 'keuangan', pinned: false, published: true, image_url: null, author_id: 'u-treasurer', published_at: ago(9), created_at: ago(9), updated_at: ago(9) },
    { id: uid(), title: 'Pemadaman Listrik Terjadwal PLN', body: 'PLN memberitahukan akan ada pemadaman terjadwal untuk pemeliharaan jaringan pada hari Rabu pukul 09.00 - 15.00 WIB.\n\nGenset RW tersedia untuk keperluan mendesak — silakan ajukan lewat menu Peminjaman. Pompa air cluster akan tetap beroperasi menggunakan cadangan daya.', category: 'umum', pinned: false, published: true, image_url: null, author_id: 'u-rt', published_at: ago(14), created_at: ago(14), updated_at: ago(14) },
    { id: uid(), title: 'Himbauan Waspada Demam Berdarah', body: 'Memasuki musim hujan, kasus demam berdarah di wilayah kecamatan meningkat. Mohon warga melakukan 3M: menguras, menutup, dan mendaur ulang barang bekas yang berpotensi menampung air.\n\nFogging akan dilaksanakan pengurus bekerja sama dengan Puskesmas. Jadwal menyusul.', category: 'umum', pinned: false, published: true, image_url: null, author_id: 'u-rt', published_at: ago(21), created_at: ago(21), updated_at: ago(21) },
  ] satisfies Announcement[]);

  // ── Events ──
  const events: CommunityEvent[] = [
    { id: 'ev-1', title: 'Kerja Bakti Bulanan', description: 'Pembersihan saluran air Blok C dan D. Bawa peralatan seadanya, konsumsi disediakan pengurus.', category: 'kerja_bakti', date: addDays(t, 4), start_time: '07:00', end_time: '10:00', location: 'Lapangan Serbaguna', image_url: null, rsvp_enabled: true, capacity: null, published: true, created_by: 'u-rw', created_at: ago(10) },
    { id: 'ev-2', title: 'Rapat Warga Triwulan', description: 'Pembahasan laporan keuangan, evaluasi keamanan, dan rencana perbaikan jalan lingkungan.', category: 'rapat', date: addDays(t, 11), start_time: '19:30', end_time: '21:30', location: 'Balai Warga', image_url: null, rsvp_enabled: true, capacity: 120, published: true, created_by: 'u-rw', created_at: ago(8) },
    { id: 'ev-3', title: 'Posyandu Balita', description: 'Penimbangan, imunisasi, dan pemberian vitamin A untuk balita. Bawa buku KIA.', category: 'posyandu', date: addDays(t, 8), start_time: '08:00', end_time: '11:00', location: 'Balai Warga', image_url: null, rsvp_enabled: false, capacity: null, published: true, created_by: 'u-rt', created_at: ago(12) },
    { id: 'ev-4', title: 'Senam Sehat Bersama', description: 'Senam pagi rutin setiap akhir pekan, dipandu instruktur. Terbuka untuk semua usia.', category: 'olahraga', date: addDays(t, 2), start_time: '06:30', end_time: '07:30', location: 'Lapangan Serbaguna', image_url: null, rsvp_enabled: true, capacity: 60, published: true, created_by: 'u-rt', created_at: ago(15) },
    { id: 'ev-5', title: 'Peringatan HUT Kemerdekaan RI', description: 'Lomba anak-anak, lomba ibu-ibu, panjat pinang, dan tumpengan bersama seluruh warga.', category: 'perayaan', date: addDays(t, 30), start_time: '08:00', end_time: '16:00', location: 'Lapangan Serbaguna', image_url: null, rsvp_enabled: true, capacity: 300, published: true, created_by: 'u-rw', created_at: ago(6) },
  ];
  store.insertMany('events', events);
  store.insertMany('event_rsvps', [
    { id: uid(), event_id: 'ev-1', user_id: 'u-warga', guests: 1, status: 'going', created_at: ago(3) },
    { id: uid(), event_id: 'ev-1', user_id: 'u-w2', guests: 0, status: 'going', created_at: ago(3) },
    { id: uid(), event_id: 'ev-1', user_id: 'u-w3', guests: 2, status: 'going', created_at: ago(2) },
    { id: uid(), event_id: 'ev-4', user_id: 'u-w5', guests: 0, status: 'going', created_at: ago(1) },
    { id: uid(), event_id: 'ev-2', user_id: 'u-w6', guests: 1, status: 'maybe', created_at: ago(1) },
  ] satisfies EventRsvp[]);

  // ── Complaints ──
  const complaints: Complaint[] = [
    { id: 'c-1', code: refCode('L'), user_id: 'u-warga', title: 'Lampu jalan depan Blok C mati', description: 'Sudah tiga malam lampu penerangan jalan di depan rumah C-2 sampai C-5 mati total. Jalan jadi sangat gelap dan rawan, terutama untuk warga yang pulang malam.', category: 'listrik', priority: 'high', status: 'in_progress', location: 'Jl. Burgundy C, depan C-2', photo_url: null, assignee_id: 'u-rt', anonymous: false, resolved_at: null, created_at: ago(4), updated_at: ago(1) },
    { id: 'c-2', code: refCode('L'), user_id: 'u-w4', title: 'Sampah menumpuk di TPS belakang', description: 'Sampah di TPS belakang cluster belum diangkut sejak akhir pekan. Sudah mulai menimbulkan bau dan mengundang lalat.', category: 'sampah', priority: 'urgent', status: 'acknowledged', location: 'TPS belakang Blok D', photo_url: null, assignee_id: null, anonymous: false, resolved_at: null, created_at: ago(2), updated_at: ago(2) },
    { id: 'c-3', code: refCode('L'), user_id: 'u-w6', title: 'Saluran air tersumbat saat hujan', description: 'Setiap hujan deras, air meluap dari saluran di depan B-8 sampai ke halaman rumah. Sepertinya ada sumbatan di gorong-gorong.', category: 'saluran', priority: 'normal', status: 'open', location: 'Depan B-8', photo_url: null, assignee_id: null, anonymous: false, resolved_at: null, created_at: ago(1), updated_at: ago(1) },
    { id: 'c-4', code: refCode('L'), user_id: 'u-w3', title: 'Kendaraan parkir menghalangi akses', description: 'Ada mobil yang rutin parkir di tikungan Blok A sehingga menyulitkan kendaraan lain berbelok, terutama mobil besar.', category: 'keamanan', priority: 'normal', status: 'resolved', location: 'Tikungan Blok A', photo_url: null, assignee_id: 'u-security', anonymous: true, resolved_at: ago(6), created_at: ago(15), updated_at: ago(6) },
    { id: 'c-5', code: refCode('L'), user_id: 'u-w5', title: 'Jalan berlubang di Blok D', description: 'Lubang cukup dalam di jalan masuk Blok D, sudah beberapa kali membuat pengendara motor oleng.', category: 'jalan', priority: 'high', status: 'resolved', location: 'Jl. Burgundy D', photo_url: null, assignee_id: 'u-rw', anonymous: false, resolved_at: ago(10), created_at: ago(25), updated_at: ago(10) },
  ];
  store.insertMany('complaints', complaints);
  store.insertMany('complaint_updates', [
    { id: uid(), complaint_id: 'c-1', author_id: 'u-rt', body: 'Terima kasih laporannya. Sudah kami cek, ternyata MCB panel penerangan turun. Sedang koordinasi dengan teknisi.', status_change: 'acknowledged', internal: false, created_at: ago(3) },
    { id: uid(), complaint_id: 'c-1', author_id: 'u-rt', body: 'Teknisi datang besok pagi. Perlu ganti dua fitting yang korslet.', status_change: 'in_progress', internal: false, created_at: ago(1) },
    { id: uid(), complaint_id: 'c-1', author_id: 'u-rw', body: 'Anggaran perbaikan diambil dari pos pemeliharaan, sudah saya setujui.', status_change: null, internal: true, created_at: ago(1) },
    { id: uid(), complaint_id: 'c-2', author_id: 'u-rw', body: 'Sudah kami hubungi pihak pengangkut sampah, dijadwalkan diangkut besok pagi.', status_change: 'acknowledged', internal: false, created_at: ago(2) },
    { id: uid(), complaint_id: 'c-4', author_id: 'u-security', body: 'Sudah kami tegur pemilik kendaraan dan dipasang rambu dilarang parkir di tikungan.', status_change: 'resolved', internal: false, created_at: ago(6) },
    { id: uid(), complaint_id: 'c-5', author_id: 'u-rw', body: 'Penambalan jalan selesai dikerjakan. Terima kasih atas laporannya.', status_change: 'resolved', internal: false, created_at: ago(10) },
  ] satisfies ComplaintUpdate[]);

  // ── Guest passes ──
  store.insertMany('guest_passes', [
    { id: uid(), code: refCode('T'), host_id: 'u-warga', house_id: 'house-C-2', guest_name: 'Keluarga Bapak Surya', guest_phone: '081298765432', party_size: 4, vehicle_plate: 'B 1234 XYZ', visit_date: t, valid_from: '10:00', valid_until: '18:00', purpose: 'Silaturahmi keluarga', status: 'active', created_at: ago(1) },
    { id: uid(), code: refCode('T'), host_id: 'u-w2', house_id: 'house-A-7', guest_name: 'Kurir Paket', guest_phone: null, party_size: 1, vehicle_plate: 'B 5678 KMP', visit_date: t, valid_from: '08:00', valid_until: '17:00', purpose: 'Pengiriman barang', status: 'used', created_at: ago(1) },
    { id: uid(), code: refCode('T'), host_id: 'u-w3', house_id: 'house-B-4', guest_name: 'Tim Servis AC', guest_phone: '081211112222', party_size: 2, vehicle_plate: null, visit_date: addDays(t, 2), valid_from: '09:00', valid_until: '15:00', purpose: 'Servis rutin AC', status: 'active', created_at: ago(0) },
  ] satisfies GuestPass[]);

  // ── Site content ──
  store.insert('site_content', SITE);

  store.markBooted();
}

/** Wipes and re-seeds. Exposed in Admin → Pengaturan. */
export async function resetAndReseed(): Promise<void> {
  store.reset();
  auth.logout();
  await seedIfEmpty();
}
