import createClient from 'openapi-fetch';
import type { paths } from './schema';

/** Backend origin. Empty in development: Vite proxies /api and /static. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const api = createClient<paths>({ baseUrl: API_BASE_URL });

/** An API error with the backend's plain-language message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FastApiValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

function messageFrom(error: unknown, status: number): string {
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return (detail as FastApiValidationItem[])
        .map((d) => `${d.loc?.slice(1).join('.') ?? 'input'}: ${d.msg ?? 'invalid'}`)
        .join('; ');
    }
  }
  if (status === 0) return 'Cannot reach the HisaabAI server. Is the backend running?';
  return `Request failed (${status}).`;
}

/**
 * Unwrap an openapi-fetch result: return the typed data, or throw an ApiError
 * carrying the backend's message so screens can show it.
 */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await request;
  } catch {
    throw new ApiError(messageFrom(null, 0), 0);
  }
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(messageFrom(result.error, result.response.status), result.response.status);
  }
  return result.data as T;
}

/** Turn a backend path like /static/images/... into a URL the browser can load. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
