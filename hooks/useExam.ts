import { jwxtApi } from '../api/endpoints/jwxt';
import type { ExamItem, ExamQuery } from '../api/contracts/jwxt';
import { useAuthedQuery } from './useAuthedQuery';

export const examKeys = {
  all: ['jwxt', 'exam'] as const,
  list: (query: ExamQuery) => [...examKeys.all, query] as const,
};

/**
 * 考试安排。
 *
 * 后端 `/jwxt/exam` 内部会分别拉「正考」与「补考」两个页面并合并，
 * 所以一次请求就能拿到全部安排；返回是**裸数组**。
 */
export function useExam(query: ExamQuery = {}) {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<ExamItem[]>({
    queryKey: examKeys.list(query),
    queryFn: () => jwxtApi.getExam(query),
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });

  return {
    status,
    exams: data ?? [],
    error,
    refetch,
    isRefreshing,
  };
}
