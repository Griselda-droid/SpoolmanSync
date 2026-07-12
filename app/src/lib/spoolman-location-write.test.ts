import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpoolmanClient } from './api/spoolman';

/**
 * Behavioral tests for the location writes in assignSpoolToTray /
 * unassignSpoolFromTray. We stub global fetch and inspect the PATCH bodies.
 */

type FetchCall = { url: string; method: string; body: Record<string, unknown> | null };

function installFetch(spool: Record<string, unknown>): FetchCall[] {
  const calls: FetchCall[] = [];
  const handler = vi.fn(async (url: string, opts: RequestInit = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? JSON.parse(opts.body as string) : null;
    calls.push({ url, method, body });

    // GET /spool  -> list (used by getSpoolsByTray); return empty so no other
    // spool is displaced.
    if (method === 'GET' && /\/spool(\?.*)?$/.test(url)) {
      return { ok: true, json: async () => [] } as unknown as Response;
    }
    // GET /spool/{id} -> the spool under test
    if (method === 'GET' && /\/spool\/\d+$/.test(url)) {
      return { ok: true, json: async () => spool } as unknown as Response;
    }
    // PATCH /spool/{id}
    return { ok: true, json: async () => spool } as unknown as Response;
  });
  vi.stubGlobal('fetch', handler);
  return calls;
}

const patchBody = (calls: FetchCall[]) =>
  calls.filter((c) => c.method === 'PATCH').pop()?.body ?? null;

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('assignSpoolToTray — location write', () => {
  it('writes location when the resolver returns a label', async () => {
    const calls = installFetch({ id: 1, extra: {} });
    const client = new SpoolmanClient('http://spoolman');
    client.setLocationResolver(async () => 'X1C - AMS 1 Tray 3');

    await client.assignSpoolToTray(1, 'x1c_ABC_tray_3');

    const body = patchBody(calls)!;
    expect(body.location).toBe('X1C - AMS 1 Tray 3');
    expect((body.extra as Record<string, string>).active_tray).toBe(JSON.stringify('x1c_ABC_tray_3'));
  });

  it('does NOT touch location when the tray is unresolved (empty label)', async () => {
    const calls = installFetch({ id: 1, extra: {} });
    const client = new SpoolmanClient('http://spoolman');
    client.setLocationResolver(async () => '');

    await client.assignSpoolToTray(1, 'unknown_key');

    const body = patchBody(calls)!;
    expect('location' in body).toBe(false);
  });

  it('does NOT touch location when no resolver is set (sync disabled)', async () => {
    const calls = installFetch({ id: 1, extra: {} });
    const client = new SpoolmanClient('http://spoolman');

    await client.assignSpoolToTray(1, 'x1c_ABC_tray_3');

    const body = patchBody(calls)!;
    expect('location' in body).toBe(false);
  });
});

describe('unassignSpoolFromTray — guarded location clear', () => {
  it('clears location when it matches the label we set for the tray being left', async () => {
    const calls = installFetch({
      id: 1,
      extra: { active_tray: JSON.stringify('x1c_ABC_tray_3') },
      location: 'X1C - AMS 1 Tray 3',
    });
    const client = new SpoolmanClient('http://spoolman');
    client.setLocationResolver(async (key) =>
      key === 'x1c_ABC_tray_3' ? 'X1C - AMS 1 Tray 3' : '');

    await client.unassignSpoolFromTray(1);

    const body = patchBody(calls)!;
    expect(body.location).toBeNull();
  });

  it('does NOT clear a manually-set location (does not match the tray label)', async () => {
    const calls = installFetch({
      id: 1,
      extra: { active_tray: JSON.stringify('x1c_ABC_tray_3') },
      location: 'My special shelf',
    });
    const client = new SpoolmanClient('http://spoolman');
    client.setLocationResolver(async () => 'X1C - AMS 1 Tray 3');

    await client.unassignSpoolFromTray(1);

    const body = patchBody(calls)!;
    expect('location' in body).toBe(false);
  });

  it('does nothing to location when spool has no location', async () => {
    const calls = installFetch({
      id: 1,
      extra: { active_tray: JSON.stringify('x1c_ABC_tray_3') },
    });
    const client = new SpoolmanClient('http://spoolman');
    client.setLocationResolver(async () => 'X1C - AMS 1 Tray 3');

    await client.unassignSpoolFromTray(1);

    const body = patchBody(calls)!;
    expect('location' in body).toBe(false);
  });

  it('does NOT touch location when no resolver is set', async () => {
    const calls = installFetch({
      id: 1,
      extra: { active_tray: JSON.stringify('x1c_ABC_tray_3') },
      location: 'X1C - AMS 1 Tray 3',
    });
    const client = new SpoolmanClient('http://spoolman');

    await client.unassignSpoolFromTray(1);

    const body = patchBody(calls)!;
    expect('location' in body).toBe(false);
  });
});
