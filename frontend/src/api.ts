import type { Session } from "./types";

const BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const STORAGE_KEY = "cookbook-demo-session";
export function resolvePhotoUrl(url: string): string {
  return url.startsWith("/api/v1/photos/") ? `${BASE}/photos/${url.split("/").pop()}` : url;
}
export const SESSION_EXPIRED_EVENT = "cookbook-session-expired";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Session;
  return typeof session.accessToken === "string" && session.accessToken.length > 0 &&
    typeof session.user?.id === "string" && typeof session.user?.email === "string";
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: unknown = JSON.parse(raw);
    return isSession(session) ? session : null;
  } catch { return null; }
}
export function saveSession(session: Session | null) {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getSession()?.accessToken;
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    });
  } catch {
    throw new ApiError("Не вдалося з’єднатися із сервером. Перевірте підключення та спробуйте ще раз.", 0);
  }
  if (response.status === 401 && token && !path.startsWith("/auth/") && getSession()?.accessToken === token) {
    saveSession(null);
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  const data: unknown = await response.json().catch(() => {
    throw new ApiError("Сервер повернув некоректну відповідь. Перевірте, чи запущений сервер CookBook AI.", response.status);
  });
  if (!response.ok) {
    if (response.status === 413) throw new ApiError("Фото перевищує допустимі 2,5 МБ", 413);
    const err = (data ?? {}) as { message?: string | string[] };
    throw new ApiError(Array.isArray(err.message) ? err.message.join("; ") : err.message ?? (response.status >= 500 ? "Сервер тимчасово недоступний. Спробуйте пізніше." : `HTTP ${response.status}`), response.status);
  }
  return data as T;
}
