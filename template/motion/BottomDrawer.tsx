import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, type ReactNode } from 'react';
import { C } from '../theme';

/**
 * 通用底部抽屉（贴纸风）：
 *  - 真·贴底：容器 absoluteFill + flex-end，背景出血安全区（marginBottom:-insets.bottom），无视 safe 距离全覆盖。
 *  - 弹性入场：首帧即钉在屏幕外（translateY=屏高），随后 withSpring 带回弹滑入，杜绝"先出现再动"。
 *  - 平滑出场：下滑/取消/确定/返回键 → translateY 滑出后卸载。
 *  - 遮罩渐变：变暗层 opacity 随开合淡入淡出（全屏覆盖，含底部安全区）。
 *  - 下拉关闭：手柄下移超过 120px 或下甩速度 > 900 即关闭，否则弹簧回弹。
 *
 * 用法：把任意内容作为 children 传入即可，动画/手势/遮罩全部由本组件托管。
 */
const SPRING_OPEN = { damping: 11, stiffness: 100, mass: 1, overshootClamping: false };
const SPRING_SETTLE = { damping: 18, stiffness: 180, mass: 1 };
const DISMISS_DISTANCE = 120; // 下拉超过 120px 即关闭
const DISMISS_VELOCITY = 900; // 或快速下甩也关闭
const BACKDROP_MAX = 0.45;

type BottomDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  backgroundColor?: string;
  borderColor?: string;
  showHandle?: boolean;
};

export default function BottomDrawer({
  open,
  onClose,
  children,
  backgroundColor = C.white,
  borderColor = C.ink,
  showHandle = true,
}: BottomDrawerProps) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const translateY = useSharedValue(screenH); // 屏高 = 完全藏在屏幕下方
  const dragY = useSharedValue(0); // 下拉手势位移
  const backdrop = useSharedValue(0); // 0=透明，1=变暗

  // 打开：挂载；挂载后由下方动画 effect 触发弹性入场
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // 入场 / 出场：mounted 与 open 任一变化时驱动
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      dragY.value = 0;
      translateY.value = screenH; // 先钉到屏幕下方（首帧即隐藏）
      backdrop.value = 0;
      // 推迟一帧再弹入：保证「屏幕外」这一帧先渲染，随后从底部弹性滑入
      const raf = requestAnimationFrame(() => {
        translateY.value = withSpring(0, SPRING_OPEN);
        backdrop.value = withTiming(BACKDROP_MAX, { duration: 240 });
      });
      return () => cancelAnimationFrame(raf);
    }
    // 出场：平滑滑出后卸载
    backdrop.value = withTiming(0, { duration: 200 });
    dragY.value = 0;
    translateY.value = withTiming(
      screenH,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [mounted, open]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  // 手柄下拉关闭：向下拖拽才生效，松手判断是否越过阈值/速度
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) dragY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        dragY.value = withSpring(0, SPRING_SETTLE);
      }
    });

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
        {/* 变暗遮罩：透明度随 backdrop 过渡；点击关闭（全屏覆盖） */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: C.ink }, backdropStyle]}
          />
        </Pressable>

        {/* 抽屉本体：贴底 + 背景出血安全区（marginBottom:-insets.bottom），无视 safe 距离全覆盖 */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor,
              borderColor,
              paddingBottom: insets.bottom + 20,
              marginBottom: -insets.bottom,
            },
            sheetStyle,
          ]}
        >
          {showHandle && (
            <GestureDetector gesture={pan}>
              <View style={styles.handleRow}>
                <View style={[styles.handle, { backgroundColor: borderColor === C.ink ? C.oat : borderColor }]} />
              </View>
            </GestureDetector>
          )}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
