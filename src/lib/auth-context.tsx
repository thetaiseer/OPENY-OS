'use client';

import React, { createContext, useContext, useState } from 'react';
import type { User } from './types';

export type UserRole = 'admin' | 'team' | 'client';

const DEFAULT_USER: User = {
  id: '1',
  name: 'Admin',
  email: 'admin@openy.os',
  role: 'admin',
};

interface AuthContextType {
  user: User;
  role: UserRole;
  clientId: string | null;
  setRole: (role: UserRole, clientId?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  role: 'admin',
  clientId: null,
  setRole: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('admin');
  const [clientId, setClientId] = useState<string | null>(null);
  const [user, setUser] = useState<User>(DEFAULT_USER);

  const setRole = (newRole: UserRole, newClientId?: string) => {
    setRoleState(newRole);
    setClientId(newClientId ?? null);
    const nameByRole: Record<UserRole, string> = {
      admin:  'Admin',
      team:   'Team Member',
      client: 'Client User',
    };
    setUser({ ...DEFAULT_USER, role: newRole, name: nameByRole[newRole] });
  };

  return (
    <AuthContext.Provider value={{ user, role, clientId, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
