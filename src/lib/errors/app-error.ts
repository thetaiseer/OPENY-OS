export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  status?: number;
};

export class AppError extends Error {
  code: string;
  status?: number;
  details?: unknown;
  requestId?: string;

  constructor(error: ApiErrorShape) {
    super(error.message);
    this.name = 'AppError';
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
    this.requestId = error.requestId;
  }
}

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logClientError(context: string, error: unknown): void {
  // Keep logs structured; useful when users report "nothing happened".
  console.error(`[client-error] ${context}`, error);
}

export async function parseApiError(response: Response): Promise<AppError> {
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  const payload = parsed as {
    error?:
      | string
      | {
          code?: string;
          message?: string;
          details?: unknown;
          requestId?: string;
        };
    requestId?: string;
  };

  const nested = payload?.error;
  const requestId =
    (typeof nested === 'object' && nested?.requestId) || payload?.requestId || undefined;
  const code =
    (typeof nested === 'object' && nested?.code) || `HTTP_${response.status}` || 'UNKNOWN_ERROR';
  const message =
    (typeof nested === 'string' && nested) ||
    (typeof nested === 'object' && nested?.message) ||
    `Request failed with status ${response.status}`;
  const details = typeof nested === 'object' ? nested?.details : undefined;

  return new AppError({
    code,
    message,
    details,
    requestId,
    status: response.status,
  });
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    const status = error.status ? ` (HTTP ${error.status})` : '';
    const req = error.requestId ? ` [requestId: ${error.requestId}]` : '';
    return `${error.message}${status}${req}`;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
