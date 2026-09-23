import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Sticker from './Sticker';
import { C, DISPLAY, R, SHADOW, inkA, limeA } from './theme';

/** 状态语义 —— 决定图标盒配色与行动层级 */
export type StateTone = 'guest' | 'not_bound' | 'empty' | 'error' | 'info';

type Action = {
  label: string;
  onPress: () => void;
  /** 主行动右侧是否带箭头 */
  arrow?: boolean;
};

type Props = {
  tone: StateTone;
  /** 图标盒内的图标（Feather 图标名或自定义节点） */
  icon: ReactNode;
  /** 图标盒右上角的旋转装饰贴纸内容 */
  badge?: ReactNode;
  /**
   * 旋转的 `!` 警示贴纸。
   *
   * 与 `badge` 二选一（`badge` 优先）。抽出来是因为 5 个页面原先各自
   * 抄了一遍同样的 `badge={<Text style={styles.bang}>!</Text>}` 加 9 行同样的样式。
   */
  bang?: boolean;
  /** 图标盒底色，缺省按 tone 推导 */
  iconBoxFill?: string;
  title: string;
  description: string;
  /** 卡内附加内容（如课表示意网格、骨架屏、绑定状态行） */
  children?: ReactNode;

  /** 主行动：墨黑实心胶囊 + 青柠字 */
  primaryAction?: Action;
  /** 次要行动：白底 + 墨黑描边胶囊 */
  secondaryAction?: Action;
  /** 底部文字链（如「返回上一页」） */
  link?: Action;
  /** 真实错误码条（对齐画布：oat 底 + 警示图标 + `CODE · 文案`） */
  errorBar?: { code: string; message: string };
};

/**
 * 通用状态卡 —— 对齐画布「通用状态规范」三屏与课程表两态的结构。
 *
 * 按钮层级约定（这是本设计系统里最要紧的一条）：
 *   空态 / 未登录 / 未绑定  → 主行动是**前置动作**（登录、绑定），用墨黑实心胶囊
 *   空态（结果为空）        → 用**次要行动**（白底描边），因为「结果为空」不是故障
 *   加载中                 → **不提供任何可点击元素**，只给骨架
 *   错误                   → 主行动是**重试**（墨黑实心）+ 次要「返回」（文字链）
 */
export default function StateCard({
  tone,
  icon,
  badge,
  bang,
  iconBoxFill,
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  link,
  errorBar,
}: Props) {
  // 错误态的图标盒刻意留白底：与青柠的「正常/待引导」形成区分
  const boxFill = iconBoxFill ?? (tone === 'error' ? C.white : C.lime);
  const badgeNode = badge ?? (bang ? <Text style={styles.bang}>!</Text> : null);

  return (
    <Sticker
      style={styles.card}
      wrapStyle={styles.cardWrap}
      fill={C.white}
      radius={R.menu}
      offset={SHADOW.xl}
    >
      {/* 头部行：隐形等宽 Spacer + 图标盒 + 旋转贴纸，保证图标盒严格居中 */}
      <View style={styles.headRow}>
        <View style={styles.spacer} />

        <Sticker style={styles.iconBox} fill={boxFill} radius={20} offset={SHADOW.lg}>
          {icon}
        </Sticker>

        {badgeNode ? (
          <Sticker
            style={[styles.badge, { backgroundColor: C.white }]}
            fill={C.white}
            radius={11}
            offset={SHADOW.sm}
            wrapStyle={styles.badgeWrap}
          >
            {badgeNode}
          </Sticker>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>

      {children}

      {errorBar && (
        <View style={styles.errorBar}>
          <Feather name="alert-triangle" size={14} color={C.ink} />
          <Text style={styles.errorText} numberOfLines={2}>
            <Text style={styles.errorCode}>{errorBar.code}</Text>
            {` · ${errorBar.message}`}
          </Text>
        </View>
      )}

      {primaryAction && (
        <Pressable
          onPress={primaryAction.onPress}
          style={({ pressed }) => [styles.actionWrap, pressed && styles.pressed]}
        >
          <Sticker style={styles.cta} fill={C.ink} radius={999} offset={SHADOW.lg}>
            <Text style={styles.ctaText}>{primaryAction.label}</Text>
            {primaryAction.arrow && <Feather name="arrow-right" size={18} color={C.lime} />}
          </Sticker>
        </Pressable>
      )}

      {secondaryAction && (
        <Pressable
          onPress={secondaryAction.onPress}
          style={({ pressed }) => [styles.actionWrap, pressed && styles.pressed]}
        >
          <Sticker style={styles.cta} fill={C.white} radius={999} offset={SHADOW.lg}>
            <Text style={[styles.ctaText, { color: C.ink }]}>{secondaryAction.label}</Text>
          </Sticker>
        </Pressable>
      )}

      {link && (
        <Pressable onPress={link.onPress} hitSlop={8}>
          <Text style={styles.link}>{link.label}</Text>
        </Pressable>
      )}
    </Sticker>
  );
}

const styles = StyleSheet.create({
  /**
   * Sticker 的外层定位容器。必须在这里 flexGrow —— `style` 是给内层卡片用的，
   * 只在内层写 flexGrow 的话，外层仍按内容高度收缩，卡片永远撑不满。
   */
  cardWrap: {
    flexGrow: 1,
  },
  card: {
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  spacer: {
    width: 34,
    height: 34,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: {
    width: 34,
    height: 34,
    transform: [{ rotate: '-12deg' }],
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `!` 警示贴纸的文字样式（原先 5 个页面各抄一遍） */
  bang: {
    fontFamily: DISPLAY,
    fontSize: 22,
    lineHeight: 24,
    color: C.ink,
    textAlign: 'center',
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 20,
    lineHeight: 26,
    color: C.ink,
    textAlign: 'center',
  },
  desc: {
    fontSize: 12.5,
    lineHeight: 19,
    color: C.gray,
    textAlign: 'center',
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.oat,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: C.gray,
    fontWeight: '600',
  },
  errorCode: {
    fontWeight: '800',
    color: C.ink,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    height: 52,
  },
  /** Pressable 默认按内容宽度收缩，必须先把它撑满，内部 Sticker 的 stretch 才生效 */
  actionWrap: {
    alignSelf: 'stretch',
  },
  ctaText: {
    fontFamily: DISPLAY,
    fontSize: 16,
    lineHeight: 22,
    color: C.lime,
  },
  link: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.gray,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});

/**
 * 把接口错误转成错误码条的内容。
 *
 * 抽出来是因为 6 个页面各写了一遍完全相同的三元表达式 —— 连字号与兜底文案都一样，
 * 只有错误对象的名字不同：
 *   code: error?.errorCode ?? `HTTP ${error?.code ?? 0}`,
 *   message: error?.message ?? '未知错误',
 *
 * 参数用结构化类型而不是 `ApiError`，这样各 hook 抛出的错误对象都能直接传进来。
 */
export function toErrorBar(
  err: { errorCode?: string; code?: number; message?: string } | null | undefined,
  fallbackMessage = '未知错误',
): { code: string; message: string } {
  return {
    code: err?.errorCode ?? `HTTP ${err?.code ?? 0}`,
    message: err?.message ?? fallbackMessage,
  };
}

/** 供外部复用的配色常量（骨架屏、进度条等同源） */
export const STATE_COLORS = {
  skeleton: C.oat,
  track: C.oat,
  progress: C.lime,
  desc: inkA(0.6),
  badge: limeA(0.85),
};
