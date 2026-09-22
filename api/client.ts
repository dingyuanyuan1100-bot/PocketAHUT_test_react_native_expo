import { API_BASE_URL, API_TIMEOUT_MS } from './config';
import { ApiError } from './contracts';
import type { ApiResponse, RefreshTokenResponse } from './contracts';
import { session } from '../lib/session';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * 查询参数载体。
 *
 * 这里刻意用宽松的 `object`：具体键值类型由各 endpoint 的入参类型
 * （如 `CourseQuery` / `LibrarySearchQuery`）在**对外 API 处**保证，
 * 而 interface 类型天然不满足 `Record<string, ...>` 的索引签名约束，
 * 若在此处收紧反而会逼得到处写 `as` 断言。
 */
export type QueryParams = object;

export type RequestOptions = {
  method?: Method;
  /** 请求体，自动 JSON 序列化 */
  body?: unknown;
  /** 查询参数，值为 undefined / null / 空串的键会被自动跳过 */
  query?: QueryParams;
  /** 单次请求超时（毫秒），缺省用 API_TIMEOUT_MS */
  timeoutMs?: number;
  /** 是否携带 Authorization 头，默认 true */
  auth?: boolean;
  /**
   * 跳过 401 自动刷新。
   * 用于 `/user/logout`（文档标注 skipAuthRefresh）与刷新接口自身，避免递归。
   */
  skipAuthRefresh?: boolean;
};

/** 拼查询串，自动编码并跳过空值 */
export function buildQuery(query?: QueryParams): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** 单次真实网络请求：解包 `{code,message,data}` 信封，非 200 抛 ApiError */
async function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, timeoutMs = API_TIMEOUT_MS, auth = true } = opts;

  const token = auth ? session.getAccessToken() : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    // 兼容两种情况：HTTP 200 里带业务码，或 HTTP 4xx/5xx 里带业务码
    let json: ApiResponse<T> | null = null;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      json = null;
    }

    if (!json) {
      throw new ApiError(res.status, `响应解析失败（HTTP ${res.status}）`, undefined, res.status);
    }

    const code = typeof json.code === 'number' ? json.code : res.status;
    if (code !== 200) {
      throw new ApiError(code, json.message || `请求失败（HTTP ${res.status}）`, json.errorCode, res.status);
    }
    return json.data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(0, '请求超时，请检查网络后重试', 'TIMEOUT');
    }
    throw new ApiError(0, '网络连接失败，请检查网络设置', 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

/** 刷新中的单飞 promise —— 并发 401 只触发一次刷新 */
let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = session.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const data = await rawRequest<RefreshTokenResponse>('/user/token/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      auth: false,
      skipAuthRefresh: true,
    });
    if (!data?.token) return false;
    session.setTokens(data.token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/**
 * 刷新令牌（单飞）。
 * 多个请求同时拿到 401 时，只会真正打一次 /user/token/refresh，
 * 其余请求复用同一个 promise，避免 refresh token 被并发轮换导致互相作废。
 */
async function ensureRefreshed(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const pending = doRefresh();
  refreshInFlight = pending;
  try {
    return await pending;
  } finally {
    if (refreshInFlight === pending) refreshInFlight = null;
  }
}

/** 统一请求入口：401 时自动刷新令牌并重放一次原请求 */
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, opts);
  } catch (err) {
    const canRetry =
      err instanceof ApiError &&
      err.isUnauthorized &&
      !opts.skipAuthRefresh &&
      !!session.getRefreshToken();

    if (!canRetry) throw err;

    const refreshed = await ensureRefreshed();
    if (refreshed) {
      return await rawRequest<T>(path, opts);
    }
    // 刷新失败：清除本地会话（对齐接口文档 §2 的约定）
    session.clear();
    throw err;
  }
}

/**
 * HTTP 动词封装。所有封装都会自动带上 `Authorization: Bearer <token>`。
 *
 * @example
 *   await http.get<CourseItem[]>('/jwxt/course', { query: { semester: '2026-2027-1' } });
 */
export const http = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),

  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),

  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
