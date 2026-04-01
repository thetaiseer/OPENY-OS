"use client";

import { createContext, useContext } from "react";

// Auth has been removed. This stub keeps imports compiling.

const AUTH_VALUE = {
  user: null,
  member: null,
  role: null,
  loading: false,
  isAdmin: false,
  isAccountManager: false,
  isCreative: false,
  signIn: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
};

const AuthContext = createContext(AUTH_VALUE);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={AUTH_VALUE}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
