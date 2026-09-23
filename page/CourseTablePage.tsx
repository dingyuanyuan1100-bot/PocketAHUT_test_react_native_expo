import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextInput,
  ViewProps,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import BrandBadge from '../template/BrandBadge';
import BottomSheet from '../template/BottomSheet';
import Chip from '../template/Chip';
import Sticker from '../template/Sticker';
import SpringFade from '../template/SpringFade';
import LoadingShell from '../template/LoadingShell';
import StickerField, { FieldInput } from '../template/StickerField';
import StatusPill, { GuestPill } from '../template/StatusPill';
import StateCard, { toErrorBar } from '../template/StateCard';
import ScheduleSkeleton from '../template/ScheduleSkeleton';
import StaggerIn from '../template/StaggerIn';
import { STEP_4_FRAMES } from '../template/RevealGroup';
import { BORDER, C, DISPLAY, R, SHADOW, inkA, limeA } from '../template/theme';
import { useCourseSchedule, useTermStart } from '../hooks/useCourseSchedule';
import {
  buildCourseBlocks,
  currentWeekFromTermStart,
  resolveRowCount,
  resolveWeekDates,
  sectionRow,
  weekRangeLabel,
} from '../lib/schedule';
import { setPagerLocked } from '../lib/pagerLock';
import { customCourseStore, toCourseItem } from '../lib/customCourses';
import type { CustomCourse } from '../lib/customCourses';
import { DEFAULT_PREFS, prefsStore } from '../lib/coursePrefs';
import type { CoursePrefs } from '../lib/coursePrefs';

// ===================== 尺寸常量（严格对齐画布 19:6 Content Wrapper） =====================
// 这些数字全部取自设计稿，**不要为了「看起来更紧凑」去改** ——
// 高度是产品明确要求锁定的，列数增加导致的溢出交给横向滚动解决。
const PAGE_PAD = 12; // 页面左右内边距（19:6 padding 12）
const TIME_W = 36; // 左侧节次列宽（Month Box / Period Column 36）
const COL_GAP = 4; // 列间距（Day Header Row / Grid Row gap 4）
/**
 * 课程列宽。画布上是 59，但 59 − 24（左右内边距 20 + 描边 4）= 35px 的文字宽：
 * 11px 的中文一行只放得下 3 个字，「大学英语2(提高)」必然被省略号截断；
 * 教室名「工程训练中心」在 9px 下要 54px，更是必然截断。
 *
 * 产品要求「再调宽一点、文字不准省略」→ 取 **78**（文字宽 54）：
 *   - 课名 11px：约 4.9 字/行，3 行可容 14 字，覆盖所有真实课名；
 *   - 教室 9px：54px 正好放得下 6 个汉字（「工程训练中心」这类最长的教室名）。
 * 代价是横向溢出更多（7 列总宽 610 vs 可用 351），靠横向滚动消化；
 * 不想滚那么远的用户可以在「显示设置」里关掉周末两列（5 列 426）。
 */
const COL_W = 78;
const ROW_H = 82; // 每个大节行高（Period 82）
const ROW_GAP = 6; // 行间距（Period Column gap 6）
const ROW_PITCH = ROW_H + ROW_GAP; // 88，节次在纵向的步进
const DAY_H = 50; // 星期表头高度（Day Cell 50）
const CARD_R = 16; // 课程卡 / 节次格圆角（设计稿 16）
const CARD_PAD_V = 8; // 课程卡上下内边距（设计稿课程卡 paddingVertical 约 8）
const META_LINES = 2; // 卡片底部元信息占的行数（教师 + 教室各 1 行）
const CARD_LINE_H = 14; // 课名行高，用于换算最多能放几行

/*
  ===================== 「显示周末」两列的弹性收放 =====================

  关掉「显示周末」时，周六 / 周日两列**不能直接卸载** —— 那是瞬变：列啪地消失、
  内容宽度一跳，既没有退场过程，横向滚动区也不会跟着「收」回来。
  所以两列常驻，由 `weekendP`（0 = 收起，1 = 展开）**同一根 spring** 驱动三件事：
    · 列宽     COL_W × p（收起到 0，不再占任何布局空间）
    · 列间距   COL_GAP × p（收拢时把它前面那道缝也一并吃掉）
    · 透明度   见 WEEKEND_OPACITY_STOPS（比几何**收得更早**，理由见那里）
  网格内容容器的宽度是同一个 p 的插值，于是「列收 → 容器收」逐帧同步，
  不会出现「列没了、内容宽度还是 7 天」。

  ⚠️ 为此这两个 row 的列间距从 `gap` 换成**每列自己的 marginLeft**：
     gap 由容器统一加，没法让某两列把它们那两道缝吐出来 —— 用负 margin 去补，
     Yoga 会在「算出来的宽度为负」时夹到 0，缝补不回来（实测 5 列会多出 8px）。
     改成 marginLeft 之后：p=1 → 78 + 6×82 = 570；p=0 → 78 + 4×82 = 406，
     与容器插值 406 → 570 在**每一帧**都严格相等。
*/
const WD_WEEK = 7; // 含周末的列数
const WD_BASE = 5; // 不含周末的列数（周一~周五）
/** 5 列的内容宽（含列间缝）：390 + 16 = 406 */
const GRID_BASE_W = WD_BASE * COL_W + (WD_BASE - 1) * COL_GAP;
/** 7 列的内容宽：546 + 24 = 570 */
const GRID_FULL_W = WD_WEEK * COL_W + (WD_WEEK - 1) * COL_GAP;
/** 周六、周日两列的 weekday 值 */
const WEEKEND_DAYS = [6, 7];
/** 渲染用的 7 列（常驻；周末两列靠 `weekendP` 收放，不靠增删数组） */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
/**
 * 透明度的停靠点：**比几何收得更早**（p 到 0.45 时只剩 0.16）。
 *
 * 列宽收到一半时只剩 39px，卡片里的课名会重排成两三行 —— 让透明度先掉下去，
 * 这一下就发生在「已经看不清」的阶段，眼睛只看到「弹走」，看不到文字在挤。
 */
const WEEKEND_OPACITY_RANGE = [0, 0.45, 1];
const WEEKEND_OPACITY_STOPS = [0, 0.16, 1];

/*
  ===================== 边缘渐变（消解硬切边） =====================

  网格区向右出血到屏幕边（不再被 PAGE_PAD 的 12dp 内边距切在屏幕里面），
  于是「内容滑出屏幕」这件事发生两处，两处都是硬切边：
    · 右侧：切在屏幕边缘；
    · 左侧：课程列滑进固定左轨底下，切在左轨的右边框。
  各盖一条 cream → 透明的渐变，让边界「化掉」，而不是一条直线突然断掉。

  宽度刻意很小（十几 dp）：要求是「确保边界感不明显」，不是做一层雾。
 */
const EDGE_FADE_W = 18; // 屏幕右边缘的渐变宽度
const SEAM_FADE_W = 14; // 左轨接缝的渐变宽度（比右侧窄，少压一点首列卡片）
/**
 * 滚动多少距离后开始显示遮罩。
 *
 * 左接缝的遮罩必须**跟着滚动量出现**：静止时首列卡片紧贴左轨，
 * 如果遮罩一直在，会平白把首列卡片的左边和描边压淡。
 * 右侧同理，滚到底时右边已经没有被切的内容，遮罩应当退场。
 */
const EDGE_FADE_TRIGGER = 12;

/**
 * 渐变端点的两个颜色。
 *
 * 必须与页面底色 `C.cream`（#F3F0E8）一致 —— 渐变是把内容「化进底色里」，
 * 颜色对不上就会在卡片上显出一条色带。这里写成常量而不是每次拼字符串，
 * 是为了让「改底色时这两处也要跟着改」变得显眼。
 */
const FADE_OPAQUE = '#F3F0E8'; // = C.cream
const FADE_CLEAR = 'rgba(243,240,232,0)';

