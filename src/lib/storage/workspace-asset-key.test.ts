import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceAssetR2Key,
  buildSafeDisplayFileName,
  safeFileStem,
} from './workspace-asset-key';

describe('workspace-asset-key', () => {
  it('builds deterministic workspace path', () => {
    const key = buildWorkspaceAssetR2Key({
      workspaceId: 'ws-1',
      clientId: 'client-uuid',
      monthKey: '2026-04',
      originalDisplayName: 'WhatsApp Image 2026-04-12 at 17.34.58.jpeg',
    });
    expect(key).toBe(
      'workspaces/ws-1/clients/client-uuid/2026/04/whatsapp-image-2026-04-12-at-17.34.58.jpeg',
    );
  });

  it('uses uncategorized when clientId missing', () => {
    const key = buildWorkspaceAssetR2Key({
      workspaceId: 'ws-1',
      clientId: null,
      monthKey: '2026-04',
      originalDisplayName: 'Report.PDF',
    });
    expect(key).toContain('/clients/uncategorized/2026/04/');
    expect(key.endsWith('.pdf')).toBe(true);
  });

  it('appends unique suffix before extension', () => {
    const name = buildSafeDisplayFileName('Photo', '.jpeg', 'abc12345');
    expect(name).toBe('photo-abc12345.jpeg');
  });

  it('sanitizes stem', () => {
    expect(safeFileStem('Weird *** Name')).toBe('weird-name');
  });
});
