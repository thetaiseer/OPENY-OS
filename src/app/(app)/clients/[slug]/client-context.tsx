'use client';

import { createContext, useContext } from 'react';
import type { Client } from '@/lib/types';

export interface ClientWorkspaceContextValue {
  client: Client | null;
  clientId: string;
  setClient: (client: Client) => void;
  reload: () => void;
}

export const ClientWorkspaceContext = createContext<ClientWorkspaceContextValue>({
  client: null,
  clientId: '',
  setClient: () => {},
  reload: () => {},
});

export const useClientWorkspace = () => useContext(ClientWorkspaceContext);
