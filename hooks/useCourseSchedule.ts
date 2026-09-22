import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/contracts';
import type { CourseItem } from '../api/contracts/jwxt';
import { jwxtApi } from '../api/endpoints/jwxt';
import { useCalendarEvents } from './useCalendarEvents';
import { useAuth } from '../store/AuthContext';

/** 查询键工厂，便于精确失效 */
export const courseKeys = {
  all: ['jwxt'] as const,
  schedule: () => [...courseKeys.all, 'course'] as const,
};

/**
 * 课程表页面状态机。
 *
 * 六个状态全部对应画布上已有稿子：
 *   guest     → 课程表 未登录          (`120:1`)
 *   not_bound → 课程表 未绑定教务       (`120:66`)
 *   loading   → 通用状态规范 加载中      (`120:157`)
 *   empty     → 通用状态规范 空态        (`120:119`)
 *   error     → 通用状态规范 加载失败     (`120:203`)
 *   ready     → 正常课表
 */
export type CourseStatus = 'guest' | 'loading' | 'not_bound' | 'empty' | 'error' | 'ready';

/**
 * 课程表数据钩子。
 *
 * 关键设计：
 *   - 未登录时**不发请求**（`enabled: false`），避免无意义的 401；
 *   - `NOT_BOUND` 不重试 —— 这是前置条件缺失，重试多少次都不会成功，
 *     必须引导用户去绑定教务，而不是给他一个「再试一次」的假希望。
 */
export function useCourseSchedule() {
  const { isAuthed, booted } = useAuth();

  const query = useQuery<CourseItem[], ApiError>({
    queryKey: courseKeys.schedule(),
    queryFn: () => jwxtApi.getCourse(),
    enabled: booted && isAuthed,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.isNotBound || error.isUnauthorized)) return false;
      return failureCount < 1;
    },
  });

  const status: CourseStatus = !booted
    ? 'loading'
    : !isAuthed
      ? 'guest'
      : query.isLoading
        ? 'loading'
        : query.isError
          ? query.error instanceof ApiError && query.error.isNotBound
            ? 'not_bound'
            : 'error'
          : (query.data?.length ?? 0) === 0
            ? 'empty'
            : 'ready';

  return {
    status,
    courses: query.data ?? [],
    error: query.error,
    refetch: query.refetch,
    /** 下拉刷新中（区别于首屏骨架） */
    isRefreshing: query.isFetching && !query.isLoading,
  };
}

/**
 * 尽力推算开学日期，用于把课表定位到「第几周」。
 *
 * 数据源是公开接口 `GET /calendar`（文档 §5 实测返回真实校历）。
 * 优先认标题里出现「开学 / 报到 / 注册」的事件；都没有时退化为最早的
 * 一条已发布事件。仍然推不出来就返回 null —— 页面据此隐藏周次而不是瞎写一个。
 */
export function useTermStart(): string | null {
  const { data } = useCalendarEvents();
  if (!data?.length) return null;

  // 注意字段是 snake_case 的 start_date（实测），且必须容忍缺字段的脏数据
  const dated = data.filter((e) => !!e?.start_date);
  if (!dated.length) return null;

  const published = dated.filter((e) => e.status === 'published' || !e.status);
  const pool = published.length ? published : dated;

  const named = pool.find((e) => /开学|报到|注册|返校/.test(e.title ?? ''));
  if (named) return named.start_date;

  const earliest = [...pool].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return earliest?.start_date ?? null;
}
