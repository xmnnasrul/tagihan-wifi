export const USER_ROLES = ['admin', 'superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function normalizeUserRoles(role: unknown, roles: unknown): UserRole[] {
  const assignedRoles: UserRole[] = Array.isArray(roles)
    ? [...new Set<UserRole>(roles.filter((value): value is UserRole => USER_ROLES.includes(value)))]
    : [];
  if (assignedRoles.length) return assignedRoles;
  if (Array.isArray(roles) && roles.includes('collector')) return ['admin'];
  if (role === 'collector') return ['admin'];
  return USER_ROLES.includes(role as UserRole) ? [role as UserRole] : [];
}

export function getPrimaryRole(roles: UserRole[]): UserRole | null {
  if (roles.includes('superadmin')) return 'superadmin';
  if (roles.includes('admin')) return 'admin';
  return null;
}

export function hasUserRole(roles: unknown, role: UserRole): boolean {
  return Array.isArray(roles) && roles.includes(role);
}

export function hasAnyRole(roles: readonly UserRole[], allowedRoles: readonly UserRole[]): boolean {
  return allowedRoles.some((allowedRole) => roles.includes(allowedRole));
}

export function canAccessApi(
  isAuthenticated: boolean,
  roles: readonly UserRole[],
  allowedRoles?: readonly UserRole[]
): boolean {
  return isAuthenticated && roles.length > 0 && (!allowedRoles || hasAnyRole(roles, allowedRoles));
}