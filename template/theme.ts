import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';

// ===== 全局配色（贴纸潮流 Sticker：高饱和实心色块 + 墨黑描边） =====
export const C = {
  lime: '#C6E844',      // 柠檬绿
  limeDeep: '#9BC426',  // 深绿（次级强调）
  ink: '#111214',       // 墨黑：描边 / 硬投影 / 主文字
  inkSoft: '#29292B',   // 墨黑渐变起点（保留给旧页面）
  cream: '#F3F0E8',     // 奶油白：页面底色
  oat: '#E6DEC7',       // 燕麦：中性「纸张」色
  white: '#FFFFFF',
  gray: '#5A5D60',      // 辅助灰
  hairline: '#E0DBCC',  // 米色分隔线
};

/** 墨黑透明度（设计稿里大量使用 ink@x%） */
export const inkA = (a: number) => `rgba(17,18,20,${a})`;
/** 柠檬绿透明度 */
export const limeA = (a: number) => `rgba(198,232,68,${a})`;

/** 贴纸风圆角 */
export const R = {
  card: 16,     // 课程卡 / 日期格 / 节次格 / 服务行卡片
  stat: 18,     // 统计砖
  badge: 20,    // 徽章底座
  hero: 20,     // 通栏 Hero 卡
  cardLg: 22,   // 支持我们大卡
  menu: 24,     // 菜单卡
  cardXl: 26,   // 头部主卡
  iconBox: 14,  // 图标底座
  btn: 12,      // 方形按钮
  pill: 999,    // 胶囊
};

/** 统一描边粗细（设计稿全部为 2px 内描边） */
export const BORDER = 2;

/** 零模糊硬投影的偏移量 —— 这是「贴纸」与「普通卡片」的分水岭 */
export const SHADOW = {
  sm: 2,     // 贴纸星等点缀
  md: 2.5,   // 方形按钮 / 胶囊
  lg: 3,     // 课程卡 / 日期格 / 统计砖 / 头像
  xl: 4,     // 菜单卡 / 大卡 / 退出按钮
  xxl: 5,    // 头部主卡
};

/**
 * 表单控件的「聚焦落差」。
 *
 * 硬投影 = 控件离桌面的高度。所以「聚焦」在物理上就是**高度降低**：
 * 本体朝投影方向下沉 `rest - focus`，露出的硬投影随之从 `rest` 收缩到 `focus`。
 *
 * 参考范式里的原始表现是：输入框静止 `3px 4px` 硬投影，聚焦时本体下沉、
 * 投影收缩为 `1px 2px`。**只取这一条聚焦特性**，配色一律沿用贴纸系统
 * （cream / 燕麦 / 墨黑），不引入范式里的米粉底、墨绿描边与橙色投影。
 *
 * 与 `Sticker` 的按下反馈是同一套隐喻的两档强度：
 *   按钮按下 → 位移 `offset`，高度归零（投影被完全盖住）
 *   输入聚焦 → 位移 `offset - focus`，高度降低但留一丝厚度
 *
 * 两者都只落在 transform 上，纯 GPU 合成、不触发布局重排。
 */
export const FIELD_ELEVATION = {
  rest: SHADOW.lg,  // 3：静止时的高度，与普通卡片同级
  focus: 1,         // 1：聚焦后残留的高度，保留一点「贴纸张厚度」的实感
} as const;

/** 展示字体：项目内置的钉钉进步体，承担设计稿里 Noto Sans SC Black 的「海报感」标题与数字 */
export const DISPLAY = 'DingTalkJinBuTi';

// Feather 图标名类型
export type FeatherName = ComponentProps<typeof Feather>['name'];
