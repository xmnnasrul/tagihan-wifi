export const USER_ROLES = ['user', 'collector', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function normalizeUserRoles(role: unknown, roles: unknown): UserRole[] {
  const assignedRoles: UserRole[] = Array.isArray(roles)
    ? [...new Set<UserRole>(roles.filter((value): value is UserRole => USER_ROLES.includes(value)))]
    : [];
  const normalizedRoles: UserRole[] = assignedRoles.length
    ? assignedRoles
    : USER_ROLES.includes(role as UserRole)
      ? [role as UserRole]
      : ['user'];

  if (normalizedRoles.some((assignedRole) => assignedRole === 'admin' || assignedRole === 'collector')) {
    return normalizedRoles.filter((assignedRole) => assignedRole !== 'user');
  }

  return ['user'];
}

export function getPrimaryRole(roles: UserRole[]): UserRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('collector')) return 'collector';
  return 'user';
}

export function hasUserRole(roles: unknown, role: UserRole): boolean {
  return Array.isArray(roles) && roles.includes(role);
}