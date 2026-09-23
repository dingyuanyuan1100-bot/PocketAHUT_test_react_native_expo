import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { BORDER, C, R, SHADOW } from './theme';

type Props = {
  /** 卡片本体样式：尺寸、内边距、排列方式写在这里 */
  style?: StyleProp<ViewStyle>;
  /** 外层定位容器样式：position / flex / margin 写在这里 */
  wrapStyle?: StyleProp<ViewStyle>;
  /** 卡片填充色 */
  fill?: string;
  /** 圆角 */
  radius?: number;
  /** 硬投影偏移，0 = 不投影 */
  offset?: number;
  /** 描边粗细 */
  border?: number;
  /** 描边颜色 */
  borderColor?: string;
  /** 硬投影颜色 */
  shadowColor?: string;
  /** 是否把子元素裁切到圆角内（菜单卡这类需要） */
  clip?: boolean;
  /**
   * 按下进度：0 = 悬浮（右下露出硬投影），1 = 完全压平（投影被本体盖住）。
   *
   * 贴纸的立体感全部来自那层偏移的硬投影 —— 它就是「卡片离桌面的高度」。
   * 所以「按下去」在物理上等于**高度归零**：本体朝投影方向平移 `offset`，
   * 正好滑到 slab 的位置把它整个盖住。
   *
   * 关键是 **slab 不动**：由于 slab 用的是 `left/top: offset, right/bottom: -offset`，
   * 它的宽高与本体完全相同（left 与 right 相抵），只是平移了 (offset, offset)。
   * 于是本体的位移量恰好等于 slab 的偏移量，两者在 p=1 时精确重合。
   * 这样只需要动画**一个** transform，纯 GPU 合成、可开 native driver，
   * 也不必去碰会产生布局重排的 left/top。
   *
   * 不传时走原来的纯 View 分支，行为与改动前逐字节一致、零额外开销。
   */
  pressProgress?: Animated.Value;
  /**
   * `pressProgress` 到 1 时本体的位移量，**默认等于 `offset`**（完全压平）。
   *
   * 用于表现「高度降低但没归零」：表单聚焦只需沉 `offset - 残留高度`，
   * 于是本体与原地不动的 slab 之间仍留着一丝硬投影（见 `FIELD_ELEVATION`）。
   * 不传时行为与加这个 prop 之前完全一致。
   */
  pressShift?: number;
  children?: ReactNode;
};

/**
 * 贴纸容器：2px 墨黑描边 + 零模糊硬投影。
 *
 * 这里刻意不用 elevation / shadowRadius —— Android 的 elevation 一定是模糊阴影，
 * 会把「贴纸」的硬边质感糊掉。改为自己画一层向右下偏移的墨黑底板，
 * 双端呈现完全一致，也正好对应设计稿里 radius: 0 的 DROP_SHADOW。
 */
const Sticker = forwardRef<View, Props>(function Sticker(
  {
    style,
    wrapStyle,
    fill = C.white,
    radius = R.card,
    offset = SHADOW.lg,
    border = BORDER,
    borderColor = C.ink,
    shadowColor = C.ink,
    clip = false,
    pressProgress,
    pressShift,
    children,
  }: Props,
  ref,
) {
  const slab =
    offset > 0 ? (
      <View
        pointerEvents="none"
        style={[
          styles.slab,
          {
            left: offset,
            top: offset,
            right: -offset,
            bottom: -offset,
            backgroundColor: shadowColor,
            borderRadius: radius,
          },
        ]}
      />
    ) : null;

  const bodyStyle = [
    {
      backgroundColor: fill,
      borderRadius: radius,
      borderWidth: border,
      borderColor,
    },
    clip && styles.clip,
    style,
  ];

  if (pressProgress) {
    // 不传 pressShift 时 shift === offset，与改动前逐字节一致
    const shift = pressShift ?? offset;
    const pressTransform = {
      transform: [
        { translateX: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, shift] }) },
        { translateY: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, shift] }) },
      ],
    };
    return (
      <View ref={ref} style={wrapStyle}>
        {slab}
        <Animated.View style={[bodyStyle, pressTransform]}>{children}</Animated.View>
      </View>
    );
  }

  return (
    <View ref={ref} style={wrapStyle}>
      {slab}
      <View style={bodyStyle}>{children}</View>
    </View>
  );
});

export default Sticker;

const styles = StyleSheet.create({
  slab: {
    position: 'absolute',
  },
  clip: {
    overflow: 'hidden',
  },
});
