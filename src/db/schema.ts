/**
 * Burgundy Residences — canonical entity model.
 *
 * This file is the single source of truth for the shape of every record in
 * the system. The IndexedDB driver, the Supabase adapter and the SQL
 * migration in supabase/migrations/ all agree with what is written here;
 * when you change a type here, change the migration in the same commit.
 */

// ── Identity & access ───────────────────────────────────────────────────

/** Ordered by privilege. `rank()` in permissions.ts depends on this order. */
export type Role =
  | 'resident'   // warga — the default for every approved account
  | 'security'   // satpam — gate log, guest verification
  | 'treasurer'  // bendahara — dues + finance
  | 'rt'         // ketua RT — their own RT's residents & complaints
  | 'rw'         // ketua RW — everything operational
  | 'admin';     // full control incl. user management

export type AccountStatus = 'pending' | 'active' | 'suspended';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  status: AccountStatus;
  house_id: string | null;
  avatar_url: string | null;
  occupation: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  /** Set once an RT/RW/admin has verified this person really lives here. */
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Auth material. Never leaves the local driver; Supabase Auth replaces it. */
export interface Credential {
  user_id: string;
  email: string;
  /** PBKDF2-SHA256, 210k iterations. Base64. Never a plaintext password. */
  hash: string;
  salt: string;
  iterations: number;
  failed_attempts: number;
  /** Epoch ms. Set after repeated failures to throttle brute force. */
  locked_until: number | null;
}

export interface Session {
  token: string;
  user_id: string;
  issued_at: number;
  expires_at: number;
}

// ── Place ───────────────────────────────────────────────────────────────

export interface House {
  id: string;
  block: string;          // "A", "B", "C"
  number: string;         // "12"
  street: string;
  rt: string;             // "001"
  rw: string;             // "007"
  /** owner | tenant — who the primary occupant is to the property. */
  tenure: 'owner' | 'tenant';
  occupied: boolean;
  created_at: string;
}

export type Relation = 'kepala_keluarga' | 'istri' | 'suami' | 'anak' | 'orang_tua' | 'kerabat' | 'art' | 'lainnya';

export interface HouseholdMember {
  id: string;
  house_id: string;
  full_name: string;
  relation: Relation;
  gender: 'L' | 'P';
  birth_date: string | null;
  /** Stored masked (last 4 only) — we never keep a full NIK client-side. */
  nik_last4: string | null;
  phone: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  house_id: string;
  kind: 'mobil' | 'motor' | 'sepeda' | 'lainnya';
  plate: string;
  brand: string | null;
  color: string | null;
  sticker_no: string | null;
  created_at: string;
}

// ── Equipment lending (inventaris RW) ───────────────────────────────────

export type EquipmentCategory =
  | 'kursi' | 'meja' | 'karpet' | 'tenda' | 'audio' | 'pendingin'
  | 'dapur' | 'kebersihan' | 'olahraga' | 'lainnya';

export type Condition = 'baik' | 'layak' | 'perlu_perbaikan' | 'rusak';

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  description: string;
  /** Total units the RW owns. Availability is derived, never stored. */
  total_qty: number;
  unit: string;                   // "buah", "set", "meter"
  /** Refundable deposit in IDR. 0 = none. */
  deposit: number;
  /** Rental fee per day in IDR. 0 = free for residents. */
  fee_per_day: number;
  condition: Condition;
  image_url: string | null;
  /** Max days a single booking may span. Guards against indefinite holds. */
  max_days: number;
  /** Whether residents can book it at all right now. */
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Booking lifecycle:
 *   pending ──approve──> approved ──pickup──> picked_up ──return──> returned
 *      │                    │
 *      └──reject──> rejected└──cancel──> cancelled
 *
 * BLOCKING_BOOKING_STATUSES below defines which of these hold inventory.
 */
export type BookingStatus =
  | 'pending' | 'approved' | 'picked_up' | 'returned' | 'rejected' | 'cancelled';

/** Statuses that reserve stock. Anything else frees the units again. */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  'pending', 'approved', 'picked_up',
] as const;

