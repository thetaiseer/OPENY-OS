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

import { useState } from 'react';
import { X, FileImage, FileText, FileVideo, FileAudio, File, Plus } from 'lucide-react';
import MonthYearPicker from '@/components/ui/MonthYearPicker';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import CreateClientModal from '@/components/upload/CreateClientModal';
import {
  MAIN_CATEGORIES,
  SUBCATEGORIES,
  type MainCategorySlug,
} from '@/lib/asset-utils';
import type { Client } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadFileItem {
  id:              string;
  file:            File;
  previewUrl:      string | null;
  uploadName:      string; // user-editable base name (without extension)
  thumbnailBlob:   Blob | null;
  durationSeconds: number | null;
  previewBlob:     Blob | null;
}

export interface UploadModalProps {
  files:          UploadFileItem[];
  mainCategory:   string;
  subCategory:    string;
  monthKey:       string;
  clientName:     string;
  clientId:       string;
  clients:        Client[];
  /** When true the client field is hidden (uploading from a client workspace) */
  lockClient?:    boolean;
  onMainCategoryChange: (v: string) => void;
  onSubCategoryChange:  (v: string) => void;
  onMonthChange:        (v: string) => void;
  onClientChange?:      (name: string, id: string) => void;
  /** Called when a new client is created via the inline modal */
  onNewClientCreated?:  (client: Client) => void;
  onUploadNameChange:   (id: string, name: string) => void;
  onRemoveFile:         (id: string) => void;
  onConfirm:            () => void;
  /** Upload files and open scheduling modal immediately after */
  onConfirmAndSchedule?: () => void;
  onCancel:             () => void;
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
  if (isPdf) return <FileText  size={size} style={{ color: '#ef4444' }} />;
  if (isVid) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (isAud) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

// ── Field label helper ────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      className="block text-xs font-semibold mb-1.5 tracking-wide"
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
  item:         UploadFileItem;
  onChangeName: (name: string) => void;
  onRemove:     () => void;
}) {
  const ext   = getFileExtension(item.file.name);
  const error = validateUploadName(item.uploadName);

  return (
    <div
      className="rounded-xl border p-3 space-y-2.5 transition-colors"
      style={{
        background:   'var(--surface-2)',
        borderColor:  error ? 'rgba(239,68,68,0.5)' : 'var(--border)',
      }}
    >
      {/* Top row: icon + original name + size + remove */}
      <div className="flex items-center gap-2">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewUrl}
            alt=""
            className="w-8 h-8 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface)' }}
          >
            <FileIcon name={item.file.name} type={item.file.type} size={15} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
            {item.file.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            {formatSize(item.file.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
          title="Remove file"
        >
          <X size={13} />
        </button>
      </div>

      {/* Name input row */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            File name
            {ext && (
              <span className="ml-1 opacity-50 font-normal">(ext: {ext})</span>
            )}
          </label>
          <AiImproveButton
            value={item.uploadName}
            onImproved={onChangeName}
            mode="name"
          />
        </div>
        <input
          type="text"
          value={item.uploadName}
          onChange={e => onChangeName(e.target.value)}
          placeholder="Enter file name..."
          className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
          style={{
            background:  'var(--surface)',
            color:       'var(--text)',
            border:      `1.5px solid ${error ? 'rgba(239,68,68,0.6)' : 'var(--border)'}`,
          }}
        />
        {error && (
          <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>
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
  onConfirm,
  onConfirmAndSchedule,
  onCancel,
}: UploadModalProps) {
  const [showCreateClient, setShowCreateClient] = useState(false);

  const hasErrors  = files.some(f => validateUploadName(f.uploadName) !== null);
  const canConfirm = files.length > 0 && !hasErrors && (lockClient || !!clientName) && !!mainCategory;

  const subcategoryOptions = mainCategory
    ? (SUBCATEGORIES[mainCategory as MainCategorySlug] ?? [])
    : [];

  const handleClientSelect = (name: string) => {
    if (!onClientChange) return;
    const found = clients.find(c => c.name === name);
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
      <div
        className="openy-modal-overlay fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
        onClick={onCancel}
      >
        <div
          className="openy-modal-panel w-full max-w-lg rounded-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] my-auto overflow-hidden"
          style={{
            animation: 'openy-modal-in 280ms var(--ease-spring) both',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                Upload {files.length === 1 ? 'File' : `${files.length} Files`}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Review details before uploading
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-opacity hover:opacity-70"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* File list */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {files.map(item => (
                <FileRow
                  key={item.id}
                  item={item}
                  onChangeName={name => onUploadNameChange(item.id, name)}
                  onRemove={() => onRemoveFile(item.id)}
                />
              ))}
            </div>

            <div
              className="rounded-2xl border p-4 space-y-4"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              {/* Client selector */}
              {!lockClient && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label required>Client</Label>
                    <button
                      type="button"
                      onClick={() => setShowCreateClient(true)}
                      className="flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
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
                      ...clients.map(c => ({ value: c.name, label: c.name })),
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
                    ...MAIN_CATEGORIES.map(c => ({ value: c.slug, label: c.label })),
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
                      ...subcategoryOptions.map(s => ({ value: s.slug, label: s.label })),
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
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-3 px-6 py-4 border-t shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: 'var(--surface-2)',
                color:      'var(--text)',
                border:     '1px solid var(--border)',
              }}
            >
              Cancel
            </button>
            {onConfirmAndSchedule && (
              <button
                type="button"
                onClick={onConfirmAndSchedule}
                disabled={!canConfirm}
                className="flex-1 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: '1.5px solid var(--accent)' }}
              >
                Upload &amp; Schedule
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canConfirm}
              className="flex-1 h-10 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)' }}
            >
              {files.length === 1
                ? 'Upload File'
                : `Upload ${files.length} Files`}
            </button>
          </div>
        </div>
      </div>

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

