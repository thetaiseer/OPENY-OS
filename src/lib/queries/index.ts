/**
 * Typed React Query hooks for OPENY OS data fetching.
 * Uses Supabase client-side queries with automatic caching and
 * background refetch via @tanstack/react-query.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Client, Task, Asset, Notification } from '@/lib/types';

function supabase() {
  return createClient();
}

// ── Clients ───────────────────────────────────────────────────────────────────

export interface ClientsPage {
  data: Client[];
  total: number;
}

interface UseClientsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function useClients(
  { page = 1, pageSize = 50, search = '' }: UseClientsOptions = {},
  options?: Partial<UseQueryOptions<ClientsPage>>,
) {
  return useQuery<ClientsPage>({
    queryKey: ['clients', page, pageSize, search],
    queryFn: async () => {
      const sb = supabase();
      let q = sb
        .from('clients')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`name.ilike.${s},email.ilike.${s}`);
      }

      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { data: (data ?? []) as Client[], total: count ?? 0 };
    },
    staleTime: 30_000,
    ...options,
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export interface TasksPage {
  data: Task[];
  total: number;
}

interface UseTasksOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  clientId?: string;
}

export function useTasks(
  { page = 1, pageSize = 30, search = '', status = '', clientId = '' }: UseTasksOptions = {},
  options?: Partial<UseQueryOptions<TasksPage>>,
) {
  return useQuery<TasksPage>({
    queryKey: ['tasks', page, pageSize, search, status, clientId],
    queryFn: async () => {
      const sb = supabase();
      let q = sb
        .from('tasks')
        .select('*, client:clients(id,name)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (search.trim()) {
        q = q.ilike('title', `%${search.trim()}%`);
      }
      if (status) q = q.eq('status', status);
      if (clientId) q = q.eq('client_id', clientId);

      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { data: (data ?? []) as Task[], total: count ?? 0 };
    },
    staleTime: 15_000,
    ...options,
  });
}

// ── Assets ────────────────────────────────────────────────────────────────────

export interface AssetsPage {
  data: Asset[];
  total: number;
}

interface UseAssetsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  contentType?: string;
  clientId?: string;
  tags?: string[];
}

export function useAssets(
  { page = 1, pageSize = 30, search = '', contentType = '', clientId = '', tags = [] }: UseAssetsOptions = {},
  options?: Partial<UseQueryOptions<AssetsPage>>,
) {
  return useQuery<AssetsPage>({
    queryKey: ['assets', page, pageSize, search, contentType, clientId, tags],
    queryFn: async () => {
      const sb = supabase();
      let q = sb
        .from('assets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (search.trim()) {
        q = q.ilike('name', `%${search.trim()}%`);
      }
      if (contentType) q = q.eq('content_type', contentType);
      if (clientId)    q = q.eq('client_id', clientId);
      if (tags.length) q = (q as unknown as { overlaps: (col: string, val: string[]) => typeof q }).overlaps('tags', tags);

      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { data: (data ?? []) as Asset[], total: count ?? 0 };
    },
    staleTime: 15_000,
    ...options,
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function useNotifications(
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {},
  options?: Partial<UseQueryOptions<{ data: Notification[]; total: number }>>,
) {
  return useQuery<{ data: Notification[]; total: number }>({
    queryKey: ['notifications', page, pageSize],
    queryFn: async () => {
      const sb = supabase();
      const from = (page - 1) * pageSize;
      const { data, error, count } = await sb
        .from('notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      return { data: (data ?? []) as Notification[], total: count ?? 0 };
    },
    staleTime: 10_000,
    ...options,
  });
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export interface DashboardStats {
  totalClients: number;
  activeTasks: number;
  overdueTasks: number;
  tasksDueThisWeek: number;
  totalAssets: number;
}

export function useDashboardStats(options?: Partial<UseQueryOptions<DashboardStats>>) {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const sb = supabase();
      const todayStr = new Date().toISOString().slice(0, 10);
      const weekLater = new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      const weekLaterStr = weekLater.toISOString().slice(0, 10);

      const settled = await Promise.allSettled([
        sb.from('clients').select('id', { count: 'exact', head: true }),
        sb.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
        sb.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
        sb.from('tasks').select('id', { count: 'exact', head: true })
          .gte('due_date', todayStr)
          .lte('due_date', weekLaterStr)
          .not('status', 'in', '("done","delivered")'),
        sb.from('assets').select('id', { count: 'exact', head: true }),
      ]);

      const [clients, tasks, overdue, dueThisWeek, assets] = settled;
      return {
        totalClients:     clients.status     === 'fulfilled' ? (clients.value.count     ?? 0) : 0,
        activeTasks:      tasks.status       === 'fulfilled' ? (tasks.value.count       ?? 0) : 0,
        overdueTasks:     overdue.status     === 'fulfilled' ? (overdue.value.count     ?? 0) : 0,
        tasksDueThisWeek: dueThisWeek.status === 'fulfilled' ? (dueThisWeek.value.count ?? 0) : 0,
        totalAssets:      assets.status      === 'fulfilled' ? (assets.value.count      ?? 0) : 0,
      };
    },
    staleTime: 60_000,
    ...options,
  });
}
