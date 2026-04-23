'use client';

/**
 * UploadModal — shared upload metadata modal used by both the Assets page
 * and individual Client workspace pages.
 *
 * Features:
 *  - Per-file name editor with validation
 *  - Client selection (lockable when uploading from a client workspace)
 *  - "+ Create New" button opens CreateClientModal inline
 *  - Main Category → Subcategory selectors (new asset hierarchy)
 *  - MonthYearPicker (modern calendar-style month/year picker)
 *  - AI writing improvement on file names
 *  - Consistent design system styling
 */

import { useRef, useState } from 'react';
import { X, FileImage, FileText, FileVideo, FileAudio, File, Plus } from 'lucide-react';
import MonthYearPicker from '@/components/ui/MonthYearPicker';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import CreateClientModal from '@/components/upload/CreateClientModal';
import AppModal from '@/components/ui/AppModal';
import { MAIN_CATEGORIES, SUBCATEGORIES, type MainCategorySlug } from '@/lib/asset-utils';
import type { Client } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadFileItem {
  id: string;
  file: File;
  previewUrl: string | null;
  uploadName: string; // user-editable base name (without extension)
  thumbnailBlob: Blob | null;
  durationSeconds: number | null;
  previewBlob: Blob | null;
}

export interface UploadModalProps {
  files: UploadFileItem[];
  mainCategory: string;
  subCategory: string;
  monthKey: string;
  clientName: string;
  clientId: string;
  clients: Client[];
  /** When true the client field is hidden (uploading from a client workspace) */
  lockClient?: boolean;
  onMainCategoryChange: (v: string) => void;
  onSubCategoryChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onClientChange?: (name: string, id: string) => void;
  /** Called when a new client is created via the inline modal */
  onNewClientCreated?: (client: Client) => void;
  onUploadNameChange: (id: string, name: string) => void;
  onRemoveFile: (id: string) => void;
  onAddFiles?: (files: FileList) => void;
  onConfirm: () => void;
  /** Upload files and open scheduling modal immediately after */
  onConfirmAndSchedule?: () => void;
  onCancel: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00]/;

export function validateUploadName(name: string): string | null {
  const t = name.trim();
  if (!t) return 'Name cannot be empty';
  if (INVALID_FILENAME_CHARS.test(t)) return 'Invalid characters (< > : " / \\ | ? *)';
  if (t.startsWith('.')) return 'Name cannot start with a period';
  if (t.length > 200) return 'Too long (max 200 characters)';
  return null;
}

function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileIcon({ name, type, size = 16 }: { name: string; type?: string; size?: number }) {
  const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) || type?.startsWith('image/');
  const isPdf = /\.pdf$/i.test(name) || type === 'application/pdf';
  const isVid = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name) || type?.startsWith('video/');
  const isAud = type?.startsWith('audio/');
  if (isImg) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (isPdf) return <FileText size={size} style={{ color: '#ef4444' }} />;
  if (isVid) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (isAud) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

// ── Field label helper ────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      className="mb-1.5 block text-xs font-semibold tracking-wide"
      style={{ color: 'var(--text-secondary)' }}
    >
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

// ── Per-file row ──────────────────────────────────────────────────────────────

