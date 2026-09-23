import { createContext, forwardRef, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { TextInput } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';

import Sticker from './Sticker';
import usePressFeedback from './motion/usePressFeedback';
import { BORDER, C, FIELD_ELEVATION, R } from './theme';

/**
 * 表单输入框：静止时浮起（带硬投影），聚焦时下沉、硬投影收缩。
 *
 * 特性只取自一组经典表单样式里的**聚焦那一条**：
 * 静止 `3px 4px` 硬投影 → 聚焦时本体下沉、投影收缩为 `1px 2px`。
 * 配色与圆角一律沿用贴纸系统，不引入范式里的米粉底、墨绿描边与橙色投影。
 *
 * 实现上复用了 `Sticker` 的 slab 机制：slab 用 `left/top: offset, right/bottom: -offset`
 * 定位，宽高与本体完全相同、只是平移了 (offset, offset)。所以让本体下沉
 * `restOffset - focusOffset`，**slab 原地不动**，露出的硬投影就正好从 rest 收到 focus ——
 * 只动一个 transform，纯 GPU 合成、可开 native driver，也不会触发布局重排。
 *
 * 之所以用 Context 而不是让调用方自己接 onFocus：输入框是本项目里最容易「各写各的」
 * 的控件，集中接线能保证后加的字段自动获得同一套反馈，不会漏。
 */

type FocusCtx = { setFocused: (on: boolean) => void };

const FieldFocusContext = createContext<FocusCtx | null>(null);

type Props = {
  /** 外壳本体样式：内边距、排列方式、高度写在这里（代替原来写在 Sticker 上的 style） */
  style?: StyleProp<ViewStyle>;
  /** 外层定位容器样式：position / flex / margin 写在这里 */
  wrapStyle?: StyleProp<ViewStyle>;
  fill?: string;
  radius?: number;
  border?: number;
  borderColor?: string;
  shadowColor?: string;
  /** 静止时离桌面的高度（硬投影偏移）。默认取 `FIELD_ELEVATION.rest` */
  restOffset?: number;
  /** 聚焦后残留的高度。默认取 `FIELD_ELEVATION.focus`；设为 0 则聚焦时彻底压平 */
  focusOffset?: number;
  children?: ReactNode;
};

export default function StickerField({
  style,
  wrapStyle,
  fill = C.white,
  radius = R.card,
  border = BORDER,
  borderColor = C.ink,
  shadowColor = C.ink,
  restOffset = FIELD_ELEVATION.rest,
  focusOffset = FIELD_ELEVATION.focus,
  children,
}: Props) {
  // 聚焦下沉与按钮按压是同一套隐喻的两档强度（高度归零 vs 高度降到很低），
  // 所以复用同一个进度值机制，只是位移量取 restOffset - focusOffset。
  const { progress, setPressed: setFocused } = usePressFeedback();

  const ctx = useMemo(() => ({ setFocused }), [setFocused]);

  return (
    <FieldFocusContext.Provider value={ctx}>
      <Sticker
        style={style}
        wrapStyle={wrapStyle}
        fill={fill}
        radius={radius}
        border={border}
        borderColor={borderColor}
        shadowColor={shadowColor}
        offset={restOffset}
        pressProgress={progress}
        // 位移量刻意小于 offset：留一丝硬投影 = 高度降到很低但不归零
        pressShift={Math.max(0, restOffset - focusOffset)}
      >
        {children}
      </Sticker>
    </FieldFocusContext.Provider>
  );
}

/**
 * 与 `StickerField` 配套的输入框：自动把 onFocus / onBlur 接到外壳的下沉动效上。
 * 调用方传进来的 onFocus / onBlur 仍会照常执行。
 *
 * 转发了 ref（指向内部的 TextInput）：搜索这类场景需要「展开动画跑完再聚焦」，
 * 而 `autoFocus` 是挂载即触发 —— 对「常驻但平时不可见」的输入框会平白弹键盘。
 */
export const FieldInput = forwardRef<TextInput, TextInputProps>(function FieldInput(
  { onFocus, onBlur, ...rest },
  ref,
) {
  const ctx = useContext(FieldFocusContext);

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
    ctx?.setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => {
    ctx?.setFocused(false);
    onBlur?.(e);
  };

  return <TextInput ref={ref} {...rest} onFocus={handleFocus} onBlur={handleBlur} />;
});
