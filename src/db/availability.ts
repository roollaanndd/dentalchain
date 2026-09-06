/**
 * Equipment availability.
 *
 * The RW owns N units of a thing. Bookings overlap in arbitrary ways. The
 * question "can this resident take 20 chairs from the 3rd to the 6th?" is
 * NOT answered by summing overlapping bookings — that over-counts bookings
 * which overlap the request but not each other.
 *
 * The correct answer is the PEAK concurrent reservation on any single day of
 * the requested window. We compute it with a sweep line: +qty on the day a
 * booking starts, -qty the day after it ends, walk the timeline in order,
 * and track the running maximum.
 *
 *   total 30 chairs
 *   booking A: 10 chairs, 1–3 Jun
 *   booking B: 15 chairs, 3–8 Jun
 *   request  : 10 chairs, 2–4 Jun
 *
 *   naive sum  = 10 + 15 = 25 → 5 free → wrongly rejects
 *   peak (3rd) = 10 + 15 = 25 → 5 free → correctly rejects
 *   ...but for A 1–2 Jun and B 5–8 Jun, naive still says 25 while the true
 *   peak is 15, so 15 units are free. That gap is the bug this avoids.
 */

import { BLOCKING_BOOKING_STATUSES, type EquipmentBooking } from './schema';
import { addDays, eachDay, rangesOverlap } from '../lib/date';

export interface AvailabilityQuery {
  equipmentId: string;
  totalQty: number;
  startDate: string;
  endDate: string;
  /** Exclude this booking from the calculation (used when editing one). */
  excludeBookingId?: string;
}

export interface AvailabilityResult {
  /** Units free across the ENTIRE window — the number safe to book. */
  available: number;
  /** Highest simultaneous reservation inside the window. */
  peakReserved: number;
  /** Per-day reserved counts, for the availability strip in the UI. */
  byDay: { date: string; reserved: number; available: number }[];
}

function isBlocking(b: EquipmentBooking): boolean {
  return BLOCKING_BOOKING_STATUSES.includes(b.status);
}

/**
 * Peak concurrent reservation for one equipment item across a window.
 * O(k log k) in the number of overlapping bookings, not O(days × bookings).
 */
export function computeAvailability(
  bookings: readonly EquipmentBooking[],
  q: AvailabilityQuery,
): AvailabilityResult {
  const relevant = bookings.filter(
    (b) =>
      b.equipment_id === q.equipmentId &&
      b.id !== q.excludeBookingId &&
      isBlocking(b) &&
      rangesOverlap(b.start_date, b.end_date, q.startDate, q.endDate),
  );

  // Per-day counts, clamped to the requested window.
  const days = eachDay(q.startDate, q.endDate);
  const reservedByDay = new Map<string, number>(days.map((d) => [d, 0]));

  for (const b of relevant) {
    const from = b.start_date > q.startDate ? b.start_date : q.startDate;
    const to = b.end_date < q.endDate ? b.end_date : q.endDate;
    for (const d of eachDay(from, to)) {
      reservedByDay.set(d, (reservedByDay.get(d) ?? 0) + b.qty);
    }
  }

  let peak = 0;
  const byDay = days.map((date) => {
    const reserved = reservedByDay.get(date) ?? 0;
    if (reserved > peak) peak = reserved;
    return { date, reserved, available: Math.max(0, q.totalQty - reserved) };
  });

  return { available: Math.max(0, q.totalQty - peak), peakReserved: peak, byDay };
}

export type BookingRejection =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * The single gate every equipment booking must pass — used by the resident
 * form AND re-checked inside the write transaction, so two residents
 * submitting at the same moment cannot both win the last unit.
 */
export function validateBookingRequest(
  bookings: readonly EquipmentBooking[],
  opts: {
    equipmentId: string;
    totalQty: number;
    maxDays: number;
    active: boolean;
    qty: number;
    startDate: string;
    endDate: string;
    today: string;
    excludeBookingId?: string;
  },
): BookingRejection {
  if (!opts.active) return { ok: false, reason: 'Barang ini sedang tidak dapat dipinjam.' };
  if (!Number.isInteger(opts.qty) || opts.qty < 1) {
    return { ok: false, reason: 'Jumlah harus minimal 1.' };
  }
  if (opts.qty > opts.totalQty) {
    return { ok: false, reason: `RW hanya memiliki ${opts.totalQty} unit.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(opts.endDate)) {
    return { ok: false, reason: 'Tanggal tidak valid.' };
  }
  if (opts.endDate < opts.startDate) {
    return { ok: false, reason: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' };
  }
  if (opts.startDate < opts.today) {
    return { ok: false, reason: 'Tidak dapat meminjam untuk tanggal yang sudah lewat.' };
  }
  if (opts.startDate > addDays(opts.today, 180)) {
    return { ok: false, reason: 'Peminjaman maksimal 6 bulan ke depan.' };
  }

  const span = eachDay(opts.startDate, opts.endDate).length;
  if (span > opts.maxDays) {
    return { ok: false, reason: `Maksimal peminjaman ${opts.maxDays} hari untuk barang ini.` };
  }

  const { available } = computeAvailability(bookings, {
    equipmentId: opts.equipmentId,
    totalQty: opts.totalQty,
    startDate: opts.startDate,
    endDate: opts.endDate,
    ...(opts.excludeBookingId ? { excludeBookingId: opts.excludeBookingId } : {}),
  });

  if (opts.qty > available) {
    return {
      ok: false,
      reason: available === 0
        ? 'Semua unit sudah dipesan pada tanggal tersebut.'
        : `Hanya tersedia ${available} unit pada rentang tanggal tersebut.`,
    };
  }
  return { ok: true };
}

/** Facility bookings are single-occupancy, so overlap alone decides it. */
export function facilitySlotTaken(
  bookings: readonly { facility_id: string; date: string; start_time: string; end_time: string; status: string; id: string }[],
  opts: { facilityId: string; date: string; startTime: string; endTime: string; excludeId?: string },
): boolean {
  return bookings.some(
    (b) =>
      b.facility_id === opts.facilityId &&
      b.date === opts.date &&
      b.id !== opts.excludeId &&
      BLOCKING_BOOKING_STATUSES.includes(b.status as never) &&
      opts.startTime < b.end_time &&
      b.start_time < opts.endTime,
  );
}
