import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, sendInviteEmailMock, requireRoleMock, resolveWorkspaceForRequestMock } = vi.hoisted(
  () => {
    type QueryState = {
      table: string;
      mode: 'idle' | 'select' | 'update' | 'insert' | 'delete';
      selectClause: string | null;
      filters: Record<string, unknown>;
      inFilters: Record<string, unknown[]>;
      payload: Record<string, unknown> | null;
    };

    const makeQuery = (table: string) => {
      const state: QueryState = {
        table,
        mode: 'idle',
        selectClause: null,
        filters: {},
        inFilters: {},
        payload: null,
      };

      const resolveSelect = async () => {
        if (state.table === 'workspace_invitations') {
          return {
            data: {
              id: 'workspace-invite-1',
              status: 'pending',
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            },
            error: null,
          };
        }
        return { data: null, error: null };
      };

      const resolveMutation = async () => ({ data: null, error: null });

      const chain = {
        select: (clause: string) => {
          state.mode = 'select';
          state.selectClause = clause;
          return chain;
        },
        update: (payload: Record<string, unknown>) => {
          state.mode = 'update';
          state.payload = payload;
          return chain;
        },
        insert: (payload: Record<string, unknown>) => {
          state.mode = 'insert';
          state.payload = payload;
          return chain;
        },
        delete: () => {
          state.mode = 'delete';
          return chain;
        },
        eq: (column: string, value: unknown) => {
          state.filters[column] = value;
          return chain;
        },
        in: (column: string, values: unknown[]) => {
          state.inFilters[column] = values;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => resolveSelect(),
        single: async () => resolveSelect(),
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          resolveMutation().then(onFulfilled, onRejected),
      };

      return chain;
    };

    const db = {
      auth: {
        admin: {
          listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
        },
      },
      from: vi.fn((table: string) => makeQuery(table)),
    };

    return {
      mockDb: db,
      sendInviteEmailMock: vi.fn(async () => undefined),
      requireRoleMock: vi.fn(async () => ({
        profile: { id: 'owner-1', name: 'Owner', email: 'owner@example.com', role: 'owner' },
      })),
      resolveWorkspaceForRequestMock: vi.fn(async () => ({
        workspaceKey: 'os',
        workspaceId: 'workspace-1',
        error: null,
      })),
    };
  },
);

vi.mock('@/lib/api-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/supabase/service-client', () => ({
  getServiceClient: () => mockDb,
}));

vi.mock('@/lib/api-workspace', () => ({
  resolveWorkspaceForRequest: resolveWorkspaceForRequestMock,
}));

vi.mock('@/lib/email/sendInviteEmail', () => ({
  sendInviteEmail: sendInviteEmailMock,
}));

vi.mock('@/lib/email', () => ({
  logEmailSent: vi.fn(async () => undefined),
}));

vi.mock('@/lib/notification-service', () => ({
  notifyInvitation: vi.fn(async () => undefined),
}));

vi.mock('@/lib/event-engine', () => ({
  processEvent: vi.fn(),
}));

describe('POST /api/team/invite (regenerate existing invite)', () => {
  beforeEach(() => {
    sendInviteEmailMock.mockClear();
    requireRoleMock.mockClear();
    resolveWorkspaceForRequestMock.mockClear();
  });

  it('returns member and invitation payload for regenerate responses', async () => {
    const { POST } = await import('@/app/api/team/invite/route');
    const req = new NextRequest('http://localhost/api/team/invite', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Pat Lee',
        email: 'pat@example.com',
        access_role: 'manager',
        workspace_access: ['os'],
        workspace_roles: { os: 'admin' },
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.regenerated).toBe(true);
    expect(body).toEqual(
      expect.objectContaining({
        member: expect.objectContaining({
          full_name: 'Pat Lee',
          email: 'pat@example.com',
        }),
        invitation: expect.objectContaining({
          email: 'pat@example.com',
        }),
      }),
    );
  });
});
