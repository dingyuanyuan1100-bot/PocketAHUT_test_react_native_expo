import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import RevealGroup, { STEP_4_FRAMES } from '../template/RevealGroup';
import StaggerIn from '../template/StaggerIn';
import Sticker from '../template/Sticker';
import { BORDER, C, DISPLAY, FeatherName, inkA, R, SHADOW } from '../template/theme';

/** 未选中分类的图标/文字色（对位设计稿的墨黑 45%） */
const MUTED = '#8E8B84';

/**
 * 导轨项尺寸。滑块按同一套数字定位，改这里就等于同时改了项与滑块。
 * `PITCH` 是相邻两项原点的距离（项高 + 间隙），滑块位移按它成倍走。
 */
const RAIL_ITEM_W = 84;
const RAIL_ITEM_H = 72;
const RAIL_GAP = 10;
const RAIL_PITCH = RAIL_ITEM_H + RAIL_GAP; // 82

/** 滑块滑动时长与曲线（对位参考动效的 0.4s cubic-bezier(0.5, 1.6, 0.4, 1)：末段回弹过冲） */
const GLIDE_MS = 400;
const GLIDE_EASING = Easing.bezier(0.5, 1.6, 0.4, 1);
/** 滑块底色交叉淡入的平台宽度：小过冲不改变透明度 */
const GLIDE_PLATEAU = 0.35;

// ===================== 分类导轨 =====================
type Tone = 'lime' | 'ink' | 'oat';

const CATS: { key: string; label: string; icon: FeatherName; tone: Tone }[] = [
  { key: 'study', label: '教务学习', icon: 'award', tone: 'lime' },
  { key: 'life', label: '校园生活', icon: 'home', tone: 'ink' },
  { key: 'news', label: '资讯信息', icon: 'file-text', tone: 'oat' },
];

/** 选中态用该分类的品牌色实心贴纸；未选中全透明 */
const RAIL_TONE: Record<Tone, { fill: string; fg: string }> = {
  lime: { fill: C.lime, fg: C.ink },
  ink: { fill: C.ink, fg: C.lime },
  oat: { fill: C.oat, fg: C.ink },
};

// ===================== 服务项 =====================
/**
 * route 指向已落地的第 2 层页面。
 *
 * ⚠️ 留空 = 尚未接入，行会**变暗并标注「待接入」且不带箭头** ——
 * 早期版本对未实现项也画了 chevron-right，用户点了没反应，等于骗点击。
 * 新增页面时请把 route 补上，这个标记会自动消失。
 */
type Svc = { title: string; sub: string; icon: FeatherName; route?: string };

const SERVICES: Record<string, Svc[]> = {
  study: [
    { title: '课程表', sub: '查看每日课表', icon: 'grid' },
    { title: '成绩查询', sub: '查询学期成绩与绩点', icon: 'bar-chart-2', route: '/grades' },
    { title: '考试安排', sub: '查看考试时间与考场', icon: 'check-square', route: '/exam' },
    { title: '校历', sub: '查看学期校历活动', icon: 'calendar' },
    { title: '空教室查询', sub: '查找空闲教室', icon: 'layout' },
    { title: '培养方案', sub: '查看课程计划', icon: 'file-text' },
    { title: '教材查询', sub: '查看学期教材', icon: 'book-open' },
    { title: '图书检索', sub: '检索馆藏图书', icon: 'book' },
    { title: '学习通作业', sub: '查看未完成作业', icon: 'clipboard' },
    { title: '体测计算器', sub: '大学生体测成绩计算', icon: 'activity' },
  ],
  life: [
    { title: '电费查询', sub: '剩余电量与充值', icon: 'zap', route: '/electricity' },
    { title: '宿舍签到', sub: '宿舍打卡签到', icon: 'home', route: '/dorm-sign' },
    { title: '洗衣机查询', sub: '查看洗衣机状态', icon: 'loader' },
    { title: '校园网', sub: '流量、在线设备与记录', icon: 'wifi', route: '/network' },
    { title: '宿舍房间绑定', sub: '绑定房间以查询电费', icon: 'key', route: '/dorm-bind' },
    { title: '智慧控水', sub: '扫码充值控制设备', icon: 'droplet', route: '/smart-water' },
    { title: '食堂查询', sub: '查询食堂菜品', icon: 'coffee' },
    { title: '校园地图', sub: '地点检索与校内导航', icon: 'map-pin' },
    { title: '校园集市', sub: '安工大二手集市', icon: 'shopping-bag' },
  ],
  news: [
    { title: '校园新闻', sub: '学校最新动态', icon: 'rss', route: '/campus-news' },
    { title: '校园信息', sub: '校园黄页信息', icon: 'info' },
  ],
};

