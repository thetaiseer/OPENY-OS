import { NextResponse } from 'next/server';
import { createRequestId } from '@/lib/errors/app-error';

type ApiFailBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
};

export function ok<T extends Record<string, unknown>>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  requestId = createRequestId(),
): NextResponse<ApiFailBody> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        requestId,
      },
    },
    { status },
  );
}
