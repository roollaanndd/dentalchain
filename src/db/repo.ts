/**
 * The repository: every domain operation in the system.
 *
 * Two rules hold everywhere in this file.
 *   1. No mutation runs without passing `assertCan` (or an explicit ownership
 *      check). The UI hides buttons; this refuses the work.
 *   2. Every value written has been through lib/validate first.
 *
 * Reads are synchronous against the local store; the async signatures are
 * deliberate, so the Supabase adapter can drop in without a single call site
 * changing shape.
 */

import { store } from './store';
import {
  assertCan, can, canTouch, ForbiddenError, type Actor, type Capability,
} from './permissions';
import { computeAvailability, facilitySlotTaken, validateBookingRequest } from './availability';
import type {
  Announcement, AuditLog, Complaint, ComplaintStatus, ComplaintUpdate,
  CommunityEvent, Condition, DuesInvoice, DuesStatus, Equipment, EquipmentBooking,
  EventRsvp, Facility, FacilityBooking, GateLog, GuestPass, House, HouseholdMember,
  LedgerEntry, Notification, Priority, Profile, Role, SiteContent, Vehicle,
} from './schema';
import { refCode, uid } from '../lib/id';
import { currentPeriod, todayISO } from '../lib/date';
import {
  clampInt, clampMoney, clean, cleanMultiline, isISODate, isPhoneID, isTime,
  LIMITS, maskNIK, normalisePlate, safeUrl,
} from '../lib/validate';

const now = () => new Date().toISOString();

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
export { ForbiddenError };

function need(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

function audit(actor: Actor | null, action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}): void {
  const row: AuditLog = {
    id: uid(), actor_id: actor?.id ?? null, action, entity, entity_id: entityId, meta, at: now(),
  };
  store.insert('audit_logs', row);
  // Keep the log bounded so localStorage never fills from audit alone.
  const rows = store.all('audit_logs');
  if (rows.length > 1000) store.replace('audit_logs', rows.slice(-800));
}

function notify(userId: string, n: Omit<Notification, 'id' | 'user_id' | 'read' | 'created_at'>): void {
  store.insert('notifications', {
    id: uid(), user_id: userId, read: false, created_at: now(), ...n,
  });
}

/** Everyone who can act on operational queues, for fan-out notifications. */
function officers(cap: Capability): Profile[] {
  return store.where('profiles', (p) => p.status === 'active' && can({ id: p.id, role: p.role, status: p.status }, cap));
}

// ══ Profiles & households ═══════════════════════════════════════════════

export const profiles = {
  list(actor: Actor): Profile[] {
    assertCan(actor, 'resident.read.all');
    return store.all('profiles').slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
  },

  get(actor: Actor, id: string): Profile | null {
    if (!canTouch(actor, id, 'resident.read.all')) throw new ForbiddenError('resident.read.all');
    return store.find('profiles', id) ?? null;
  },

  updateOwn(actor: Actor, patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'occupation' | 'emergency_name' | 'emergency_phone' | 'avatar_url'>>): Profile {
    assertCan(actor, 'profile.update.own');
    const next: Partial<Profile> = { updated_at: now() };

    if (patch.full_name !== undefined) {
      const v = clean(patch.full_name, LIMITS.name);
      need(v.length >= 2, 'Nama minimal 2 karakter.');
      next.full_name = v;
    }
    if (patch.phone !== undefined) {
      const v = clean(patch.phone, LIMITS.phone);
      need(isPhoneID(v), 'Nomor HP tidak valid (contoh: 081234567890).');
      next.phone = v;
    }
    if (patch.occupation !== undefined) next.occupation = clean(patch.occupation, LIMITS.name) || null;
    if (patch.emergency_name !== undefined) next.emergency_name = clean(patch.emergency_name, LIMITS.name) || null;
    if (patch.emergency_phone !== undefined) {
      const v = clean(patch.emergency_phone, LIMITS.phone);
      need(!v || isPhoneID(v), 'Nomor kontak darurat tidak valid.');
      next.emergency_phone = v || null;
    }
    if (patch.avatar_url !== undefined) next.avatar_url = patch.avatar_url ? safeUrl(patch.avatar_url) : null;

    const saved = store.update('profiles', actor.id, next);
    need(!!saved, 'Profil tidak ditemukan.');
    audit(actor, 'profile.update', 'profiles', actor.id, { fields: Object.keys(patch) });
    return saved;
  },

  /** Officers correcting another resident's record. Role is NOT settable here. */
  updateAny(actor: Actor, id: string, patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'house_id' | 'occupation'>>): Profile {
    assertCan(actor, 'resident.verify');
    const next: Partial<Profile> = { updated_at: now() };
    if (patch.full_name !== undefined) next.full_name = clean(patch.full_name, LIMITS.name);
    if (patch.phone !== undefined) next.phone = clean(patch.phone, LIMITS.phone);
    if (patch.occupation !== undefined) next.occupation = clean(patch.occupation, LIMITS.name) || null;
    if (patch.house_id !== undefined) {
      need(!patch.house_id || !!store.find('houses', patch.house_id), 'Rumah tidak ditemukan.');
      next.house_id = patch.house_id;
    }
    const saved = store.update('profiles', id, next);
    need(!!saved, 'Warga tidak ditemukan.');
    audit(actor, 'profile.update.any', 'profiles', id, { fields: Object.keys(patch) });
    return saved;
  },

  verify(actor: Actor, id: string): Profile {
    assertCan(actor, 'resident.verify');
    const saved = store.update('profiles', id, { status: 'active', verified_at: now(), updated_at: now() });
    need(!!saved, 'Warga tidak ditemukan.');
    audit(actor, 'resident.verify', 'profiles', id);
    notify(id, { title: 'Akun terverifikasi', body: 'Akun Anda telah diverifikasi pengurus. Selamat datang di Burgundy Residences.', kind: 'system', link: '/app' });
    return saved;
  },

  setStatus(actor: Actor, id: string, status: Profile['status']): Profile {
    assertCan(actor, 'user.manage');
    need(actor.id !== id, 'Anda tidak dapat mengubah status akun sendiri.');
    const saved = store.update('profiles', id, { status, updated_at: now() });
    need(!!saved, 'Warga tidak ditemukan.');
    audit(actor, 'user.status', 'profiles', id, { status });
    return saved;
  },

  setRole(actor: Actor, id: string, role: Role): Profile {
    assertCan(actor, 'role.assign');
    need(actor.id !== id, 'Anda tidak dapat mengubah peran akun sendiri.');
    // Guard the last administrator out of existence.
    if (role !== 'admin') {
      const admins = store.where('profiles', (p) => p.role === 'admin' && p.status === 'active');
      need(!(admins.length === 1 && admins[0]?.id === id), 'Minimal harus ada satu administrator aktif.');
    }
    const saved = store.update('profiles', id, { role, updated_at: now() });
    need(!!saved, 'Warga tidak ditemukan.');
    audit(actor, 'role.assign', 'profiles', id, { role });
    notify(id, { title: 'Peran diperbarui', body: `Peran akun Anda kini: ${role}.`, kind: 'system', link: '/app/profil' });
    return saved;
  },
};

