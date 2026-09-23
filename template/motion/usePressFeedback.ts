import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * 「按下 → 硬投影归零」的动效进度值。
 *
 * 贴纸系统里硬投影 = 控件离桌面的高度。按下时本体朝投影方向平移、把投影盖住，
 * 视觉上就是「压到桌面上」。这个进度值 (0→1) 交给 `Sticker` 的 `pressProgress`
 * 去插值位移，所以是纯 transform、可开 native driver，也不会触发布局重排。
 *
 * 收敛了原先散在三处的同一份实现（HeroCard / Tile 的按压反馈、
 * StickerField 的聚焦下沉）—— 它们连时序常量都逐字相同，只该有一处。
 */

/** 按下用的时长；回弹刻意不留过冲，收得干脆利落 */
export const PRESS_IN_MS = 110;

const SPRING = { tension: 240, friction: 22 } as const;

export default function usePressFeedback() {
  const progress = useRef(new Animated.Value(0)).current;

  // 卸载兜底：避免动画回调在组件已销毁后还持有对 progress 的引用
  useEffect(() => () => progress.stopAnimation(), [progress]);

  /** 按下：快速落下 */
  const pressIn = useCallback(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: PRESS_IN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  /** 回弹：带一点弹性，比线性退出更「有厚度」 */
  const pressOut = useCallback(() => {
    Animated.spring(progress, { toValue: 0, ...SPRING, useNativeDriver: true }).start();
  }, [progress]);

  /** 归一成一个布尔入口，供聚焦这类「非按压」场景使用 */
  const setPressed = useCallback((on: boolean) => (on ? pressIn() : pressOut()), [pressIn, pressOut]);

  return useMemo(
    () => ({ progress, pressIn, pressOut, setPressed }),
    [progress, pressIn, pressOut, setPressed],
  );
}
