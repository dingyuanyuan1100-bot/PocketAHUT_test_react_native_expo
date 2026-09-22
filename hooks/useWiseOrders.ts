import { ApiError } from '../api/contracts';
import type { WiseOrder } from '../api/contracts/wise';
import { wiseApi } from '../api/endpoints/wise';
import { useAuthedQuery } from './useAuthedQuery';

export const wiseKeys = {
  all: ['wise'] as const,
  orders: () => [...wiseKeys.all, 'orders'] as const,
};

/**
 * 后端 `Service.ensureSession` 自动重建会话失败时的报文（`internal/wise/application/service.go:122`）。
 *
 * 触发条件（同一份源码可证）：session 缓存已过期（TTL 1h）→ 命中已缓存的 portal →
 * 走 `resolveToken` + `client.Login(portalURL, token)` 重登录 88wise → 失败。
 * 也就是说：**用户之前扫过码、但现在设备链接和令牌都过期了**。
 *
 * ⚠️ 后端没有为它单开 errorCode（仍是 `UPSTREAM_ERROR`），上游原始原因
 * （如 `入口302无code/state: status=... location=...`）也被 `AppError.Cause`（`json:"-"`）
 * 挡在响应外，前端**只能靠这句文案**区分。文案若变更，判定会静默失效并退化成
 * 普通错误卡（重试仍安全，只是引导不够准）——所以这里只做加法，不做替换。
 */
const SESSION_LOST_MESSAGE = '建立88wise会话失败';

/**
 * 当日订单（一码通 / 智慧用水）。
 *
 * 这个接口有四个「不可达」原因，UI 必须分开引导，不能一律丢给重试：
 *
 *   - `NOT_BOUND / 未绑定智慧校园账号` → 去绑定 vpncas（六态里的 not_bound）
 *   - `UNAUTHORIZED / 请先扫码建立会话` → 从未扫过码，得先扫一次设备码
 *   - `UNAUTHORIZED / 未登录或登录已过期` → 令牌过期，要去重新登录
 *   - `UPSTREAM_ERROR / 建立88wise会话失败` → 扫过码但会话重建失败（见上），
 *     **重试一定再失败**，必须重新扫码
 *
 * ⚠️ 后端对前两种「扫码 vs 登录」**用的是同一个 errorCode**
 * （`apperror.ErrCodeUnauthorized`，见 `middleware/auth.go` 的 `response.FailUnauthorized`），
 * 唯一能区分的只有报文文案。所以这里必须带文案判定，否则令牌过期会被误导成
 * 「请先扫码建立会话」—— 用户会觉得莫名其妙：我明明扫过码了。
 */
export function useWiseOrders() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<WiseOrder[]>({
    queryKey: wiseKeys.orders(),
    queryFn: () => wiseApi.getOrders(),
    queryOptions: { staleTime: 20 * 1000 },
  });

  const unauthErr =
    status === 'error' && error instanceof ApiError && error.errorCode === 'UNAUTHORIZED'
      ? error
      : null;

  /** 会话未建立（文案里点名「扫码」）→ 引导扫码，而不是给「重试」 */
  const needScan = !!unauthErr && /扫码/.test(unauthErr.message || '');
  /** 单纯 401（未登录 / 令牌过期）→ 去登录，扫码也救不了 */
  const needLogin = !!unauthErr && !needScan;

  /**
   * 设备会话失效：扫过码，但服务端无法用缓存的设备链接重建会话。
   * 此时「重新加载」是无效按钮 —— 只有重新扫码（`POST /wise/scan` 会写入新的
   * portal 并重建会话）能恢复。
   */
  const sessionLost =
    status === 'error' &&
    error instanceof ApiError &&
    error.errorCode === 'UPSTREAM_ERROR' &&
    (error.message || '').includes(SESSION_LOST_MESSAGE);

  return {
    status,
    /** 未建立会话时，`status` 仍是 error，但语义是「先扫码」而不是「加载失败」 */
    needScan,
    /** 令牌过期 / 未登录，需要重新登录 */
    needLogin,
    /** 会话重建失败，需要重新扫码（重试无用） */
    sessionLost,
    orders: data ?? [],
    error,
    refetch,
    isRefreshing,
  };
}
