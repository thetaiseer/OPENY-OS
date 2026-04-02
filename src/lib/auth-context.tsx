'use client';

import React, { createContext, useContext } from 'react';
import type { User } from './types';

const DEFAULT_USER: User = {
  id: '1',
  name: 'Admin',
  email: 'admin@openy.os',
  role: 'admin',
};

interface AuthContextType {
  user: User;
}

const AuthContext = createContext<AuthContextType>({ user: DEFAULT_USER });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: DEFAULT_USER }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
