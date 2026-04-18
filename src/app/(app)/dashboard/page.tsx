'use client';

import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { useDashboardStats } from '@/lib/queries';
import ModularWorkspaceCanvas from '@/components/workspace/ModularWorkspaceCanvas';
import type { Activity, Asset, Client, PublishingSchedule } from '@/lib/types';

export default function DashboardPage() {
  const { data: stats } = useDashboardStats();

  const { data: activitiesData } = useQuery<Activity[]>({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(10);
      return (data ?? []) as Activity[];
    },
    staleTime: 30_000,
  });

  const { data: scheduled } = useQuery<PublishingSchedule[]>({
    queryKey: ['scheduled-posts'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('publishing_schedules')
        .select('id, scheduled_date, scheduled_time, platforms, client_id, caption, status, asset:assets(id, name, content_type, client_name)')
        .in('status', ['scheduled', 'queued'])
        .gte('scheduled_date', todayStr)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(6);
      return (data ?? []) as unknown as PublishingSchedule[];
    },
    staleTime: 60_000,
  });

  const { data: trendsData } = useQuery<{ date: string; completed: number }[]>({
    queryKey: ['dashboard-trends'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/trends');
      if (!res.ok) return [];
      const json = await res.json() as { success: boolean; trends?: { date: string; completed: number }[] };
      return json.trends ?? [];
    },
    staleTime: 120_000,
  });

  const { data: atRiskTasks } = useQuery({
    queryKey: ['at-risk-tasks'],
    queryFn: async () => {
      const soonStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, client:clients(id,name,slug)')
        .lte('due_date', soonStr)
        .not('status', 'in', '("done","delivered","completed","published","cancelled")')
        .order('due_date', { ascending: true })
        .limit(8);
      return (data ?? []) as unknown as Array<{ id: string; title: string; due_date?: string; client?: { name: string; slug?: string } | null }>;
    },
    staleTime: 60_000,
  });

  const { data: recentAssets } = useQuery<Asset[]>({
    queryKey: ['dashboard-recent-assets'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assets')
        .select('id, name, file_type, created_at, thumbnail_url, preview_url, file_url, client_name, client_id')
        .order('created_at', { ascending: false })
        .limit(12);
      return (data ?? []) as Asset[];
    },
    staleTime: 60_000,
  });

  const { data: activeClients } = useQuery<Client[]>({
    queryKey: ['dashboard-active-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, slug, status, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(8);
      return (data ?? []) as Client[];
    },
    staleTime: 60_000,
  });

  return (
    <ModularWorkspaceCanvas
      stats={stats}
      atRiskTasks={atRiskTasks ?? []}
      activeClients={activeClients ?? []}
      scheduled={scheduled ?? []}
      activities={activitiesData ?? []}
      trends={trendsData ?? []}
      recentAssets={recentAssets ?? []}
    />
  );
}
