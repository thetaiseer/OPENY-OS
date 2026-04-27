export type ApiSuccess<T> = {
  success: true;
  data?: T;
  error?: undefined;
  code?: undefined;
};

export type ApiFailure = {
  success: false;
  data?: undefined;
  error: string;
  code?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiRequestError';
  }
}

type ApiRequestOptions = RequestInit & {
  workspaceId?: string | null;
};

function withWorkspaceId(url: string, workspaceId?: string | null): string {
  if (!workspaceId) return url;
  if (url.includes('workspace_id=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}workspace_id=${encodeURIComponent(workspaceId)}`;
}

export async function apiRequest<T = unknown>(
  url: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const finalUrl = withWorkspaceId(url, options.workspaceId);
  const response = await fetch(finalUrl, options);

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError(`Server returned status ${response.status}`, response.status);
  }

  const body = (payload ?? {}) as Partial<ApiResponse<T>> & { message?: string };
  if (!response.ok || body.success === false) {
    const message = body.error ?? body.message ?? `Request failed with status ${response.status}`;
    throw new ApiRequestError(message, response.status, body.code);
  }

  if (body.success === true) {
    return (body.data as T | undefined) ?? (body as unknown as T);
  }

  // Backward compatibility for endpoints that return raw JSON without success wrapper.
  return body as unknown as T;
}
