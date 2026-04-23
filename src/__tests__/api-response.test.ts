import { describe, it, expect } from 'vitest';
import { ok, err, HTTP } from '@/lib/api-response';

describe('ok()', () => {
  it('returns success: true with data', async () => {
    const res = ok({ task: { id: '1' } });
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect((body.task as { id: string }).id).toBe('1');
    expect(res.status).toBe(200);
  });

  it('accepts a custom status code', async () => {
    const res = ok({ created: true }, 201);
    expect(res.status).toBe(201);
  });
});

describe('err()', () => {
  it('returns success: false with error message', async () => {
    const res = err('Something went wrong', 400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Something went wrong');
    expect(res.status).toBe(400);
  });

  it('includes step when provided', async () => {
    const res = err('Validation failed', 400, { step: 'parse' });
    const body = await res.json() as Record<string, unknown>;
    expect(body.step).toBe('parse');
  });
});

describe('HTTP helpers', () => {
  it('HTTP.unauthorized returns 401', async () => {
    const res = HTTP.unauthorized();
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Unauthorized');
  });

  it('HTTP.notFound returns 404', async () => {
    const res = HTTP.notFound('Resource missing');
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Resource missing');
  });

  it('HTTP.serverError returns 500', async () => {
    const res = HTTP.serverError('DB error', 'db_insert');
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body.step).toBe('db_insert');
  });

  it('HTTP.gone returns 410', async () => {
    const res = HTTP.gone('Invitation expired');
    expect(res.status).toBe(410);
  });

  it('HTTP.badRequest returns 400', async () => {
    const res = HTTP.badRequest('Name is required', 'validation');
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.step).toBe('validation');
  });
});
