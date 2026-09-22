import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/contracts';
import { newsApi } from '../api/endpoints/content';
import type { NewsItem, NewsType } from '../api/contracts/content';

export const newsKeys = {
  all: ['news'] as const,
  list: (type: NewsType | '') => [...newsKeys.all, 'list', type] as const,
};

/**
 * 新闻列表（公开接口，无需登录）。
 *
 * 刻意**不用** `useAuthedQuery`：/news 不要求令牌，走了反而会因为
 * `enabled: booted && isAuthed` 在未登录时把首页要闻也一起禁掉。
 *
 * 分类筛选交给后端 `type` 参数而不是前端过滤 —— 后端按栏目抓取，
 * 前端拿到的条目本身**不带分类字段**，硬过滤只能靠标题猜，不可靠。
 */
export function useNews(type: NewsType | '' = '') {
  const query = useQuery<NewsItem[], ApiError, NewsItem[], ReturnType<typeof newsKeys.list>>({
    queryKey: newsKeys.list(type),
    queryFn: () => newsApi.getList(type ? { type } : {}),
    staleTime: 10 * 60 * 1000,
  });

  return {
    news: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefreshing: query.isFetching && !query.isLoading,
  };
}
