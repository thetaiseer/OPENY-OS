import { NextResponse } from 'next/server';

export type ApiSuccess<T = Record<string, unknown>> = {
  success: true;
} & T;

export type ApiError = {
  success: false;
  error: string;
  step?: string;
};

export type ApiResponse<T = Record<string, unknown>> = ApiSuccess<T> | ApiError;

export function ok<T extends Record<string, unknown>>(
  data: T,
  status = 200,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, ...data } as ApiSuccess<T>, { status });
}

export function err(
  message: string,
  status = 400,
  extras?: { step?: string },
): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error: message, ...extras } satisfies ApiError, {
    status,
  });
}

export const HTTP = {
  badRequest: (msg: string, step?: string) => err(msg, 400, { step }),
  unauthorized: (msg = 'Unauthorized') => err(msg, 401),
  forbidden: (msg = 'Forbidden') => err(msg, 403),
  notFound: (msg = 'Not found') => err(msg, 404),
  gone: (msg: string) => err(msg, 410),
  serverError: (msg: string, step?: string) => err(msg, 500, { step }),
} as const;
