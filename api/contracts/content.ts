/**
 * 内容类契约 —— 对应接口文档 §3.3 校历（/calendar）、§3.6 食堂、
 * §3.11 校园地图、§3.12 新闻、§3.13 通知 / 校历 / 学习通。
 *
 * 本节多数接口在文档 §5 实测为**公开接口**（无需令牌）。
 *
 * ✅ 带「实测」标记的结构，均已对线上 `https://ahut.domye.top` 发过真实请求核对，
 *    字段名与分页形态都是真实值，可直接消费。
 */
import type { Paged, PagedResult, UnverifiedList, UnverifiedRecord } from './index';

// ===================== 校历（calendar） =====================

/**
 * 校历活动（GET /calendar）。
 *
 * ✅ 实测（`/calendar` 返回 7 条：开学 / 调休 / 中秋 / 国庆 / 运动会 / 寒假）：
 *   `{"id":3,"title":"开学","start_date":"2026-08-31","end_date":"2026-08-31","status":"published"}`
 *
 * ⚠️ 注意字段是 **snake_case** 的 `start_date` / `end_date`，
 *    不是驼峰 —— 这点与后端 Go 结构体的 json tag 有关，写错会直接拿到 undefined。
 */
export interface CalendarEvent {
  id: number;
  title: string;
  /** 'YYYY-MM-DD' */
  start_date: string;
  /** 'YYYY-MM-DD' */
  end_date: string;
  status: 'draft' | 'published';
}

// ===================== 新闻（news） =====================

/**
 * 新闻条目（GET /news）。
 *
 * ✅ 实测：返回 30 条，字段为 `{title, content, date, url}`。
 * `content` 已经是正文文本（不是摘要），列表页渲染时需要自行截断。
 */
export interface NewsItem {
  title: string;
  content: string;
  date: string;
  url: string;
}

/**
 * 新闻分类。**取值是英文枚举，不是中文名**
 * （源码 `internal/news/application/dto.go` 的 `NewsType`）。
 *
 * ⚠️ 实测：传中文「公告通知」会让上游炸掉，返回
 *   `{"code":500,"errorCode":"UPSTREAM_ERROR","message":"获取新闻失败"}`；
 *   传 `announcement` 正常返回 200。别按 UI 上的中文标签直接透传。
 */
export type NewsType = 'academic' | 'announcement' | 'school';

/** 分类枚举 → 界面中文标签，顺序即筛选条顺序 */
export const NEWS_TYPE_OPTIONS: { value: NewsType | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'announcement', label: '公告通知' },
  { value: 'academic', label: '学业通知' },
  { value: 'school', label: '学校要闻' },
];

/** GET /news 查询参数 */
export interface NewsQuery {
  /** 新闻分类，英文枚举；不传 / 空串 = 全部（后端按时间排序） */
  type?: NewsType | '';
}

/** GET /news/article 查询参数。文档已证实 url */
export interface NewsArticleQuery {
  url: string;
}

/**
 * 新闻正文（GET /news/article?url=…）。
 *
 * ✅ 结构由后端 DTO 证实：`internal/news/domain/news.go`
 *    `ArticleContent{ Title string \`json:"title"\`; Content string \`json:"content"\` }`
 *    handler 走 `response.Success(c, content)` 直接透出，无二次包装。
 *
 * ⚠️ 三个必须知道的事实：
 *   1. **需要登录**。路由挂 `middleware.Auth()`（`internal/news/interfaces/router.go`），
 *      不带令牌实测返回 `401 UNAUTHORIZED / 未登录或登录已过期`。
 *      列表 `/news` 公开、正文要登录 —— 两者权限不同，别混用。
 *   2. **`content` 是 HTML 片段，不是纯文本**。后端
 *      `parser.ParseArticleContent` 取正文容器（`#vsb_content` / `[id^=vsb_content]` /
 *      `.v_news_content` …）的 innerHTML 原样返回，只把 `img[src]`、`a[href]`
 *      补成绝对地址。RN 里没有 WebView，必须先用 `lib/newsHtml.ts` 解析成块。
 *   3. `url` 受白名单限制（`domain/url_policy.go`）：仅 `https://` +
 *      `news.ahut.edu.cn` / `jwc.ahut.edu.cn`，其它域名一律 400。列表项带的 url 天然满足。
 */
export interface NewsArticle {
  /** 上游网页的 `<title>`，注意它带站点后缀，与列表标题不完全一致 */
  title: string;
  /** 正文 HTML 片段（图片/链接已是绝对地址；jwc 文章走 VPN 时图片是 base64 data URI） */
  content: string;
}

// ===================== 通知（notification） =====================

/**
 * 通知条目。
 *
 * ✅ 实测：`/notification/latest` 返回的是**单个对象**（不是数组）：
 *   `{"id":..,"title":..,"content":..,"created_at":..}`
 */