export const houses = {
  list(): House[] {
    return store.all('houses').slice().sort((a, b) => a.block.localeCompare(b.block) || Number(a.number) - Number(b.number));
  },
  get(id: string): House | null {
    return store.find('houses', id) ?? null;
  },
  label(id: string | null): string {
    if (!id) return 'Belum terdata';
    const h = store.find('houses', id);
    return h ? `Blok ${h.block} No. ${h.number}` : 'Belum terdata';
  },
  create(actor: Actor, input: Pick<House, 'block' | 'number' | 'street' | 'rt' | 'rw' | 'tenure'>): House {
    assertCan(actor, 'resident.verify');
    const block = clean(input.block, 4).toUpperCase();
    const number = clean(input.number, 8);
    need(!!block && !!number, 'Blok dan nomor rumah wajib diisi.');
    need(!store.all('houses').some((h) => h.block === block && h.number === number), 'Rumah ini sudah terdaftar.');
    const row: House = {
      id: uid(), block, number,
      street: clean(input.street, LIMITS.address),
      rt: clean(input.rt, 4), rw: clean(input.rw, 4),
      tenure: input.tenure === 'tenant' ? 'tenant' : 'owner',
      occupied: true, created_at: now(),
    };
    store.insert('houses', row);
    audit(actor, 'house.create', 'houses', row.id);
    return row;
  },
  remove(actor: Actor, id: string): void {
    assertCan(actor, 'resident.verify');
    need(!store.all('profiles').some((p) => p.house_id === id), 'Masih ada warga terdaftar di rumah ini.');
    store.removeWhere('household_members', (m) => m.house_id === id);
    store.removeWhere('vehicles', (v) => v.house_id === id);
    store.remove('houses', id);
    audit(actor, 'house.delete', 'houses', id);
  },
};

/** A resident manages the members and vehicles of their OWN house only. */
function ownsHouse(actor: Actor, houseId: string): boolean {
  const me = store.find('profiles', actor.id);
  return me?.house_id === houseId;
}

export const household = {
  members(actor: Actor, houseId: string): HouseholdMember[] {
    if (!ownsHouse(actor, houseId) && !can(actor, 'resident.read.all')) throw new ForbiddenError('resident.read.all');
    return store.where('household_members', (m) => m.house_id === houseId);
  },

  addMember(actor: Actor, houseId: string, input: Omit<HouseholdMember, 'id' | 'house_id' | 'created_at' | 'nik_last4'> & { nik?: string }): HouseholdMember {
    assertCan(actor, 'household.manage.own');
    need(ownsHouse(actor, houseId) || can(actor, 'resident.verify'), 'Anda hanya dapat mengelola anggota keluarga sendiri.');
    const full_name = clean(input.full_name, LIMITS.name);
    need(full_name.length >= 2, 'Nama anggota keluarga wajib diisi.');
    need(!input.birth_date || isISODate(input.birth_date), 'Tanggal lahir tidak valid.');
    need(!input.birth_date || input.birth_date <= todayISO(), 'Tanggal lahir tidak boleh di masa depan.');
    const row: HouseholdMember = {
      id: uid(), house_id: houseId, full_name,
      relation: input.relation, gender: input.gender === 'P' ? 'P' : 'L',
      birth_date: input.birth_date || null,
      nik_last4: input.nik ? maskNIK(input.nik) : null,
      phone: input.phone ? clean(input.phone, LIMITS.phone) : null,
      created_at: now(),
    };
    store.insert('household_members', row);
    audit(actor, 'household.add', 'household_members', row.id, { house_id: houseId });
    return row;
  },

  removeMember(actor: Actor, id: string): void {
    assertCan(actor, 'household.manage.own');
    const m = store.find('household_members', id);
    need(!!m, 'Anggota tidak ditemukan.');
    need(ownsHouse(actor, m.house_id) || can(actor, 'resident.verify'), 'Anda hanya dapat mengelola anggota keluarga sendiri.');
    store.remove('household_members', id);
    audit(actor, 'household.remove', 'household_members', id);
  },

  vehicles(actor: Actor, houseId: string): Vehicle[] {
    if (!ownsHouse(actor, houseId) && !can(actor, 'resident.read.all')) throw new ForbiddenError('resident.read.all');
    return store.where('vehicles', (v) => v.house_id === houseId);
  },

  addVehicle(actor: Actor, houseId: string, input: Omit<Vehicle, 'id' | 'house_id' | 'created_at'>): Vehicle {
    assertCan(actor, 'vehicle.manage.own');
    need(ownsHouse(actor, houseId) || can(actor, 'resident.verify'), 'Anda hanya dapat mengelola kendaraan sendiri.');
    const plate = normalisePlate(input.plate);
    need(plate.length >= 3, 'Nomor polisi wajib diisi.');
    need(!store.all('vehicles').some((v) => v.plate === plate), 'Nomor polisi ini sudah terdaftar.');
    const row: Vehicle = {
      id: uid(), house_id: houseId, kind: input.kind, plate,
      brand: input.brand ? clean(input.brand, 40) : null,
      color: input.color ? clean(input.color, 24) : null,
      sticker_no: input.sticker_no ? clean(input.sticker_no, 16) : null,
      created_at: now(),
    };
    store.insert('vehicles', row);
    audit(actor, 'vehicle.add', 'vehicles', row.id, { house_id: houseId });
    return row;
  },

  removeVehicle(actor: Actor, id: string): void {
    assertCan(actor, 'vehicle.manage.own');
    const v = store.find('vehicles', id);
    need(!!v, 'Kendaraan tidak ditemukan.');
    need(ownsHouse(actor, v.house_id) || can(actor, 'resident.verify'), 'Anda hanya dapat mengelola kendaraan sendiri.');
    store.remove('vehicles', id);
    audit(actor, 'vehicle.remove', 'vehicles', id);
  },
};

// ══ Equipment lending ═══════════════════════════════════════════════════

