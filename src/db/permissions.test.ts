import { can, canTouch, assignableRoles, hasBackofficeAccess, type Actor } from './permissions';
import type { Role } from './schema';

let pass = 0, fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n       got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}
const a = (role: Role, status: Actor['status'] = 'active', id = 'u1'): Actor => ({ id, role, status });

console.log('\nPRIVILEGE ESCALATION');
eq('resident cannot approve bookings', can(a('resident'), 'booking.approve'), false);
eq('resident cannot manage users', can(a('resident'), 'user.manage'), false);
eq('resident cannot read all finance', can(a('resident'), 'finance.read.all'), false);
eq('security cannot approve bookings', can(a('security'), 'booking.approve'), false);
eq('security cannot manage finance', can(a('security'), 'finance.manage'), false);
eq('treasurer cannot approve bookings', can(a('treasurer'), 'booking.approve'), false);
eq('rt cannot manage equipment inventory', can(a('rt'), 'equipment.manage'), false);
eq('rw cannot manage users', can(a('rw'), 'user.manage'), false);
eq('rw cannot assign roles', can(a('rw'), 'role.assign'), false);
eq('admin can manage users', can(a('admin'), 'user.manage'), true);

console.log('\nINACTIVE ACCOUNTS HAVE NO POWER');
eq('pending admin cannot manage users', can(a('admin', 'pending'), 'user.manage'), false);
eq('suspended admin cannot manage users', can(a('admin', 'suspended'), 'user.manage'), false);
eq('suspended resident cannot even book', can(a('resident', 'suspended'), 'booking.create'), false);
eq('pending resident cannot read announcements', can(a('resident', 'pending'), 'announcement.read'), false);
eq('null actor has nothing', can(null, 'announcement.read'), false);

console.log('\nOWNERSHIP');
eq('owner may touch own record', canTouch(a('resident', 'active', 'me'), 'me', 'booking.read.all'), true);
eq('stranger may not touch', canTouch(a('resident', 'active', 'me'), 'other', 'booking.read.all'), false);
eq('rt may touch anyone (escalated)', canTouch(a('rt', 'active', 'me'), 'other', 'booking.read.all'), true);
eq('suspended owner may not touch own', canTouch(a('resident', 'suspended', 'me'), 'me', 'booking.read.all'), false);

console.log('\nROLE ASSIGNMENT CEILING');
eq('admin may assign below admin', assignableRoles(a('admin')), ['resident','security','treasurer','rt','rw']);
eq('rw may assign nothing (no role.assign)', assignableRoles(a('rw')), []);
eq('resident may assign nothing', assignableRoles(a('resident')), []);

console.log('\nBACKOFFICE GATE');
eq('resident has no backoffice', hasBackofficeAccess('resident'), false);
eq('security has backoffice', hasBackofficeAccess('security'), true);
eq('admin has backoffice', hasBackofficeAccess('admin'), true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
