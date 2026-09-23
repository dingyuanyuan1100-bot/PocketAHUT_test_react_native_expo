import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C, DISPLAY, inkA } from './theme';

type Props = {
  /** 开始退场的瞬间触发 —— 此时首页元素接手，开始错峰落位 */
  onReveal?: () => void;
  /** 退场结束，可以卸载启动页 */
  onFinish?: () => void;
};

/** 从开始到退场启动的停留时长 */
const HOLD = 1320;
/** 退场时长 —— 略长一点，让曲线走得开 */
const EXIT = 460;

/** 影院级缓出曲线（expo-out）：起步快、尾巴长，消除机械感 */
const EXPO_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * 启动页（四段式出场）：
 *   1. 青柠印章圆从中心「按」下去（spring 带轻微回弹）
 *   2. 白色贴纸底板 + 校徽落到印章上（回正旋转，spring）
 *   3. 校名 / 副标题依次上浮浮现
 *   4. 整体上浮 + 推近 + 淡出（expo-out），交棒首页的错峰落位
 * 全流程走 RN Animated，Expo Go 里可直接看到。
 */
export default function LaunchScreen({ onReveal, onFinish }: Props) {
  const seal = useRef(new Animated.Value(0)).current;   // 青柠印章
  const plate = useRef(new Animated.Value(0)).current;  // 白色贴纸底板
  const logo = useRef(new Animated.Value(0)).current;   // 校徽
  const text = useRef(new Animated.Value(0)).current;   // 校名
  const sub = useRef(new Animated.Value(0)).current;    // 副标题
  const exit = useRef(new Animated.Value(0)).current;   // 整体退场

  useEffect(() => {
    // 1) 印章按下 + 2) 贴纸落定
    Animated.parallel([
      Animated.spring(seal, {
        toValue: 1,
        tension: 55,
        friction: 8.5,
        useNativeDriver: true,
      }),
      Animated.spring(plate, {
        toValue: 1,
        delay: 120,
        tension: 88,
        friction: 7.5,
        useNativeDriver: true,
      }),
    ]).start();

    // 校徽淡入（随贴纸落定一起显影）
    Animated.timing(logo, {
      toValue: 1,
      duration: 260,
      delay: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // 3) 文字依次浮现
    Animated.timing(text, {
      toValue: 1,
      duration: 420,
      delay: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(sub, {
      toValue: 1,
      duration: 380,
      delay: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 4) 退场：上浮 + 推近 + 淡出
    const timer = setTimeout(() => {
      onReveal?.();
      Animated.timing(exit, {
        toValue: 1,
        duration: EXIT,
        easing: EXPO_OUT,
        useNativeDriver: true,
      }).start(() => onFinish?.());
    }, HOLD);

    return () => clearTimeout(timer);
  }, [exit, logo, onFinish, onReveal, seal, plate, sub, text]);

  // —— 印章 ——
  const sealScale = seal.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] });
  const sealOpacity = seal.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] });

  // —— 贴纸底板 ——
  const plateScale = plate.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const plateRotate = plate.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '0deg'] });
  const plateOpacity = plate.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });
  // 投影随落定收拢：贴纸「按」到纸面时阴影拉近，产生物理落地感
  const shadowX = plate.interpolate({ inputRange: [0, 1], outputRange: [11, 5] });
  const shadowY = plate.interpolate({ inputRange: [0, 1], outputRange: [14, 6] });

  // —— 文字 ——
  const textY = text.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const subY = sub.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  // —— 退场 ——
  const exitOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const exitScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const exitY = exit.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });

  return (
    <Animated.View
      style={[
        styles.root,
        { opacity: exitOpacity, transform: [{ translateY: exitY }, { scale: exitScale }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.stage}>
        {/* 徽章：青柠印章 + 白色贴纸底板 + 校徽 */}
        <View style={styles.badgeWrap}>
          {/* 青柠印章 */}
          <Animated.View
            style={[styles.seal, { opacity: sealOpacity, transform: [{ scale: sealScale }] }]}
          />
          {/* 白色贴纸底板（含硬投影） */}
          <Animated.View
            style={[
              styles.plateWrap,
              { opacity: plateOpacity, transform: [{ scale: plateScale }, { rotate: plateRotate }] },
            ]}
          >
            <Animated.View
              style={[
                styles.plateShadow,
                { transform: [{ translateX: shadowX }, { translateY: shadowY }] },
              ]}
            />
            <View style={styles.plate}>
              <Animated.Image
                source={require('../assets/logo-transparent.png')}
                style={[styles.logo, { opacity: logo }]}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
        </View>

        {/* 校名 */}
        <Animated.View
          style={[styles.textCol, { opacity: text, transform: [{ translateY: textY }] }]}
        >
          <Text style={styles.brand}>安徽工业大学</Text>
          <Animated.Text style={[styles.sub, { opacity: sub, transform: [{ translateY: subY }] }]}>
            校园服务 · 你的智能校园助手
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const SEAL = 232;
const PLATE = 198;

const styles = StyleSheet.create({
  /**
   * 铺满父容器，而不是按 useWindowDimensions 的宽高定尺寸。
   * 原生端 edge-to-edge 下，useWindowDimensions().height 拿到的是「屏幕减去系统栏」的高度
   * （实测比真实根视图矮一截，约 65dp），照它设高会让启动页底部漏出、露出底部导航栏。
   * 用 absoluteFill 后，启动页与底部导航栏位于同一父容器内，覆盖关系由结构保证，与系统栏无关。
   */
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  stage: {
    alignItems: 'center',
    gap: 26,
  },
  badgeWrap: {
    width: SEAL,
    height: SEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: {
    position: 'absolute',
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    backgroundColor: C.lime,
  },
  plateWrap: {
    width: PLATE,
    height: PLATE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateShadow: {
    position: 'absolute',
    width: PLATE,
    height: PLATE,
    borderRadius: PLATE / 2,
    backgroundColor: C.ink,
  },
  plate: {
    width: PLATE,
    height: PLATE,
    borderRadius: PLATE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 150,
    height: 169,
  },
  textCol: {
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontFamily: DISPLAY,
    fontSize: 27,
    letterSpacing: 2,
    color: C.ink,
  },
  sub: {
    fontSize: 12,
    letterSpacing: 0.5,
    color: inkA(0.55),
  },
});