export const equipment = {
  list(opts: { activeOnly?: boolean } = {}): Equipment[] {
    const rows = store.all('equipment');
    return (opts.activeOnly ? rows.filter((e) => e.active) : rows.slice())
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  },

  get(id: string): Equipment | null {
    return store.find('equipment', id) ?? null;
  },

  /** Free units for a window — the number the booking form may offer. */
  availability(equipmentId: string, startDate: string, endDate: string, excludeBookingId?: string) {
    const item = store.find('equipment', equipmentId);
    if (!item) return { available: 0, peakReserved: 0, byDay: [] };
    return computeAvailability(store.all('equipment_bookings'), {
      equipmentId, totalQty: item.total_qty, startDate, endDate,
      ...(excludeBookingId ? { excludeBookingId } : {}),
    });
  },

  save(actor: Actor, input: Partial<Equipment> & { id?: string }): Equipment {
    assertCan(actor, 'equipment.manage');
    const name = clean(input.name ?? '', LIMITS.name);
    need(name.length >= 2, 'Nama barang wajib diisi.');
    const total_qty = clampInt(input.total_qty, 1, 10_000, 1);
    const max_days = clampInt(input.max_days, 1, 90, 7);

    if (input.id) {
      const existing = store.find('equipment', input.id);
      need(!!existing, 'Barang tidak ditemukan.');
      // Reducing stock below what is already committed would silently
      // oversell the remaining units, so refuse it.
      const peak = computeAvailability(store.all('equipment_bookings'), {
        equipmentId: input.id, totalQty: existing.total_qty,
        startDate: todayISO(), endDate: '2099-12-31',
      }).peakReserved;
      need(total_qty >= peak, `Tidak dapat mengurangi stok di bawah ${peak} unit yang sedang dipesan.`);

      const saved = store.update('equipment', input.id, {
        name, total_qty, max_days,
        category: input.category ?? existing.category,
        description: cleanMultiline(input.description ?? existing.description, LIMITS.short),
        unit: clean(input.unit ?? existing.unit, 16) || 'buah',
        deposit: clampMoney(input.deposit ?? existing.deposit),
        fee_per_day: clampMoney(input.fee_per_day ?? existing.fee_per_day),
        condition: input.condition ?? existing.condition,
        image_url: input.image_url !== undefined ? (input.image_url ? safeUrl(input.image_url) : null) : existing.image_url,
        active: input.active ?? existing.active,
        notes: input.notes !== undefined ? clean(input.notes, LIMITS.note) || null : existing.notes,
        updated_at: now(),
      });
      need(!!saved, 'Barang tidak ditemukan.');
      audit(actor, 'equipment.update', 'equipment', saved.id);
      return saved;
    }

    const row: Equipment = {
      id: uid(), name, category: input.category ?? 'lainnya',
      description: cleanMultiline(input.description ?? '', LIMITS.short),
      total_qty, unit: clean(input.unit ?? 'buah', 16) || 'buah',
      deposit: clampMoney(input.deposit ?? 0),
      fee_per_day: clampMoney(input.fee_per_day ?? 0),
      condition: input.condition ?? 'baik',
      image_url: input.image_url ? safeUrl(input.image_url) : null,
      max_days, active: input.active ?? true,
      notes: input.notes ? clean(input.notes, LIMITS.note) : null,
      created_at: now(), updated_at: now(),
    };
    store.insert('equipment', row);
    audit(actor, 'equipment.create', 'equipment', row.id);
    return row;
  },

  remove(actor: Actor, id: string): void {
    assertCan(actor, 'equipment.manage');
    const open = store.where('equipment_bookings', (b) =>
      b.equipment_id === id && ['pending', 'approved', 'picked_up'].includes(b.status));
    need(open.length === 0, 'Masih ada peminjaman aktif untuk barang ini.');
    store.remove('equipment', id);
    audit(actor, 'equipment.delete', 'equipment', id);
  },
};