function FileRow({
  item,
  onChangeName,
  onRemove,
}: {
  item: UploadFileItem;
  onChangeName: (name: string) => void;
  onRemove: () => void;
}) {
  const ext = getFileExtension(item.file.name);
  const error = validateUploadName(item.uploadName);

  return (
    <div
      className="space-y-2.5 rounded-xl border p-3 transition-colors"
      style={{
        background: 'var(--surface-2)',
        borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--border)',
      }}
    >
      {/* Top row: icon + original name + size + remove */}
      <div className="flex items-center gap-2">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        ) : (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--surface)' }}
          >
            <FileIcon name={item.file.name} type={item.file.type} size={15} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {item.file.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            {formatSize(item.file.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
          title="Remove file"
        >
          <X size={13} />
        </button>
      </div>

      {/* Name input row */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            File name
            {ext && <span className="ml-1 font-normal opacity-50">(ext: {ext})</span>}
          </label>
          <AiImproveButton value={item.uploadName} onImproved={onChangeName} mode="name" />
        </div>
        <input
          type="text"
          value={item.uploadName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Enter file name..."
          className="h-9 w-full rounded-lg px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--accent)]"
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: `1.5px solid ${error ? 'rgba(239,68,68,0.6)' : 'var(--border)'}`,
          }}
        />
        {error && (
          <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function UploadModal({
  files,
  mainCategory,
  subCategory,
  monthKey,
  clientName,
  clientId: _clientId,
  clients,
  lockClient = false,
  onMainCategoryChange,
  onSubCategoryChange,
  onMonthChange,
  onClientChange,
  onNewClientCreated,
  onUploadNameChange,
  onRemoveFile,
  onAddFiles,
  onConfirm,
  onConfirmAndSchedule,
  onCancel,
}: UploadModalProps) {
  const [showCreateClient, setShowCreateClient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasErrors = files.some((f) => validateUploadName(f.uploadName) !== null);
  const canConfirm =
    files.length > 0 && !hasErrors && (lockClient || !!clientName) && !!mainCategory;

  const subcategoryOptions = mainCategory
    ? (SUBCATEGORIES[mainCategory as MainCategorySlug] ?? [])
    : [];

  const handleClientSelect = (name: string) => {
    if (!onClientChange) return;
    const found = clients.find((c) => c.name === name);
    onClientChange(name, found?.id ?? '');
  };

  const handleMainCategoryChange = (v: string) => {
    onMainCategoryChange(v);
    // Reset subcategory when main category changes
    onSubCategoryChange('');
  };

  const handleNewClientCreated = (client: Client) => {
    setShowCreateClient(false);
    onNewClientCreated?.(client);
    onClientChange?.(client.name, client.id);
  };

  return (
    <>
      <AppModal
        open
        onClose={onCancel}
        title={
          files.length === 0
            ? 'Upload Files'
            : files.length === 1
              ? 'Upload File'
              : `Upload ${files.length} Files`
        }
        subtitle="Review details before uploading"
        size="md"
        bodyClassName="space-y-5"
        footer={
          <>
            <button type="button" onClick={onCancel} className="openy-modal-btn-secondary flex-1">
              Cancel
            </button>
            {onConfirmAndSchedule && (
              <button
                type="button"
                onClick={onConfirmAndSchedule}
                disabled={!canConfirm}
                className="openy-modal-btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
              >
                Upload & Schedule
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canConfirm}
              className="openy-modal-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {files.length === 1 ? 'Upload File' : `Upload ${files.length} Files`}
            </button>
          </>
        }
      >
        {/* File list */}
        <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
          {files.length === 0 ? (
            <div
              className="space-y-2 rounded-xl border border-dashed p-4 text-center"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                No files selected
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Choose files to continue
              </p>
              {onAddFiles && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) onAddFiles(e.target.files);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 rounded-lg border px-3 text-xs font-medium transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    Choose Files
                  </button>
                </>
              )}
            </div>
          ) : (
            files.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                onChangeName={(name) => onUploadNameChange(item.id, name)}
                onRemove={() => onRemoveFile(item.id)}
              />
            ))
          )}
        </div>

        <div
          className="space-y-4 rounded-2xl border p-4"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          {/* Client selector */}
          {!lockClient && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label required>Client</Label>
                <button
                  type="button"
                  onClick={() => setShowCreateClient(true)}
                  className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: 'var(--accent)' }}
                >
                  <Plus size={12} /> Create New
                </button>
              </div>
              <SelectDropdown
                fullWidth
                value={clientName}
                onChange={handleClientSelect}
                placeholder="— Select a client —"
                options={[
                  { value: '', label: '— Select a client —' },
                  ...clients.map((c) => ({ value: c.name, label: c.name })),
                ]}
              />
            </div>
          )}

          {/* Main Category */}
          <div>
            <Label required>Main Category</Label>
            <SelectDropdown
              fullWidth
              value={mainCategory}
              onChange={handleMainCategoryChange}
              placeholder="— Select a category —"
              options={[
                { value: '', label: '— Select a category —' },
                ...MAIN_CATEGORIES.map((c) => ({ value: c.slug, label: c.label })),
              ]}
            />
          </div>

          {/* Subcategory (dependent on main category) */}
          {subcategoryOptions.length > 0 && (
            <div>
              <Label>Subcategory</Label>
              <SelectDropdown
                fullWidth
                value={subCategory}
                onChange={onSubCategoryChange}
                placeholder="— Select a subcategory —"
                options={[
                  { value: '', label: '— Select a subcategory —' },
                  ...subcategoryOptions.map((s) => ({ value: s.slug, label: s.label })),
                ]}
              />
            </div>
          )}

          {/* Month / Year picker */}
          <div>
            <Label required>Month & Year</Label>
            <MonthYearPicker
              value={monthKey}
              onChange={onMonthChange}
              placeholder="Pick a month..."
              className="w-full"
            />
          </div>
        </div>
      </AppModal>

      {/* Inline Create Client modal — renders above UploadModal (z-60) */}
      {showCreateClient && (
        <CreateClientModal
          onCreated={handleNewClientCreated}
          onCancel={() => setShowCreateClient(false)}
        />
      )}
    </>
  );
}
