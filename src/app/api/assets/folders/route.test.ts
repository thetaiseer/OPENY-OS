import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

const authorizedWorkspaceId = '11111111-1111-4111-8111-111111111111';
const attackerWorkspaceId = '22222222-2222-4222-8222-222222222222';

const requireRoleMock = vi.hoisted(() => vi.fn());
const resolveWorkspaceForRequestMock = vi.hoisted(() => vi.fn());
const deleteR2ObjectMock = vi.hoisted(() => vi.fn());
const getServiceClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/api-workspace', () => ({
  resolveWorkspaceForRequest: resolveWorkspaceForRequestMock,
}));

vi.mock('@/lib/storage/r2', () => ({
  deleteR2Object: deleteR2ObjectMock,
}));

vi.mock('@/lib/supabase/service-client', () => ({
  getServiceClient: getServiceClientMock,
}));

type QueryRecord = {
  table: string;
  operations: Array<{ method: string; args: unknown[] }>;
};

function createSupabaseMock(assetRows: Array<Record<string, unknown>>) {
  const records: QueryRecord[] = [];

  function createBuilder(table: string, mode: 'select' | 'update' | 'delete'): PromiseLike<unknown> {
    const record: QueryRecord = { table, operations: [] };
    records.push(record);

    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        record.operations.push({ method: 'select', args });
        return builder;
      },
      update: (...args: unknown[]) => {
        record.operations.push({ method: 'update', args });
        return builder;
      },
      delete: (...args: unknown[]) => {
        record.operations.push({ method: 'delete', args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        record.operations.push({ method: 'eq', args });
        return builder;
      },
      is: (...args: unknown[]) => {
        record.operations.push({ method: 'is', args });
        return builder;
      },
      or: (...args: unknown[]) => {
        record.operations.push({ method: 'or', args });
        return builder;
      },
      like: (...args: unknown[]) => {
        record.operations.push({ method: 'like', args });
        return builder;
      },
      in: (...args: unknown[]) => {
        record.operations.push({ method: 'in', args });
        return builder;
      },
      then: (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) => {
        const response = mode === 'select' ? { data: assetRows, error: null } : { error: null };
        return Promise.resolve(response).then(resolve, reject);
      },
    };

    return builder as PromiseLike<unknown>;
  }

  const supabase = {
    from: vi.fn((table: string) => ({
      select: (...args: unknown[]) => {
        const builder = createBuilder(table, 'select') as Record<string, unknown>;
        return (builder.select as (...selectArgs: unknown[]) => unknown)(...args);
      },
      update: (...args: unknown[]) => {
        const builder = createBuilder(table, 'update') as Record<string, unknown>;
        return (builder.update as (...updateArgs: unknown[]) => unknown)(...args);
      },
      delete: (...args: unknown[]) => {
        const builder = createBuilder(table, 'delete') as Record<string, unknown>;
        return (builder.delete as (...deleteArgs: unknown[]) => unknown)(...args);
      },
    })),
  };

  return { supabase, records };
}

describe('DELETE /api/assets/folders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({
      profile: { id: 'user-1', email: 'admin@example.com', role: 'admin' },
    });
    resolveWorkspaceForRequestMock.mockResolvedValue({
      workspaceId: authorizedWorkspaceId,
      workspaceKey: 'os',
      error: null,
    });
    deleteR2ObjectMock.mockResolvedValue({ success: true });
  });

  it('ignores a request body workspaceId and scopes deletion to the authorized workspace', async () => {
    const { supabase, records } = createSupabaseMock([
      {
        id: 'asset-1',
        storage_key: 'workspaces/authorized/asset.png',
        storage_provider: 'r2',
        client_name: 'Client A',
        deleted_at: null,
        is_deleted: false,
        missing_in_storage: false,
        sync_status: 'synced',
      },
    ]);
    getServiceClientMock.mockReturnValue(supabase);

    const response = await DELETE(
      new NextRequest('https://app.example.com/api/assets/folders', {
        method: 'DELETE',
        body: JSON.stringify({
          folder: 'Client A',
          workspaceId: attackerWorkspaceId,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const workspaceFilters = records.flatMap((record) =>
      record.operations.filter(
        (operation) => operation.method === 'eq' && operation.args[0] === 'workspace_id',
      ),
    );

    expect(workspaceFilters.length).toBeGreaterThan(0);
    expect(workspaceFilters.every((operation) => operation.args[1] === authorizedWorkspaceId)).toBe(
      true,
    );
    expect(
      workspaceFilters.some((operation) => operation.args[1] === attackerWorkspaceId),
    ).toBe(false);
  });
});
