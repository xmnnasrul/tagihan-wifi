'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getPrimaryRole, normalizeUserRoles, UserRole } from '@/lib/roles';

interface CurrentUser {
  id: string;
  username: string;
  role: string;
  roles: UserRole[];
  profileImage: string;
  hasOriginalProfileImage: boolean;
}

const CurrentUserContext = createContext<CurrentUser | null>(null);
const CurrentUserLoadingContext = createContext(true);

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

export function useCurrentUserLoading() {
  return useContext(CurrentUserLoadingContext);
}

export default function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        setCurrentUser(null);
        return;
      }
      const data = await response.json();
      setCurrentUser(typeof data.user?.role === 'string' ? {
        id: typeof data.user.id === 'string' ? data.user.id : '',
        username: typeof data.user.username === 'string' ? data.user.username : '',
        role: getPrimaryRole(normalizeUserRoles(data.user.role, data.user.roles)) || '',
        roles: normalizeUserRoles(data.user.role, data.user.roles),
        profileImage: typeof data.user.profileImage === 'string' ? data.user.profileImage : '',
        hasOriginalProfileImage: Boolean(data.user.hasOriginalProfileImage),
      } : null);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCurrentUser();
    window.addEventListener('profile-updated', refreshCurrentUser);
    return () => window.removeEventListener('profile-updated', refreshCurrentUser);
  }, [refreshCurrentUser]);

  return (
    <CurrentUserLoadingContext.Provider value={isLoading}>
      <CurrentUserContext.Provider value={currentUser}>{children}</CurrentUserContext.Provider>
    </CurrentUserLoadingContext.Provider>
  );
}