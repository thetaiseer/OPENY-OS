/**
 * src/lib/rbac.ts
 *
 * Role-based access control helpers shared across the app.
 *
 * Role hierarchy (highest → lowest):
 *   owner > admin > manager > member > viewer
 */

import type { UserRole } from './auth-context';

/** Numeric rank for easy comparison — higher = more privileged. */
const ROLE_RANK: Record<UserRole, number> = {
  owner:   5,
  admin:   4,
  manager: 3,
  member:  2,
  viewer:  1,
};

/** Returns true if `role` is at least as privileged as `required`. */
export function hasRole(role: UserRole, required: UserRole): boolean {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[required] ?? 0);
}

/** Owner or admin can manage (invite, edit, remove) team members. */
export function canManageMembers(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Can `callerRole` assign `targetRole` to someone?
 *
 * Rules:
 *  - owner can assign any role including owner
 *  - admin can assign manager, member, or viewer; cannot assign admin or owner
 *  - manager/member/viewer cannot assign any role
 */
export function canAssignRole(callerRole: UserRole, targetRole: UserRole): boolean {
  if (callerRole === 'owner') return true;
  if (callerRole === 'admin') return targetRole === 'manager' || targetRole === 'member' || targetRole === 'viewer';
  return false;
}

/**
 * Can `callerRole` change the role of a user who currently has `subjectRole`?
 * An admin cannot change another admin or owner.
 */
export function canChangeRoleOf(callerRole: UserRole, subjectRole: UserRole): boolean {
  if (callerRole === 'owner') return true;
  if (callerRole === 'admin') return subjectRole === 'manager' || subjectRole === 'member' || subjectRole === 'viewer';
  return false;
}

/** member/viewer cannot access team management, settings, or security pages. */
export function canAccessAdminPages(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** Valid RBAC permission roles accepted in API requests. */
export const VALID_PERMISSION_ROLES: UserRole[] = ['owner', 'admin', 'manager', 'member', 'viewer'];

/** Valid roles that can be assigned when inviting a new team member (excludes owner). */
export const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'manager', 'member', 'viewer'];

export function isValidPermissionRole(value: string): value is UserRole {
  return VALID_PERMISSION_ROLES.includes(value as UserRole);
}
