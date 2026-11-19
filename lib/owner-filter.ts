export interface OwnerScope {
  ownerId: unknown;
  isSuperadmin: boolean;
}

/**
 * Filter query untuk data milik akun aktif. Superadmin melihat semua data.
 * Modul ini sengaja bebas dari mongoose agar mudah dites.
 */
export function getOwnerFilter(scope: OwnerScope): Record<string, unknown> {
  return scope.isSuperadmin ? {} : { ownerId: scope.ownerId };
}
