import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_COLUMN, PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';
import { USER_SESSION_COLUMNS, USER_SESSION_COLUMNS_LEGACY } from '@/lib/supabase-list-columns';

// ── User-Agent parser ──────────────────────────────────────────────────────────

function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  let browser = 'Unknown';
  if (/Edg\/|EdgA\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident\//.test(ua)) browser = 'Internet Explorer';

  let os = 'Unknown';
  if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/);
    const map: Record<string, string> = {
      '10.0': 'Windows 10/11',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7',
    };
    os = map[m?.[1] ?? ''] ?? 'Windows';
  } else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPad/.test(ua)) os = 'iPadOS';
  else if (/iPhone/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let deviceType = 'Desktop';
  if (/iPhone|Android.*Mobile|IEMobile/.test(ua)) deviceType = 'Mobile';
  else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) deviceType = 'Tablet';

  return { browser, os, deviceType };
}

// ── GeoIP lookup ───────────────────────────────────────────────────────────────

async function resolveGeo(
  ip: string,
  vercelCountry: string | null,
  vercelCity: string | null,
): Promise<{ country: string | null; city: string | null }> {
  // Prefer Vercel's built-in geo headers (no extra request needed)
  if (vercelCountry) return { country: vercelCountry, city: vercelCity };

  // Skip private / loopback IPs
  if (!ip || ip === '::1' || /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
    return { country: 'Local', city: 'Local' };
  }

  try {
    const res = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,city`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as { status: string; country: string; city: string };
      if (data.status === 'success') return { country: data.country, city: data.city };
    }
  } catch {
    /* ignore timeout/network errors */
  }

  return { country: null, city: null };
}

// ── GET — list sessions ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getServiceClient();
  const primarySessionsResult = await admin
    .from('user_sessions')
    .select(USER_SESSION_COLUMNS)
    .eq('user_id', auth.profile.id)
    .order('last_seen_at', { ascending: false })
    .limit(50);

  let sessions = primarySessionsResult.data as Array<Record<string, unknown>> | null;
  let error = primarySessionsResult.error;

  if (primarySessionsResult.error?.code === PG_UNDEFINED_COLUMN) {
    const fallback = await admin
      .from('user_sessions')
      .select(USER_SESSION_COLUMNS_LEGACY)
      .eq('user_id', auth.profile.id)
      .order('last_seen_at', { ascending: false })
      .limit(50);
    sessions = fallback.data as Array<Record<string, unknown>> | null;
    error = fallback.error;
  }

  if (error) {
    // Table not yet created — return empty list so the UI degrades gracefully
    if (error.code === PG_UNDEFINED_TABLE) {
      return NextResponse.json({ sessions: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const currentSid = request.cookies.get('openy-sid')?.value;
  const sessionsWithCurrent = (sessions ?? []).map((s) => ({
    ...s,
    country: (s.country as string | null | undefined) ?? null,
    city: (s.city as string | null | undefined) ?? null,
    is_current: s.id === currentSid,
  }));

  return NextResponse.json({ sessions: sessionsWithCurrent });
}

// ── POST — create session on login ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getServiceClient();

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '';
  const ua = request.headers.get('user-agent') ?? '';
  const { browser, os, deviceType } = parseUserAgent(ua);

  const { country, city } = await resolveGeo(
    ip,
    request.headers.get('x-vercel-ip-country'),
    request.headers.get('x-vercel-ip-city'),
  );

  // Detect suspicious login: new country compared to recent sessions
  const primaryRecentSessionsResult = await admin
    .from('user_sessions')
    .select('country, browser, os')
    .eq('user_id', auth.profile.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  let recentSessions = primaryRecentSessionsResult.data as Array<Record<string, unknown>> | null;

  if (primaryRecentSessionsResult.error?.code === PG_UNDEFINED_COLUMN) {
    const fallbackRecent = await admin
      .from('user_sessions')
      .select('browser, os')
      .eq('user_id', auth.profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);
    recentSessions = fallbackRecent.data as Array<Record<string, unknown>> | null;
  }

  let riskFlag = false;
  if (recentSessions && recentSessions.length > 0 && country && country !== 'Local') {
    const knownCountries = new Set(
      recentSessions
        .map((s) => (typeof s.country === 'string' ? s.country : null))
        .filter((v): v is string => Boolean(v)),
    );
    if (!knownCountries.has(country)) riskFlag = true;
  }

  let { data: session, error } = await admin
    .from('user_sessions')
    .insert({
      user_id: auth.profile.id,
      ip_address: ip || null,
      country,
      city,
      user_agent: ua || null,
      browser,
      os,
      device_type: deviceType,
      is_active: true,
      risk_flag: riskFlag,
    })
    .select()
    .single();

  if (error?.code === PG_UNDEFINED_COLUMN) {
    const fallbackInsert = await admin
      .from('user_sessions')
      .insert({
        user_id: auth.profile.id,
        ip_address: ip || null,
        user_agent: ua || null,
        browser,
        os,
        device_type: deviceType,
        is_active: true,
        risk_flag: riskFlag,
      })
      .select()
      .single();
    session = fallbackInsert.data;
    error = fallbackInsert.error;
  }

  if (error) {
    // Table not yet created — skip session creation silently
    if (error.code === PG_UNDEFINED_TABLE) {
      console.warn(
        '[sessions] user_sessions table not found — skipping session creation (run supabase-migration-sessions.sql)',
      );
      return NextResponse.json({ session: null, risk_flag: false });
    }
    console.error(
      '[sessions] ✗ Failed to create session for user:',
      auth.profile.id,
      '| error:',
      error.message,
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ session, risk_flag: riskFlag });
  response.cookies.set('openy-sid', session.id as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
