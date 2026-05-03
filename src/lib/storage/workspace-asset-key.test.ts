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
      'workspaces/ws-1/clients/client-uuid/other/general/2026/04/whatsapp-image-2026-04-12-at-17.34.58.jpeg',
    );
  });

  it('includes category segments when supplied', () => {
    const key = buildWorkspaceAssetR2Key({
      workspaceId: 'ws-1',
      clientId: 'client-uuid',
      monthKey: '2026-04',
      originalDisplayName: 'Logo.PNG',
      mainCategory: 'Brand Assets',
      subCategory: 'Client Logos',
    });
    expect(key).toBe(
      'workspaces/ws-1/clients/client-uuid/brand-assets/client-logos/2026/04/logo.png',
    );
  });

  it('uses uncategorized when clientId missing', () => {
    const key = buildWorkspaceAssetR2Key({
      workspaceId: 'ws-1',
      clientId: null,
      monthKey: '2026-04',
      originalDisplayName: 'Report.PDF',
    });
    expect(key).toContain('/clients/uncategorized/other/general/2026/04/');
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
