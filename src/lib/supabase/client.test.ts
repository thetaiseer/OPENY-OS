import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function createClientWithBlankConfig() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  const { createClient } = await import('./client');
  return createClient();
}

describe('createClient()', () => {
  it('returns a Supabase-shaped auth client when public config is blank', async () => {
    const supabase = await createClientWithBlankConfig();

    const authChange = supabase.auth.onAuthStateChange(() => {});
    const session = await supabase.auth.getSession();

    expect(authChange.data.subscription.unsubscribe).toEqual(expect.any(Function));
    expect(session).toEqual({ data: { user: null, session: null }, error: null });
  });

  it('returns a clear auth error for interactive calls when public config is blank', async () => {
    const supabase = await createClientWithBlankConfig();

    const result = await supabase.auth.signInWithPassword({
      email: 'user@example.com',
      password: 'password',
    });

    expect(result.error?.message).toContain('Supabase is not configured');
  });

  it('keeps no-op query chains thenable when public config is blank', async () => {
    const supabase = await createClientWithBlankConfig();

    const result = await supabase
      .from('workspace_memberships')
      .select('workspace_key')
      .eq('id', '1');

    expect(result).toEqual({ data: null, error: null });
  });
});
