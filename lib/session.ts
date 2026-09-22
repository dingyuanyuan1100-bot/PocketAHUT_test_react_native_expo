/**
 * 会话令牌（前端侧）。
 *
 * 设计：**内存镜像 + 异步持久化**。
 *   - 同步 getter 供 `api/client.ts` 在每次请求头里直接取值，不引入 await；
 *   - 写入时同步更新内存镜像，同时异步落盘到 expo-secure-store，
 *     这样即使持久化尚未完成，本进程内的后续请求也能立刻拿到新令牌。
 *
 * 后端令牌策略（见 pkg/jwt）：access token TTL 24h，refresh token TTL 30d 且可轮换。
 * 持久化键名见 api/config.ts 的 TOKEN_KEY / REFRESH_TOKEN_KEY。
 */
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from '../api/config';
import { tokenStorage } from './storage';

let accessToken: string | null = null;
let refreshToken: string | null = null;

/** 启动时从安全存储恢复令牌（由 AuthProvider 调用一次） */
async function hydrate(): Promise<boolean> {
  const [token, refresh] = await Promise.all([
    tokenStorage.get(TOKEN_KEY),
    tokenStorage.get(REFRESH_TOKEN_KEY),
  ]);
  accessToken = token;
  refreshToken = refresh;
  return !!token;
}

export const session = {
  /** 同步取 access token（请求头用） */
  getAccessToken: () => accessToken,

  /** 同步取 refresh token */
  getRefreshToken: () => refreshToken,

  /** 是否已有令牌（同步，用于首屏判断） */
  hasToken: () => !!accessToken,

  hydrate,

  setTokens(token: string, refresh?: string) {
    accessToken = token;
    void tokenStorage.set(TOKEN_KEY, token);
    if (refresh !== undefined) {
      refreshToken = refresh;
      void tokenStorage.set(REFRESH_TOKEN_KEY, refresh);
    }
  },

  clear() {
    accessToken = null;
    refreshToken = null;
    void tokenStorage.remove(TOKEN_KEY);
    void tokenStorage.remove(REFRESH_TOKEN_KEY);
  },
};
