import { computeAvailability, validateBookingRequest } from './availability';
import type { EquipmentBooking, BookingStatus } from './schema';

let pass = 0, fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n       got  ${g}\n       want ${w}`); }
}

const mk = (id: string, qty: number, s: string, e: string, status: BookingStatus = 'approved') =>
  ({ id, equipment_id: 'eq1', qty, start_date: s, end_date: e, status } as EquipmentBooking);

console.log('\nPEAK vs NAIVE SUM');
// A and B do not overlap each other, but both overlap the request window.
// Naive sum would say 25 reserved; true peak is 15.
eq('non-overlapping neighbours -> peak not sum',
  computeAvailability([mk('a', 10, '2026-06-01', '2026-06-02'), mk('b', 15, '2026-06-05', '2026-06-08')],
    { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-01', endDate: '2026-06-08' }).available, 15);

eq('genuinely stacked bookings -> summed on shared day',
  computeAvailability([mk('a', 10, '2026-06-01', '2026-06-03'), mk('b', 15, '2026-06-03', '2026-06-08')],
    { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-02', endDate: '2026-06-04' }).available, 5);

console.log('\nBOUNDARIES');
eq('booking ending the day request starts -> shares that day',
  computeAvailability([mk('a', 30, '2026-06-01', '2026-06-05')],
    { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-05', endDate: '2026-06-06' }).available, 0);
eq('booking ending day BEFORE request -> no conflict',
  computeAvailability([mk('a', 30, '2026-06-01', '2026-06-04')],
    { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-05', endDate: '2026-06-06' }).available, 30);
eq('single-day booking, single-day request, same day',
  computeAvailability([mk('a', 5, '2026-06-05', '2026-06-05')],
    { equipmentId: 'eq1', totalQty: 10, startDate: '2026-06-05', endDate: '2026-06-05' }).available, 5);

console.log('\nSTATUS FILTERING');
for (const [st, expect] of [['pending',20],['approved',20],['picked_up',20],['returned',30],['rejected',30],['cancelled',30]] as const) {
  eq(`${st} ${expect===30?'frees':'holds'} stock`,
    computeAvailability([mk('a', 10, '2026-06-01', '2026-06-09', st as BookingStatus)],
      { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-02', endDate: '2026-06-05' }).available, expect);
}

console.log('\nSCOPING');
eq('other equipment ignored',
  computeAvailability([{ ...mk('a', 30, '2026-06-01', '2026-06-09'), equipment_id: 'OTHER' } as EquipmentBooking],
    { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-02', endDate: '2026-06-05' }).available, 30);
eq('excluded booking ignored (edit case)',
  computeAvailability([mk('self', 30, '2026-06-01', '2026-06-09')],
    { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-02', endDate: '2026-06-05', excludeBookingId: 'self' }).available, 30);

console.log('\nPER-DAY STRIP');
const strip = computeAvailability([mk('a', 10, '2026-06-02', '2026-06-03')],
  { equipmentId: 'eq1', totalQty: 30, startDate: '2026-06-01', endDate: '2026-06-04' }).byDay;
eq('byDay reserved profile', strip.map(d => d.reserved), [0, 10, 10, 0]);
eq('byDay covers every day', strip.length, 4);

console.log('\nVALIDATION GATE');
const base = { equipmentId: 'eq1', totalQty: 30, maxDays: 7, active: true, today: '2026-06-01' };
const v = (o: Partial<typeof base> & { qty: number; startDate: string; endDate: string }) =>
  validateBookingRequest([mk('a', 25, '2026-06-03', '2026-06-04')], { ...base, ...o });
eq('within stock -> ok', v({ qty: 5, startDate: '2026-06-03', endDate: '2026-06-04' }).ok, true);
eq('one over stock -> rejected', v({ qty: 6, startDate: '2026-06-03', endDate: '2026-06-04' }).ok, false);
eq('past date rejected', v({ qty: 1, startDate: '2026-05-30', endDate: '2026-05-31' }).ok, false);
eq('reversed range rejected', v({ qty: 1, startDate: '2026-06-09', endDate: '2026-06-05' }).ok, false);
eq('over max_days rejected', v({ qty: 1, startDate: '2026-06-10', endDate: '2026-06-20' }).ok, false);
eq('exactly max_days ok', v({ qty: 1, startDate: '2026-06-10', endDate: '2026-06-16' }).ok, true);
eq('qty 0 rejected', v({ qty: 0, startDate: '2026-06-10', endDate: '2026-06-10' }).ok, false);
eq('fractional qty rejected', v({ qty: 1.5, startDate: '2026-06-10', endDate: '2026-06-10' }).ok, false);
eq('qty beyond total stock rejected', v({ qty: 99, startDate: '2026-06-10', endDate: '2026-06-10' }).ok, false);
eq('inactive item rejected', v({ qty: 1, startDate: '2026-06-10', endDate: '2026-06-10', active: false } as never).ok, false);
eq('far-future rejected', v({ qty: 1, startDate: '2027-06-10', endDate: '2027-06-10' }).ok, false);
eq('malformed date rejected', v({ qty: 1, startDate: 'nope', endDate: '2026-06-10' }).ok, false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
