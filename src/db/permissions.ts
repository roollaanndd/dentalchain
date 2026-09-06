/**
 * Authorisation.
 *
 * Every capability in the app is named here, and every mutation in the data
 * layer asks `can()` before it runs. Hiding a button is presentation; this
 * is the rule. When the Supabase adapter is switched on, the RLS policies in
 * supabase/migrations/0001_init.sql mirror this table exactly — that is the
 * boundary that actually holds, because it runs on the server.
 */

import type { Role } from './schema';

export const ROLE_RANK: Record<Role, number> = {
  resident: 10,
  security: 20,
  treasurer: 30,
  rt: 40,
  rw: 50,
  admin: 60,
};

export const ROLE_LABEL: Record<Role, string> = {
  resident: 'Warga',
  security: 'Satpam',
  treasurer: 'Bendahara',
  rt: 'Ketua RT',
  rw: 'Ketua RW',
  admin: 'Administrator',
};

export type Capability =
  // self-service — every active resident has these
  | 'profile.read.own' | 'profile.update.own'
  | 'household.manage.own' | 'vehicle.manage.own'
  | 'booking.create' | 'booking.cancel.own' | 'booking.read.own'
  | 'facility.book' | 'complaint.create' | 'complaint.read.own'
  | 'dues.read.own' | 'dues.pay.own'
  | 'guest.create.own' | 'guest.revoke.own'
  | 'event.rsvp' | 'announcement.read' | 'finance.read.published'
  // operational
  | 'booking.approve' | 'booking.handover' | 'booking.read.all'
  | 'facility.approve'
  | 'complaint.triage' | 'complaint.read.all' | 'complaint.assign'
  | 'equipment.manage' | 'facility.manage'
  | 'announcement.manage' | 'event.manage'
  | 'resident.read.all' | 'resident.verify'
  | 'gate.log' | 'guest.read.all'
  // financial
  | 'dues.manage' | 'dues.verify' | 'finance.manage' | 'finance.read.all'
  // administrative
  | 'user.manage' | 'role.assign' | 'site.manage' | 'audit.read';

const RESIDENT: Capability[] = [
  'profile.read.own', 'profile.update.own',
  'household.manage.own', 'vehicle.manage.own',
  'booking.create', 'booking.cancel.own', 'booking.read.own',
  'facility.book', 'complaint.create', 'complaint.read.own',
  'dues.read.own', 'dues.pay.own',
  'guest.create.own', 'guest.revoke.own',
  'event.rsvp', 'announcement.read', 'finance.read.published',
];

const SECURITY: Capability[] = [
  ...RESIDENT,
  'gate.log', 'guest.read.all', 'complaint.read.all', 'resident.read.all',
];

const TREASURER: Capability[] = [
  ...RESIDENT,
  'dues.manage', 'dues.verify', 'finance.manage', 'finance.read.all',
  'resident.read.all',
];

const RT: Capability[] = [
  ...RESIDENT,
  'booking.approve', 'booking.handover', 'booking.read.all',
  'facility.approve',
  'complaint.triage', 'complaint.read.all', 'complaint.assign',
  'resident.read.all', 'resident.verify',
  'guest.read.all', 'announcement.manage', 'event.manage',
];

const RW: Capability[] = [
  ...RT, ...TREASURER,
  'equipment.manage', 'facility.manage', 'gate.log', 'site.manage', 'audit.read',
];

const ADMIN: Capability[] = [
  ...RW, 'user.manage', 'role.assign',
];

const MATRIX: Record<Role, ReadonlySet<Capability>> = {
  resident: new Set(RESIDENT),
  security: new Set(SECURITY),
  treasurer: new Set(TREASURER),
  rt: new Set(RT),
  rw: new Set(RW),
  admin: new Set(ADMIN),
};

export interface Actor {
  id: string;
  role: Role;
  status: 'pending' | 'active' | 'suspended';
}

/**
 * The one authorisation question. A suspended or unapproved account has no
 * capabilities at all, whatever its role says.
 */
export function can(actor: Actor | null, cap: Capability): boolean {
  if (!actor) return false;
  if (actor.status !== 'active') return false;
  return MATRIX[actor.role]?.has(cap) ?? false;
}

/** Throwing variant for the data layer's write paths. */
export class ForbiddenError extends Error {
  constructor(cap: Capability) {
    super(`Akses ditolak: Anda tidak memiliki izin untuk tindakan ini (${cap}).`);
    this.name = 'ForbiddenError';
  }
}

export function assertCan(actor: Actor | null, cap: Capability): void {
  if (!can(actor, cap)) throw new ForbiddenError(cap);
}

/**
 * Ownership check for the many "…own" capabilities: an actor may act on a
 * record if they own it, OR if they hold the corresponding ".all" power.
 */
export function canTouch(actor: Actor | null, ownerId: string, escalated: Capability): boolean {
  if (!actor || actor.status !== 'active') return false;
  if (actor.id === ownerId) return true;
  return can(actor, escalated);
}

/** Roles an actor is allowed to grant. Nobody may grant at or above themselves. */
export function assignableRoles(actor: Actor | null): Role[] {
  if (!can(actor, 'role.assign') || !actor) return [];
  const ceiling = ROLE_RANK[actor.role];
  return (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] < ceiling);
}

/** Does this role see the admin console at all? */
export function hasBackofficeAccess(role: Role): boolean {
  return ROLE_RANK[role] > ROLE_RANK.resident;
}
