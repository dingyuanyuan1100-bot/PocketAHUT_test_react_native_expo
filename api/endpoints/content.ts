import { http } from '../client';
import type { Paged } from '../contracts';
import type {
  CampusMapBootstrap,
  CampusPlace,
  CampusPlaceDetail,
  ChaoxingUnfinished,
  NewsArticle,
  NewsItem,
  NewsQuery,
  NotificationItem,
} from '../contracts/content';

/**
 * 内容类接口 —— 接口文档 §3.12 新闻、§3.13 通知 / 学习通。
 *
 * ⚠️ `/news` 与 `/notification/latest` 在文档 §5 实测为**公开接口**（无需令牌）。
 * 这里仍走统一 http（有令牌就带上），不带令牌也能正常返回。
 */
export const newsApi = {
  /**
   * 新闻列表。
   *
   * ✅ 实测：不传 type 返回 30 条混合结果；传 `announcement` / `academic` / `school`
   * 分别返回对应栏目。**type 必须是英文枚举**，传中文会 500 UPSTREAM_ERROR。
   * 公开接口，无令牌也能取到。
   */
  getList: (query?: NewsQuery) => http.get<NewsItem[]>('/news', { query }),

  /**
   * 新闻正文。
   *
   * ⚠️ **需要登录**：路由挂 `middleware.Auth()`，未登录返回 401 UNAUTHORIZED。
   * 返回 `{title, content}`，其中 `content` 是**正文 HTML 片段**（后端只做了
   * 相对路径补全，没有转成纯文本）—— 必须先用 `lib/newsHtml.ts` 解析再渲染。
   *
   * `url` 有白名单（仅 https + news.ahut.edu.cn / jwc.ahut.edu.cn），
   * 列表项带的 url 天然满足；自己拼 URL 会被 400。
   */
  getArticle: (url: string) => http.get<NewsArticle>('/news/article', { query: { url } }),
};

export const notificationApi = {
  /**
   * 最新通知（增量拉取）。
   *
   * ✅ 实测返回的是**单个对象**而不是数组：`{id,title,content,created_at}`。
   * 传 since = 上次拿到的时间戳，服务端只返回此后的新通知。
   */
  getLatest: (since?: number | string) =>
    http.get<NotificationItem>('/notification/latest', { query: { since } }),
};

export const chaoxingApi = {
  /** 超星学习通未完成任务 */
  getUnfinished: () => http.get<ChaoxingUnfinished>('/chaoxing/unfinished'),
};

/** 校园地图（campus-map）—— 接口文档 §3.11，实测为公开接口 */
export const campusMapApi = {
  /**
   * 地图初始化数据。
   * ✅ 实测 → `{categories: MapCategory[]}`，分类含 name / icon / color。
   */
  getBootstrap: () => http.get<CampusMapBootstrap>('/campus-map/bootstrap'),

  /** 地点列表。✅ 实测 → `{rows,total}`，total = 114，**不是裸数组** */
  getPlaces: () => http.get<Paged<CampusPlace>>('/campus-map/places'),

  /** 热门地点。✅ 实测 → 裸数组（8 条） */
  getTrending: () => http.get<CampusPlace[]>('/campus-map/trending'),

  /** 地点详情 */
  getPlace: (id: string | number) => http.get<CampusPlaceDetail>(`/campus-map/places/${id}`),

  /** 地点实景 / 视图 */
  getPlaceView: (id: string | number) =>
    http.get<CampusPlaceDetail>(`/campus-map/places/${id}/view`),
};
