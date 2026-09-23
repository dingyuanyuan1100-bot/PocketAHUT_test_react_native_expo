import { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  /**
   * 是否「在场」。
   * true → 弹回原位；false → 弹性淡出（缩小 + 轻微下沉 + 透明到 0）。
   */
  visible: boolean;
  /** 定位样式（绝对定位的 top/left/right 写在这里，动画只叠 transform / opacity） */
  style?: StyleProp<ViewStyle>;
  /**
   * 退场时的下沉量（pt）。给一点纵向位移，元素看起来是「塌下去」而不是原地干瘪。
   * 传 0 只做缩放 + 透明。
   */
  sink?: number;
  children: ReactNode;
};

/**
 * 弹性显隐：内容在「在位 / 退场」之间用 spring 过渡，而不是瞬间消失。
 *
 * 用途是**筛选**——搜索时不符合条件的卡片要「弹走」，清空关键词再「弹回来」。
 * 注意这里刻意**不卸载**子节点（退场后只是 opacity 0 + `pointerEvents: none`）：
 * 卸载会让「又匹配上了」的那次变成重新挂载，弹回来就只剩淡入、丢了缩放那一段；
 * 而卡片在父容器里本来就是绝对定位，留在树上不会影响别的元素排布。
 *
 * 只动 opacity 与 transform，因此可以开 native driver（纯 GPU 合成，不触发布局重排）。
 */
export default function SpringFade({ visible, style, sink = 8, children }: Props) {
  // 初值跟着 visible 走：首次挂载就是「已退场」的卡片不该播一遍退场动画
  const v = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    const anim = Animated.spring(v, {
      toValue: visible ? 1 : 0,
      // 张力偏小、摩擦偏大：退场要「软」，别抖
      tension: 80,
      friction: 9,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [visible, v]);

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [sink, 0] });

  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ scale }, { translateY }] }]}
      // 退场后不该还能被点到（它仍占着那一格的绝对定位区域）
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
}
