import { useMutation } from '@tanstack/react-query';
import { jwxtApi } from '../api/endpoints/jwxt';
import type { GradeDetail, GradeItem, GradeQuery } from '../api/contracts/jwxt';
import { useAuthedQuery } from './useAuthedQuery';

export const gradeKeys = {
  all: ['jwxt', 'grades'] as const,
  list: (query: GradeQuery) => [...gradeKeys.all, 'list', query] as const,
  detail: (jx0404id: string, cj0708id: string) =>
    [...gradeKeys.all, 'detail', jx0404id, cj0708id] as const,
};

/**
 * 成绩列表。
 *
 * `course`（课名模糊）与 `type`（必修/选修）都是后端显式声明的可选参数，
 * 直接透传给后端过滤 —— 不在前端做假筛选，避免与教务的真实口径不一致。
 */
export function useGrades(query: GradeQuery = {}) {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<GradeItem[]>({
    queryKey: gradeKeys.list(query),
    queryFn: () => jwxtApi.getGrades(query),
    // 成绩相对静态，5 分钟内不重复请求
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });

  return {
    status,
    grades: data ?? [],
    error,
    refetch,
    isRefreshing,
  };
}

/**
 * 成绩明细。刻意用 mutation 而不是 query：
 * 明细只在用户点开某门课时才需要，且参数是「成绩列表条目里带的凭据」，
 * 用 query 会导致列表一变就批量预取。
 */
export function useGradeDetail() {
  return useMutation<GradeDetail, unknown, { item: GradeItem }>({
    mutationFn: ({ item }) =>
      jwxtApi.getGradeDetail({
        jx0404id: item.jx0404id as string,
        cj0708id: item.cj0708id as string,
        zcj: item.zcj as string,
      }),
  });
}
