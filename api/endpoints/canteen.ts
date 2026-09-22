import { http } from '../client';
import type { Paged } from '../contracts';
import type {
  CanteenCategory,
  CanteenComment,
  CanteenWindow,
  CompareQuery,
  CompareResult,
  Dish,
  DishesQuery,
  WindowsQuery,
} from '../contracts/content';

/**
 * 食堂（canteen）接口封装 —— 接口文档 §3.6。
 *
 * ✅ 已对线上真实响应核对过**每个接口的返回形态**（重要，三种形态并存）：
 *   `/canteen/categories`            → 裸数组
 *   `/canteen/comments/random`       → 裸数组
 *   `/canteen/dishes`                → `{rows, total}`
 *   `/canteen/windows`               → `{rows, total}`
 *   `/canteen/window/{id}/comments`  → `{rows, total}`
 *   `/canteen/compare`               → `{items, stats, total}`
 */
export const canteenApi = {
  /** 菜品列表（分页信封 `{rows,total}`），可按分类 / 窗口过滤 */
  getDishes: (query?: DishesQuery) => http.get<Paged<Dish>>('/canteen/dishes', { query }),

  /** 菜品对比（分页信封 `{items,stats,total}`） */
  compare: (query: CompareQuery) => http.get<CompareResult>('/canteen/compare', { query }),

  /** 分类列表（裸数组：汤面、拌面、粥类…） */
  getCategories: () => http.get<CanteenCategory[]>('/canteen/categories'),

  /** 窗口列表（分页信封 `{rows,total}`） */
  getWindows: (query?: WindowsQuery) =>
    http.get<Paged<CanteenWindow>>('/canteen/windows', { query }),

  /** 随机评论（裸数组，首页「同学们怎么说」用） */
  getRandomComment: () => http.get<CanteenComment[]>('/canteen/comments/random'),

  /** 某窗口的评论列表（分页信封 `{rows,total}`） */
  getWindowComments: (windowId: string | number) =>
    http.get<Paged<CanteenComment>>(`/canteen/window/${windowId}/comments`),

  /** 某窗口单条评论（字段形态待运行时确认） */
  getWindowComment: (windowId: string | number, id: string | number) =>
    http.get<CanteenComment>(`/canteen/window/${windowId}/comments/${id}`),
};
