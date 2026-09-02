import { revalidatePath } from 'next/cache';
import { requireAnyPermission, can } from '@/lib/auth/session';
import { PERMISSIONS, type AppRole } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { dateOnly, dateTime } from '@/lib/format';
import { codify, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Select,
} from '@/components/ui/primitives';

export const metadata = { title: 'Employees' };

const PATH = '/admin/employees';

const STAFF_ROLE_LABELS: Record<string, string> = {
  developer_admin: 'Developer Admin',
  owner: 'Owner',
  branch_manager: 'Branch Manager',
  kitchen_staff: 'Kitchen Staff',
};

/**
 * Supabase enforces its own minimum, but a shared kitchen tablet is a poor
 * place for a six-character password.
 */
const MIN_PASSWORD_LENGTH = 12;

interface EmployeeRow {
  id: string;
  profile_id: string;
  employee_code: string;
  display_name: string;
  role: string;
  hired_on: string | null;
  is_active: boolean;
  notes: string | null;
  auth_profiles: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
  } | null;
}

/**
 * Staff accounts (PRD 5).
 *
 * Role *quantities* are never hardcoded -- a fourth kitchen hand is a row, not
 * a deploy. What each role may do is separately data too (`role_permissions`),
 * so this screen assigns a role and never a permission.
 *
 * Creating the login itself is the one thing that needs the service key, since
 * there is no signed-in user to create yet. Everything after that -- the role,
 * the employment record -- goes through the Owner's own token, so RLS still
 * applies and the audit trail names them rather than "system".
 */
