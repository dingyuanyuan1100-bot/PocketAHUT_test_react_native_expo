import { useQuery } from '@tanstack/react-query';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '../api/contracts';
import { useAuth } from '../store/AuthContext';

/**
 * 需要登录的查询的六种界面状态。
 *
 * 与画布上的稿子一一对应，且这套命名是全项目统一约定：
 *   guest     → 未登录              （课程表 120:1）
 *   not_bound → 已登录但缺前置绑定    （课程表 120:66）
 *   loading   → 加载中              （通用规范 120:157）
 *   empty     → 结果为空            （通用规范 120:119）
 *   error     → 加载失败            （通用规范 120:203）
 *   ready     → 有数据
 */
export type LoadStatus = 'guest' | 'loading' | 'not_bound' | 'empty' | 'error' | 'ready';

type Options<T> = {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  /** 判定「空」的规则。默认：数组长度为 0 视为空，其余视为有数据 */
  isEmpty?: (data: T) => boolean;
  /**
   * 业务码 `NOT_FOUND`（HTTP 404）应映射成哪个状态，默认 `'error'`。
   *
   * 需要显式指定的典型场景：`GET /dorm/binding` 未绑定时返回 404，
   * 那是「缺前置条件」而不是「结果为空」，调用方应传 `'not_bound'`，
   * 否则页面会给用户一个语义错误的重试按钮。
   */
  notFoundStatus?: LoadStatus;
  /** 透传给 useQuery 的额外配置（staleTime 等） */
  queryOptions?: Omit<
    UseQueryOptions<T, ApiError, T, QueryKey>,
    'queryKey' | 'queryFn' | 'enabled' | 'retry'
  >;
};

/**
 * 带六态判定的登录态查询。
 *
 * 统一了两条重要策略，避免每个页面各写一遍：
 *
 *   1. **未登录不发请求**（`enabled: false`）—— 省掉注定 401 的往返，
 *      也让「未登录」这个状态是**推导出来**的，而不是靠接口错误反推。
 *   2. **NOT_BOUND 不重试** —— 前置条件缺失，重试多少次都不会成功。
 *      给它一个「再试一次」的按钮是在骗用户，正确做法是引导去绑定。
 */
export function useAuthedQuery<T>({
  queryKey,
  queryFn,
  isEmpty,
  notFoundStatus = 'error',
  queryOptions,
}: Options<T>) {
  const { isAuthed, booted } = useAuth();

  const query = useQuery<T, ApiError, T, QueryKey>({
    queryKey,
    queryFn,
    enabled: booted && isAuthed,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.isNotBound || error.isUnauthorized)) return false;
      return failureCount < 1;
    },
    ...queryOptions,
  });

  const isNotFound = query.error instanceof ApiError && query.error.errorCode === 'NOT_FOUND';

  const status: LoadStatus = !booted
    ? 'loading'
    : !isAuthed
      ? 'guest'
      : query.isLoading
        ? 'loading'
        : query.isError
          ? isNotFound
            ? notFoundStatus
            : query.error instanceof ApiError && query.error.isNotBound
              ? 'not_bound'
              : 'error'
          : isEmpty
            ? isEmpty(query.data as T)
              ? 'empty'
              : 'ready'
            : Array.isArray(query.data) && query.data.length === 0
              ? 'empty'
              : 'ready';

  return {
    status,
    data: query.data,
    error: query.error,
    refetch: query.refetch,
    /** 下拉刷新中（区别于首屏骨架） */
    isRefreshing: query.isFetching && !query.isLoading,
  };
}