/** 图标底座按行轮转品牌色 —— 长列表靠这个撑住节奏 */
const BASES: { bg: string; fg: string }[] = [
  { bg: C.lime, fg: C.ink },
  { bg: C.ink, fg: C.lime },
  { bg: C.oat, fg: C.ink },
  { bg: C.limeDeep, fg: C.ink },
];

/** 第 3 页：服务（分类导轨 + 服务列表） */
export default function ServicePage({ animate = false }: { animate?: boolean }) {
  const [cat, setCat] = useState('study');
  const list = SERVICES[cat] ?? [];
  const catIndex = Math.max(0, CATS.findIndex((c) => c.key === cat));

  /*
    滑块位置用**浮点索引**表示（0 → 1 → 2），一个 Animated.Value 同时驱动
    位移与底色交叉淡入 —— 只动 transform / opacity，可开 native driver，
    整个切换过程零 React 重渲染、零布局重排（同首页胶囊与课程表遮罩的思路）。
  */
  const glide = useRef(new Animated.Value(catIndex)).current;
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      // 首次渲染直接就位，不播动画（否则一进页面滑块会从第 1 项飞过来）
      isFirstRender.current = false;
      return;
    }
    Animated.timing(glide, {
      toValue: catIndex,
      duration: GLIDE_MS,
      easing: GLIDE_EASING,
      useNativeDriver: true,
    }).start();
  }, [catIndex, glide]);

  return (
    <View style={styles.page}>
      {/* 页头 */}
      <View style={styles.header}>
        <Text style={styles.title}>功能服务</Text>
        <View style={styles.headerBtns}>
          <Sticker style={styles.headerBtn} radius={R.btn} offset={SHADOW.sm} clip>
            <Feather name="more-horizontal" size={18} color={C.ink} />
          </Sticker>
          <Sticker style={styles.headerBtn} radius={R.btn} offset={SHADOW.sm} clip>
            <Feather name="target" size={18} color={C.ink} />
          </Sticker>
        </View>
      </View>

      <View style={styles.body}>
        {/* 分类导轨 */}
        <View style={styles.rail}>
          {/*
            滑块层：绝对定位铺满导轨，`pointerEvents="none"` 不参与点击。
            三个 tone 各一个滑块，位移**完全相同**（同一个 glide 驱动）、只有
            opacity 不同 —— 于是「换色」表现为交叉淡入，而不是三个色块各滑各的。
          */}
          <View style={styles.gliderLayer} pointerEvents="none">
            {CATS.map((c, i) => (
              <Animated.View
                key={c.key}
                style={[
                  styles.glider,
                  {
                    // 平台区内恒为 1：bezier 的末段过冲不会把滑块淡一下再回来
                    opacity: glide.interpolate({
                      inputRange: [i - 1, i - GLIDE_PLATEAU, i + GLIDE_PLATEAU, i + 1],
                      outputRange: [0, 1, 1, 0],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        translateY: glide.interpolate({
                          inputRange: [0, 1, 2],
                          outputRange: [0, RAIL_PITCH, RAIL_PITCH * 2],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* 硬投影底板：与本体同尺寸、整体平移 (offset, offset)（见 template/Sticker.tsx） */}
                <View style={styles.gliderSlab} />
                <View style={[styles.gliderBody, { backgroundColor: RAIL_TONE[c.tone].fill }]} />
              </Animated.View>
            ))}
          </View>

          {CATS.map((c) => {
            const on = c.key === cat;
            const tone = RAIL_TONE[c.tone];
            return (
              <TouchableOpacity key={c.key} activeOpacity={0.8} onPress={() => setCat(c.key)}>
                {/*
                  项本身不再画底色 —— 底色由会滑动的 glider 提供。
                  否则选中项会原地多出一块实心底色，滑块就白滑了。
                */}
                <Sticker
                  style={styles.railItem}
                  fill="transparent"
                  border={0}
                  offset={0}
                  radius={R.card}
                >
                  <Feather name={c.icon} size={18} color={on ? tone.fg : MUTED} />
                  <Text style={[styles.railLabel, { color: on ? tone.fg : MUTED }]}>{c.label}</Text>
                </Sticker>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 服务列表：一整张白色贴纸大卡 + 行间细分割线（不是每行一张卡） */}
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Sticker clip radius={R.card} offset={SHADOW.md} fill={C.white} style={styles.listCard}>
            {/*
              服务行逐行错峰落位。这里用 RevealGroup 而不是手写 `StaggerIn index`：
              分类下可能有 20 多行，靠它的 maxStagger 把屏外那些行的落位时刻收住，
              否则按 4 帧排下去要 1.5 秒才结束，用户早就划走了。
            */}
            <RevealGroup active={animate} waitForTransition={false}>
              {list.map((s, i) => {
                const base = BASES[i % BASES.length];
                const live = !!s.route;
                return (
                  <View key={s.title}>
                    {i > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      style={[styles.row, !live && styles.rowPending]}
                      activeOpacity={live ? 0.7 : 1}
                      disabled={!live}
                      onPress={() => {
                        if (s.route) router.push(s.route as never);
                      }}
                    >
                      <View style={[styles.iconBase, { backgroundColor: base.bg }]}>
                        <Feather name={s.icon} size={18} color={base.fg} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {s.title}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {s.sub}
                        </Text>
                      </View>
                      {live ? (
                        <Feather name="chevron-right" size={18} color={inkA(0.35)} />
                      ) : (
                        <View style={styles.pendingTag}>
                          <Text style={styles.pendingText}>待接入</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </RevealGroup>
          </Sticker>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 28,
    letterSpacing: -0.5,
    color: C.ink,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  rail: {
    width: RAIL_ITEM_W,
    gap: RAIL_GAP,
  },
  /** 滑块层：绝对铺满导轨，位于所有选项之下（不参与布局） */
  gliderLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  /** 单个滑块：只负责定位与动画，视觉交给 slab + body 两层 */
  glider: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: RAIL_ITEM_W,
    height: RAIL_ITEM_H,
  },
  /** 硬投影底板：与本体同尺寸，整体平移 (SHADOW.sm, SHADOW.sm) */
  gliderSlab: {
    position: 'absolute',
    left: SHADOW.sm,
    top: SHADOW.sm,
    right: -SHADOW.sm,
    bottom: -SHADOW.sm,
    borderRadius: R.card,
    backgroundColor: C.ink,
  },
  /** 本体：底色由 Animated 按 tone 交叉淡入注入，这里只留 2px 墨黑描边 */
  gliderBody: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: R.card,
    borderWidth: BORDER,
    borderColor: C.ink,
  },
  railItem: {
    width: RAIL_ITEM_W,
    height: RAIL_ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  railLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 120, // 给悬浮导航栏留出空间
  },
  listCard: {
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: C.hairline,
  },
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  /** 未接入的项：整行压暗，避免与可用功能混淆 */
  rowPending: {
    opacity: 0.42,
  },
  pendingTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.oat,
  },
  pendingText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.gray,
  },
  iconBase: {
    width: 40,
    height: 40,
    borderRadius: R.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: DISPLAY,
    fontSize: 14,
    letterSpacing: -0.2,
    color: C.ink,
  },
  rowSub: {
    fontSize: 11,
    color: inkA(0.55),
  },
});
