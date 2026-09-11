import type { AppRole } from './permissions';

/**
 * What each role is called on screen.
 *
 * Its own module because the sign-in page's demo panel is a client component
 * and needs these five strings, and the module they used to live in reaches
 * for the service-role client and the server environment. Importing one
 * constant from there put Supabase's admin client and Zod in the sign-in
 * page's bundle. This file imports a type and nothing else.
 */
export const ROLE_LABELS: Record<AppRole, string> = {
  developer_admin: 'Developer Admin',
  owner: 'Owner',
  branch_manager: 'Branch Manager',
  kitchen_staff: 'Kitchen Staff',
  customer: 'Customer',
};
