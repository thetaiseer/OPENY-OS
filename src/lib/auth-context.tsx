'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import pb from './pocketbase';
import type { User } from './types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pb.authStore.isValid) {
      const model = pb.authStore.model;
      if (model) {
        setUser({
          id: model.id,
          email: model.email,
          name: model.name || model.email,
          avatar: model.avatar,
          role: model.role,
        });
      }
    }
    setLoading(false);

    const unsub = pb.authStore.onChange((token, model) => {
      if (model && token) {
        setUser({
          id: model.id,
          email: model.email,
          name: model.name || model.email,
          avatar: model.avatar,
          role: model.role,
        });
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
    });
    await login(email, password);
  };

  const logout = () => {
    pb.authStore.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
