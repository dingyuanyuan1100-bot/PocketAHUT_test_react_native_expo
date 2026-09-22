import { useState, useRef, useEffect } from 'react';
import { Animated, PanResponder, ScrollView } from 'react-native';

const clamp = (v: number, min = 0, max: number) => Math.max(min, Math.min(max, v));

export type PageSwiperResult = {
  /** 当前激活页 index */
  activeIndex: number;
  /** 导航胶囊位移（Animated 值，直接用于 translateX） */
  pillX: Animated.Value;
  /** 胶囊宽度（需要传给 pill 样式） */
  cellWidth: number;
  /** 底部导航容器 onLayout 用，上报实际宽度 */
  setNavWidth: (w: number) => void;
  /** 页面滚动回调（横向翻页容器 onScroll） */
  onPageScroll: (e: { nativeEvent: { contentOffset: { x: number } } }) => void;
  /** 切到指定页（点击导航项 / 松手吸附时调用） */
  scrollToPage: (idx: number) => void;
  /** 横向翻页容器 ref */
  pagerRef: React.RefObject<ScrollView | null>;
  /** 底部导航拖拽手势（绑定到 navInner） */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
};

/**
 * 横向翻页 + 底部导航胶囊联动 hook
 * - 滑动页面 -> onPageScroll 实时同步胶囊位置
 * - 点击导航 / 拖动胶囊 -> scrollToPage / 页面跟随
 */
export function usePageSwiper(itemCount: number, screenWidth: number): PageSwiperResult {
  const [activeIndex, setActiveIndex] = useState(0);
  const [navWidth, setNavWidthState] = useState(0);

  const pagerRef = useRef<ScrollView>(null);
  const pillX = useRef(new Animated.Value(0)).current;
  const cellWidthRef = useRef(0);
  const activeIndexRef = useRef(0);
  const startX = useRef(0);
  const posRef = useRef(0);
  const programmaticScroll = useRef(false); // 程序切页期间 onScroll 不覆盖胶囊动画

  useEffect(() => {
    const id = pillX.addListener(({ value }) => { posRef.current = value; });
    return () => pillX.removeListener(id);
  }, [pillX]);

  const cellWidth = navWidth > 0 ? navWidth / itemCount : 0;
  cellWidthRef.current = cellWidth;

  // 页面滚动时实时同步导航胶囊位置（滑动页面 -> 导航联动）
  const onPageScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (programmaticScroll.current) return; // 程序切页：胶囊走 spring，不被滚动覆盖
    const x = e.nativeEvent.contentOffset.x;
    const cellW = cellWidthRef.current;
    pillX.setValue(
      Math.max(0, Math.min(cellW * (itemCount - 1), (x / screenWidth) * cellW))
    );
    const idx = clamp(Math.round(x / screenWidth), 0, itemCount - 1);
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  };

  // 切到指定页：页面瞬间到位，胶囊弹簧动画弹过去（恢复弹性手感）
  const scrollToPage = (idx: number) => {
    const target = clamp(idx, 0, itemCount - 1);
    programmaticScroll.current = true;
    pagerRef.current?.scrollTo({ x: target * screenWidth, animated: false });
    pillX.stopAnimation();
    Animated.spring(pillX, {
      toValue: target * cellWidthRef.current,
      useNativeDriver: false,
      damping: 9,
      stiffness: 170,
      mass: 0.7,
    }).start(({ finished }) => {
      if (finished) programmaticScroll.current = false;
    });
    activeIndexRef.current = target;
    setActiveIndex(target);
  };

  // 拖动胶囊 -> 页面同步跟随
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        pillX.stopAnimation();
        programmaticScroll.current = false;
        startX.current = posRef.current;
      },
      onPanResponderMove: (_, g) => {
        const cellW = cellWidthRef.current;
        const x = clamp(startX.current + g.dx, 0, cellW * (itemCount - 1));
        pillX.setValue(x);
        pagerRef.current?.scrollTo({ x: (x / cellW) * screenWidth, animated: false });
      },
      onPanResponderRelease: (_, g) => {
        scrollToPage(Math.round((startX.current + g.dx) / cellWidthRef.current));
      },
      onPanResponderTerminate: () => {
        scrollToPage(activeIndexRef.current);
      },
    })
  ).current;

  useEffect(() => {
    if (navWidth > 0) {
      pillX.setValue(activeIndexRef.current * cellWidth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navWidth]);

  return {
    activeIndex,
    pillX,
    cellWidth,
    setNavWidth: setNavWidthState,
    onPageScroll,
    scrollToPage,
    pagerRef,
    panHandlers: panResponder.panHandlers,
  };
}