export interface EquipmentBooking {
  id: string;
  /** Human-facing code, e.g. BR-P-4KX92. Residents quote this at the pos RW. */
  code: string;
  equipment_id: string;
  user_id: string;
  house_id: string | null;
  qty: number;
  start_date: string;             // YYYY-MM-DD, inclusive
  end_date: string;               // YYYY-MM-DD, inclusive
  purpose: string;
  status: BookingStatus;
  deposit_amount: number;
  fee_amount: number;
  deposit_returned: boolean;
  condition_out: Condition | null;
  condition_in: Condition | null;
  handled_by: string | null;      // profile id of the officer
  decided_at: string | null;
  picked_up_at: string | null;
  returned_at: string | null;
  /** Why an officer rejected it — shown to the resident. */
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Facilities (balai warga, lapangan, musholla) ────────────────────────

export interface Facility {
  id: string;
  name: string;
  description: string;
  capacity: number;
  image_url: string | null;
  fee_per_session: number;
  /** Bookable window, local clock. */
  open_time: string;              // "06:00"
  close_time: string;             // "22:00"
  active: boolean;
  created_at: string;
}

export interface FacilityBooking {
  id: string;
  code: string;
  facility_id: string;
  user_id: string;
  date: string;                   // YYYY-MM-DD
  start_time: string;             // "09:00"
  end_time: string;               // "12:00"
  purpose: string;
  attendees: number;
  status: BookingStatus;
  fee_amount: number;
  handled_by: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Dues (IPL) & finance ────────────────────────────────────────────────

export type DuesStatus = 'unpaid' | 'awaiting_verification' | 'paid' | 'waived' | 'overdue';

export interface DuesInvoice {
  id: string;
  house_id: string;
  /** Billing period as YYYY-MM. Unique together with house_id. */
  period: string;
  amount: number;
  status: DuesStatus;
  due_date: string;
  paid_at: string | null;
  method: 'transfer' | 'tunai' | 'qris' | null;
  /** Uploaded transfer proof, pending treasurer verification. */
  proof_url: string | null;
  verified_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type LedgerKind = 'income' | 'expense';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  category: string;               // "IPL", "Kebersihan", "Keamanan", ...
  amount: number;
  date: string;
  description: string;
  receipt_url: string | null;
  /** Only published entries appear on the residents' transparency report. */
  published: boolean;
  created_by: string;
  created_at: string;
}

// ── Communication ───────────────────────────────────────────────────────

export type AnnouncementCategory = 'umum' | 'keamanan' | 'kebersihan' | 'kegiatan' | 'darurat' | 'keuangan';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  published: boolean;
  image_url: string | null;
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  category: 'kerja_bakti' | 'rapat' | 'perayaan' | 'olahraga' | 'posyandu' | 'keagamaan' | 'lainnya';
  date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  image_url: string | null;
  rsvp_enabled: boolean;
  capacity: number | null;
  published: boolean;
  created_by: string;
  created_at: string;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  guests: number;
  status: 'going' | 'maybe' | 'not_going';
  created_at: string;
}

// ── Complaints (lapor warga) ────────────────────────────────────────────

export type ComplaintCategory =
  | 'jalan' | 'sampah' | 'keamanan' | 'air' | 'listrik' | 'saluran' | 'fasum' | 'kebisingan' | 'lainnya';
export type ComplaintStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface Complaint {
  id: string;
  code: string;
  user_id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: Priority;
  status: ComplaintStatus;
  location: string;
  photo_url: string | null;
  assignee_id: string | null;
  /** Resident may file without their name shown to other residents. */
  anonymous: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplaintUpdate {
  id: string;
  complaint_id: string;
  author_id: string;
  body: string;
  /** Status this update moved the complaint to, if any. */
  status_change: ComplaintStatus | null;
  /** Internal notes are hidden from the reporting resident. */
  internal: boolean;
  created_at: string;
}

// ── Guests & gate ───────────────────────────────────────────────────────

export type GuestPassStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface GuestPass {
  id: string;
  /** Short code the guest shows at the gate. Also encoded in the QR. */
  code: string;
  host_id: string;
  house_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  party_size: number;
  vehicle_plate: string | null;
  visit_date: string;
  valid_from: string;             // "08:00"
  valid_until: string;            // "22:00"
  purpose: string;
  status: GuestPassStatus;
  created_at: string;
}

export interface GateLog {
  id: string;
  pass_id: string | null;
  direction: 'in' | 'out';
  guest_name: string;
  vehicle_plate: string | null;
  /** Which satpam recorded it. */
  officer_id: string | null;
  note: string | null;
  at: string;
}

// ── Site content (CMS) ──────────────────────────────────────────────────

export interface SiteContent {
  id: 'default';
  schema_version: number;
  brand: { name: string; tagline: string; established: string; logo_url: string | null };
  hero: { eyebrow: string; title: string; subtitle: string; image_url: string | null; cta_label: string };
  about: { title: string; body: string; image_url: string | null; stats: { label: string; value: string }[] };
  facilities_intro: { title: string; body: string };
  contact: {
    address: string; phone: string; email: string;
    whatsapp: string; maps_url: string;
    office_hours: string;
  };
  emergency: { label: string; phone: string }[];
  officers: { name: string; position: string; phone: string; photo_url: string | null }[];
  gallery: { url: string; caption: string }[];
  faq: { q: string; a: string }[];
  /** Bank details shown on the dues screen. */
  payment: { bank: string; account_no: string; account_name: string; qris_url: string | null };
  updated_at: string;
}

// ── Audit ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;                 // "booking.approve", "profile.update"
  entity: string;
  entity_id: string;
  meta: Record<string, unknown>;
  at: string;
}

// ── Notifications ───────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  kind: 'booking' | 'dues' | 'complaint' | 'announcement' | 'event' | 'guest' | 'system';
  link: string | null;
  read: boolean;
  created_at: string;
}

// ── The database shape the drivers implement ────────────────────────────

export interface DatabaseShape {
  profiles: Profile;
  credentials: Credential;
  sessions: Session;
  houses: House;
  household_members: HouseholdMember;
  vehicles: Vehicle;
  equipment: Equipment;
  equipment_bookings: EquipmentBooking;
  facilities: Facility;
  facility_bookings: FacilityBooking;
  dues_invoices: DuesInvoice;
  ledger_entries: LedgerEntry;
  announcements: Announcement;
  events: CommunityEvent;
  event_rsvps: EventRsvp;
  complaints: Complaint;
  complaint_updates: ComplaintUpdate;
  guest_passes: GuestPass;
  gate_logs: GateLog;
  site_content: SiteContent;
  audit_logs: AuditLog;
  notifications: Notification;
}

export type TableName = keyof DatabaseShape;

/** Tables the local driver persists. `sessions` is deliberately included so
 *  a refresh keeps you logged in; `credentials` never leaves this device. */
export const TABLES: readonly TableName[] = [
  'profiles', 'credentials', 'sessions', 'houses', 'household_members', 'vehicles',
  'equipment', 'equipment_bookings', 'facilities', 'facility_bookings',
  'dues_invoices', 'ledger_entries', 'announcements', 'events', 'event_rsvps',
  'complaints', 'complaint_updates', 'guest_passes', 'gate_logs',
  'site_content', 'audit_logs', 'notifications',
] as const;