export interface NotificationItem {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

/** GET /notification/latest 查询参数。文档已证实 since（增量拉取） */
export interface NotificationQuery {
  /** 上次拉取时间戳，服务端只返回此后的新通知 */
  since?: number | string;
}

// ===================== 校园地图（campus-map） =====================

/**
 * 地图分类（`/campus-map/bootstrap` 的 `categories`）。
 *
 * ✅ 实测：`{"id":1,"name":"校门","icon":"door-open","color":"#C4785A","sort_order":10,"status":"published"}`
 */
export interface MapCategory {
  id: number;
  name: string;
  /** 图标名（前端图标库 key） */
  icon: string;
  /** 十六进制色值 */
  color: string;
  sort_order: number;
  status: string;
}

/** ✅ 实测：`/campus-map/bootstrap` → `{categories: MapCategory[]}` */
export interface CampusMapBootstrap {
  categories: MapCategory[];
}

/**
 * 地点条目。
 *
 * ✅ 实测：`/campus-map/places` → `{rows, total}`，total = 114；
 * 行结构 `{aliases, campus_id, category_color, category_icon, category_id,
 *          category_name, description, id, latitude, longitude, name}`
 */
export interface CampusPlace {
  id: number;
  name: string;
  /** 别名，可能是逗号分隔的字符串，也可能为空 */
  aliases?: string | null;
  description?: string | null;
  campus_id?: number;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  latitude: number;
  longitude: number;
}

/** 地点详情（字段待运行时确认） */
export type CampusPlaceDetail = UnverifiedRecord;

// ===================== 食堂（canteen） =====================

/**
 * 菜品条目。
 *
 * ✅ 实测：
 *   `{"canteen_name":"八食堂一楼","category_id":10,"category_name":"粥类","id":1,
 *     "is_lowest":false,"name":"绿豆粥","origin_price":0,"price":1.5,"status":1,
 *     "tags":"","window_id":2,"window_name":"营养粥"}`
 */
export interface Dish {
  id: number;
  name: string;
  /** 现价（元） */
  price: number;
  /** 原价（元），0 表示无原价 */
  origin_price: number;
  /** 是否全窗口最低价 */
  is_lowest: boolean;
  tags?: string;
  status?: number;
  category_id?: number;
  category_name?: string;
  window_id?: number;
  window_name?: string;
  canteen_name?: string;
}

/**
 * 窗口条目。
 *
 * ✅ 实测：`/canteen/windows` → `{rows, total}`，
 * 行结构 `{campus_id, canteen_id, created_at, desc, id, name, status}`
 */
export interface CanteenWindow {
  id: number;
  name: string;
  campus_id?: number;
  canteen_id?: number;
  desc?: string;
  status?: number;
  created_at?: string;
}

/**
 * 食堂分类。
 *
 * ✅ 实测：`/canteen/categories` → **裸数组**（17 条），
 * 行结构 `{created_at, id, name, sort_order}`
 */
export interface CanteenCategory {
  id: number;
  name: string;
  sort_order: number;
  created_at?: string;
}

/**
 * 窗口评论。
 *
 * ✅ 实测：`/canteen/comments/random` → **裸数组**（5 条），
 * 行结构 `{campus_name, canteen_name, content, created_at, id, username, window_id, window_name}`
 */
export interface CanteenComment {
  id: number;
  content: string;
  username: string;
  created_at: string;
  window_id?: number;
  window_name?: string;
  canteen_name?: string;
  campus_name?: string;
}

/** GET /canteen/dishes 查询参数 */
export interface DishesQuery {
  category_id?: string | number;
  window_id?: string | number;
  page?: number;
  pageSize?: number;
}

/** GET /canteen/windows 查询参数 */
export interface WindowsQuery {
  canteen_id?: string | number;
}

/** GET /canteen/compare 查询参数 */
export interface CompareQuery {
  /** 参与对比的菜品 ID，多个以逗号分隔 */
  ids?: string;
}

/**
 * 菜品对比结果。
 *
 * ✅ 实测：`/canteen/compare?ids=1,2` → `{items, stats, total}`。
 * 这是后端出现的**第三种分页形态**（前两种见 Paged / PagedResult），
 * 接入时不要想当然按数组处理。
 */
export interface CompareResult {
  items: Dish[];
  /** 聚合统计（字段待运行时确认） */
  stats: UnverifiedRecord;
  total: number;
}

// ===================== 图书馆（library） =====================

/**
 * 图书条目。
 *
 * ✅ 实测：`/library/search?keyword=math&page=1` → `{page, pageSize, results, total}`，
 * 行结构 `{author, availCount, callNo, id, pubYear, publisher, title, totalCount}`
 */
export interface BookItem {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  pubYear?: string;
  /** 索书号 */
  callNo?: string;
  totalCount?: number;
  availCount?: number;
}

// ===================== 学习通（chaoxing） =====================

/** GET /chaoxing/unfinished —— 未完成任务（需登录，字段待运行时确认） */
export type ChaoxingUnfinished = UnverifiedList;

// ===================== 便捷别名 =====================

export type PagedDishes = Paged<Dish>;
export type PagedWindows = Paged<CanteenWindow>;
export type PagedPlaces = Paged<CampusPlace>;
export type PagedBooks = PagedResult<BookItem>;
