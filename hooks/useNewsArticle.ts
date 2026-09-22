import { useMemo } from 'react';
import type { NewsArticle } from '../api/contracts/content';
import { newsApi } from '../api/endpoints/content';
import { parseNewsHtml, type NewsBlock } from '../lib/newsHtml';
import { useAuthedQuery } from './useAuthedQuery';

export const newsArticleKeys = {
  all: ['news', 'article'] as const,
  detail: (url: string) => [...newsArticleKeys.all, url] as const,
};

/** 取文章 URL 的 origin，用作解析 HTML 里相对地址时的兜底 baseURL */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * 新闻正文（`GET /news/article?url=`）。
 *
 * 与列表 `/news` 的关键差别是**权限**：列表公开，正文挂 `middleware.Auth()`。
 * 所以这里必须用 `useAuthedQuery` —— 未登录时不发这个注定 401 的请求，
 * 页面直接落到 guest 态（展示列表带来的摘要 + 登录引导），而不是先闪一下错误卡。
 *
 * `isEmpty` 判定在正文上：后端在页面拿到但**正文容器选择器没命中**时
 * （`ParseArticleContent` 里 `bodySelection == nil`）会返回 `{title:"", content:""}`，
 * 这是「解析不出正文」而不是「加载失败」，应当走 empty 态给原文出口。
 */
export function useNewsArticle(url: string) {
  const query = useAuthedQuery<NewsArticle | null>({
    queryKey: newsArticleKeys.detail(url),
    queryFn: () => (url ? newsApi.getArticle(url) : Promise.resolve(null)),
    isEmpty: (data) => !(data?.content ?? '').trim(),
    // 正文是一篇一次、内容不会变，缓存久一点；重新进入同一篇不再打网络
    queryOptions: { staleTime: 10 * 60 * 1000 },
  });

  const html = query.data?.content ?? '';
  const blocks = useMemo<NewsBlock[]>(() => parseNewsHtml(html, originOf(url)), [html, url]);

  return {
    ...query,
    /** 解析后的正文块（仅 ready 态有意义） */
    blocks,
    /** 后端返回的网页标题（带站点后缀），页面按需使用 */
    articleTitle: query.data?.title ?? '',
  };
}
