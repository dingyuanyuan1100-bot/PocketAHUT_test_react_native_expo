import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { C } from './theme';

/**
 * Square Jelly Box —— 方块缓慢翻转下落的 loading 动效（RN 原生实现）。
 *
 * 来源：Load Awesome 的 `.la-square-jelly-box`（CSS keyframes），
 * 这里用 `Animated` 等价重写，**不依赖任何 WebView 或 CSS**：
 *
 *   - 方块：`translateY` 0→50%→0 与 `rotate` 0→90° 同步推进，
 *     并在 50% 处压扁（scaleY 0.9）+ 右下角圆角拉到 100%，
 *     于是「方 → 圆角 → 立起来」的果冻感就出来了；
 *   - 影子：在方块最低点同步放大到 1.25 倍宽，暗示高度变化。
 *
 * ⚠️ 两个易错点：
 *   1. CSS 的 `%` 位移是相对**自身高度**，RN 的 `translateY` 是像素，
 *      所以这里按 size 换算成具体像素（25% / 50%）。
 *   2. CSS 是单次动画用 `infinite` 循环；RN 需要 `Animated.loop`，
 *      且 `useNativeDriver: false` —— borderBottomRightRadius / scaleY
 *      属于非 transform 属性，用 native driver 会被静默忽略。
 */

type Props = {
  /** 方块边长（px）。原版的 la-sm/2x/3x 对应 16 / 64 / 96 */
  size?: number;
  /** 方块颜色 */
  color?: string;
  /** 影子颜色（原版是 currentColor 的 20% 黑） */
  shadowColor?: string;
  /** 一轮动画时长（毫秒），原版 600ms */
  duration?: number;
};

export default function SquareJellyBox({
  size = 48,
  color = C.ink,
  shadowColor = 'rgba(17,18,20,0.18)',
  duration = 600,
}: Props) {
  // 单一驱动值 0 → 1，四个属性都从它插值出来，保证严格同步
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: false, // 见文件头说明 2
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, duration]);

  // ---- 方块：translateY ----
  // CSS: 0% → 0, 25% → 25%, 50% → 50%, 75% → 25%, 100% → 0（相对自身高度）
  const translateY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, size * 0.25, size * 0.5, size * 0.25, 0],
  });

  // ---- 方块：rotate 0 → 90°（线性，每段 22.5°）----
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  // ---- 方块：下落最低点压扁 ----
  const scaleY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 0.97, 0.9, 0.97, 1],
  });

  // 基准圆角：原版 `border-radius: 10%`（相对自身边长）
  const baseR = size * 0.1;

  // ---- 右下角圆角：10% → 100% → 10% ----
  // CSS 只在 17% 和 50% 打点；这里补 0%/100% 让曲线连续，视觉等价
  const radiusBR = progress.interpolate({
    inputRange: [0, 0.17, 0.5, 0.75, 1],
    outputRange: [baseR, baseR, size, size, baseR],
  });

  // ---- 影子：底部中心放大 ----
  const shadowScaleX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.25, 1],
  });

  const shadowH = Math.max(4, Math.round(size * 0.1));

  return (
    <View
      style={[styles.stage, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="加载中"
    >
      {/* 影子（原版 nth-child(2)）：贴底、水平放大 */}
      <Animated.View
        style={[
          styles.shadow,
          {
            height: shadowH,
            borderRadius: shadowH / 2,
            // 原版 bottom: -9%（相对容器高）→ 影子略微探出容器底边
            bottom: -size * 0.09,
            backgroundColor: shadowColor,
            transform: [{ scaleX: shadowScaleX }],
          },
        ]}
      />

      {/* 方块（原版 nth-child(1)）：上浮 25% 起跳，翻转下落 */}
      <Animated.View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            marginTop: -size * 0.25,
            backgroundColor: color,
            // 原版 `border-radius: 10%` 是**四角**统一；动画只改右下角这一只。
            // 逐个角写死（不用 borderRadius 简写）——RN Web 下简写与
            // borderBottomRightRadius 的覆盖顺序不可靠。
            borderTopLeftRadius: baseR,
            borderTopRightRadius: baseR,
            borderBottomLeftRadius: baseR,
            borderBottomRightRadius: radiusBR,
            transform: [{ translateY }, { rotate }, { scaleY }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  box: {
    // 四个圆角都在渲染时按 size 逐角写入（见上文注释），这里不设默认值
  },
  shadow: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
});
