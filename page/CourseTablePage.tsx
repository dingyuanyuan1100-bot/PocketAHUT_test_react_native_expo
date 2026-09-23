import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ViewProps } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BrandBadge from '../template/BrandBadge';
import BottomSheet from '../template/BottomSheet';
import Chip from '../template/Chip';
import Sticker from '../template/Sticker';
import LoadingShell from '../template/LoadingShell';
import StickerField, { FieldInput } from '../template/StickerField';
import StatusPill, { GuestPill } from '../template/StatusPill';
import StateCard, { toErrorBar } from '../template/StateCard';
import ScheduleSkeleton from '../template/ScheduleSkeleton';
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
  { bg: C.lime, fg: C.ink, sub: inkA(0.62) },
  { bg: C.ink, fg: C.cream, sub: limeA(0.85) },
  { bg: C.limeDeep, fg: C.ink, sub: inkA(0.72) },
  { bg: C.white, fg: C.ink, sub: inkA(0.55) },
  { bg: C.oat, fg: C.ink, sub: inkA(0.6) },
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
export default function CourseTablePage() {
  const { width } = useWindowDimensions();
  const { status, courses, error, refetch, isRefreshing } = useCourseSchedule();
  // 开学日期：用于推算「第几周」，取不到就退化为第 1 周（不编日期）
  const termStart = useTermStart();

  const ready = status === 'ready';

  // ===================== 本地偏好 / 自定义课程 =====================
  const [prefs, setPrefs] = useState<CoursePrefs>(DEFAULT_PREFS);
  const [custom, setCustom] = useState<CustomCourse[]>([]);

  useEffect(() => {
    void prefsStore.load().then(setPrefs);
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

  const allCourses = useMemo<any[]>(
    () => [...courses, ...custom.map(toCourseItem)],
    [courses, custom],
  );
  const blocks = useMemo(() => buildCourseBlocks(allCourses, week), [allCourses, week]);
  const days = useMemo(() => resolveWeekDates(week, termStart), [week, termStart]);

  /** 搜索 + 「显示周末」之后的最终块集合 */
  const visibleBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (s?: string) => !!s && s.toLowerCase().includes(q);
    return blocks.filter(
      (b) =>
        (!q || hit(b.course.course_name) || hit(b.course.teacher) || hit(b.course.class_room)) &&
        (prefs.showWeekend || b.weekday <= 5),
    );
  }, [blocks, query, prefs.showWeekend]);

  // 产品要求周日常驻；「显示周末」关掉后退回周一至周五 5 列
  const weekdays = useMemo(
    () => (prefs.showWeekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5]),
    [prefs.showWeekend],
  );

  // 每行有 (1 + 列数) 个子元素 → 列数个间距，不要再额外加尾部间距
  const gridW = TIME_W + (COL_W + COL_GAP) * weekdays.length;
  const needHScroll = gridW > width - PAGE_PAD * 2;
  const rowCount = resolveRowCount(blocks);
  const gridH = rowCount * ROW_H + (rowCount - 1) * ROW_GAP;

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
      <View style={styles.topRow}>
        <View style={styles.topRowLeft}>
          <Text style={styles.pageTitle}>课程表</Text>
          {status === 'guest' && <GuestPill />}
          {status === 'not_bound' && <StatusPill label="未绑定教务" />}
          {status === 'loading' && <StatusPill label="同步中" />}
          {status === 'empty' && <StatusPill label="暂无课程" />}
          {status === 'error' && <StatusPill label="加载失败" />}
          {status === 'ready' && <StatusPill label="已同步" />}
        </View>

        <View style={styles.headerActions}>
          <IconBtn
            name="search"
            active={searchOpen}
            disabled={!ready}
            onPress={() => {
              setSearchOpen((v) => !v);
              setQuery('');
            }}
          />
          <IconBtn name="plus" variant="ink" disabled={!ready} onPress={openAdd} />
          <IconBtn name="sliders" onPress={() => setSettingsOpen(true)} />
        </View>
      </View>

      {/* 搜索：纯前端过滤已加载的课表（后端没有课程搜索接口） */}
      {searchOpen && (
        <StickerField style={styles.searchBox} fill={C.white} radius={R.card}>
          <Feather name="search" size={14} color={inkA(0.45)} />
          <FieldInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索课名 / 教师 / 教室"
            placeholderTextColor={inkA(0.32)}
            style={styles.searchInput}
            autoFocus
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={6}>
              <Feather name="x" size={14} color={C.ink} />
            </Pressable>
          )}
        </StickerField>
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

            <View style={styles.weekCenter}>
              <Text style={styles.weekTitle}>第 {week} 周</Text>
              <Text style={styles.weekRange}>{weekRangeLabel(week, termStart)}</Text>
            </View>

            <Pressable onPress={() => setWeekOffset((o) => o + 1)} hitSlop={6}>
              <Sticker style={styles.weekBtn} fill={C.white} radius={R.pill} offset={SHADOW.sm}>
                <Text style={styles.weekBtnText}>下一周</Text>
                <Feather name="chevron-right" size={13} color={C.ink} />
              </Sticker>
            </Pressable>
          </View>

          {/* 翻走之后给一个「回到本周」出口 */}
          {weekOffset !== 0 && (
            <Pressable onPress={() => setWeekOffset(0)} style={styles.backToNowWrap}>
              <Sticker style={styles.backToNow} fill={C.ink} radius={R.pill} offset={SHADOW.sm}>
                <Text style={styles.backToNowText}>回到本周（第 {currentWeek} 周）</Text>
              </Sticker>
            </Pressable>
          )}

          {/*
            横向滚动容器：宽屏时内容刚好铺满（无滚动），窄屏/列数多时才出现滚动，
            滚动条隐藏（showsHorizontalScrollIndicator={false}）。
            表头与网格必须在同一个横向容器里，否则两者滚动不同步会列错位。

            ⚠️ 外层 View 负责在触摸期间锁住首页的横向分页器（PAGER_LOCK_PROPS）——
            同方向嵌套滚动时，pagingEnabled 的外层会抢走手势，用户一划就翻页。
            Android 另需 nestedScrollEnabled 才能把嵌套滚动交给内层。
          */}
          <View {...PAGER_LOCK_PROPS}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={needHScroll}
              style={styles.gridScroll}
              contentContainerStyle={styles.gridScrollContent}
            >
              <View style={{ width: gridW }}>
                {/* 星期表头（Day Header Row：gap 4，Day Cell 50 高，圆角 16） */}
                <View style={styles.dayRow}>
                  <View style={styles.monthBox}>
                    <Text style={styles.monthText}>
                      {days?.[0]?.date ? `${days[0].date.split('/')[0]}月` : ''}
                    </Text>
                  </View>
                  {weekdays.map((wd) => {
                    const day = days?.[wd - 1];
                    return (
                      <Sticker
                        key={wd}
                        wrapStyle={styles.dayCellWrap}
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
                    );
                  })}
                </View>

                {/* 课程网格（Grid Row：gap 4，行高 82，行距 6） */}
                <View style={styles.gridRow}>
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

                  {weekdays.map((wd) => (
                    <View key={wd} style={[styles.dayColumn, { height: gridH }]}>
                      {visibleBlocks
                        .filter((b) => b.weekday === wd)
                        .map((b, bi) => {
                          const t = toneOf(b.course.course_name);
                          const r0 = sectionRow(b.startSection);
                          const r1 = sectionRow(b.endSection);
                          const rowSpan = r1 - r0 + 1;
                          const isCustom = !!(b.course as any).__customId;
                          return (
                            <Sticker
                              key={`${b.weekday}-${b.startSection}-${bi}`}
                              wrapStyle={{
                                position: 'absolute',
                                top: (r0 - 1) * ROW_PITCH,
                                left: 0,
                                right: 0,
                              }}
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
                          );
                        })}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
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
 * 画布给了两种：白底 + 墨黑描边（搜索 / 设置）、墨黑实心 + 青柠图标（添加）。
 * 三者统一 12 圆角、2.5 硬投影，只靠填色区分 —— 一排按钮才不会歪。
 */
function IconBtn({
  name,
  variant = 'plain',
  active = false,
  disabled = false,
  onPress,
}: {
  name: 'search' | 'plus' | 'sliders';
  variant?: 'plain' | 'ink';
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const ink = variant === 'ink';
  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} hitSlop={4}>
      <Sticker
        style={styles.iconBtn}
        fill={ink ? C.ink : active ? C.lime : C.white}
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
    paddingBottom: 130, // 给悬浮导航栏留出空间
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

  // ===================== 搜索行 =====================
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    color: C.ink,
    paddingVertical: 0,
  },

  // ===================== 加载中 =====================
  loadingHint: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.gray,
    textAlign: 'center',
  },

  // ===================== 卡内小件 =====================
  previewLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: C.gray,
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
    color: C.gray,
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
    color: inkA(0.55),
  },
  backToNowWrap: {
    alignSelf: 'center',
  },
  backToNow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    gap: COL_GAP,
    height: DAY_H,
  },
  monthBox: {
    width: TIME_W,
    alignItems: 'center',
  },
  monthText: {
    fontSize: 10,
    fontWeight: '600',
    color: inkA(0.6),
  },
  dayCellWrap: {
    width: COL_W,
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
    color: inkA(0.5),
  },
  // 今天是青柠底，日期要比白色格子里更实一点（设计稿 opacity .75 vs .5）
  dayDateToday: {
    color: inkA(0.75),
  },

  // ===================== 课程网格（Grid Row） =====================
  gridScroll: {
    // 横向滚动容器不吃多余高度，避免把内容撑开
    flexGrow: 0,
  },
  gridScrollContent: {
    // 内容窄于容器时靠左，不做居中（居中会让左导轨离开屏幕边缘）
    flexGrow: 0,
  },
  gridRow: {
    flexDirection: 'row',
    gap: COL_GAP,
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
    color: inkA(0.45),
  },
  // 设计稿 Period End 用的是燕麦灰 #A8A394，不是半透明墨色
  periodEnd: {
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: -0.4,
    color: '#A8A394',
  },
  dayColumn: {
    width: COL_W,
  },

  // ===================== 课程卡（设计稿 Course Name / Course Meta） =====================
  cardName: {
    fontSize: 11,
    lineHeight: CARD_LINE_H,
    fontWeight: '700',
  },
  cardMeta: {
    gap: 0,
  },
  cardMetaText: {
    fontSize: 9,
    lineHeight: 12,
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
    color: inkA(0.5),
  },
  weekEmpty: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  weekEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.gray,
  },

  // ===================== 弹层表单 =====================
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: C.gray,
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
    color: C.gray,
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
    color: C.gray,
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
    color: C.gray,
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
