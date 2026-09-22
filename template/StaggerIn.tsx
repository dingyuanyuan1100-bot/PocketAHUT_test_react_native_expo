import { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  /** 落位次序；配合 step 决定延迟 = delay + index * step */
  index?: number;
  /** 起始延迟（ms） */
  delay?: number;
  /** 相邻元素的错峰间隔（ms） */
  step?: number;
  /**
   * 是否开始入场。
   * 传 false 时元素保持隐藏（opacity 0），等外部信号（如启动页淡出）再统一落位。
   */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * 错峰入场：scale 0.86 → 1 + 上移 18pt + 淡入，spring 收尾带回弹。
 * 用 RN Animated（不依赖 reanimated / 原生配置），Expo Go 里直接可见。
 */
export default function StaggerIn({
  index = 0,
  delay = 0,
  step = 60,
  active = true,
  style,
  children,
}: Props) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.spring(v, {
      toValue: 1,
      delay: delay + index * step,
      tension: 90,
      friction: 8,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [active, delay, index, step, v]);

  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }, { translateY }] }]}>
      {children}
    </Animated.View>
  );
}
