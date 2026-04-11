/**
 * src/lib/rbac.ts
 *
 * Role-based access control helpers shared across the app.
 *
 * Role hierarchy (highest → lowest):
 *   owner > admin > member > viewer
 */

import type { UserRole } from './auth-context';

/** Numeric rank for easy comparison — higher = more privileged. */
const ROLE_RANK: Record<UserRole, number> = {
  owner:  4,
  admin:  3,
  member: 2,
  viewer: 1,
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
 *  - admin can assign member or viewer; cannot assign admin or owner
 *  - member/viewer cannot assign any role
 */
export function canAssignRole(callerRole: UserRole, targetRole: UserRole): boolean {
  if (callerRole === 'owner') return true;
  if (callerRole === 'admin') return targetRole === 'member' || targetRole === 'viewer';
  return false;
}

/**
 * Can `callerRole` change the role of a user who currently has `subjectRole`?
 * An admin cannot change another admin or owner.
 */
export function canChangeRoleOf(callerRole: UserRole, subjectRole: UserRole): boolean {
  if (callerRole === 'owner') return true;
  if (callerRole === 'admin') return subjectRole === 'member' || subjectRole === 'viewer';
  return false;
}

/** member/viewer cannot access team management, settings, or security pages. */
export function canAccessAdminPages(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** All roles may access their own security (sessions) page. */
export function canAccessSecurityPage(_role: UserRole): boolean {
  return true;
}

/** Valid RBAC permission roles accepted in API requests. */
export const VALID_PERMISSION_ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer'];

export function isValidPermissionRole(value: string): value is UserRole {
  return VALID_PERMISSION_ROLES.includes(value as UserRole);
}