export const bookings = {
  mine(actor: Actor): EquipmentBooking[] {
    assertCan(actor, 'booking.read.own');
    return store.where('equipment_bookings', (b) => b.user_id === actor.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  all(actor: Actor): EquipmentBooking[] {
    assertCan(actor, 'booking.read.all');
    return store.all('equipment_bookings').slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  get(actor: Actor, id: string): EquipmentBooking | null {
    const b = store.find('equipment_bookings', id);
    if (!b) return null;
    if (!canTouch(actor, b.user_id, 'booking.read.all')) throw new ForbiddenError('booking.read.all');
    return b;
  },

  /**
   * Create a booking.
   *
   * The availability check runs INSIDE store.transact against the committed
   * table, not against a value read earlier by the form. Two residents
   * submitting for the last unit at the same moment therefore serialise, and
   * the second one is rejected rather than both being accepted.
   */
  create(actor: Actor, input: { equipment_id: string; qty: number; start_date: string; end_date: string; purpose: string }): EquipmentBooking {
    assertCan(actor, 'booking.create');
    const item = store.find('equipment', input.equipment_id);
    need(!!item, 'Barang tidak ditemukan.');

    const purpose = clean(input.purpose, LIMITS.purpose);
    need(purpose.length >= 3, 'Keperluan peminjaman wajib diisi.');
    need(isISODate(input.start_date) && isISODate(input.end_date), 'Tanggal tidak valid.');

    const me = store.find('profiles', actor.id);
    const qty = clampInt(input.qty, 1, item.total_qty, 1);

    return store.transact('equipment_bookings', (rows) => {
      const verdict = validateBookingRequest(rows, {
        equipmentId: item.id, totalQty: item.total_qty, maxDays: item.max_days,
        active: item.active, qty, startDate: input.start_date, endDate: input.end_date,
        today: todayISO(),
      });
      if (!verdict.ok) throw new ValidationError(verdict.reason);

      const days = Math.round(
        (Date.parse(`${input.end_date}T12:00:00Z`) - Date.parse(`${input.start_date}T12:00:00Z`)) / 86_400_000,
      ) + 1;

      const row: EquipmentBooking = {
        id: uid(), code: refCode('P'), equipment_id: item.id, user_id: actor.id,
        house_id: me?.house_id ?? null, qty,
        start_date: input.start_date, end_date: input.end_date, purpose,
        status: 'pending',
        deposit_amount: item.deposit * qty,
        fee_amount: item.fee_per_day * qty * days,
        deposit_returned: false, condition_out: null, condition_in: null,
        handled_by: null, decided_at: null, picked_up_at: null, returned_at: null,
        decision_note: null, created_at: now(), updated_at: now(),
      };
      return { rows: [...rows, row], result: row };
    });
  },

  cancel(actor: Actor, id: string, reason = ''): EquipmentBooking {
    const b = store.find('equipment_bookings', id);
    need(!!b, 'Peminjaman tidak ditemukan.');
    need(canTouch(actor, b.user_id, 'booking.approve'), 'Anda tidak dapat membatalkan peminjaman ini.');
    need(['pending', 'approved'].includes(b.status), 'Peminjaman ini tidak dapat dibatalkan lagi.');
    const saved = store.update('equipment_bookings', id, {
      status: 'cancelled', decision_note: clean(reason, LIMITS.note) || null, updated_at: now(),
    })!;
    audit(actor, 'booking.cancel', 'equipment_bookings', id);
    return saved;
  },

  decide(actor: Actor, id: string, approve: boolean, note = ''): EquipmentBooking {
    assertCan(actor, 'booking.approve');
    const b = store.find('equipment_bookings', id);
    need(!!b, 'Peminjaman tidak ditemukan.');
    need(b.status === 'pending', 'Peminjaman ini sudah diproses.');

    if (approve) {
      // Re-validate: stock may have changed since the request was filed.
      const item = store.find('equipment', b.equipment_id);
      need(!!item, 'Barang tidak ditemukan.');
      const verdict = validateBookingRequest(store.all('equipment_bookings'), {
        equipmentId: item.id, totalQty: item.total_qty, maxDays: item.max_days,
        active: item.active, qty: b.qty, startDate: b.start_date, endDate: b.end_date,
        today: todayISO(), excludeBookingId: b.id,
      });
      if (!verdict.ok) throw new ValidationError(`Tidak dapat disetujui: ${verdict.reason}`);
    }

    const saved = store.update('equipment_bookings', id, {
      status: approve ? 'approved' : 'rejected',
      handled_by: actor.id, decided_at: now(),
      decision_note: clean(note, LIMITS.note) || null, updated_at: now(),
    })!;
    audit(actor, approve ? 'booking.approve' : 'booking.reject', 'equipment_bookings', id);
    notify(b.user_id, {
      title: approve ? 'Peminjaman disetujui' : 'Peminjaman ditolak',
      body: approve
        ? `Peminjaman ${b.code} disetujui. Silakan ambil barang sesuai jadwal.`
        : `Peminjaman ${b.code} ditolak. ${clean(note, 160)}`.trim(),
      kind: 'booking', link: '/app/pinjam',
    });
    return saved;
  },

  handover(actor: Actor, id: string, condition: Condition): EquipmentBooking {
    assertCan(actor, 'booking.handover');
    const b = store.find('equipment_bookings', id);
    need(!!b, 'Peminjaman tidak ditemukan.');
    need(b.status === 'approved', 'Peminjaman belum disetujui.');
    const saved = store.update('equipment_bookings', id, {
      status: 'picked_up', condition_out: condition, picked_up_at: now(),
      handled_by: actor.id, updated_at: now(),
    })!;
    audit(actor, 'booking.handover', 'equipment_bookings', id, { condition });
    return saved;
  },

  receive(actor: Actor, id: string, condition: Condition, depositReturned: boolean, note = ''): EquipmentBooking {
    assertCan(actor, 'booking.handover');
    const b = store.find('equipment_bookings', id);
    need(!!b, 'Peminjaman tidak ditemukan.');
    need(b.status === 'picked_up', 'Barang belum diambil.');
    const saved = store.update('equipment_bookings', id, {
      status: 'returned', condition_in: condition, deposit_returned: depositReturned,
      returned_at: now(), handled_by: actor.id,
      decision_note: clean(note, LIMITS.note) || b.decision_note, updated_at: now(),
    })!;
    // A damaged return downgrades the item's recorded condition.
    if (condition === 'perlu_perbaikan' || condition === 'rusak') {
      store.update('equipment', b.equipment_id, { condition, updated_at: now() });
    }
    audit(actor, 'booking.receive', 'equipment_bookings', id, { condition, depositReturned });
    notify(b.user_id, {
      title: 'Barang telah dikembalikan',
      body: `Terima kasih. Peminjaman ${b.code} selesai.`,
      kind: 'booking', link: '/app/pinjam',
    });
    return saved;
  },
};

// ══ Facilities ══════════════════════════════════════════════════════════

export const facilities = {
  list(opts: { activeOnly?: boolean } = {}): Facility[] {
    const rows = store.all('facilities');
    return (opts.activeOnly ? rows.filter((f) => f.active) : rows.slice());
  },
  get(id: string): Facility | null {
    return store.find('facilities', id) ?? null;
  },
  bookedSlots(facilityId: string, date: string): FacilityBooking[] {
    return store.where('facility_bookings', (b) =>
      b.facility_id === facilityId && b.date === date &&
      ['pending', 'approved', 'picked_up'].includes(b.status));
  },

  save(actor: Actor, input: Partial<Facility> & { id?: string }): Facility {
    assertCan(actor, 'facility.manage');
    const name = clean(input.name ?? '', LIMITS.name);
    need(name.length >= 2, 'Nama fasilitas wajib diisi.');
    const open_time = isTime(input.open_time ?? '') ? input.open_time! : '06:00';
    const close_time = isTime(input.close_time ?? '') ? input.close_time! : '22:00';
    need(open_time < close_time, 'Jam tutup harus setelah jam buka.');

    const base = {
      name, description: cleanMultiline(input.description ?? '', LIMITS.short),
      capacity: clampInt(input.capacity, 1, 5000, 50),
      image_url: input.image_url ? safeUrl(input.image_url) : null,
      fee_per_session: clampMoney(input.fee_per_session ?? 0),
      open_time, close_time, active: input.active ?? true,
    };
    if (input.id) {
      const saved = store.update('facilities', input.id, base);
      need(!!saved, 'Fasilitas tidak ditemukan.');
      audit(actor, 'facility.update', 'facilities', saved.id);
      return saved;
    }
    const row: Facility = { id: uid(), created_at: now(), ...base };
    store.insert('facilities', row);
    audit(actor, 'facility.create', 'facilities', row.id);
    return row;
  },

  book(actor: Actor, input: { facility_id: string; date: string; start_time: string; end_time: string; purpose: string; attendees: number }): FacilityBooking {
    assertCan(actor, 'facility.book');
    const f = store.find('facilities', input.facility_id);
    need(!!f, 'Fasilitas tidak ditemukan.');
    need(f.active, 'Fasilitas ini sedang tidak dapat dipesan.');
    need(isISODate(input.date), 'Tanggal tidak valid.');
    need(input.date >= todayISO(), 'Tidak dapat memesan tanggal yang sudah lewat.');
    need(isTime(input.start_time) && isTime(input.end_time), 'Jam tidak valid.');
    need(input.start_time < input.end_time, 'Jam selesai harus setelah jam mulai.');
    need(input.start_time >= f.open_time && input.end_time <= f.close_time,
      `Fasilitas hanya tersedia ${f.open_time}-${f.close_time}.`);
    const purpose = clean(input.purpose, LIMITS.purpose);
    need(purpose.length >= 3, 'Keperluan wajib diisi.');
    const attendees = clampInt(input.attendees, 1, f.capacity, 1);
    need(attendees <= f.capacity, `Kapasitas maksimal ${f.capacity} orang.`);

    return store.transact('facility_bookings', (rows) => {
      if (facilitySlotTaken(rows, {
        facilityId: f.id, date: input.date, startTime: input.start_time, endTime: input.end_time,
      })) {
        throw new ValidationError('Jadwal tersebut sudah dipesan warga lain.');
      }
      const row: FacilityBooking = {
        id: uid(), code: refCode('F'), facility_id: f.id, user_id: actor.id,
        date: input.date, start_time: input.start_time, end_time: input.end_time,
        purpose, attendees, status: 'pending', fee_amount: f.fee_per_session,
        handled_by: null, decision_note: null, created_at: now(), updated_at: now(),
      };
      return { rows: [...rows, row], result: row };
    });
  },

  mine(actor: Actor): FacilityBooking[] {
    return store.where('facility_bookings', (b) => b.user_id === actor.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  allBookings(actor: Actor): FacilityBooking[] {
    assertCan(actor, 'booking.read.all');
    return store.all('facility_bookings').slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  decide(actor: Actor, id: string, approve: boolean, note = ''): FacilityBooking {
    assertCan(actor, 'facility.approve');
    const b = store.find('facility_bookings', id);
    need(!!b, 'Pemesanan tidak ditemukan.');
    need(b.status === 'pending', 'Pemesanan ini sudah diproses.');
    if (approve && facilitySlotTaken(store.all('facility_bookings'), {
      facilityId: b.facility_id, date: b.date, startTime: b.start_time, endTime: b.end_time, excludeId: b.id,
    })) {
      throw new ValidationError('Jadwal ini sudah dipesan warga lain.');
    }
    const saved = store.update('facility_bookings', id, {
      status: approve ? 'approved' : 'rejected', handled_by: actor.id,
      decision_note: clean(note, LIMITS.note) || null, updated_at: now(),
    })!;
    audit(actor, approve ? 'facility.approve' : 'facility.reject', 'facility_bookings', id);
    notify(b.user_id, {
      title: approve ? 'Pemesanan fasilitas disetujui' : 'Pemesanan fasilitas ditolak',
      body: `Pemesanan ${b.code} ${approve ? 'disetujui' : 'ditolak'}.`,
      kind: 'booking', link: '/app/fasilitas',
    });
    return saved;
  },

  cancel(actor: Actor, id: string): FacilityBooking {
    const b = store.find('facility_bookings', id);
    need(!!b, 'Pemesanan tidak ditemukan.');
    need(canTouch(actor, b.user_id, 'facility.approve'), 'Anda tidak dapat membatalkan pemesanan ini.');
    need(['pending', 'approved'].includes(b.status), 'Pemesanan ini tidak dapat dibatalkan.');
    const saved = store.update('facility_bookings', id, { status: 'cancelled', updated_at: now() })!;
    audit(actor, 'facility.cancel', 'facility_bookings', id);
    return saved;
  },
};

// ══ Dues & finance ══════════════════════════════════════════════════════

export const dues = {
  forHouse(actor: Actor, houseId: string): DuesInvoice[] {
    const me = store.find('profiles', actor.id);
    if (me?.house_id !== houseId && !can(actor, 'dues.manage')) throw new ForbiddenError('dues.manage');
    return store.where('dues_invoices', (d) => d.house_id === houseId)
      .sort((a, b) => b.period.localeCompare(a.period));
  },

  all(actor: Actor): DuesInvoice[] {
    assertCan(actor, 'dues.manage');
    return store.all('dues_invoices').slice().sort((a, b) => b.period.localeCompare(a.period));
  },

  /** Marks anything past its due date as overdue. Cheap, idempotent. */
  refreshOverdue(): void {
    const today = todayISO();
    const stale = store.where('dues_invoices', (d) => d.status === 'unpaid' && d.due_date < today);
    for (const d of stale) store.update('dues_invoices', d.id, { status: 'overdue', updated_at: now() });
  },

  /** Issues invoices for a period to every occupied house that lacks one. */
  generate(actor: Actor, period: string, amount: number, dueDate: string): number {
    assertCan(actor, 'dues.manage');
    need(/^\d{4}-\d{2}$/.test(period), 'Periode tidak valid (YYYY-MM).');
    need(isISODate(dueDate), 'Tanggal jatuh tempo tidak valid.');
    const value = clampMoney(amount);
    need(value > 0, 'Nominal iuran harus lebih dari nol.');

    const existing = new Set(store.where('dues_invoices', (d) => d.period === period).map((d) => d.house_id));
    const created: DuesInvoice[] = [];
    for (const h of store.all('houses')) {
      if (!h.occupied || existing.has(h.id)) continue;
      created.push({
        id: uid(), house_id: h.id, period, amount: value, status: 'unpaid',
        due_date: dueDate, paid_at: null, method: null, proof_url: null,
        verified_by: null, note: null, created_at: now(), updated_at: now(),
      });
    }
    store.insertMany('dues_invoices', created);
    audit(actor, 'dues.generate', 'dues_invoices', period, { count: created.length, amount: value });
    return created.length;
  },

  /** Resident submits payment; a treasurer must verify before it counts. */
  submitPayment(actor: Actor, id: string, method: NonNullable<DuesInvoice['method']>, proofUrl?: string): DuesInvoice {
    assertCan(actor, 'dues.pay.own');
    const d = store.find('dues_invoices', id);
    need(!!d, 'Tagihan tidak ditemukan.');
    const me = store.find('profiles', actor.id);
    need(me?.house_id === d.house_id, 'Ini bukan tagihan rumah Anda.');
    need(d.status !== 'paid', 'Tagihan ini sudah lunas.');
    const saved = store.update('dues_invoices', id, {
      status: 'awaiting_verification', method,
      proof_url: proofUrl ? safeUrl(proofUrl) : null, updated_at: now(),
    })!;
    audit(actor, 'dues.submit', 'dues_invoices', id, { method });
    for (const t of officers('dues.verify')) {
      notify(t.id, { title: 'Konfirmasi pembayaran IPL', body: `${me?.full_name ?? 'Warga'} mengunggah bukti pembayaran periode ${d.period}.`, kind: 'dues', link: '/admin/iuran' });
    }
    return saved;
  },

  verify(actor: Actor, id: string, accept: boolean, note = ''): DuesInvoice {
    assertCan(actor, 'dues.verify');
    const d = store.find('dues_invoices', id);
    need(!!d, 'Tagihan tidak ditemukan.');
    const status: DuesStatus = accept ? 'paid' : 'unpaid';
    const saved = store.update('dues_invoices', id, {
      status, paid_at: accept ? now() : null, verified_by: accept ? actor.id : null,
      note: clean(note, LIMITS.note) || null, updated_at: now(),
    })!;

    // A verified payment posts to the ledger, so the transparency report and
    // the dues register can never drift apart.
    if (accept) {
      const h = store.find('houses', d.house_id);
      ledger.record(actor, {
        kind: 'income', category: 'IPL', amount: d.amount, date: todayISO(),
        description: `IPL ${d.period} — Blok ${h?.block ?? '?'} No. ${h?.number ?? '?'}`, receipt_url: null,
        published: true,
      });
    }
    audit(actor, accept ? 'dues.verify' : 'dues.reject', 'dues_invoices', id);
    for (const p of store.where('profiles', (p) => p.house_id === d.house_id)) {
      notify(p.id, {
        title: accept ? 'Pembayaran IPL terverifikasi' : 'Pembayaran IPL ditolak',
        body: accept ? `IPL periode ${d.period} telah lunas. Terima kasih.` : `Bukti pembayaran ${d.period} perlu diperbaiki. ${clean(note, 120)}`.trim(),
        kind: 'dues', link: '/app/iuran',
      });
    }
    return saved;
  },

  waive(actor: Actor, id: string, note: string): DuesInvoice {
    assertCan(actor, 'dues.manage');
    const saved = store.update('dues_invoices', id, {
      status: 'waived', note: clean(note, LIMITS.note) || null, updated_at: now(),
    });
    need(!!saved, 'Tagihan tidak ditemukan.');
    audit(actor, 'dues.waive', 'dues_invoices', id);
    return saved;
  },

  /** Collection summary for the admin dashboard. */
  summary(period = currentPeriod()) {
    const rows = store.where('dues_invoices', (d) => d.period === period);
    const paid = rows.filter((d) => d.status === 'paid');
    const pending = rows.filter((d) => d.status === 'awaiting_verification');
    const collected = paid.reduce((s, d) => s + d.amount, 0);
    const billed = rows.reduce((s, d) => s + d.amount, 0);
    return {
      period, total: rows.length, paid: paid.length, pending: pending.length,
      unpaid: rows.filter((d) => d.status === 'unpaid' || d.status === 'overdue').length,
      collected, billed,
      rate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
    };
  },
};

export const ledger = {
  list(actor: Actor | null): LedgerEntry[] {
    const rows = can(actor, 'finance.read.all')
      ? store.all('ledger_entries').slice()
      : store.where('ledger_entries', (e) => e.published);
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  },

  record(actor: Actor, input: Omit<LedgerEntry, 'id' | 'created_by' | 'created_at'>): LedgerEntry {
    assertCan(actor, 'finance.manage');
    const amount = clampMoney(input.amount);
    need(amount > 0, 'Nominal harus lebih dari nol.');
    need(isISODate(input.date), 'Tanggal tidak valid.');
    const row: LedgerEntry = {
      id: uid(), kind: input.kind === 'expense' ? 'expense' : 'income',
      category: clean(input.category, 40) || 'Lainnya', amount, date: input.date,
      description: clean(input.description, LIMITS.short),
      receipt_url: input.receipt_url ? safeUrl(input.receipt_url) : null,
      published: input.published ?? true,
      created_by: actor.id, created_at: now(),
    };
    store.insert('ledger_entries', row);
    audit(actor, 'finance.record', 'ledger_entries', row.id, { kind: row.kind, amount });
    return row;
  },

  remove(actor: Actor, id: string): void {
    assertCan(actor, 'finance.manage');
    store.remove('ledger_entries', id);
    audit(actor, 'finance.delete', 'ledger_entries', id);
  },

  balance(actor: Actor | null) {
    const rows = ledger.list(actor);
    const income = rows.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = rows.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense };
  },

  /** Monthly income/expense series for the transparency chart. */
  monthly(actor: Actor | null, months = 6) {
    const rows = ledger.list(actor);
    const out: { period: string; income: number; expense: number }[] = [];
    const [y0, m0] = currentPeriod().split('-').map(Number);
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y0!, (m0! - 1) - i, 1));
      const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const inPeriod = rows.filter((e) => e.date.startsWith(period));
      out.push({
        period,
        income: inPeriod.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0),
        expense: inPeriod.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0),
      });
    }
    return out;
  },
};

