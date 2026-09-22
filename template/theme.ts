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

/** 展示字体：项目内置的钉钉进步体，承担设计稿里 Noto Sans SC Black 的「海报感」标题与数字 */
export const DISPLAY = 'DingTalkJinBuTi';

// Feather 图标名类型
export type FeatherName = ComponentProps<typeof Feather>['name'];
