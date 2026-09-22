import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { session } from '../lib/session';
import { authApi } from '../api/endpoints/auth';
import type { LoginResponse, RegisterRequest, UserVO } from '../api/contracts/auth';

type AuthContextValue = {
  user: UserVO | null;
  isAuthed: boolean;
  /** 启动时是否已完成会话恢复（避免闪烁） */
  booted: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  register: (req: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** 重新拉取用户信息（改完资料 / 绑定系统后可调用） */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserVO | null>(null);
  const [booted, setBooted] = useState(false);

  /**
   * 启动时从安全存储恢复令牌并拉取最新用户信息。
   *
   * 顺序很重要：必须先 `session.hydrate()` 把持久化令牌灌进内存镜像，
   * 否则 `authApi.me()` 发出的是一个不带 Authorization 头的请求，必然 401。
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await session.hydrate();
        if (!session.getAccessToken()) return;
        const me = await authApi.me();
        if (alive) setUser(me);
      } catch {
        // 令牌失效或网络异常：清掉本地会话，回到未登录
        session.clear();
      } finally {
        if (alive) setBooted(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const resp = await authApi.login({ username, password });
    session.setTokens(resp.token, resp.refresh_token);
    setUser(resp.user_info);
    return resp;
  }, []);

  // 注册成功后自动登录，省去用户二次操作
  const register = useCallback(async (req: RegisterRequest) => {
    await authApi.register(req);
    const resp = await authApi.login({ username: req.username, password: req.password });
    session.setTokens(resp.token, resp.refresh_token);
    setUser(resp.user_info);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(session.getRefreshToken() ?? undefined);
    } catch {
      // 即使后端撤销失败，本地也清掉登录态
    }
    session.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!session.getAccessToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await authApi.me());
    } catch {
      session.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthed: !!user, booted, login, register, logout, refreshUser }),
    [user, booted, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  return ctx;
}