/*
  ===================== 展开式搜索条（画布 19:12 那颗放大镜） =====================

  搜索入口就是顶栏那排动作按钮里的**第一个**（32×32）。点击后**它自己变宽**：
  右边缘从「原位」滑到页面右内边距、宽度从 32 长到整行 —— 左边缘一路向左扫过标题区，
  右边缘向右顶到屏幕边。放大镜按右内边距定位（不参与 flex 排布），
  所以它从头到尾待在同一处：按钮里居中 → 展开后落在右侧靠边的内边距上。

  为什么不做成「另一行的搜索框」：那样「变宽」就失去了载体 —— 用户看到的是一个框凭空出现，
  而不是「我点的那颗按钮长成了一条」。下面的 searchRight / searchWidth 两个插值就是这段动作。

  未展开时条**正好压在搜索按钮的原位上**（ACTIONS_W 反算），所以两态之间没有位置跳变。
*/
const ACTION_SLOT = 32; // 动作按钮边长
const ACTION_GAP = 8; // 动作按钮间距
const ACTION_COUNT = 3; // 搜索 / 添加 / 显示设置
const ACTIONS_W = ACTION_SLOT * ACTION_COUNT + ACTION_GAP * (ACTION_COUNT - 1); // 112
const SEARCH_ICON = 15; // 放大镜尺寸（与 IconBtn 里那颗一致）
/**
 * 放大镜的右内边距。
 *
 * ⚠️ 要按**内容盒**算：`Sticker` 本体带 2px 描边，绝对定位的 left/right 参照的是
 * 描边内侧的 padding box，而 IconBtn 里那颗图标是 flex 居中于内容盒的。
 * 所以 (32 − 2×2 − 15) / 2 = 6.5 —— 未展开时两处的图标才会严丝合缝地重合。
 */
const SEARCH_PAD = (ACTION_SLOT - 2 * BORDER - SEARCH_ICON) / 2;

/*
  ===================== 周次栏的「回到本周」 =====================

  它和「第 X 周」**并列居中**：翻走之后，两个元素作为一组居中于整行，
  「第 X 周」往左让出位置、「回到本周」从右侧弹进来。

  做法上刻意**不给「回到本周」做宽度动画**（那会每帧触发布局重排，只能 JS 驱动）。
  让它的占位宽度恒定（布局位置固定），改成：
    · 「第 X 周」用 translateX 把「未出现时本该居中」的位置补回来 —— 出现时弹回 0（向左移）；
    · 「回到本周」用 opacity + translateX 从右侧弹进来。
  两个都只落在 transform / opacity 上，可开 native driver。
*/
const WEEK_BACK_GAP = 8; // 「第 X 周」与「回到本周」之间的间距
/** 首帧兜底宽度：`onLayout` 量到真实值之前先用它算位移，免得「第 X 周」先跳一下 */
const WEEK_BACK_FALLBACK_W = 68;
const WEEK_BACK_SLIDE = 18; // 「回到本周」入场时从右侧滑入的距离

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const WEEKDAY_SHORT = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 每个大节的起止时间 —— 取自设计稿 19:6 的 Period Start / Period End。
 *
 * ⚠️ **这不是接口字段**：`/jwxt/course` 只给「第1,2节」这样的节次标签，
 *    没有任何作息时间数据。这里的时间是画布上写死的教学作息表，
 *    属于「设计常量」。若学校作息调整，改这一处即可。
 *
 * 第 5 大节是「第 9,10,11 节」的晚间连堂 → **19:00–21:30**（7 点到 9 点半），
 * 这也是为什么不存在「第 6 节」：第 11 节并进了这一行，所以只有 5 行。
 */
const SECTION_TIMES: { start: string; end: string }[] = [
  { start: '08:00', end: '09:35' },
  { start: '10:00', end: '11:35' },
  { start: '14:00', end: '15:35' },
  { start: '16:00', end: '17:35' },
  { start: '19:00', end: '21:30' },
];

/**
 * 内层横向滚动期间锁住外层分页器（见 lib/pagerLock.ts）。
 *
 * `onTouchStart / onTouchEnd / onTouchCancel` 在运行时是合法的 View props
 * （react-native-web 也把它们转发给 DOM），但 RN 的 TS 类型没有暴露，
 * 所以这里收敛成一个具名常量 + 断言，避免每个使用点都写 `as any`。
 */
const PAGER_LOCK_PROPS = {
  onTouchStart: () => setPagerLocked(true),
  onTouchEnd: () => setPagerLocked(false),
  onTouchCancel: () => setPagerLocked(false),
} as unknown as ViewProps;

// ===================== 课程配色 =====================
// 贴纸风：整块高饱和实心色 + 2px 墨黑描边 + 硬投影。
// 同一个课程名恒定映射到同一个色，方便横向扫读。
type Tone = { bg: string; fg: string; sub: string };

const TONES: Tone[] = [
  { bg: C.lime, fg: C.ink, sub: C.ink },
  // 唯一不适用「副文字改最黑」的一档：底色本身是墨黑，副文字必须留在浅色系
  { bg: C.ink, fg: C.cream, sub: limeA(0.85) },
  { bg: C.limeDeep, fg: C.ink, sub: C.ink },
  { bg: C.white, fg: C.ink, sub: C.ink },
  { bg: C.oat, fg: C.ink, sub: C.ink },
];

/** 稳定的字符串哈希 → 色调，保证同一门课永远是同一个颜色 */
function toneOf(name: string): Tone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

/** 「+」弹层的草稿 */
type Draft = {
  name: string;
  teacher: string;
  room: string;
  weekday: number;
  s1: number;
  s2: number;
};

const EMPTY_DRAFT: Draft = { name: '', teacher: '', room: '', weekday: 1, s1: 1, s2: 2 };