// ══ Announcements & events ══════════════════════════════════════════════

export const announcements = {
  list(opts: { publishedOnly?: boolean } = {}): Announcement[] {
    const rows = opts.publishedOnly
      ? store.where('announcements', (a) => a.published)
      : store.all('announcements').slice();
    return rows.sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at));
  },
  get(id: string): Announcement | null {
    return store.find('announcements', id) ?? null;
  },
  save(actor: Actor, input: Partial<Announcement> & { id?: string }): Announcement {
    assertCan(actor, 'announcement.manage');
    const title = clean(input.title ?? '', LIMITS.title);
    const body = cleanMultiline(input.body ?? '', LIMITS.body);
    need(title.length >= 3, 'Judul pengumuman wajib diisi.');
    need(body.length >= 10, 'Isi pengumuman terlalu pendek.');
    const published = input.published ?? true;
    const base = {
      title, body, category: input.category ?? 'umum',
      pinned: input.pinned ?? false, published,
      image_url: input.image_url ? safeUrl(input.image_url) : null,
      updated_at: now(),
    };
    if (input.id) {
      const prev = store.find('announcements', input.id);
      need(!!prev, 'Pengumuman tidak ditemukan.');
      const saved = store.update('announcements', input.id, {
        ...base,
        published_at: published ? (prev.published_at ?? now()) : null,
      })!;
      audit(actor, 'announcement.update', 'announcements', saved.id);
      return saved;
    }
    const row: Announcement = {
      id: uid(), ...base, author_id: actor.id,
      published_at: published ? now() : null, created_at: now(),
    };
    store.insert('announcements', row);
    audit(actor, 'announcement.create', 'announcements', row.id);
    if (published) {
      for (const p of store.where('profiles', (p) => p.status === 'active')) {
        notify(p.id, { title: 'Pengumuman baru', body: title, kind: 'announcement', link: '/app/info' });
      }
    }
    return row;
  },
  remove(actor: Actor, id: string): void {
    assertCan(actor, 'announcement.manage');
    store.remove('announcements', id);
    audit(actor, 'announcement.delete', 'announcements', id);
  },
};

