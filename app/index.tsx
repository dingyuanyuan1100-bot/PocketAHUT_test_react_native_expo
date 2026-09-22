import { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, ScrollView, useWindowDimensions } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePageSwiper } from '../hooks/usePageSwiper';
import { usePagerLocked } from '../lib/pagerLock';
import HomePage from '../page/HomePage';
import CourseTablePage from '../page/CourseTablePage';
import ServicePage from '../page/ServicePage';
import ProfilePage from '../page/ProfilePage';
import LaunchScreen from '../template/LaunchScreen';
import { C } from '../template/theme';

const NAV_ITEMS = [
  { icon: "home", label: "首页" },
  { icon: "calendar", label: "课程表" },
  { icon: "grid", label: "服务" },
  { icon: "user", label: "我的" },
] as const;

// 中心按钮弹出的三个卫星按钮（视觉示意，不接业务）
// angle: 0°=正上方，正值向右偏，负值向左偏（俯瞰时针方向）
const SATELLITE_ITEMS = [
  { icon: "search", label: "搜索", angle: -61, radius: 61 },
  { icon: "heart",  label: "收藏", angle:   0, radius: 56 },
  { icon: "user",   label: "我的", angle:  61, radius: 61 },
] as const;

export default function HomeScreen() {
  // 启动页：revealed = 开始淡出（首页接手错峰落位）；launchGone = 淡出结束、可卸载
  const [revealed, setRevealed] = useState(false);
  const [launchGone, setLaunchGone] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  // 页面内部的横向滚动（目前只有课程表网格）在触摸期间会锁住分页器，
  // 否则同方向手势会被这个 pagingEnabled 容器抢走 → 一划就翻页。
  const pagerLocked = usePagerLocked();
  const {
    activeIndex,
    pillX,
    cellWidth,
    setNavWidth,
    onPageScroll,
    scrollToPage,
    pagerRef,
    panHandlers,
  } = usePageSwiper(NAV_ITEMS.length, screenWidth);

  // ===== 中心按钮 + 卫星 =====
  const [isExpanded, setIsExpanded] = useState(false);
  const satelliteAnims = useRef(
    SATELLITE_ITEMS.map(() => new Animated.Value(0))
  ).current;

  const toggleExpand = () => {
    const target = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    // 顺时针散开：左 → 上 → 右（按数组顺序错峰）
    Animated.stagger(
      55,
      satelliteAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: target,
          useNativeDriver: true,
          tension: 90,
          friction: 7,
        })
      )
    ).start();
  };

  // ===== 分页高度 =====
  // 横向 ScrollView 的内容盒高度默认由「最高的那一页」决定（实测被「我的」页顶到 1260，
  // 视口只有 812）→ 整个 App 会多出一段幽灵纵向滚动，且各页只能拿到内容盒的一部分高度，
  // 页面里的空态卡就撑不满屏、与设计稿不符。
  // 这里用「窗口高度 − 顶部安全区」精确算出分页容器的可用高度，把内容盒与每一页都锁死。
  // （不用 onLayout：在 RN Web 上它拿不到这个容器的高度，实测不可靠）
  const [pagerHeight, setPagerHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const h = windowHeight - insets.top;
    if (h > 0) setPagerHeight(h);
  }, [windowHeight, insets.top]);

  return (
    <>
      <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 横向翻页容器：首页 / 课程表 / 服务 / 我的 */}
      <ScrollView
        ref={pagerRef}
        style={styles.pager}
        contentContainerStyle={pagerHeight ? { height: pagerHeight } : undefined}
        horizontal
        pagingEnabled
        scrollEnabled={!pagerLocked}
        showsHorizontalScrollIndicator={false}
        onScroll={onPageScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        <View style={[styles.page, { width: screenWidth, height: pagerHeight || undefined }]}>
          <HomePage animate={revealed} />
        </View>
        <View style={[styles.page, { width: screenWidth, height: pagerHeight || undefined }]}>
          <CourseTablePage />
        </View>
        <View style={[styles.page, { width: screenWidth, height: pagerHeight || undefined }]}>
          <ServicePage />
        </View>
        <View style={[styles.page, { width: screenWidth, height: pagerHeight || undefined }]}>
          <ProfilePage />
        </View>
      </ScrollView>

      {/* ===================== 底部导航栏 ===================== */}
      <View style={styles.box}>
        <View
          style={styles.navInner}
          onLayout={(e) => setNavWidth(e.nativeEvent.layout.width)}
          {...panHandlers}
        >
          <Animated.View
            style={[styles.pill, { width: cellWidth, transform: [{ translateX: pillX }] }]}
          >
            {/* 玻璃顶部高光：平滑淡出，无硬边 */}
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
              style={styles.pillHighlight}
            />
          </Animated.View>
          {NAV_ITEMS.map((item, idx) => {
            const active = activeIndex === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={styles.item}
                activeOpacity={0.7}
                onPress={() => scrollToPage(idx)}
              >
                <Feather name={item.icon} size={20} color={active ? "#000000" : "#ffffff"} />
                <Text style={[styles.label, { color: active ? "#000000" : "#ffffff" }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ===================== 中心浮动按钮 + 卫星 ===================== */}
      <View style={styles.centerCluster} pointerEvents="box-none">
        {/* 三个卫星（默认隐藏在中心按钮内，展开时扇形散开） */}
        {SATELLITE_ITEMS.map((item, idx) => {
          const angleRad = (item.angle * Math.PI) / 180;
          const dx = item.radius * Math.sin(angleRad);
          const dy = -item.radius * Math.cos(angleRad); // 负 Y 代表向上
          const translateX = satelliteAnims[idx].interpolate({
            inputRange: [0, 1],
            outputRange: [0, dx],
          });
          const translateY = satelliteAnims[idx].interpolate({
            inputRange: [0, 1],
            outputRange: [0, dy],
          });
          const scale = satelliteAnims[idx].interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 1],
          });
          const opacity = satelliteAnims[idx].interpolate({
            inputRange: [0, 0.45, 1],
            outputRange: [0, 0, 1],
          });
          return (
            <Animated.View
              key={idx}
              pointerEvents={isExpanded ? 'auto' : 'none'}
              style={[
                styles.satellite,
                {
                  opacity,
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.satelliteTouch}
                activeOpacity={0.7}
                onPress={() => {
                  // 仅作收起示意，不接业务
                  toggleExpand();
                }}
              >
                <Feather name={item.icon as any} size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* 中心双层圆按钮 */}
        <TouchableOpacity
          style={styles.centerOuter}
          activeOpacity={0.85}
          onPress={toggleExpand}
        >
          <View style={styles.centerInner}>
            <MaterialCommunityIcons
              name={isExpanded ? 'close' : 'silverware-fork-knife'}
              size={isExpanded ? 20 : 22}
              color={C.lime}
            />
          </View>
        </TouchableOpacity>
      </View>

      </SafeAreaView>

      {/* 启动页：校徽落定 → 淡出，交棒首页的错峰落位（放在 SafeAreaView 外，保证真正全屏覆盖） */}
      {!launchGone && (
        <LaunchScreen
          onReveal={() => setRevealed(true)}
          onFinish={() => setLaunchGone(true)}
        />
      )}
    </>
  );
}

// ===================== 底部导航栏样式 =====================
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.cream,
  },
  pager: {
    flex: 1,
  },
  /** 单页容器：高度由 pagerHeight 内联给定，页面内部各自滚动 */
  page: {
    // 高度走内联样式（见组件内说明），这里不写死
  },
  box: {
    position: 'absolute',
    bottom: 40,
    // 宽度对齐设计稿：导航条占屏宽 90.4% → 取 90%（左右各 5%，≈18px）
    // 同时和上方内容卡片（paddingHorizontal 16）基本齐边
    left: '5%',
    width: '90%',
    height: 64,
    backgroundColor: '#0f0f0f',
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible', // 中心按钮要"刺穿"导航栏，所以不能裁剪
  },
  navInner: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 10,
    height: '100%',
  },
  pill: {
    position: 'absolute',
    top: '10%',
    height: '80%',
    borderRadius: 35,
    backgroundColor: 'rgba(152, 223, 19, 0.97)',
    borderWidth: 1,
    borderColor: 'rgb(101, 238, 9)',
    shadowColor: '#c6e278',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: 'hidden',
  },
  pillHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '35%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },

  // ===================== 中心按钮 + 卫星样式 =====================
  centerCluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    // 导航栏 top 边 = 40 + 64 = 104（距屏幕底）。
    // 设计稿实测：中心圆的圆心落在导航顶边【上方 0.05H】≈ 3px，即距底 107；
    // 外圈圆 d=56（0.879H）→ 底边 = 107 - 28 = 79
    bottom: 79,
    // 高度：最高的卫星（圆心 107 + 56 + 17 = 180）减去底 79 = 101，取 112 留余量
    height: 112,
    alignItems: 'center',
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  satellite: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    // 底边对齐到中心按钮的圆心（外圈 56 / 2 - 卫星 34 / 2 = 11）
    bottom: 11,
    left: '50%',
    marginLeft: -17,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  satelliteTouch: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  centerInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    // 墨黑底 + 青柠图标：避免和历史一样用青柠底、和选中 tab 的青柠胶囊糊成一片
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
