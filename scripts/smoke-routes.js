#!/usr/bin/env node

const BASE_URL = (process.env.SMOKE_BASE_URL || 'https://openy-os.com').replace(/\/+$/, '');
const routes = [
  '/',
  '/?from=2026-04-26&to=2026-05-03',
  '/?from=bad&to=bad',
  '/dashboard',
  '/clients',
  '/projects',
  '/content',
];

const crashMarkers = [
  'Application error: a server-side exception has occurred',
  'Unhandled Runtime Error',
  'Error: Minified React error',
  'NEXT_REDIRECT',
  'digest:',
];

const shellMarkers = ['<html', '</html>', '<body', 'OPENY'];

function hasExpectedShell(html) {
  const lower = html.toLowerCase();
  return (
    lower.includes(shellMarkers[0]) &&
    lower.includes(shellMarkers[1]) &&
    lower.includes(shellMarkers[2]) &&
    html.includes(shellMarkers[3])
  );
}

async function checkRoute(route) {
  const url = `${BASE_URL}${route}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'user-agent': 'openy-smoke/1.0',
        accept: 'text/html',
      },
      redirect: 'follow',
    });
  } catch (error) {
    throw new Error(`network failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const body = await response.text();
  const lowerBody = body.toLowerCase();

  if (response.status >= 500) {
    throw new Error(`status ${response.status}`);
  }
  if (!body.trim()) {
    throw new Error('empty response body');
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    throw new Error(
      `unexpected content-type "${response.headers.get('content-type') || 'unknown'}"`,
    );
  }

  const crashMarker = crashMarkers.find((marker) => lowerBody.includes(marker.toLowerCase()));
  if (crashMarker) {
    throw new Error(`crash marker found: "${crashMarker}"`);
  }

  if (!hasExpectedShell(body)) {
    throw new Error('expected app shell markers missing');
  }

  return { route, status: response.status };
}

async function main() {
  console.log(`Running smoke checks against ${BASE_URL}`);
  const failures = [];

  for (const route of routes) {
    try {
      const result = await checkRoute(route);
      console.log(`PASS ${result.status} ${route}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ route, message });
      console.error(`FAIL ${route} -> ${message}`);
    }
  }

  if (failures.length > 0) {
    console.error('\nSmoke checks failed:');
    for (const failure of failures) {
      console.error(`- ${failure.route}: ${failure.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nAll smoke checks passed.');
}

void main();