export const events = {
  list(opts: { publishedOnly?: boolean; upcomingOnly?: boolean } = {}): CommunityEvent[] {
    let rows = opts.publishedOnly ? store.where('events', (e) => e.published) : store.all('events').slice();
    if (opts.upcomingOnly) {
      const t = todayISO();
      rows = rows.filter((e) => e.date >= t);
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  },
  get(id: string): CommunityEvent | null {
    return store.find('events', id) ?? null;
  },
  save(actor: Actor, input: Partial<CommunityEvent> & { id?: string }): CommunityEvent {
    assertCan(actor, 'event.manage');
    const title = clean(input.title ?? '', LIMITS.title);
    need(title.length >= 3, 'Judul kegiatan wajib diisi.');
    need(isISODate(input.date ?? ''), 'Tanggal kegiatan tidak valid.');
    need(isTime(input.start_time ?? ''), 'Jam mulai tidak valid.');
    need(!input.end_time || isTime(input.end_time), 'Jam selesai tidak valid.');
    need(!input.end_time || input.end_time > input.start_time!, 'Jam selesai harus setelah jam mulai.');
    const base = {
      title, description: cleanMultiline(input.description ?? '', LIMITS.body),
      category: input.category ?? 'lainnya', date: input.date!,
      start_time: input.start_time!, end_time: input.end_time || null,
      location: clean(input.location ?? '', LIMITS.address),
      image_url: input.image_url ? safeUrl(input.image_url) : null,
      rsvp_enabled: input.rsvp_enabled ?? true,
      capacity: input.capacity ? clampInt(input.capacity, 1, 10_000) : null,
      published: input.published ?? true,
    };
    if (input.id) {
      const saved = store.update('events', input.id, base);
      need(!!saved, 'Kegiatan tidak ditemukan.');
      audit(actor, 'event.update', 'events', saved.id);
      return saved;
    }
    const row: CommunityEvent = { id: uid(), ...base, created_by: actor.id, created_at: now() };
    store.insert('events', row);
    audit(actor, 'event.create', 'events', row.id);
    return row;
  },
  remove(actor: Actor, id: string): void {
    assertCan(actor, 'event.manage');
    store.removeWhere('event_rsvps', (r) => r.event_id === id);
    store.remove('events', id);
    audit(actor, 'event.delete', 'events', id);
  },
  rsvps(eventId: string): EventRsvp[] {
    return store.where('event_rsvps', (r) => r.event_id === eventId);
  },
  myRsvp(actor: Actor, eventId: string): EventRsvp | null {
    return store.all('event_rsvps').find((r) => r.event_id === eventId && r.user_id === actor.id) ?? null;
  },
  rsvp(actor: Actor, eventId: string, status: EventRsvp['status'], guests = 0): EventRsvp {
    assertCan(actor, 'event.rsvp');
    const ev = store.find('events', eventId);
    need(!!ev, 'Kegiatan tidak ditemukan.');
    need(ev.rsvp_enabled, 'Kegiatan ini tidak memerlukan konfirmasi kehadiran.');
    need(ev.date >= todayISO(), 'Kegiatan ini sudah lewat.');
    const g = clampInt(guests, 0, 20, 0);

    if (status === 'going' && ev.capacity) {
      const taken = store.where('event_rsvps', (r) => r.event_id === eventId && r.status === 'going' && r.user_id !== actor.id)
        .reduce((s, r) => s + 1 + r.guests, 0);
      need(taken + 1 + g <= ev.capacity, `Kuota kegiatan penuh (${ev.capacity} orang).`);
    }

    const existing = events.myRsvp(actor, eventId);
    if (existing) {
      return store.update('event_rsvps', existing.id, { status, guests: g })!;
    }
    const row: EventRsvp = { id: uid(), event_id: eventId, user_id: actor.id, guests: g, status, created_at: now() };
    store.insert('event_rsvps', row);
    return row;
  },
};

// ══ Complaints ══════════════════════════════════════════════════════════

export const complaints = {
  mine(actor: Actor): Complaint[] {
    assertCan(actor, 'complaint.read.own');
    return store.where('complaints', (c) => c.user_id === actor.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  all(actor: Actor): Complaint[] {
    assertCan(actor, 'complaint.read.all');
    return store.all('complaints').slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  get(actor: Actor, id: string): Complaint | null {
    const c = store.find('complaints', id);
    if (!c) return null;
    if (!canTouch(actor, c.user_id, 'complaint.read.all')) throw new ForbiddenError('complaint.read.all');
    return c;
  },

  create(actor: Actor, input: { title: string; description: string; category: Complaint['category']; location: string; photo_url?: string; anonymous?: boolean }): Complaint {
    assertCan(actor, 'complaint.create');
    const title = clean(input.title, LIMITS.title);
    const description = cleanMultiline(input.description, LIMITS.body);
    need(title.length >= 5, 'Judul laporan minimal 5 karakter.');
    need(description.length >= 10, 'Deskripsi laporan terlalu pendek.');

    // Light rate limit: stops an accidental double-submit and casual spam.
    const recent = store.where('complaints', (c) =>
      c.user_id === actor.id && Date.now() - Date.parse(c.created_at) < 60_000);
    need(recent.length < 3, 'Terlalu banyak laporan dalam waktu singkat. Coba lagi sebentar lagi.');

    const row: Complaint = {
      id: uid(), code: refCode('L'), user_id: actor.id, title, description,
      category: input.category, priority: 'normal', status: 'open',
      location: clean(input.location, LIMITS.address),
      photo_url: input.photo_url ? safeUrl(input.photo_url) : null,
      assignee_id: null, anonymous: input.anonymous ?? false,
      resolved_at: null, created_at: now(), updated_at: now(),
    };
    store.insert('complaints', row);
    audit(actor, 'complaint.create', 'complaints', row.id);
    for (const o of officers('complaint.triage')) {
      notify(o.id, { title: 'Laporan warga baru', body: title, kind: 'complaint', link: '/admin/laporan' });
    }
    return row;
  },

  updates(actor: Actor, complaintId: string): ComplaintUpdate[] {
    const c = store.find('complaints', complaintId);
    if (!c) return [];
    const isOwner = c.user_id === actor.id;
    if (!isOwner && !can(actor, 'complaint.read.all')) throw new ForbiddenError('complaint.read.all');
    const rows = store.where('complaint_updates', (u) => u.complaint_id === complaintId);
    // Internal notes stay with the officers.
    return (can(actor, 'complaint.triage') ? rows : rows.filter((u) => !u.internal))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  comment(actor: Actor, complaintId: string, body: string, opts: { internal?: boolean; status?: ComplaintStatus } = {}): ComplaintUpdate {
    const c = store.find('complaints', complaintId);
    need(!!c, 'Laporan tidak ditemukan.');
    const isOwner = c.user_id === actor.id;
    need(isOwner || can(actor, 'complaint.triage'), 'Anda tidak dapat menanggapi laporan ini.');
    const text = cleanMultiline(body, LIMITS.note);
    need(text.length >= 2, 'Tanggapan tidak boleh kosong.');

    // Only officers may change status or write internal notes.
    const internal = opts.internal === true && can(actor, 'complaint.triage');
    const statusChange = opts.status && can(actor, 'complaint.triage') ? opts.status : null;

    const row: ComplaintUpdate = {
      id: uid(), complaint_id: complaintId, author_id: actor.id, body: text,
      status_change: statusChange, internal, created_at: now(),
    };
    store.insert('complaint_updates', row);

    if (statusChange) {
      store.update('complaints', complaintId, {
        status: statusChange,
        resolved_at: statusChange === 'resolved' ? now() : c.resolved_at,
        updated_at: now(),
      });
      if (!isOwner) {
        notify(c.user_id, { title: 'Laporan Anda diperbarui', body: `${c.code}: ${statusChange}`, kind: 'complaint', link: '/app/lapor' });
      }
    } else if (!isOwner && !internal) {
      notify(c.user_id, { title: 'Tanggapan baru', body: `${c.code}: ${text.slice(0, 90)}`, kind: 'complaint', link: '/app/lapor' });
    }
    audit(actor, 'complaint.comment', 'complaints', complaintId, { status: statusChange });
    return row;
  },

  triage(actor: Actor, id: string, patch: { priority?: Priority; assignee_id?: string | null; status?: ComplaintStatus }): Complaint {
    assertCan(actor, 'complaint.triage');
    const next: Partial<Complaint> = { updated_at: now() };
    if (patch.priority) next.priority = patch.priority;
    if (patch.assignee_id !== undefined) {
      need(!patch.assignee_id || !!store.find('profiles', patch.assignee_id), 'Petugas tidak ditemukan.');
      next.assignee_id = patch.assignee_id;
    }
    if (patch.status) {
      next.status = patch.status;
      if (patch.status === 'resolved') next.resolved_at = now();
    }
    const saved = store.update('complaints', id, next);
    need(!!saved, 'Laporan tidak ditemukan.');
    audit(actor, 'complaint.triage', 'complaints', id, patch as Record<string, unknown>);
    return saved;
  },
};

// ══ Guests & gate ═══════════════════════════════════════════════════════

export const guests = {
  mine(actor: Actor): GuestPass[] {
    return store.where('guest_passes', (g) => g.host_id === actor.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  all(actor: Actor): GuestPass[] {
    assertCan(actor, 'guest.read.all');
    return store.all('guest_passes').slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  /** Marks passes whose visit date has gone by. Idempotent. */
  refreshExpired(): void {
    const t = todayISO();
    for (const g of store.where('guest_passes', (g) => g.status === 'active' && g.visit_date < t)) {
      store.update('guest_passes', g.id, { status: 'expired' });
    }
  },

  create(actor: Actor, input: { guest_name: string; guest_phone?: string; party_size: number; vehicle_plate?: string; visit_date: string; valid_from: string; valid_until: string; purpose: string }): GuestPass {
    assertCan(actor, 'guest.create.own');
    const guest_name = clean(input.guest_name, LIMITS.name);
    need(guest_name.length >= 2, 'Nama tamu wajib diisi.');
    need(isISODate(input.visit_date), 'Tanggal kunjungan tidak valid.');
    need(input.visit_date >= todayISO(), 'Tanggal kunjungan sudah lewat.');
    need(isTime(input.valid_from) && isTime(input.valid_until), 'Jam berlaku tidak valid.');
    need(input.valid_from < input.valid_until, 'Jam selesai harus setelah jam mulai.');
    const me = store.find('profiles', actor.id);

    const row: GuestPass = {
      id: uid(), code: refCode('T'), host_id: actor.id, house_id: me?.house_id ?? null,
      guest_name,
      guest_phone: input.guest_phone ? clean(input.guest_phone, LIMITS.phone) : null,
      party_size: clampInt(input.party_size, 1, 50, 1),
      vehicle_plate: input.vehicle_plate ? normalisePlate(input.vehicle_plate) : null,
      visit_date: input.visit_date, valid_from: input.valid_from, valid_until: input.valid_until,
      purpose: clean(input.purpose, LIMITS.purpose), status: 'active', created_at: now(),
    };
    store.insert('guest_passes', row);
    audit(actor, 'guest.create', 'guest_passes', row.id);
    return row;
  },

  revoke(actor: Actor, id: string): GuestPass {
    const g = store.find('guest_passes', id);
    need(!!g, 'Undangan tamu tidak ditemukan.');
    need(canTouch(actor, g.host_id, 'gate.log'), 'Anda tidak dapat membatalkan undangan ini.');
    const saved = store.update('guest_passes', id, { status: 'revoked' })!;
    audit(actor, 'guest.revoke', 'guest_passes', id);
    return saved;
  },

  /** Gate lookup by typed or scanned code. */
  lookup(code: string): { pass: GuestPass; host: Profile | null; house: House | null } | null {
    const needle = clean(code, 24).toUpperCase();
    if (!needle) return null;
    const pass = store.all('guest_passes').find((g) => g.code.toUpperCase() === needle);
    if (!pass) return null;
    return {
      pass,
      host: store.find('profiles', pass.host_id) ?? null,
      house: pass.house_id ? store.find('houses', pass.house_id) ?? null : null,
    };
  },

  checkIn(actor: Actor, passId: string, direction: 'in' | 'out', note = ''): GateLog {
    assertCan(actor, 'gate.log');
    const p = store.find('guest_passes', passId);
    need(!!p, 'Undangan tamu tidak ditemukan.');
    need(p.status === 'active' || (p.status === 'used' && direction === 'out'),
      p.status === 'revoked' ? 'Undangan ini telah dibatalkan.' : 'Undangan ini tidak berlaku.');
    if (direction === 'in') {
      need(p.visit_date === todayISO(), 'Undangan ini bukan untuk hari ini.');
      store.update('guest_passes', passId, { status: 'used' });
    }
    const log: GateLog = {
      id: uid(), pass_id: passId, direction, guest_name: p.guest_name,
      vehicle_plate: p.vehicle_plate, officer_id: actor.id,
      note: clean(note, LIMITS.note) || null, at: now(),
    };
    store.insert('gate_logs', log);
    audit(actor, `gate.${direction}`, 'gate_logs', log.id);
    notify(p.host_id, {
      title: direction === 'in' ? 'Tamu Anda telah tiba' : 'Tamu Anda telah keluar',
      body: `${p.guest_name} tercatat di pos jaga.`, kind: 'guest', link: '/app/tamu',
    });
    return log;
  },

  /** Walk-in with no pre-registration. */
  logWalkIn(actor: Actor, input: { guest_name: string; vehicle_plate?: string; note?: string; direction: 'in' | 'out' }): GateLog {
    assertCan(actor, 'gate.log');
    const guest_name = clean(input.guest_name, LIMITS.name);
    need(guest_name.length >= 2, 'Nama tamu wajib diisi.');
    const log: GateLog = {
      id: uid(), pass_id: null, direction: input.direction, guest_name,
      vehicle_plate: input.vehicle_plate ? normalisePlate(input.vehicle_plate) : null,
      officer_id: actor.id, note: clean(input.note ?? '', LIMITS.note) || null, at: now(),
    };
    store.insert('gate_logs', log);
    return log;
  },

  gateLog(actor: Actor, limit = 100): GateLog[] {
    assertCan(actor, 'guest.read.all');
    return store.all('gate_logs').slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  },
};

// ══ Notifications ═══════════════════════════════════════════════════════

export const notifications = {
  mine(actor: Actor): Notification[] {
    return store.where('notifications', (n) => n.user_id === actor.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 60);
  },
  unread(actor: Actor): number {
    return store.where('notifications', (n) => n.user_id === actor.id && !n.read).length;
  },
  markRead(actor: Actor, id: string): void {
    const n = store.find('notifications', id);
    if (n?.user_id !== actor.id) return;
    store.update('notifications', id, { read: true });
  },
  markAllRead(actor: Actor): void {
    for (const n of store.where('notifications', (n) => n.user_id === actor.id && !n.read)) {
      store.update('notifications', n.id, { read: true });
    }
  },
};

// ══ Site content (CMS) ══════════════════════════════════════════════════

export const site = {
  get(): SiteContent | null {
    return store.find('site_content', 'default') ?? null;
  },
  save(actor: Actor, patch: Partial<SiteContent>): SiteContent {
    assertCan(actor, 'site.manage');
    const current = site.get();
    need(!!current, 'Konten situs belum tersedia.');
    const next = { ...current, ...patch, id: 'default' as const, updated_at: now() };
    store.update('site_content', 'default', next);
    audit(actor, 'site.update', 'site_content', 'default', { sections: Object.keys(patch) });
    return next;
  },
};

export const auditLog = {
  list(actor: Actor, limit = 200): AuditLog[] {
    assertCan(actor, 'audit.read');
    return store.all('audit_logs').slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  },
};

// ══ Dashboard rollup ════════════════════════════════════════════════════

export function dashboardStats(actor: Actor) {
  const t = todayISO();
  return {
    residents: store.all('profiles').filter((p) => p.status === 'active').length,
    pendingResidents: store.all('profiles').filter((p) => p.status === 'pending').length,
    houses: store.all('houses').length,
    pendingBookings: store.all('equipment_bookings').filter((b) => b.status === 'pending').length,
    activeLoans: store.all('equipment_bookings').filter((b) => b.status === 'picked_up').length,
    overdueLoans: store.all('equipment_bookings').filter((b) => b.status === 'picked_up' && b.end_date < t).length,
    pendingFacility: store.all('facility_bookings').filter((b) => b.status === 'pending').length,
    openComplaints: store.all('complaints').filter((c) => !['resolved', 'closed', 'rejected'].includes(c.status)).length,
    urgentComplaints: store.all('complaints').filter((c) => c.priority === 'urgent' && !['resolved', 'closed'].includes(c.status)).length,
    guestsToday: store.all('guest_passes').filter((g) => g.visit_date === t && g.status !== 'revoked').length,
    upcomingEvents: store.all('events').filter((e) => e.published && e.date >= t).length,
    dues: dues.summary(),
    balance: can(actor, 'finance.read.all') ? ledger.balance(actor) : null,
  };
}