/** 第 2 页：课程表（真实接口 + 六态） */
export default function CourseTablePage({ animate = false }: { animate?: boolean }) {
  const { width } = useWindowDimensions();
  const { status, courses, error, refetch, isRefreshing } = useCourseSchedule();
  // 开学日期：用于推算「第几周」，取不到就退化为第 1 周（不编日期）
  const termStart = useTermStart();

  const ready = status === 'ready';

  // ===================== 本地偏好 / 自定义课程 =====================
  const [prefs, setPrefs] = useState<CoursePrefs>(DEFAULT_PREFS);
  const [custom, setCustom] = useState<CustomCourse[]>([]);
  /**
   * 偏好是否已经**从本机读回来**。
   *
   * 首帧用的是 `DEFAULT_PREFS`（showWeekend = true），用户真实设置要等异步加载。
   * 这段时间里不能播「周末列收放」的动画，否则每次冷启动都会白演一遍
   * 「周末先展开、再收起来」—— 用户会以为设置没生效。
   */
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    void prefsStore.load().then((p) => {
      setPrefs(p);
      setPrefsReady(true);
    });
    void customCourseStore.load().then(setCustom);
  }, []);

  // 卸载时兜底解锁分页器：极端情况下（手指按着就翻页了）end 事件可能收不到
  useEffect(() => () => setPagerLocked(false), []);

  const updatePrefs = useCallback((next: CoursePrefs) => {
    setPrefs(next);
    void prefsStore.save(next);
  }, []);

  // ===================== 三个 Header Action 的开关 =====================
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  // ===================== 周次 =====================
  const currentWeek = currentWeekFromTermStart(termStart) ?? 1;
  const [weekOffset, setWeekOffset] = useState(0);
  const week = Math.max(1, currentWeek + weekOffset);

  /*
    ===================== 「显示周末」两列的收放 =====================

    只用一个 `weekendP` 驱动全部插值（列宽 / 列间距 / 透明度 / 内容容器宽），
    与搜索条同一个思路：展开与收起都不会出现「列还没收、宽度先收」这种错拍。
  */
  const weekendP = useRef(new Animated.Value(DEFAULT_PREFS.showWeekend ? 1 : 0)).current;
  /**
   * 周末两列是否已经「折起」到可以裁切。
   *
   * 只用来去掉一个**看不见但占地方**的尾巴：列宽收到 0 之后，那 0 宽盒子里的文字
   * 仍然会溢出（测到卡片文字 20.6px、日标签 9.5px），把横向滚动区撑多约 9px ——
   * 于是「宽度收回来了」这件事在滚动条上打了折扣。
   *
   * 但裁切（`overflow: hidden`）会连硬投影一起裁掉，所以**不能在列还看得见时裁**：
   *   · 开始展开 → 立刻解除裁切（否则第一帧就把内容裁成 0 宽）；
   *   · 收拢动画**跑完之后**才裁（那一刻透明度已经是 0，裁掉看不出来）。
   */
  const [weekendFolded, setWeekendFolded] = useState(!DEFAULT_PREFS.showWeekend);

  useEffect(() => {
    const to = prefs.showWeekend ? 1 : 0;
    // 偏好还没读回来：直接落位、不播动画（理由见 prefsReady 的注释）
    if (!prefsReady) {
      weekendP.setValue(to);
      setWeekendFolded(!prefs.showWeekend);
      return;
    }
    if (to === 1) setWeekendFolded(false);
    const anim = Animated.spring(weekendP, {
      toValue: to,
      // 张力偏小、摩擦偏大：收起要「软」，别抖
      tension: 90,
      friction: 8,
      // 驱动的是 width / marginLeft，属于布局属性，只能 JS 驱动
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && to === 0) setWeekendFolded(true);
    });
    return () => anim.stop();
  }, [prefs.showWeekend, prefsReady, weekendP]);

  /** 周末列的占位宽：COL_W → 0 */
  const weekendSlotW = useMemo(
    () => weekendP.interpolate({ inputRange: [0, 1], outputRange: [0, COL_W] }),
    [weekendP],
  );
  /** 周末列前面的那道缝：COL_GAP → 0（收拢时把缝也吃掉） */
  const weekendSlotGap = useMemo(
    () => weekendP.interpolate({ inputRange: [0, 1], outputRange: [0, COL_GAP] }),
    [weekendP],
  );
  const weekendOpacity = useMemo(
    () =>
      weekendP.interpolate({
        inputRange: WEEKEND_OPACITY_RANGE,
        outputRange: WEEKEND_OPACITY_STOPS,
        extrapolate: 'clamp',
      }),
    [weekendP],
  );
  /** 周末两列的整套动效样式（表头格与课程列共用） */
  const weekendSlotStyle = useMemo(
    () => ({
      width: weekendSlotW,
      marginLeft: weekendSlotGap,
      opacity: weekendOpacity,
    }),
    [weekendSlotW, weekendSlotGap, weekendOpacity],
  );
  /** 网格内容容器宽：406 ↔ 570（与两列的收放逐帧同步，见顶部常量说明） */
  const gridContentW = useMemo(
    () =>
      weekendP.interpolate({ inputRange: [0, 1], outputRange: [GRID_BASE_W, GRID_FULL_W] }),
    [weekendP],
  );

  /*
    ===================== 展开式搜索条 =====================

    一个 `searchP`（0 = 32×32 的按钮，1 = 铺满整行的搜索条）驱动全部插值：
    右内边距、宽度，以及标题 / 其余动作按钮的淡出。这样「展开」永远只有一个驱动源，
    不会出现条已经宽了、标题还没让位这种错拍（本项目在首页胶囊上踩过同类的坑）。
  */
  const searchInputRef = useRef<TextInput>(null);
  const searchP = useRef(new Animated.Value(0)).current;
  /** 顶栏那一行在内容容器里的位置 —— 给「点别处收起」的两条接住层留出中间那条不挡的缝 */
  const [topRowBox, setTopRowBox] = useState({ y: 0, h: 0 });

  const onTopRowLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setTopRowBox((prev) => (prev.y === y && prev.h === height ? prev : { y, h: height }));
  }, []);

  const SEARCH_SPRING = { tension: 130, friction: 13, useNativeDriver: false } as const;

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    Animated.spring(searchP, { toValue: 1, ...SEARCH_SPRING }).start(({ finished }) => {
      // 展开动画跑完再聚焦：否则键盘先弹出、把内容顶上去，展开这段动作看不全
      if (finished) searchInputRef.current?.focus();
    });
  }, [searchP]);

  /**
   * 收起搜索条：清关键词 + 收键盘。
   *
   * 三个入口都走这里：点放大镜、点页面别处、拉动页面。
   * 清关键词是必须的 —— 条缩回 32px 的小按钮后，用户看不到「还在筛选」这件事，
   * 课表却只显示几门课，那才像 bug。
   */
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    Keyboard.dismiss();
    searchInputRef.current?.blur();
    setQuery('');
    Animated.spring(searchP, { toValue: 0, ...SEARCH_SPRING }).start();
  }, [searchP]);

  const toggleSearch = useCallback(() => {
    if (searchOpen) closeSearch();
    else openSearch();
  }, [searchOpen, openSearch, closeSearch]);

  /**
   * 收起搜索条时兜底解锁外层分页器。
   *
   * 接住层自己也接了 `PAGER_LOCK_PROPS`（触摸期间锁住首页的横向分页器，
   * 免得用户想划课表却翻页了），而它是随 `searchOpen` 挂载 / 卸载的 ——
   * 万一某次 touchEnd 没送到（比如手指还没抬起条就收了），那个布尔值就会永久为 true，
   * 分页器彻底卡死。这里在卸载时无条件释放一次。
   */
  useEffect(() => {
    if (!searchOpen) return;
    return () => setPagerLocked(false);
  }, [searchOpen]);


  /**
   * 右边缘：从「搜索按钮原位」滑到顶栏右端。
   *
   * ⚠️ 展开后是 **0**，不是 PAGE_PAD —— 这里是相对 `topRow` 定位，
   *    而 topRow 本身已经在页面的 12dp 内边距之内了（写 PAGE_PAD 会多缩 12）。
   */
  const searchRight = useMemo(
    () =>
      searchP.interpolate({
        inputRange: [0, 1],
        outputRange: [ACTIONS_W - ACTION_SLOT, 0],
      }),
    [searchP],
  );
  /** 宽度：32 → 整行（两侧各让出 PAGE_PAD） */
  const searchWidth = useMemo(
    () =>
      searchP.interpolate({
        inputRange: [0, 1],
        outputRange: [ACTION_SLOT, Math.max(ACTION_SLOT, width - PAGE_PAD * 2)],
      }),
    [searchP, width],
  );
  /** 标题 / 状态胶囊 / 另外两颗动作按钮：条伸过去之前就让位（在条盖住它们那一刻已是空的） */
  const headFade = useMemo(
    () =>
      searchP.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: 'clamp' }),
    [searchP],
  );

  /*
    ===================== 「回到本周」的进出 =====================

    backP：0 = 未出现（此时「第 X 周」靠 translateX 假装自己居中），
           1 = 与「回到本周」并列、整组居中。
    backW 是「回到本周」**恒定的占位宽度**（onLayout 量一次），用来算「第 X 周」要补回多少位移。
  */
  const [backW, setBackW] = useState(0);
  const backP = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.spring(backP, {
      toValue: weekOffset !== 0 ? 1 : 0,
      tension: 90,
      friction: 8,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [weekOffset, backP]);

  const onBackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setBackW((prev) => (prev === w ? prev : w));
  }, []);

  const weekTitleShift = useMemo(
    () =>
      backP.interpolate({
        inputRange: [0, 1],
        // 未出现：把「第 X 周」往右推回屏幕中心；出现：弹回 0（整组居中 → 它于是向左移）
        outputRange: [(WEEK_BACK_GAP + (backW || WEEK_BACK_FALLBACK_W)) / 2, 0],
      }),
    [backP, backW],
  );
  /** 「回到本周」自身：从右侧弹进来 */
  const weekBackEnter = useMemo(
    () => backP.interpolate({ inputRange: [0, 1], outputRange: [WEEK_BACK_SLIDE, 0] }),
    [backP],
  );

  const allCourses = useMemo<any[]>(
    () => [...courses, ...custom.map(toCourseItem)],
    [courses, custom],
  );
  const blocks = useMemo(() => buildCourseBlocks(allCourses, week), [allCourses, week]);
  const days = useMemo(() => resolveWeekDates(week, termStart), [week, termStart]);

  /**
   * 命中搜索词的课程（只用于**计数**：判「没有匹配的课程」那句空态）。
   *
   * 渲染不再用它来过滤 —— 卡片改成渲染整周、由 `SpringFade` 按命中与否弹性进出，
   * 否则不匹配的卡片是直接卸载（啪地消失），没有退场过程。
   */
  const visibleBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (s?: string) => !!s && s.toLowerCase().includes(q);
    return blocks.filter(
      (b) =>
        (!q || hit(b.course.course_name) || hit(b.course.teacher) || hit(b.course.class_room)) &&
        (prefs.showWeekend || b.weekday <= 5),
    );
  }, [blocks, query, prefs.showWeekend]);

  /** 命中集合：每列每张卡都要问一次「我在不在里面」，用 Set 把这张表的查询降到 O(1) */
  const matchedSet = useMemo(() => new Set(visibleBlocks), [visibleBlocks]);

  // 7 列**常驻**：周末两列不再跟着偏好增删，改由 `weekendP` 把它们的宽度收到 0
  // （直接卸载 = 瞬变，且内容宽度会一跳，见顶部常量说明）。
  const weekdays = WEEKDAYS;

  /*
    横向滚动区里**只有**星期表头与课程列 —— 左轨（月盒 + 节次列）是固定的一列。
    早期版本把左轨也放进滚动容器，一横向滑动它就跟着跑：用户滑到中间时
    既看不到自己在第几节，左边缘还会把课程卡切成半个字。

    列间距已经挪到**每列自己的 marginLeft** 上（见顶部说明），所以这里不再 +gap 项。
  */
  const daysW = prefs.showWeekend ? GRID_FULL_W : GRID_BASE_W;
  /** 滚动区可用宽度 = 屏幕宽 − 左内边距 − 固定左轨（右边缘出血到屏幕边，不再减 PAGE_PAD） */
  const scrollW = width - PAGE_PAD - TIME_W;
  /** 滚动内容总宽：左端留一个 COL_GAP 的缝（首列紧贴左轨），右端留 PAGE_PAD */
  const contentW = COL_GAP + daysW + PAGE_PAD;
  const maxScrollX = Math.max(0, contentW - scrollW);
  const needHScroll = maxScrollX > 0;
  const showFade = needHScroll && maxScrollX > EDGE_FADE_TRIGGER;
  const rowCount = resolveRowCount(blocks);
  const gridH = rowCount * ROW_H + (rowCount - 1) * ROW_GAP;

  /*
    横向滚动位置 → 两条遮罩的透明度。

    用 `Animated.event` + 原生驱动，滚动位置是**唯一**驱动源（与首页胶囊同一个
    思路，见 hooks/usePageSwiper.ts）：不额外跑定时器、不 setState，
    滚动过程零 React 重渲染。
  */
  const gridScrollX = useRef(new Animated.Value(0)).current;
  const onGridScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: gridScrollX } } }], {
        useNativeDriver: true,
      }),
    [gridScrollX],
  );

  /*
    横向偏移的**JS 镜像** + 收窄内容后把偏移拉回合法范围。

    原生 ScrollView 在 contentSize 变小后**不会**自动把过期的 contentOffset 拉回来：
    用户为了看周六周日滑到最右，再关掉「显示周末」——内容只剩 5 列宽，
    滚动位置却还停在 7 列那儿，屏幕上一片空，看起来就是「宽度还是 7 天的宽度」。
    用原生驱动的 `Animated.event` 读不到 JS 侧的值，所以另外记一份（拖动/惯性结束时取）。
  */
  const gridRef = useRef<ScrollView>(null);
  const gridScrollXRef = useRef(0);
  const rememberGridOffset = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    gridScrollXRef.current = e.nativeEvent.contentOffset.x;
  }, []);
  useEffect(() => {
    if (gridScrollXRef.current <= maxScrollX + 0.5) return;
    gridRef.current?.scrollTo({ x: maxScrollX, animated: true });
  }, [maxScrollX]);
  // 左接缝：静止时完全透明，滚开一点才浮现
  const seamFadeOpacity = useMemo(
    () =>
      gridScrollX.interpolate({
        inputRange: [0, EDGE_FADE_TRIGGER],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [gridScrollX],
  );
  // 右边缘：还剩内容被切着时就显示，滚到底淡出（inputRange 单调递增，showFade 已保证 maxScrollX 足够大）
  const edgeFadeOpacity = useMemo(
    () =>
      gridScrollX.interpolate({
        inputRange: [maxScrollX - EDGE_FADE_TRIGGER, maxScrollX],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [gridScrollX, maxScrollX],
  );

  const goLogin = useCallback(() => router.push('/login'), []);
  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openAdd = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setAddOpen(true);
  }, []);

  const saveDraft = useCallback((d: Draft) => {
    const item: CustomCourse = {
      id: `${Date.now()}`,
      course_name: d.name.trim(),
      teacher: d.teacher.trim() || undefined,
      class_room: d.room.trim() || undefined,
      weekday: d.weekday,
      startSection: Math.min(d.s1, d.s2),
      endSection: Math.max(d.s1, d.s2),
    };
    setCustom((prev) => {
      const next = [...prev, item];
      void customCourseStore.save(next);
      return next;
    });
  }, []);

  const removeCustom = useCallback((id: string) => {
    setCustom((prev) => {
      const next = prev.filter((c) => c.id !== id);
      void customCourseStore.save(next);
      return next;
    });
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      // 拉动页面也算「点别的地方」：搜索条收起来，别让它挡着正在看的内容
      onScrollBeginDrag={searchOpen ? closeSearch : undefined}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={C.ink}
          colors={[C.limeDeep]}
        />
      }
    >
      {/* ===================== 品牌徽章 ===================== */}
      <BrandBadge label="校园服务 · 课程表" hardShadow />

      {/*
        ===================== Top Row（画布 19:10） =====================
        左边：标题「课程表」(28 / Noto Sans SC Black / lineHeight 34) + 状态胶囊
        右边：Header Actions（画布 19:12）—— 搜索 / 添加 / 显示设置，3 个 32×32
      */}
      <View style={styles.topRow} onLayout={onTopRowLayout}>
        <Animated.View
          style={[styles.topRowLeft, { opacity: headFade }]}
          pointerEvents={searchOpen ? 'none' : 'auto'}
        >
          <Text style={styles.pageTitle}>课程表</Text>
          {status === 'guest' && <GuestPill />}
          {status === 'not_bound' && <StatusPill label="未绑定教务" />}
          {status === 'loading' && <StatusPill label="同步中" />}
          {status === 'empty' && <StatusPill label="暂无课程" />}
          {status === 'error' && <StatusPill label="加载失败" />}
          {status === 'ready' && <StatusPill label="已同步" />}
        </Animated.View>

        <Animated.View
          style={[styles.headerActions, { opacity: headFade }]}
          pointerEvents={searchOpen ? 'none' : 'auto'}
        >
          {/* 搜索按钮的「原位占位」：搜索条此刻正压在它上面，占位是为了让另外两颗按钮留在设计稿的位置上 */}
          <View style={styles.actionSlot} />
          <IconBtn name="plus" variant="ink" disabled={!ready} onPress={openAdd} />
          <IconBtn name="sliders" onPress={() => setSettingsOpen(true)} />
        </Animated.View>

        {/*
          搜索条：**绝对定位**在顶栏右端，未展开时 right/width 正好把它摆到搜索按钮的原位上
          （32×32、白底、12 圆角、2.5 硬投影 —— 与 IconBtn 逐像素重合），
          所以「点击 → 变宽」的起点就是用户手指下面那颗按钮，不存在跳变。

          展开时右边缘滑到页面内边距、宽度铺满整行：左边缘一路向左扫过标题区（标题已让位）。
          放大镜按 `right: SEARCH_PAD` 绝对定位，全程停在条右端 —— 未展开时它正好落在
          32×32 的中心（上下左右各 8.5），展开后就成了「靠右侧内边距」的那颗图标。
        */}
        <Animated.View
          testID="course-search-bar"
          style={[styles.searchWrap, { right: searchRight, width: searchWidth }]}
          pointerEvents={ready ? 'auto' : 'none'}
        >
          <StickerField
            style={styles.searchBox}
            fill={C.white}
            radius={R.btn}
            restOffset={ready ? SHADOW.md : 0}
            focusOffset={1}
          >
            <FieldInput
              ref={searchInputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="搜索课名 / 教师 / 教室"
              placeholderTextColor={inkA(0.32)}
              style={styles.searchInput}
              returnKeyType="search"
              editable={ready}
            />
            {!!query && (
              <Pressable
                testID="course-search-clear"
                style={styles.searchClear}
                onPress={() => setQuery('')}
                hitSlop={6}
              >
                <Feather name="x" size={13} color={C.ink} />
              </Pressable>
            )}
            <Pressable
              testID="course-search-icon"
              style={styles.searchIcon}
              onPress={toggleSearch}
              hitSlop={6}
            >
              <Feather name="search" size={SEARCH_ICON} color={ready ? C.ink : inkA(0.3)} />
            </Pressable>
          </StickerField>
        </Animated.View>
      </View>

      {/*
        ===================== 搜索：点页面别处收起 =====================

        展开后，页面其余部分铺一层「点哪儿都算点了别处」的接住层。
        做成**上下两条带、刻意留空顶栏那一行**：中间那条是搜索条本身，
        被盖住的话展开后连字都打不进去。

        为什么不用「输入框失焦就收起」：RN 里点空白处**不会**让 TextInput 失焦，
        失焦只在键盘收起 / 主动 blur 时发生 —— 而 Web 上点空白处会失焦。
        只在网页预览里验，会得到「已经修好了」的错觉（同类坑：worklet 在 Web 上不序列化）。
      */}
      {searchOpen && (
        <View style={styles.searchCatcher} pointerEvents="box-none">
          {topRowBox.y > 0 && (
            <Pressable
              testID="course-search-backdrop-top"
              style={[styles.catcherBand, { height: topRowBox.y }]}
              onPress={closeSearch}
              {...PAGER_LOCK_PROPS}
            />
          )}
          <Pressable
            testID="course-search-backdrop"
            style={[styles.catcherBand, { top: topRowBox.y + topRowBox.h, bottom: 0 }]}
            onPress={closeSearch}
            {...PAGER_LOCK_PROPS}
          />
        </View>
      )}

      {/* ===================== 加载中：骨架屏，无任何可点击元素 ===================== */}
      {status === 'loading' && (
        <LoadingShell>
          <ScheduleSkeleton />
          <Text style={styles.loadingHint}>正在同步本学期课表…</Text>
        </LoadingShell>
      )}

      {/* ===================== 未登录 ===================== */}
      {status === 'guest' && (
        <StateCard
          tone="guest"
          icon={<Feather name="calendar" size={34} color={C.ink} />}
          badge={<Sparkle />}
          title="登录后查看课程表"
          description={'课表来自学校教务系统\n登录并绑定教务账号后，自动同步本学期全部课程'}
          primaryAction={{ label: '立即登录', onPress: goLogin }}
          link={{ label: '还没有账号？立即注册', onPress: goLogin }}
        >
          <Text style={styles.previewLabel}>课表示意</Text>
          <GridPreview />
        </StateCard>
      )}

      {/* ===================== 已登录 · 未绑定教务 ===================== */}
      {status === 'not_bound' && (
        <StateCard
          tone="not_bound"
          icon={<Feather name="calendar" size={30} color={C.ink} />}
          bang
          title="绑定教务账号查看课表"
          description={'课表由学校教务系统提供\n绑定后可自动同步本学期课程、考试与成绩'}
          primaryAction={{ label: '立即绑定教务', onPress: goLogin, arrow: true }}
          link={{ label: '可在「我的 → 账号绑定」中管理教务账号', onPress: goLogin }}
        >
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>教务系统账号</Text>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>未绑定</Text>
            </View>
          </View>
          <Text style={styles.previewLabel}>课表示意</Text>
          <GridPreview />
        </StateCard>
      )}

      {/* ===================== 空态：结果为空不是故障，给次要行动 ===================== */}
      {status === 'empty' && (
        <StateCard
          tone="empty"
          icon={<Feather name="calendar" size={34} color={C.ink} />}
          badge={<Sparkle />}
          title="本学期暂无课程"
          description={'教务系统尚未发布本学期课表\n稍后刷新试试'}
          secondaryAction={{ label: '重新加载', onPress: onRefresh }}
        />
      )}

      {/* ===================== 错误：主行动重试 + 真实错误码 ===================== */}
      {status === 'error' && (
        <StateCard
          tone="error"
          icon={<Feather name="alert-circle" size={34} color={C.ink} />}
          bang
          title="课表加载失败"
          description="可能是教务系统繁忙或网络异常"
          errorBar={toErrorBar(error)}
          primaryAction={{ label: '重新加载', onPress: onRefresh }}
        />
      )}

      {/* ===================== 正常课表 ===================== */}
      {status === 'ready' && (
        <>
          {/* 周切换 */}
          <View style={styles.weekBar}>
            <Pressable onPress={() => setWeekOffset((o) => o - 1)} hitSlop={6}>
              <Sticker style={styles.weekBtn} fill={C.white} radius={R.pill} offset={SHADOW.sm}>
                <Feather name="chevron-left" size={13} color={C.ink} />
                <Text style={styles.weekBtnText}>上一周</Text>
              </Sticker>
            </Pressable>

            {/*
              中间这组（第 X 周 ＋ 回到本周）**绝对定位居中于整行**。
              用绝对定位而不是让它在 flex 里居中：否则「回到本周」出现时会把两侧的
              翻周按钮挤动 —— 那是整行在动，不是「第 X 周」在动。
              `box-none`：自身不拦截触摸，但里面的「回到本周」照常可点。
            */}
            <View style={styles.weekCenter} pointerEvents="box-none">
              <Animated.View style={{ transform: [{ translateX: weekTitleShift }] }}>
                <View style={styles.weekTitleBox} testID="course-week-title">
                  <Text style={styles.weekTitle}>第 {week} 周</Text>
                  <Text style={styles.weekRange}>{weekRangeLabel(week, termStart)}</Text>
                </View>
              </Animated.View>

              {/*
                「回到本周」：占位宽度恒定（布局位置固定），只靠 opacity + translateX 进出 ——
                这样整段动画没有一次布局重排，可以交给 native driver。
                「第 X 周」的向左让位由 `weekTitleShift` 负责（见上面的常量说明）。
              */}
              <Animated.View
                testID="course-week-back"
                style={[
                  styles.weekBackSlot,
                  { opacity: backP, transform: [{ translateX: weekBackEnter }] },
                ]}
                pointerEvents={weekOffset === 0 ? 'none' : 'auto'}
                onLayout={onBackLayout}
              >
                <Pressable onPress={() => setWeekOffset(0)} hitSlop={6}>
                  <Sticker style={styles.backToNow} fill={C.ink} radius={R.pill} offset={SHADOW.sm}>
                    <Text style={styles.backToNowText}>回到本周</Text>
                  </Sticker>
                </Pressable>
              </Animated.View>
            </View>

            <Pressable onPress={() => setWeekOffset((o) => o + 1)} hitSlop={6}>
              <Sticker style={styles.weekBtn} fill={C.white} radius={R.pill} offset={SHADOW.sm}>
                <Text style={styles.weekBtnText}>下一周</Text>
                <Feather name="chevron-right" size={13} color={C.ink} />
              </Sticker>
            </Pressable>
          </View>

          {/*
            网格区：**向右出血到屏幕边**（跳出 PAGE_PAD 的 12dp 内边距）。

            结构是三段：
              [ 固定左轨 ][ 横向滚动区 ][ 两端渐变遮罩 ]

            · 左轨（月盒 + 节次列）不参与横向滚动 —— 滑到中间也始终知道在第几节；
            · 滚动区从「左轨右边框」起，一直吃到屏幕右边缘：内容不再被切在
              屏幕里侧 12dp 处（那正是用户看到的「边边被遮挡」）；
            · 滚动区里只有星期表头与课程列，表头与网格必须同容器，否则列会错位；
            · 遮罩让两处硬切边化进底色（见 EDGE_FADE_* 常量）。

            ⚠️ 滚动区外层 View 负责在触摸期间锁住首页的横向分页器（PAGER_LOCK_PROPS）——
            同方向嵌套滚动时，pagingEnabled 的外层会抢走手势，用户一划就翻页。
            Android 另需 nestedScrollEnabled 才能把嵌套滚动交给内层。
          */}
          <View style={styles.gridBleed}>
            {/* 固定左轨：先落位，其余列随后依次错峰进入 */}
            <StaggerIn index={0} step={STEP_4_FRAMES} active={animate} style={styles.rail}>
              <View style={styles.monthBox}>
                <Text style={styles.monthText}>
                  {days?.[0]?.date ? `${days[0].date.split('/')[0]}月` : ''}
                </Text>
              </View>

              {/*
                左侧节次导轨。一行 = 一个「大节」= 2 个节次（见 lib/schedule.ts 的
                SECTIONS_PER_ROW）。设计稿只有 5 行，第 5 行是「第 9,10,11 节」的
                晚间连堂（19:00–21:30），所以**没有第 6 节**。
              */}
              <View style={styles.periodColumn}>
                {Array.from({ length: rowCount }, (_, i) => i + 1).map((no) => {
                  const time = SECTION_TIMES[no - 1];
                  return (
                    <Sticker
                      key={no}
                      style={styles.periodCell}
                      fill={C.white}
                      radius={CARD_R}
                      offset={0}
                      border={1}
                    >
                      <Text style={styles.periodNo}>{no}</Text>
                      {!!prefs.showTimes && !!time && (
                        <>
                          <Text style={styles.periodStart}>{time.start}</Text>
                          <Text style={styles.periodEnd}>{time.end}</Text>
                        </>
                      )}
                    </Sticker>
                  );
                })}
              </View>
            </StaggerIn>

            <View style={styles.gridScrollWrap} {...PAGER_LOCK_PROPS}>
              {/*
                ⚠️ 必须是 `Animated.ScrollView`，不是 `ScrollView`。
                `Animated.event(..., { useNativeDriver: true })` 返回的是一个**事件对象**
                （原生驱动用的 NativeAnimatedEvent 包装），不是普通回调函数。
                普通 ScrollView 的 _handleScroll 会直接把它当函数调用 → 原生端崩：
                「Uncaught Error: Object is not a function」（Web 端不报，别只在网页上验）。
                Animated.ScrollView 才认识这个对象并调 attachNativeEvent 交给原生驱动。
              */}
              <Animated.ScrollView
                ref={gridRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={needHScroll}
                onScroll={onGridScroll}
                onScrollEndDrag={rememberGridOffset}
                onMomentumScrollEnd={rememberGridOffset}
                scrollEventThrottle={16}
                style={styles.gridScroll}
                contentContainerStyle={styles.gridScrollContent}
              >
                {/*
                  内容容器宽度由 `gridContentW` 驱动（406 ↔ 570），与周末两列的收放
                  同源同帧 —— 于是「列收 → 滚动区收」严格同步，不会出现列已经没了、
                  滚动区还停在 7 天宽的情况。
                */}
                <Animated.View testID="course-grid-content" style={{ width: gridContentW }}>
                  {/*
                    星期表头（Day Header Row：列间距 4，Day Cell 50 高，圆角 16）。
                    与下面的课程列用**同一个序号**错峰：表头格与它那一列课程同时落位，
                    横向扫过去是一列一列地浮上来。

                    ⚠️ 列间距走**每列自己的 marginLeft**（除首列），不用 `gap`：
                       周末两列收拢时要把自己前面那道缝一起收掉，`gap` 由容器统一加、收不了。
                       两者数值完全相同，静止时布局与改动前逐像素一致。
                  */}
                  <View style={styles.dayRow}>
                    {weekdays.map((wd, ci) => {
                      const day = days?.[wd - 1];
                      const weekend = WEEKEND_DAYS.includes(wd);
                      return (
                        <Animated.View
                          key={wd}
                          testID={`course-dayhead-${wd}`}
                          style={[
                            styles.daySlot,
                            ci > 0 && styles.daySlotGap,
                            weekend && weekendSlotStyle,
                            weekend && weekendFolded && styles.daySlotFolded,
                          ]}
                        >
                          <StaggerIn index={ci + 1} step={STEP_4_FRAMES} active={animate} style={styles.daySlotFill}>
                            <Sticker
                              style={styles.dayCell}
                              fill={day?.today ? C.lime : C.white}
                              radius={CARD_R}
                              offset={day?.today ? SHADOW.lg : SHADOW.md}
                            >
                              <Text style={styles.dayLabel}>{day?.label ?? DAY_LABELS[wd - 1]}</Text>
                              {!!day?.date && (
                                <Text style={[styles.dayDate, day.today && styles.dayDateToday]}>
                                  {day.date}
                                </Text>
                              )}
                            </Sticker>
                          </StaggerIn>
                        </Animated.View>
                      );
                    })}
                  </View>

                  {/* 课程网格（Grid Row：列间距 4，行高 82，行距 6） */}
                  <View style={styles.gridRow}>
                    {weekdays.map((wd, ci) => (
                      <Animated.View
                        key={wd}
                        testID={`course-daycol-${wd}`}
                        style={[
                          styles.daySlot,
                          ci > 0 && styles.daySlotGap,
                          WEEKEND_DAYS.includes(wd) && weekendSlotStyle,
                          WEEKEND_DAYS.includes(wd) && weekendFolded && styles.daySlotFolded,
                        ]}
                      >
                        <StaggerIn index={ci + 1} step={STEP_4_FRAMES} style={styles.daySlotFill}>
                          <View style={[styles.dayColumn, { height: gridH }]}>
                            {/*
                              渲染的是**这一周的全部课程**（7 列常驻，周末两列由
                              `weekendP` 把列宽收到 0，见顶部常量说明）。
                              命中与否交给 SpringFade 做弹性显隐 —— 直接过滤数组的话，
                              不匹配的卡片是「啪」地消失（卸载），没有退场过程。
                            */}
                            {blocks
                              .filter((b) => b.weekday === wd)
                              .map((b, bi) => {
                                const t = toneOf(b.course.course_name);
                                const r0 = sectionRow(b.startSection);
                                const r1 = sectionRow(b.endSection);
                                const rowSpan = r1 - r0 + 1;
                                const isCustom = !!(b.course as any).__customId;
                                return (
                                  <SpringFade
                                    key={`${b.weekday}-${b.startSection}-${bi}`}
                                    visible={matchedSet.has(b)}
                                    style={{
                                      position: 'absolute',
                                      top: (r0 - 1) * ROW_PITCH,
                                      left: 0,
                                      right: 0,
                                    }}
                                  >
                                    <Sticker
                                      style={{
                                        height: rowSpan * ROW_H + (rowSpan - 1) * ROW_GAP,
                                        paddingHorizontal: 10,
                                        paddingVertical: CARD_PAD_V,
                                        justifyContent: 'center',
                                        gap: 4,
                                      }}
                                      fill={t.bg}
                                      radius={CARD_R}
                                      offset={SHADOW.lg}
                                    >
                                      {/* 自定义课程（本机添加）右上角点一个青柠方点，和教务课区分开 */}
                                      {isCustom && <View style={styles.customDot} />}
                                      {/*
                                        课名行数上限按可用高度算：卡片高 − 上下内边距 − 元信息 2 行。
                                        写死 2 行会把「大学英语2(提高)」截成「大学英语2(...」。
                                      */}
                                      <Text
                                        style={[styles.cardName, { color: t.fg }]}
                                        numberOfLines={Math.max(
                                          2,
                                          Math.floor(
                                            (rowSpan * ROW_H +
                                              (rowSpan - 1) * ROW_GAP -
                                              CARD_PAD_V * 2 -
                                              META_LINES * 12) /
                                              CARD_LINE_H,
                                          ),
                                        )}
                                      >
                                        {b.course.course_name}
                                      </Text>
                                      <View style={styles.cardMeta}>
                                        {!!b.course.teacher && (
                                          <Text
                                            style={[styles.cardMetaText, { color: t.sub }]}
                                            numberOfLines={1}
                                          >
                                            {b.course.teacher}
                                          </Text>
                                        )}
                                        {!!b.course.class_room && (
                                          <Text
                                            style={[styles.cardMetaText, { color: t.sub }]}
                                            numberOfLines={1}
                                          >
                                            {b.course.class_room}
                                          </Text>
                                        )}
                                      </View>
                                    </Sticker>
                                  </SpringFade>
                                );
                              })}
                          </View>
                        </StaggerIn>
                      </Animated.View>
                    ))}
                  </View>
                </Animated.View>
              </Animated.ScrollView>
            </View>

            {/* 左轨接缝的渐变：静止时不显示，滑开一点才浮现 */}
            {showFade && (
              <Animated.View
                style={[styles.seamFade, { opacity: seamFadeOpacity }]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={[FADE_OPAQUE, FADE_CLEAR]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.fadeFill}
                />
              </Animated.View>
            )}

            {/* 屏右边缘的渐变：滚到底时淡出 */}
            {showFade && (
              <Animated.View
                style={[styles.edgeFade, { opacity: edgeFadeOpacity }]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={[FADE_CLEAR, FADE_OPAQUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.fadeFill}
                />
              </Animated.View>
            )}
          </View>
          {/* 搜索无命中 */}
          {!!query.trim() && visibleBlocks.length === 0 && (
            <Sticker style={styles.weekEmpty} fill={C.oat} radius={R.card} offset={0}>
              <Text style={styles.weekEmptyText}>没有匹配「{query.trim()}」的课程</Text>
            </Sticker>
          )}

          {/* 有课表数据、但这一周没课 */}
          {!query.trim() && blocks.length === 0 && (
            <Sticker style={styles.weekEmpty} fill={C.oat} radius={R.card} offset={0}>
              <Text style={styles.weekEmptyText}>这一周没有安排课程</Text>
            </Sticker>
          )}

          {/* 自定义课程说明：后端没有新增课程的接口，必须讲清楚 */}
          {custom.length > 0 && (
            <Text style={styles.customNote}>
              含 {custom.length} 门自定义课程（右上角带青柠方点）· 仅保存在本机，不会同步到教务
            </Text>
          )}
        </>
      )}

      {/* ===================== 弹层 ===================== */}
      <AddCourseSheet
        visible={addOpen}
        draft={draft}
        onChange={setDraft}
        onClose={() => setAddOpen(false)}
        onSave={saveDraft}
      />
      <SettingsSheet
        visible={settingsOpen}
        prefs={prefs}
        onPrefs={updatePrefs}
        custom={custom}
        onDelete={removeCustom}
        onClose={() => setSettingsOpen(false)}
      />
    </ScrollView>
  );
}

// ===================== Header Actions（画布 19:12） =====================

/**
 * 32×32 的贴纸图标按钮。
 *
 * 画布给了两种：白底 + 墨黑描边（设置）、墨黑实心 + 青柠图标（添加）。
 * 统一 12 圆角、2.5 硬投影，只靠填色区分 —— 一排按钮才不会歪。
 *
 * 搜索那颗不在这里：它要「点击后变宽」，是一个独立的常驻条（见 topRow 里的 searchWrap），
 * 占位由 `styles.actionSlot` 顶着，好让这两颗按钮留在设计稿的位置上。
 */
function IconBtn({
  name,
  variant = 'plain',
  disabled = false,
  onPress,
}: {
  name: 'plus' | 'sliders';
  variant?: 'plain' | 'ink';
  disabled?: boolean;
  onPress?: () => void;
}) {
  const ink = variant === 'ink';
  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} hitSlop={4}>
      <Sticker
        style={styles.iconBtn}
        fill={ink ? C.ink : C.white}
        radius={12}
        offset={disabled ? 0 : SHADOW.md}
        border={ink ? 0 : BORDER}
      >
        <Feather
          name={name}
          size={15}
          color={disabled ? inkA(0.3) : ink ? C.lime : C.ink}
        />
      </Sticker>
    </Pressable>
  );
}

// ===================== 小部件 =====================

/** 旋转贴纸星 */
function Sparkle() {
  return <MaterialCommunityIcons name="star-four-points" size={16} color={C.ink} />;
}

/**
 * 课表示意网格。
 *
 * 刻意只画**骨架轮廓**（左侧节次列 + 五天疏密不一的色块），不写具体课程名 ——
 * 用户还没登录 / 还没绑定，编课程名属于误导。
 */
function GridPreview() {
  const cols = [26, 32, 26, 34, 26];
  return (
    <View style={styles.preview}>
      <View style={styles.previewRail}>
        <View style={[styles.previewBlock, { height: 26 }]} />
        <View style={[styles.previewBlock, { height: 34 }]} />
        <View style={[styles.previewBlock, { height: 22 }]} />
      </View>
      {cols.map((h, ci) => (
        <View key={ci} style={styles.previewCol}>
          <View style={[styles.previewBlock, { height: h }]} />
          <View style={[styles.previewBlock, { height: 58 - h }]} />
          <View style={[styles.previewBlock, { height: 24 }]} />
        </View>
      ))}
    </View>
  );
}

// ===================== 弹层：表单件 =====================

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <StickerField style={styles.inputBox} fill={C.white} radius={R.btn}>
        <FieldInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={inkA(0.32)}
          style={styles.input}
        />
      </StickerField>
    </View>
  );
}

function ChipGroup({
  label,
  values,
  value,
  onPick,
}: {
  label: string;
  values: number[];
  value: number;
  onPick: (v: number) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {values.map((v) => (
          <Chip key={v} label={`${v}`} active={value === v} onPress={() => onPick(v)} />
        ))}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {!!desc && <Text style={styles.toggleDesc}>{desc}</Text>}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

// ===================== 弹层：添加课程 =====================

function AddCourseSheet({
  visible,
  draft,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  draft: Draft;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: (d: Draft) => void;
}) {
  const valid = draft.name.trim().length > 0;
  return (
    <BottomSheet
      visible={visible}
      title="添加课程"
      subtitle="教务接口是只读的，自定义课程只保存在这台设备"
      onClose={onClose}
    >
      <Field
        label="课程名"
        value={draft.name}
        onChange={(v) => onChange({ ...draft, name: v })}
        placeholder="例如：大学英语2(提高)"
      />
      <Field
        label="教师（选填）"
        value={draft.teacher}
        onChange={(v) => onChange({ ...draft, teacher: v })}
        placeholder="例如：李镜"
      />
      <Field
        label="教室（选填）"
        value={draft.room}
        onChange={(v) => onChange({ ...draft, room: v })}
        placeholder="例如：教三南302"
      />
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>星期</Text>
        <View style={styles.chipWrap}>
          {[1, 2, 3, 4, 5, 6, 7].map((v) => (
            <Chip
              key={v}
              label={WEEKDAY_SHORT[v]}
              active={draft.weekday === v}
              onPress={() => onChange({ ...draft, weekday: v })}
            />
          ))}
        </View>
      </View>
      <ChipGroup
        label="起始节次"
        values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
        value={draft.s1}
        onPick={(v) => onChange({ ...draft, s1: v })}
      />
      <ChipGroup
        label="结束节次"
        values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
        value={draft.s2}
        onPick={(v) => onChange({ ...draft, s2: v })}
      />
      <Pressable
        disabled={!valid}
        style={styles.submitWrap}
        onPress={() => {
          onSave(draft);
          onClose();
        }}
      >
        <Sticker
          style={styles.submit}
          fill={valid ? C.ink : C.oat}
          radius={R.pill}
          offset={valid ? SHADOW.md : 0}
        >
          <Text style={[styles.submitText, !valid && styles.submitTextOff]}>保存到本机</Text>
        </Sticker>
      </Pressable>
    </BottomSheet>
  );
}

// ===================== 弹层：显示设置 =====================

function SettingsSheet({
  visible,
  prefs,
  onPrefs,
  custom,
  onDelete,
  onClose,
}: {
  visible: boolean;
  prefs: CoursePrefs;
  onPrefs: (p: CoursePrefs) => void;
  custom: CustomCourse[];
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      title="显示设置"
      subtitle="这些偏好只保存在本机，后端没有对应的配置接口"
      onClose={onClose}
    >
      <ToggleRow
        label="显示周末"
        desc="关掉后课表只显示周一至周五，横向滚动距离更短"
        value={prefs.showWeekend}
        onChange={(v) => onPrefs({ ...prefs, showWeekend: v })}
      />
      <ToggleRow
        label="显示节次时间"
        desc="左侧节次列是否显示每个大节的起止时间"
        value={prefs.showTimes}
        onChange={(v) => onPrefs({ ...prefs, showTimes: v })}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>自定义课程（{custom.length}）</Text>
        {custom.length === 0 ? (
          <Text style={styles.emptyHint}>
            还没有添加。点右上角「+」可以把自习、社团活动这类教务系统里没有的安排补进课表。
          </Text>
        ) : (
          <View style={styles.customList}>
            {custom.map((c) => (
              <View key={c.id} style={styles.customRow}>
                <View style={styles.customText}>
                  <Text style={styles.customName} numberOfLines={1}>
                    {c.course_name}
                  </Text>
                  <Text style={styles.customMeta} numberOfLines={1}>
                    {WEEKDAY_SHORT[c.weekday]} 第{c.startSection}
                    {c.endSection !== c.startSection ? `-${c.endSection}` : ''}节
                    {c.class_room ? ` · ${c.class_room}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => onDelete(c.id)} hitSlop={6} style={styles.delBtn}>
                  <Feather name="trash-2" size={14} color={C.ink} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

// ===================== 样式 =====================

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    // flexGrow 让状态卡能吃掉剩余高度，与画布一致地垂直撑满；
    // 正常课表态内容本身超屏，flexGrow 不产生影响
    flexGrow: 1,
    paddingHorizontal: PAGE_PAD,
    paddingTop: 16,
    // 给悬浮导航栏留出空间。原 130 不够：滚到底时第 5 大节（19:00–21:30）那张卡
    // 的下沿正好压在悬浮栏上，看起来像被切掉一截。176 = 130 + 一张卡的高度余量。
    paddingBottom: 176,
    gap: 12,
  },

  // ===================== Top Row（画布 19:10） =====================
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    height: 34,
  },
  topRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  pageTitle: {
    fontFamily: DISPLAY,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1.1,
    color: C.ink,
  },
  // Header Actions（画布 19:12）：3 × 32 + 2 × 8 = 112
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===================== 搜索条（顶栏那颗放大镜，点击后变宽） =====================
  /** 搜索按钮的原位占位：只为把另外两颗按钮顶在设计稿的位置上 */
  actionSlot: {
    width: ACTION_SLOT,
    height: ACTION_SLOT,
  },
  /** 条的外壳：绝对定位在顶栏右端（right / width 由动画给），高度与动作按钮齐平 */
  searchWrap: {
    position: 'absolute',
    top: (34 - ACTION_SLOT) / 2, // topRow 高 34，与那颗按钮同轴
    height: ACTION_SLOT,
    zIndex: 2,
  },
  /**
   * 条的内胆。三个子元素全部**绝对定位**：
   * 用 flex 排的话，未展开时（可用宽 32）「输入框 + 间距 + 放大镜」会超出容器，
   * 而 RN 的 flexShrink 默认是 0 —— 放大镜会被顶到按钮外面去。
   * 绝对定位天然满足：输入框的 left/right 一起收缩到 0，放大镜始终贴住右内边距。
   */
  searchBox: {
    height: ACTION_SLOT,
  },
  searchInput: {
    position: 'absolute',
    left: SEARCH_PAD,
    // 让开右端的放大镜与清除按钮
    right: SEARCH_PAD + SEARCH_ICON + 6,
    top: 0,
    bottom: 0,
    fontSize: 13,
    lineHeight: 17,
    color: C.ink,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  /** 放大镜：未展开时正好落在 32×32 的中心，展开后就是「右侧靠边内边距」那颗 */
  searchIcon: {
    position: 'absolute',
    right: SEARCH_PAD,
    top: 0,
    bottom: 0,
    width: SEARCH_ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClear: {
    position: 'absolute',
    right: SEARCH_PAD + SEARCH_ICON + 6,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
    搜索条展开时，页面其余部分铺的「点哪儿都算点了别处」接住层。
    绝对定位在内容容器上（跟内容一起滚动），分上下两条带、中间留给搜索条本身。

    `zIndex: 4` 只为一件事：要压住网格两端那两条 zIndex 3 的渐变遮罩，
    否则点屏幕最右那 18px 会落到遮罩上、收不起来。
  */
  searchCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  catcherBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },

  // ===================== 加载中 =====================
  loadingHint: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.ink,
    textAlign: 'center',
  },

  // ===================== 卡内小件 =====================
  previewLabel: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  preview: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 5,
  },
  previewRail: {
    width: 16,
    gap: 5,
  },
  previewCol: {
    flex: 1,
    gap: 5,
  },
  previewBlock: {
    borderRadius: 8,
    backgroundColor: C.oat,
  },
  infoRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.oat,
  },
  infoLabel: {
    fontSize: 12.5,
    lineHeight: 17,
    color: C.ink,
  },
  infoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
  },
  infoBadgeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: C.ink,
  },

  // ===================== 周切换 =====================
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    // 周卡与下面课程网格的间距（外加 content 的 gap 12，合计约 18）
    marginBottom: 6,
  },
  weekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: R.pill,
  },
  weekBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.ink,
  },
  weekCenter: {
    // 绝对定位居中于整行：「回到本周」进出时，两侧的翻周按钮纹丝不动
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: WEEK_BACK_GAP,
  },
  weekTitleBox: {
    alignItems: 'center',
  },
  weekTitle: {
    fontFamily: DISPLAY,
    fontSize: 22,
    letterSpacing: -0.8,
    color: C.ink,
  },
  weekRange: {
    fontSize: 10,
    fontWeight: '600',
    color: C.ink,
  },
  /** 不写 flex：宽度由内容决定且恒定，「第 X 周」的布局位置才稳定（位移全靠 transform 补偿） */
  weekBackSlot: {},
  backToNow: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
  },
  backToNowText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.lime,
  },

  // ===================== 星期表头（Day Header Row） =====================
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // 列间距在每列自己的 daySlotGap 上（周末两列要能把它收掉，见顶部常量说明）
    height: DAY_H,
  },
  /*
    每一列（表头格 / 课程列）的槽位。宽度写死 COL_W，周末两列由 `weekendSlotStyle` 覆盖为
    「COL_W × p + COL_GAP × p」的动画值 —— 于是收拢时列与它前面那道缝一起消失。

    ⚠️ 必须是 row 的**直接子元素**：`weekendSlotStyle` 里的负向间隙要靠它自己承担，
       套一层无宽度的父节点会让 Yoga 把负宽度夹到 0（见顶部常量说明）。
  */
  daySlot: {
    width: COL_W,
  },
  daySlotGap: {
    marginLeft: COL_GAP,
  },
  /**
   * 折起之后才加的裁切：0 宽的盒子里，文字仍会溢出并把横向滚动区撑宽约 9px。
   * 硬投影也会一起被裁，所以**只在收拢动画跑完之后**加（见 `weekendFolded` 的注释）。
   */
  daySlotFolded: {
    overflow: 'hidden',
  },
  /** 槽位内层：吃满槽位宽度，让 `Sticker` 本体与绝对定位的课程卡都跟着槽位一起缩放 */
  daySlotFill: {
    width: '100%',
  },
  monthBox: {
    width: TIME_W,
    // 与星期表头行等高并垂直居中：左轨拆出滚动容器后，这里要自己撑出表头那 50dp
    height: DAY_H+6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.ink,
  },
  dayCell: {
    height: DAY_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  dayLabel: {
    fontFamily: DISPLAY,
    fontSize: 15,
    lineHeight: 18,
    color: C.ink,
  },
  dayDate: {
    fontSize: 10,
    fontWeight: '600',
    color: C.ink,
  },
  // 日期统一改最黑后与 dayDate 同色；保留这一档，日后若要在青柠底上再作区分可直接改
  dayDateToday: {
    color: C.ink,
  },

  // ===================== 课程网格（Grid Row） =====================
  /**
   * 网格区外壳：把「固定左轨 + 横向滚动区」并排放好。
   *
   * `marginRight: -PAGE_PAD` 让网格**向右出血到屏幕边** ——
   * 内容不再被切在屏幕里侧 12dp 处（用户截图里那个「边边被遮挡」的位置）。
   * 左边不加负边距：左轨要与页面上其它元素一样对齐在 12dp。
   */
  gridBleed: {
    flexDirection: 'row',
    marginRight: -PAGE_PAD,
  },
  /**
   * 固定左轨（月盒 + 节次列）。
   *
   * `zIndex` 是必需的：它在滚动区**之前**绘制，不抬层级就会被滑过来的课程卡盖住。
   */
  rail: {
    width: TIME_W,
    zIndex: 2,
  },
  /** 横向滚动区：吃掉左轨右侧剩余的全部宽度（一直顶到屏幕右边） */
  gridScrollWrap: {
    flex: 1,
  },
  /** 左轨接缝的渐变遮罩：左边界正好贴住左轨的右边框 */
  seamFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: TIME_W,
    width: SEAM_FADE_W,
    zIndex: 3,
  },
  /** 屏幕右边缘的渐变遮罩 */
  edgeFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: EDGE_FADE_W,
    zIndex: 3,
  },
  /** 渐变本体：撑满遮罩容器 */
  fadeFill: {
    flex: 1,
  },
  gridScroll: {
    // 横向滚动容器不吃多余高度，避免把内容撑开
    flexGrow: 0,
    paddingBottom: ROW_GAP,
  },
  gridScrollContent: {
    // 内容窄于容器时靠左，不做居中（居中会让首列离开左轨）
    flexGrow: 0,
    // 左端一个 COL_GAP 的缝（首列紧贴左轨），右端留页面标准内边距
    paddingLeft: COL_GAP,
    paddingRight: PAGE_PAD,
  },
  gridRow: {
    flexDirection: 'row',
    // 列间距同 dayRow：挪到每列的 daySlotGap 上
    paddingTop: ROW_GAP,
  },
  periodColumn: {
    width: TIME_W,
    gap: ROW_GAP,
  },
  periodCell: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    // 节次列只有 36 宽，三行内容（序号 + 起 + 止）+ 2px 描边会顶到边缘
    paddingHorizontal: 0,
  },
  periodNo: {
    fontFamily: DISPLAY,
    fontSize: 18,
    lineHeight: 20,
    color: C.ink,
  },
  periodStart: {
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: -0.4,
    color: C.ink,
  },
  // 原先用燕麦灰 #A8A394，与其他副文字一起统一改最黑
  periodEnd: {
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: -0.4,
    color: C.ink,
  },
  /**
   * 课程列本体：宽度跟随外层槽位（100%）。
   *
   * 宽度**不能**写死 COL_W —— 不然周末两列的槽位收到 0 时，里面的课程卡
   * （绝对定位 left/right: 0）仍旧是 78 宽、溢出去撑大滚动区，
   * 「宽度收回来」这件事就白做了（Web 端会表现成还能往右滚一片空白）。
   */
  dayColumn: {
    width: '100%',
  },

  // ===================== 课程卡（设计稿 Course Name / Course Meta） =====================
  cardName: {
    fontSize: 11,
    lineHeight: CARD_LINE_H,
    fontWeight: '700',
  },
  cardMeta: {
    gap: 1,
  },
  cardMetaText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
  },
  // 自定义课程标记：右上角 6×6 青柠方点
  customDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: C.lime,
    borderWidth: 1,
    borderColor: C.ink,
  },
  customNote: {
    fontSize: 10,
    lineHeight: 14,
    color: C.ink,
  },
  weekEmpty: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  weekEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.ink,
  },

  // ===================== 弹层表单 =====================
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: C.ink,
  },
  inputBox: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    lineHeight: 18,
    color: C.ink,
    paddingVertical: 0,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: BORDER,
    borderColor: C.ink,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: C.ink,
  },
  toggleDesc: {
    fontSize: 11,
    lineHeight: 15,
    color: C.ink,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: 999,
    borderWidth: BORDER,
    borderColor: C.ink,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
  },
  trackOn: {
    backgroundColor: C.lime,
    justifyContent: 'flex-end',
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: C.ink,
  },
  knobOn: {
    backgroundColor: C.ink,
  },
  submitWrap: {
    marginTop: 2,
  },
  submit: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.lime,
  },
  submitTextOff: {
    color: inkA(0.35),
  },
  emptyHint: {
    fontSize: 11.5,
    lineHeight: 16,
    color: C.ink,
  },
  customList: {
    gap: 8,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: BORDER,
    borderColor: C.ink,
  },
  customText: {
    flex: 1,
    gap: 2,
  },
  customName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: C.ink,
  },
  customMeta: {
    fontSize: 11,
    lineHeight: 15,
    color: C.ink,
  },
  delBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.oat,
    borderWidth: BORDER,
    borderColor: C.ink,
  },
});
