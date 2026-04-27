import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getApiUserMock, getServiceClientMock } = vi.hoisted(() => ({
  getApiUserMock: vi.fn(),
  getServiceClientMock: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  getApiUser: getApiUserMock,
}));

vi.mock('@/lib/supabase/service-client', () => ({
  getServiceClient: getServiceClientMock,
}));

import { POST } from '@/app/api/team/accept-invite/route';

type UpsertCall = {
  table: string;
  payload: Record<string, unknown>;
  options?: Record<string, unknown>;
};

function createMockDb(invitationRole: string) {
  const upserts: UpsertCall[] = [];
  const updates: Array<{
    table: string;
    payload: Record<string, unknown>;
    filters: Array<[string, unknown]>;
  }> = [];

  function createQuery(table: string) {
    const state = {
      mode: 'select' as 'select' | 'update',
      filters: [] as Array<[string, unknown]>,
      updatePayload: {} as Record<string, unknown>,
    };

    const query = {
      select(_fields: string) {
        state.mode = 'select';
        return query;
      },
      eq(column: string, value: unknown) {
        state.filters.push([column, value]);
        return query;
      },
      update(payload: Record<string, unknown>) {
        state.mode = 'update';
        state.updatePayload = payload;
        return query;
      },
      maybeSingle() {
        if (table === 'workspace_invitations') {
          return Promise.resolve({
            data: {
              id: 'invite-1',
              workspace_id: 'workspace-1',
              email: 'invitee@example.com',
              role: invitationRole,
              status: 'pending',
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            },
            error: null,
          });
        }

        if (table === 'workspaces') {
          return Promise.resolve({
            data: {
              slug: 'docs',
              name: 'OPENY DOCS',
            },
            error: null,
          });
        }

        return Promise.resolve({ data: null, error: null });
      },
      upsert(payload: Record<string, unknown>, options?: Record<string, unknown>) {
        upserts.push({ table, payload, options });
        return Promise.resolve({ error: null });
      },
      then<TResult1 = { error: null }, TResult2 = never>(
        onfulfilled?:
          | ((value: { error: null }) => TResult1 | PromiseLike<TResult1>)
          | null
          | undefined,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
      ) {
        if (state.mode === 'update') {
          updates.push({
            table,
            payload: state.updatePayload,
            filters: [...state.filters],
          });
        }

        return Promise.resolve({ error: null }).then(onfulfilled, onrejected);
      },
    };

    return query;
  }

  return {
    from(table: string) {
      return createQuery(table);
    },
    upserts,
    updates,
  };
}

describe('POST /api/team/accept-invite', () => {
  beforeEach(() => {
    getApiUserMock.mockReset();
    getServiceClientMock.mockReset();
  });

  it('maps manager invites to admin workspace access on acceptance', async () => {
    const db = createMockDb('manager');
    getApiUserMock.mockResolvedValue({
      profile: {
        id: 'user-1',
        email: 'invitee@example.com',
      },
    });
    getServiceClientMock.mockReturnValue(db);

    const request = new NextRequest('http://localhost/api/team/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'tok-manager' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(db.upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'workspace_members',
          payload: expect.objectContaining({ role: 'admin' }),
        }),
        expect.objectContaining({
          table: 'workspace_memberships',
          payload: expect.objectContaining({ role: 'admin' }),
        }),
      ]),
    );
  });

  it('preserves viewer access when accepting a viewer invite', async () => {
    const db = createMockDb('viewer');
    getApiUserMock.mockResolvedValue({
      profile: {
        id: 'user-1',
        email: 'invitee@example.com',
      },
    });
    getServiceClientMock.mockReturnValue(db);

    const request = new NextRequest('http://localhost/api/team/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token: 'tok-viewer' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(db.upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'workspace_members',
          payload: expect.objectContaining({ role: 'viewer' }),
        }),
        expect.objectContaining({
          table: 'workspace_memberships',
          payload: expect.objectContaining({ role: 'viewer' }),
        }),
      ]),
    );
  });
});