export default async function EmployeesPage({ searchParams }: PageProps<'/admin/employees'>) {
  const session = await requireAnyPermission([
    PERMISSIONS.employeesView,
    PERMISSIONS.employeesManage,
  ]);
  const params = await searchParams;
  const supabase = await serverClient();

  const [employeesResult, permissionsResult] = await Promise.all([
    supabase
      .from('employees')
      .select(
        `id, profile_id, employee_code, display_name, role, hired_on, is_active, notes,
         auth_profiles ( id, full_name, email, phone, role, is_active, last_login_at )`,
      )
      .order('role')
      .order('display_name'),
    supabase.from('role_permissions').select('role, permission_code'),
  ]);

  const employees = (employeesResult.data ?? []) as unknown as EmployeeRow[];

  const permissionCounts = new Map<string, number>();
  for (const row of (permissionsResult.data ?? []) as Array<{ role: string }>) {
    permissionCounts.set(row.role, (permissionCounts.get(row.role) ?? 0) + 1);
  }

  const canManage = can(session, PERMISSIONS.employeesManage);
  // Only an existing Developer Admin may mint another one. The Owner runs the
  // business; they do not hand out system-level access.
  const canGrantDeveloper = session.role === 'developer_admin';

  const assignableRoles = (
    ['owner', 'branch_manager', 'kitchen_staff'] as AppRole[]
  ).concat(canGrantDeveloper ? (['developer_admin'] as AppRole[]) : []);

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  async function createEmployee(formData: FormData) {
    'use server';

    const fullName = str(formData, 'fullName');
    const email = str(formData, 'email').toLowerCase();
    const password = String(formData.get('password') ?? '');
    const role = str(formData, 'role');
    const phone = str(formData, 'phone');

    if (!fullName || !email) fail(PATH, 'A staff account needs a name and an email.');
    if (password.length < MIN_PASSWORD_LENGTH) {
      fail(PATH, `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (!assignableRoles.includes(role as AppRole)) {
      fail(PATH, 'You cannot assign that role.');
    }

    // Step 1: the login. No user exists yet, so there is nobody whose token
    // could do this -- the service key is the only way in.
    const auth = adminClient();
    const { data: created, error: authError } = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !created?.user) {
      fail(PATH, authError?.message ?? 'Could not create that login.');
    }

    const profileId = created.user.id;

    // Step 2 onwards runs as the Owner, so RLS and the audit trigger apply.
    const db = await serverClient();

    const { error: profileError } = await db
      .from('auth_profiles')
      .update({ full_name: fullName, role, phone: phone || null, is_active: true })
      .eq('id', profileId);

    if (profileError) {
      // Do not leave a usable login behind that nobody granted a role to.
      await auth.auth.admin.deleteUser(profileId);
      fail(PATH, readable(profileError));
    }

    const { error: employeeError } = await db.from('employees').insert({
      profile_id: profileId,
      employee_code: codify(str(formData, 'employeeCode') || fullName),
      display_name: fullName,
      role,
      hired_on: str(formData, 'hiredOn') || null,
      notes: str(formData, 'notes') || null,
    });

    if (employeeError) {
      await auth.auth.admin.deleteUser(profileId);
      fail(PATH, readable(employeeError));
    }

    revalidatePath(PATH);
    done(PATH, `${fullName} can now sign in as ${STAFF_ROLE_LABELS[role] ?? role}.`);
  }

  async function updateEmployee(formData: FormData) {
    'use server';

    const employeeId = str(formData, 'employeeId');
    const profileId = str(formData, 'profileId');
    const db = await serverClient();

    // A role the caller may not assign is still fine to leave alone -- an Owner
    // editing a Developer Admin's name should not be told they cannot assign a
    // role they are not trying to change. The current role is read back from
    // the database rather than trusted from the form, so "unchanged" cannot be
    // asserted into a promotion.
    const { data: existing } = await db
      .from('employees')
      .select('role')
      .eq('id', employeeId)
      .maybeSingle();

    const currentRole = (existing as { role: string } | null)?.role ?? '';
    const role = str(formData, 'role') || currentRole;

    if (role !== currentRole && !assignableRoles.includes(role as AppRole)) {
      fail(PATH, 'You cannot assign that role.');
    }
    if (profileId === session.id) {
      // The privilege guard in the database would refuse this anyway; saying so
      // here is friendlier than a constraint error.
      fail(PATH, 'You cannot change your own role.');
    }

    const displayName = str(formData, 'displayName');

    const { error: employeeError } = await db
      .from('employees')
      .update({
        display_name: displayName,
        employee_code: codify(str(formData, 'employeeCode')),
        role,
        notes: str(formData, 'notes') || null,
      })
      .eq('id', employeeId);

    if (employeeError) fail(PATH, readable(employeeError));

    // The employees row and the profile must agree, or someone's badge says one
    // thing while their permissions say another.
    const { error: profileError } = await db
      .from('auth_profiles')
      .update({ role, full_name: displayName })
      .eq('id', profileId);

    if (profileError) fail(PATH, readable(profileError));

    revalidatePath(PATH);
    done(PATH, 'Staff record updated.');
  }

  async function setEmployeeActive(formData: FormData) {
    'use server';

    const activate = str(formData, 'activate') === 'true';
    const profileId = str(formData, 'profileId');

    if (profileId === session.id) fail(PATH, 'You cannot deactivate your own account.');

    const db = await serverClient();

    const { error } = await db
      .from('employees')
      .update({ is_active: activate })
      .eq('id', str(formData, 'employeeId'));

    if (error) fail(PATH, readable(error));

    // Disabling the profile is what actually stops them signing in --
    // getSession() refuses an inactive profile.
    const { error: profileError } = await db
      .from('auth_profiles')
      .update({
        is_active: activate,
        disabled_at: activate ? null : new Date().toISOString(),
        disabled_reason: activate ? null : str(formData, 'reason') || 'Left the business',
      })
      .eq('id', profileId);

    if (profileError) fail(PATH, readable(profileError));

    revalidatePath(PATH);
    done(PATH, activate ? 'Account re-enabled.' : 'Account disabled. History is preserved.');
  }

  const byRole = assignableRoles
    .concat(canGrantDeveloper ? [] : (['developer_admin'] as AppRole[]))
    .map((role) => ({
      role,
      members: employees.filter((employee) => employee.role === role),
    }))
    .filter((group) => group.members.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SectionHeading
        title="Employees"
        description="Staff accounts and the role each one holds. What a role may do is configured separately — this screen never grants a permission directly."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      {canManage ? (
        <Card className="mb-8 p-5">
          <h2 className="font-semibold">Add a staff account</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            They sign in with this email and password and land on the screen their role uses.
          </p>

          <form action={createEmployee} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name" required>
              <Input name="fullName" required />
            </Field>

            <Field label="Email" required>
              <Input name="email" type="email" required autoComplete="off" />
            </Field>

            <Field
              label="Temporary password"
              required
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            >
              <Input
                name="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Role" required>
              <Select name="role" defaultValue="kitchen_staff">
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {STAFF_ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Employee code" hint="Derived from the name if left blank.">
              <Input name="employeeCode" placeholder="KITCHEN_01" />
            </Field>

            <Field label="Mobile">
              <Input name="phone" inputMode="tel" />
            </Field>

            <Field label="Hired on">
              <Input name="hiredOn" type="date" />
            </Field>

            <Field label="Notes">
              <Input name="notes" />
            </Field>

            <div className="flex items-end">
              <Button type="submit">Create account</Button>
            </div>
          </form>

          {!canGrantDeveloper ? (
            <p className="mt-4 text-xs text-subtle">
              Developer Admin accounts can only be created by an existing Developer Admin.
            </p>
          ) : null}
        </Card>
      ) : null}

      {employees.length === 0 ? (
        <EmptyState
          title="No staff accounts yet"
          description="Add the Branch Manager and the kitchen team above."
        />
      ) : (
        <div className="space-y-8">
          {byRole.map((group) => (
            <section key={group.role}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-subtle uppercase">
                {STAFF_ROLE_LABELS[group.role]}
                <span className="text-xs font-normal normal-case">
                  {permissionCounts.get(group.role) ?? 0} permissions · {group.members.length}{' '}
                  account(s)
                </span>
              </h2>

              <div className="space-y-3">
                {group.members.map((employee) => {
                  const profile = employee.auth_profiles;
                  const signedOut = !profile?.is_active || !employee.is_active;
                  const isSelf = employee.profile_id === session.id;

                  return (
                    <Card key={employee.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{employee.display_name}</span>
                        <span className="font-mono text-xs text-subtle">
                          {employee.employee_code}
                        </span>
                        {signedOut ? (
                          <Badge tone="danger">Disabled</Badge>
                        ) : (
                          <Badge tone="success">Active</Badge>
                        )}
                        {isSelf ? <Badge tone="neutral">You</Badge> : null}
                        {profile && profile.role !== employee.role ? (
                          <Badge tone="warning">Role mismatch</Badge>
                        ) : null}
                      </div>

                      <p className="mt-0.5 text-xs text-subtle">
                        {profile?.email ?? 'no email'}
                        {profile?.phone ? ` · ${profile.phone}` : ''}
                        {employee.hired_on ? ` · hired ${dateOnly(employee.hired_on)}` : ''}
                        {profile?.last_login_at
                          ? ` · last signed in ${dateTime(profile.last_login_at)}`
                          : ' · never signed in'}
                      </p>

                      {canManage && !isSelf ? (
                        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
                          <form action={updateEmployee} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="employeeId" value={employee.id} />
                            <input type="hidden" name="profileId" value={employee.profile_id} />

                            <Field label="Name">
                              <Input
                                name="displayName"
                                defaultValue={employee.display_name}
                                className="w-48"
                              />
                            </Field>

                            <Field label="Code">
                              <Input
                                name="employeeCode"
                                defaultValue={employee.employee_code}
                                className="w-36"
                              />
                            </Field>

                            <Field label="Role">
                              <Select
                                name="role"
                                defaultValue={employee.role}
                                className="w-44"
                                disabled={
                                  employee.role === 'developer_admin' && !canGrantDeveloper
                                }
                              >
                                {assignableRoles.map((role) => (
                                  <option key={role} value={role}>
                                    {STAFF_ROLE_LABELS[role]}
                                  </option>
                                ))}
                              </Select>
                            </Field>

                            <Field label="Notes">
                              <Input
                                name="notes"
                                defaultValue={employee.notes ?? ''}
                                className="w-56"
                              />
                            </Field>

                            <Button type="submit" size="md" variant="secondary">
                              Save
                            </Button>
                          </form>

                          <form action={setEmployeeActive} className="ml-auto flex items-end gap-2">
                            <input type="hidden" name="employeeId" value={employee.id} />
                            <input type="hidden" name="profileId" value={employee.profile_id} />
                            <input
                              type="hidden"
                              name="activate"
                              value={signedOut ? 'true' : 'false'}
                            />
                            {!signedOut ? (
                              <Field label="Reason">
                                <Input name="reason" className="w-48" placeholder="Left the team" />
                              </Field>
                            ) : null}
                            {signedOut ? (
                              <Button type="submit" size="md" variant="success">
                                Re-enable
                              </Button>
                            ) : (
                              <ConfirmButton
                                size="md"
                                variant="danger"
                                confirmLabel="Really disable?"
                              >
                                Disable login
                              </ConfirmButton>
                            )}
                          </form>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Alert tone="info">
          Disabling a login never deletes the person. Their tickets, decisions and audit entries
          stay attributed to them, which is the point of keeping the record.
        </Alert>
      </div>
    </div>
  );
}
