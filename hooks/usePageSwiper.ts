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
 *
 * 性能设计（关键）：
 * 胶囊位移**只有一个驱动源** —— 页面的滚动位置（onPageScroll）。
 * 点击导航时页面用原生平滑滚动过去，胶囊被动跟随，因此：
 *   · 不再有「页面滚动 + 胶囊弹簧」两套动画同时抢 JS 线程；
 *   · 胶囊与内容严格同步，不会出现弹簧过冲回弹造成的顿挫。
 * （早期版本给胶囊单独跑 Animated.spring，在 RN 原生端 useNativeDriver:false
 *   会在 JS 线程逐帧跨桥写 transform，与滚动动画互相挤占 → 明显卡顿。）
 */
export function usePageSwiper(itemCount: number, screenWidth: number): PageSwiperResult {
  const [activeIndex, setActiveIndex] = useState(0);
  const [navWidth, setNavWidthState] = useState(0);

  const pagerRef = useRef<ScrollView>(null);
  const pillX = useRef(new Animated.Value(0)).current;
  const cellWidthRef = useRef(0);
  const activeIndexRef = useRef(0);
  const dragStartX = useRef(0);          // 拖拽起点（胶囊坐标系）
  const programmaticScroll = useRef(false); // 程序切页期间：只跟随位移，不中途改选中态
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cellWidth = navWidth > 0 ? navWidth / itemCount : 0;
  cellWidthRef.current = cellWidth;

  const clearProgrammatic = () => {
    if (programmaticTimer.current) {
      clearTimeout(programmaticTimer.current);
      programmaticTimer.current = null;
    }
    programmaticScroll.current = false;
  };

  useEffect(() => () => clearProgrammatic(), []);

  // 页面滚动 → 胶囊同步跟随（唯一驱动源；点击切页与手势滑动共用同一条路径）
  const onPageScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const x = e.nativeEvent.contentOffset.x;
    const cellW = cellWidthRef.current;
    if (cellW > 0) {
      pillX.setValue(clamp((x / screenWidth) * cellW, 0, cellW * (itemCount - 1)));
    }
    // 程序切页期间不中途改选中态，否则滚动途中 tab 高亮会来回闪
    if (programmaticScroll.current) return;
    const idx = clamp(Math.round(x / screenWidth), 0, itemCount - 1);
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  };

  // 切到指定页：页面平滑滚动，胶囊由 onScroll 同步跟随（不再叠加独立动画）
  const scrollToPage = (idx: number) => {
    const target = clamp(idx, 0, itemCount - 1);
    programmaticScroll.current = true;
    pagerRef.current?.scrollTo({ x: target * screenWidth, animated: true });
    activeIndexRef.current = target;
    setActiveIndex(target);
    // 兜底解禁：不依赖动画回调，避免回调丢失导致胶囊永久不再跟随手指
    if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    programmaticTimer.current = setTimeout(() => {
      programmaticTimer.current = null;
      programmaticScroll.current = false;
    }, 500);
  };

  // 拖动胶囊 → 页面同步跟随
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        clearProgrammatic();
        dragStartX.current = activeIndexRef.current * cellWidthRef.current;
      },
      onPanResponderMove: (_, g) => {
        const cellW = cellWidthRef.current;
        if (cellW <= 0) return;
        const x = clamp(dragStartX.current + g.dx, 0, cellW * (itemCount - 1));
        pillX.setValue(x);
        pagerRef.current?.scrollTo({ x: (x / cellW) * screenWidth, animated: false });
      },
      onPanResponderRelease: (_, g) => {
        const cellW = cellWidthRef.current;
        if (cellW <= 0) return;
        scrollToPage(Math.round((dragStartX.current + g.dx) / cellW));
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
