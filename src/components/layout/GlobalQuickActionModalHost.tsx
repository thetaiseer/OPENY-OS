'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CreateClientModal from '@/components/upload/CreateClientModal';
import NewTaskModal from '@/components/tasks/NewTaskModal';
import NewContentModal from '@/components/content/NewContentModal';
import UploadModal, { type UploadFileItem } from '@/components/upload/UploadModal';
import { MAIN_CATEGORIES } from '@/lib/asset-utils';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { createClient as createSupabase } from '@/lib/supabase/client';
import { useUpload } from '@/context/upload-context';
import { useQuickActions } from '@/context/quick-actions-context';
import type { Client, Task, TeamMember, ContentItem } from '@/lib/types';

function nowMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function getFileBaseName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function filesToItems(files: File[]): UploadFileItem[] {
  return files.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    uploadName: getFileBaseName(file.name),
    thumbnailBlob: null,
    durationSeconds: null,
    previewBlob: null,
  }));
}

export default function GlobalQuickActionModalHost() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { startBatch } = useUpload();
  const { fallbackAction, clearFallbackAction } = useQuickActions();

  const [assetFiles, setAssetFiles] = useState<UploadFileItem[]>([]);
  const [uploadMainCategory, setUploadMainCategory] = useState<string>(
    MAIN_CATEGORIES[0]?.slug ?? 'other',
  );
  const [uploadSubCategory, setUploadSubCategory] = useState('');
  const [uploadMonth, setUploadMonth] = useState(nowMonthKey());
  const [uploadClientName, setUploadClientName] = useState('');
  const [uploadClientId, setUploadClientId] = useState('');

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['quick-actions-clients'],
    queryFn: async () => {
      const sb = createSupabase();
      const { data } = await sb.from('clients').select('id, name').order('name');
      return (data ?? []) as Client[];
    },
    staleTime: 60_000,
  });

  const { data: team = [] } = useQuery<TeamMember[]>({
    queryKey: ['quick-actions-team'],
    queryFn: async () => {
      const sb = createSupabase();
      const { data } = await sb.from('team_members').select('*').order('full_name');
      return (data ?? []) as TeamMember[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (fallbackAction !== 'add-asset') return;
    setUploadMainCategory(MAIN_CATEGORIES[0]?.slug ?? 'other');
    setUploadSubCategory('');
    setUploadMonth(nowMonthKey());
    setUploadClientName('');
    setUploadClientId('');
    setAssetFiles([]);
  }, [fallbackAction]);

  const quickTaskClients = useMemo<Client[]>(
    () =>
      clients.map((client) => ({
        ...client,
        email: client.email ?? '',
        status: (client.status ?? 'active') as Client['status'],
        created_at: client.created_at ?? '',
        updated_at: client.updated_at ?? '',
      })),
    [clients],
  );

  const handleGlobalCreated = () => {
    void queryClient.invalidateQueries();
    router.refresh();
  };

  const handleAssetAddFiles = (selected: FileList) => {
    const next = filesToItems(Array.from(selected));
    setAssetFiles((prev) => [...prev, ...next]);
  };

  const handleAssetCancel = () => {
    assetFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setAssetFiles([]);
    clearFallbackAction();
  };

  const handleAssetConfirm = () => {
    if (!assetFiles.length) return;
    startBatch(
      assetFiles.map((i) => ({
        id: i.id,
        file: i.file,
        previewUrl: i.previewUrl,
        uploadName: i.uploadName,
        thumbnailBlob: i.thumbnailBlob,
        durationSeconds: i.durationSeconds,
        previewBlob: i.previewBlob,
      })),
      {
        clientName: uploadClientName,
        clientId: uploadClientId,
        contentType: '',
        mainCategory: uploadMainCategory,
        subCategory: uploadSubCategory,
        monthKey: uploadMonth,
        uploadedBy: user?.name || user?.email || null,
        uploadedByEmail: user?.email || null,
      },
    );
    toast(
      `${assetFiles.length} file${assetFiles.length === 1 ? '' : 's'} queued for upload`,
      'success',
    );
    handleAssetCancel();
    handleGlobalCreated();
  };

  return (
    <>
      {fallbackAction === 'add-client' && (
        <CreateClientModal
          onCancel={clearFallbackAction}
          onCreated={() => {
            clearFallbackAction();
            handleGlobalCreated();
          }}
        />
      )}

      {fallbackAction === 'add-task' && (
        <NewTaskModal
          open
          onClose={clearFallbackAction}
          clients={quickTaskClients}
          team={team}
          onCreated={(_task: Task) => {
            clearFallbackAction();
            handleGlobalCreated();
          }}
        />
      )}

      {fallbackAction === 'add-content' && (
        <NewContentModal
          open
          onClose={clearFallbackAction}
          clients={clients}
          onCreated={(_item: ContentItem) => {
            clearFallbackAction();
            handleGlobalCreated();
          }}
        />
      )}

      {fallbackAction === 'add-asset' && (
        <UploadModal
          files={assetFiles}
          mainCategory={uploadMainCategory}
          subCategory={uploadSubCategory}
          monthKey={uploadMonth}
          clientName={uploadClientName}
          clientId={uploadClientId}
          clients={clients}
          onMainCategoryChange={setUploadMainCategory}
          onSubCategoryChange={setUploadSubCategory}
          onMonthChange={setUploadMonth}
          onClientChange={(name, id) => {
            setUploadClientName(name);
            setUploadClientId(id);
          }}
          onUploadNameChange={(id, name) =>
            setAssetFiles((prev) => prev.map((i) => (i.id === id ? { ...i, uploadName: name } : i)))
          }
          onRemoveFile={(id) =>
            setAssetFiles((prev) => {
              const removed = prev.find((i) => i.id === id);
              if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
              return prev.filter((i) => i.id !== id);
            })
          }
          onAddFiles={(files) => {
            if (files.length) handleAssetAddFiles(files);
          }}
          onConfirm={handleAssetConfirm}
          onCancel={handleAssetCancel}
        />
      )}
    </>
  );
}
