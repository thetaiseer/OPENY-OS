import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getServiceClient: vi.fn(),
  resolveWorkspaceForRequest: vi.fn(),
  sendInviteEmail: vi.fn(),
  logEmailSent: vi.fn(),
  notifyInvitation: vi.fn(),
  processEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  requireRole: mocks.requireRole,
}));

vi.mock('@/lib/supabase/service-client', () => ({
  getServiceClient: mocks.getServiceClient,
}));

vi.mock('@/lib/api-workspace', () => ({
  resolveWorkspaceForRequest: mocks.resolveWorkspaceForRequest,
}));

vi.mock('@/lib/email/sendInviteEmail', () => ({
  sendInviteEmail: mocks.sendInviteEmail,
}));

vi.mock('@/lib/email', () => ({
  logEmailSent: mocks.logEmailSent,
}));

vi.mock('@/lib/notification-service', () => ({
  notifyInvitation: mocks.notifyInvitation,
}));

vi.mock('@/lib/event-engine', () => ({
  processEvent: mocks.processEvent,
}));

import { POST } from '@/app/api/team/invite/route';

function createInviteRouteDbMock(opts: { onIsActiveFilterUsed: () => void }) {
  const activeInviteExpiry = new Date(Date.now() + 60_000).toISOString();

  return {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
    },
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      const query: any = {};

      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        if (table === 'workspace_members' && column === 'is_active') {
          opts.onIsActiveFilterUsed();
        }
        return query;
      });
      query.order = vi.fn(() => query);
      query.limit = vi.fn(() => query);
      query.in = vi.fn(() => query);

      query.maybeSingle = vi.fn(async () => {
        if (table === 'workspace_members') {
          if ('is_active' in filters) {
            return {
              data: null,
              error: { message: 'column workspace_members.is_active does not exist' },
            };
          }
          return { data: { workspace_id: 'workspace_1' }, error: null };
        }

        if (table === 'workspace_invitations') {
          return {
            data: {
              id: 'workspace-invite-1',
              status: 'pending',
              expires_at: activeInviteExpiry,
            },
            error: null,
          };
        }

        if (table === 'profiles') {
          return { data: { id: 'invitee-profile-1' }, error: null };
        }

        return { data: null, error: null };
      });

      query.update = vi.fn(() => {
        if (table === 'workspace_invitations') {
          return {
            eq: vi.fn(async () => ({ error: null })),
          };
        }

        if (table === 'team_invitations') {
          return {
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({ error: null })),
            })),
          };
        }

        return {
          eq: vi.fn(async () => ({ error: null })),
        };
      });

      return query;
    }),
  };
}

describe('POST /api/team/invite workspace fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({
      profile: { id: 'inviter-1', name: 'Inviter Name' },
    });
    mocks.resolveWorkspaceForRequest.mockResolvedValue({ workspaceId: null, error: null });
    mocks.sendInviteEmail.mockResolvedValue(undefined);
    mocks.logEmailSent.mockResolvedValue(undefined);
    mocks.notifyInvitation.mockResolvedValue(undefined);
  });

  it('does not rely on workspace_members.is_active during legacy fallback lookup', async () => {
    let usedIsActiveFilter = false;
    const db = createInviteRouteDbMock({
      onIsActiveFilterUsed: () => {
        usedIsActiveFilter = true;
      },
    });
    mocks.getServiceClient.mockReturnValue(db);

    const request = {
      json: vi.fn().mockResolvedValue({
        full_name: 'New Team Member',
        email: 'person@example.com',
        access_role: 'member',
      }),
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(usedIsActiveFilter).toBe(false);
    expect(response.status).toBe(200);
  });
});
