import { Types } from 'mongoose';
import { getCurrentUser } from '@/lib/session';
import User from '@/lib/models/User';
import { normalizeUserRoles } from '@/lib/roles';

export interface DataOwnerScope {
  ownerId: Types.ObjectId;
  isSuperadmin: boolean;
}

export async function getDataOwnerScope(): Promise<DataOwnerScope> {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Authenticated user is required to determine data ownership');

  const account = await User.findOne({ username: currentUser.username, isActive: { $ne: false } })
    .select('_id role roles')
    .lean();
  if (!account) throw new Error('Active account was not found while determining data ownership');

  return {
    ownerId: new Types.ObjectId(account._id.toString()),
    isSuperadmin: normalizeUserRoles(account.role, account.roles).includes('superadmin'),
  };
}

export function getOwnerFilter(scope: DataOwnerScope): Record<string, unknown> {
  return scope.isSuperadmin ? {} : { ownerId: scope.ownerId };
}
