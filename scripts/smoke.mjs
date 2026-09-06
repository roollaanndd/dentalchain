import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
let pass = 0, fail = 0;
const errors = [];

function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' — ' + detail : ''}`); }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Capture ANY console error or page exception — these are the bugs.
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

console.log('\n=== PUBLIC SITE ===');
await page.goto(BASE, { waitUntil: 'networkidle' });
ok('homepage loads', await page.locator('h1').first().isVisible());
const heroText = await page.locator('h1').first().innerText();
ok('hero renders CMS content', heroText.includes('dirawat bersama'), heroText);
ok('brand strip present', await page.locator('header').first().isVisible());

for (const [path, expect] of [
  ['/tentang', 'Tentang'], ['/fasilitas', 'Fasilitas'],
  ['/inventaris', 'Inventaris'], ['/informasi', 'Informasi'], ['/kontak', 'Kontak'],
]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const h1 = await page.locator('h1').first().innerText().catch(() => '');
  ok(`${path} renders`, h1.length > 0, h1);
}

console.log('\n=== INVENTORY CATALOGUE ===');
await page.goto(BASE + '/inventaris', { waitUntil: 'networkidle' });
const cards = await page.locator('h3').count();
ok('equipment cards render', cards > 5, `${cards} headings`);
await page.fill('input[aria-label="Cari inventaris"]', 'sound');
await page.waitForTimeout(300);
const filtered = await page.locator('h3').filter({ hasText: /Sound/i }).count();
ok('search filters catalogue', filtered >= 1, `${filtered} matches`);

console.log('\n=== AUTH ===');
await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
ok('unauthenticated redirected to sign in', page.url().includes('/app/masuk'), page.url());

// Use the demo chip to fill credentials.
await page.getByRole('button', { name: /Warga/ }).first().click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Masuk', exact: true }).click();
await page.waitForURL('**/app', { timeout: 8000 }).catch(() => {});
ok('sign in succeeds', page.url().endsWith('/app'), page.url());
await page.waitForTimeout(500);
const greeting = await page.locator('text=Dewi Lestari').first().isVisible().catch(() => false);
ok('dashboard shows resident name', greeting);

console.log('\n=== LENDING FLOW (the core feature) ===');
await page.goto(BASE + '/app/pinjam', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
ok('catalogue loads', (await page.locator('text=Kursi Lipat').count()) > 0);

await page.locator('button', { hasText: 'Kursi Lipat' }).first().click();
await page.waitForTimeout(400);
ok('booking modal opens', await page.getByRole('dialog').isVisible());
ok('availability strip renders', (await page.locator('text=Ketersediaan per hari').count()) > 0);

// Fill and submit a booking.
await page.getByLabel('Jumlah').fill('12');
await page.getByLabel('Keperluan').fill('Uji coba pemesanan otomatis');
await page.waitForTimeout(200);
const submitBtn = page.getByRole('button', { name: /Ajukan Peminjaman/ });
ok('submit enabled with valid input', await submitBtn.isEnabled());
await submitBtn.click();
await page.waitForTimeout(700);
ok('booking created (moved to My Bookings)', (await page.locator('text=Menunggu persetujuan').count()) > 0);

console.log('\n=== OVERBOOKING REJECTION ===');
await page.goto(BASE + '/app/pinjam', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'AC Portable' }).first().click();
await page.waitForTimeout(400);
await page.getByLabel('Jumlah').fill('99');
await page.waitForTimeout(300);
const disabled = await page.getByRole('button', { name: /Ajukan Peminjaman/ }).isDisabled();
ok('over-capacity request blocked', disabled);
await page.keyboard.press('Escape');

console.log('\n=== OTHER RESIDENT SCREENS ===');
for (const [path, marker] of [
  ['/app/iuran', 'Iuran IPL'], ['/app/lapor', 'Lapor Warga'],
  ['/app/fasilitas', 'Fasilitas Bersama'], ['/app/tamu', 'Undangan Tamu'],
  ['/app/agenda', 'Agenda Kegiatan'], ['/app/info', 'Informasi'],
  ['/app/profil', 'Data Diri'], ['/app/notifikasi', 'Notifikasi'],
]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  ok(`${path} renders`, (await page.locator(`text=${marker}`).count()) > 0);
}

console.log('\n=== RESIDENT CANNOT REACH ADMIN ===');
await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
ok('resident bounced out of admin console', !page.url().includes('/admin'), page.url());

console.log('\n=== ADMIN CONSOLE ===');
await page.goto(BASE + '/app/masuk', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
// Sign out first if still signed in
await page.evaluate(() => localStorage.removeItem('burgundy:v1:session'));
await page.goto(BASE + '/app/masuk', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Administrator/ }).first().click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Masuk', exact: true }).click();
await page.waitForTimeout(1200);

await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
ok('admin console reachable for admin', page.url().includes('/admin'), page.url());
ok('overview stats render', (await page.locator('text=Menunggu persetujuan').count()) > 0);

for (const [path, marker] of [
  ['/admin/warga', 'Data Warga'], ['/admin/inventaris', 'Inventaris & Peminjaman'],
  ['/admin/fasilitas', 'Fasilitas Bersama'], ['/admin/keuangan', 'Iuran & Kas RW'],
  ['/admin/laporan', 'Laporan Warga'], ['/admin/konten', 'Konten & Agenda'],
  ['/admin/pos', 'Pos Jaga'], ['/admin/pengaturan', 'Pengaturan'],
]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  ok(`${path} renders`, (await page.locator(`text=${marker}`).count()) > 0);
}

console.log('\n=== APPROVAL WORKFLOW ===');
await page.goto(BASE + '/admin/inventaris', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const approveBtn = page.getByRole('button', { name: 'Setujui' }).first();
const hasQueue = await approveBtn.count() > 0;
ok('approval queue has pending items', hasQueue);
if (hasQueue) {
  await approveBtn.click();
  await page.waitForTimeout(400);
  ok('approval dialog opens', await page.getByRole('dialog').isVisible());
  await page.getByRole('dialog').getByRole('button', { name: 'Setujui' }).click();
  await page.waitForTimeout(700);
  ok('approval succeeds', (await page.locator('text=disetujui').count()) > 0);
}

console.log('\n=== GATE VERIFICATION ===');
await page.goto(BASE + '/admin/pos', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.fill('input[aria-label="Kode tamu"]', 'BR-T-NOPE1');
await page.getByRole('button', { name: 'Cek' }).click();
await page.waitForTimeout(400);
ok('unknown guest code rejected', (await page.locator('text=Kode tidak ditemukan').count()) > 0);

console.log('\n=== RESPONSIVE (mobile viewport) ===');
const mobile = await ctx.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(BASE, { waitUntil: 'networkidle' });
const scrollW = await mobile.evaluate(() => document.documentElement.scrollWidth);
ok('no horizontal overflow on mobile home', scrollW <= 391, `scrollWidth=${scrollW}`);
await mobile.goto(BASE + '/app/masuk', { waitUntil: 'networkidle' });
const scrollW2 = await mobile.evaluate(() => document.documentElement.scrollWidth);
ok('no horizontal overflow on sign in', scrollW2 <= 391, `scrollWidth=${scrollW2}`);

await browser.close();

console.log('\n=== CONSOLE ERRORS ===');
if (errors.length === 0) console.log('  none');
else errors.slice(0, 15).forEach((e) => console.log('  ! ' + e));

console.log(`\n${pass} passed, ${fail} failed, ${errors.length} console errors\n`);
process.exit(fail || errors.length ? 1 : 0);
