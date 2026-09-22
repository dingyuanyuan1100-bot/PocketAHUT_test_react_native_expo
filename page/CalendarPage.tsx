import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import PageHeader from '../template/PageHeader';
import Sticker from '../template/Sticker';
import BottomDrawer from '../template/motion/BottomDrawer';
import { C, DISPLAY, inkA, R, SHADOW } from '../template/theme';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { CalendarEvent } from '../api/contracts';

/**
 * 第 2 层页面：校历
 *
 * 对应设计稿 Frame 14（Ardot 56:395）—— 一整张青柠 Hero 卡，卡内自上而下：
 *   页头 → 月份条（X月 + 筛选）→ 月历卡（含节假日标签 + 图例）→ 当日日程卡
 * 另含设计稿里的「年月选择」底部抽屉（贴底 + 弹簧入场/出场 + 遮罩淡入淡出 + 手柄下拉关闭）。
 *
 * 与旧版差异：
 *   - 年月选择由 Modal(fade) 改为 reanimated 真·底部抽屉：贴最底、滑入/滑出带弹簧、遮罩透明度过渡。
 *   - 月历按真实日历推算（首格星期 + 当月天数 + 上下月补位），不再写死。
 *   - 节假日改为「白格内小标签」（开学/中秋/国庆/调休），与设计稿一致；
 *     仅「选中」格反白为青柠底，不再把节假日画成墨黑反白格。
 *   - 日期可点选，选中态联动当日日程卡的日期头。
 */

const WEEK_HEAD = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_NAME = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 日历网格单元：携带绝对年月日，便于与后端校历活动按日期精确匹配
 * （含上下月补位，muted 标记非本月）
 */
type Cell = { year: number; month: number; day: number; muted: boolean };

/** 生成某年某月的 6 周 × 7 格网格（含上下月补位，muted 标记） */
function buildWeeks(year: number, month: number): Cell[][] {
  const first = new Date(year, month - 1, 1);
  const lead = first.getDay();                       // 1 号星期几（0=日）
  const days = new Date(year, month, 0).getDate();   // 当月天数
  const prevDays = new Date(year, month - 1, 0).getDate(); // 上月天数
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    if (i < lead) {
      const pm = month === 1 ? 12 : month - 1;
      const py = month === 1 ? year - 1 : year;
      cells.push({ year: py, month: pm, day: prevDays - lead + 1 + i, muted: true });
    } else if (i < lead + days) {
      cells.push({ year, month, day: i - lead + 1, muted: false });
    } else {
      const nm = month === 12 ? 1 : month + 1;
      const ny = month === 12 ? year + 1 : year;
      cells.push({ year: ny, month: nm, day: i - lead - days + 1, muted: true });
    }
  }
  const weeks: Cell[][] = [];
  for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
  return weeks;
}

// 注：「当日日程（课表）」暂无对应后端接口，待 jwxt 课表模块接入；
// 当前「当日校历卡」展示的是后端 /calendar 的校历活动（开学/中秋/国庆等）。

const LEGEND = [
  { label: '选中', color: C.lime },
  { label: '校历', color: C.ink },
  { label: '非本月', color: C.cream },
];

const YEARS = [2025, 2026, 2027];

// ===================== 年月选择内容（纯展示，动画/手势/遮罩由 BottomDrawer 托管） =====================
type PickerProps = {
  initialYear: number;
  initialMonth: number;
  onClose: () => void;
  onConfirm: (y: number, m: number) => void;
};

function YearMonthPicker({ initialYear, initialMonth, onClose, onConfirm }: PickerProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  return (
    <View>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>选择年月</Text>
        <TouchableOpacity activeOpacity={0.8} style={styles.closeBtn} onPress={onClose}>
          <Feather name="x" size={16} color={C.ink} />
        </TouchableOpacity>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>年份</Text>
        <View style={styles.yearRow}>
          {YEARS.map((y) => {
            const on = y === year;
            return (
              <TouchableOpacity
                key={y}
                activeOpacity={0.8}
                onPress={() => setYear(y)}
                style={[styles.yearChip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>月份</Text>
        <View style={styles.monthGrid}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const on = m === month;
            return (
              <TouchableOpacity
                key={m}
                activeOpacity={0.8}
                onPress={() => setMonth(m)}
                style={[styles.monthChip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{m}月</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.sheetDivider} />

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={0.85} style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={styles.confirmBtn} onPress={() => onConfirm(year, month)}>
          <Text style={styles.confirmText}>确定</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===================== 校历页 =====================
export default function CalendarPage() {
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(9);            // 1-12
  const [selectedKey, setSelectedKey] = useState('2026-9-11');
  const [pickerOpen, setPickerOpen] = useState(false);

  // —— 真实校历数据（后端 GET /calendar，react-query 托管缓存/重试/loading）——
  const { data: events = [], isLoading } = useCalendarEvents();

  // 把跨天区间的校历活动按日期展开：dateKey -> 标签列表 / 活动列表
  const { labelsByDate, eventsByDate } = useMemo(() => {
    const labels = new Map<string, string[]>();
    const detail = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const start = new Date(ev.start_date + 'T00:00:00');
      const end = new Date(ev.end_date + 'T00:00:00');
      for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const key = `${cur.getFullYear()}-${cur.getMonth() + 1}-${cur.getDate()}`;
        const l = labels.get(key) ?? [];
        l.push(ev.title);
        labels.set(key, l);
        const d = detail.get(key) ?? [];
        d.push(ev);
        detail.set(key, d);
      }
    }
    return { labelsByDate: labels, eventsByDate: detail };
  }, [events]);

  const weeks = buildWeeks(viewYear, viewMonth);
  const [sy, sm, sd] = selectedKey.split('-').map(Number);
  const detailDate = new Date(sy, sm - 1, sd);
  const detailText = `${sy}.${sm}.${sd} ${WEEKDAY_NAME[detailDate.getDay()]}`;
  const selectedEvents = eventsByDate.get(selectedKey) ?? [];

  const openPicker = () => setPickerOpen(true);
  const confirmPicker = (y: number, m: number) => {
    setViewYear(y);
    setViewMonth(m);
    setPickerOpen(false);
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Sticker fill={C.lime} radius={R.hero} offset={SHADOW.xl} style={styles.hero}>
          {/* ===================== 页头 ===================== */}
          <PageHeader
            title="校历"
            fg={C.ink}
            badgeBg={C.ink}
            badgeFg={C.lime}
            onBack={() => router.back()}
            backLeft
          />

          {/* ===================== 月份条 ===================== */}
          <View style={styles.monthBar}>
            <Text style={styles.monthTitle}>{viewMonth}月</Text>
            <TouchableOpacity activeOpacity={0.8} style={styles.filterBtn} onPress={openPicker}>
              <Feather name="sliders" size={16} color={C.ink} />
            </TouchableOpacity>
          </View>

          {/* ===================== 月历卡 ===================== */}
          <View style={styles.calendarCard}>
            <View style={styles.weekRow}>
              {WEEK_HEAD.map((h) => (
                <Text key={h} style={styles.weekCell}>
                  {h}
                </Text>
              ))}
            </View>

            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((cell, ci) => {
                  const cellKey = `${cell.year}-${cell.month}-${cell.day}`;
                  const isSel = !cell.muted && selectedKey === `${viewYear}-${viewMonth}-${cell.day}`;
                  const label = cell.muted ? null : (labelsByDate.get(cellKey)?.join(' / ') ?? null);
                  const bg = cell.muted ? C.cream : isSel ? C.lime : C.white;
                  const fg = cell.muted ? inkA(0.35) : C.ink;
                  const bordered = !cell.muted && isSel;
                  return (
                    <View key={ci} style={styles.dayCell}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={cell.muted}
                        onPress={() => !cell.muted && setSelectedKey(`${viewYear}-${viewMonth}-${cell.day}`)}
                        style={[
                          styles.dayBox,
                          { backgroundColor: bg, borderColor: C.ink, borderWidth: bordered ? 2 : 0 },
                        ]}
                      >
                        <Text style={[styles.dayText, { color: fg }]}>{cell.day}</Text>
                        {label && (
                          <Text style={[styles.dayLabel, { color: cell.muted ? inkA(0.35) : inkA(0.7) }]}>
                            {label}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}

            <View style={styles.legend}>
              {LEGEND.map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      {
                        backgroundColor: l.color,
                        borderColor: l.color === C.cream ? inkA(0.35) : C.ink,
                        borderWidth: l.color === C.cream ? 1 : 0,
                      },
                    ]}
                  />
                  <Text style={styles.legendLabel}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ===================== 当日日程卡 ===================== */}
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailDate}>{detailText}</Text>
              <TouchableOpacity activeOpacity={0.8} style={styles.addBtn}>
                <Feather name="plus" size={16} color={C.ink} />
              </TouchableOpacity>
            </View>

            {selectedEvents.length > 0 ? (
              <View style={styles.eventList}>
                {selectedEvents.map((ev) => (
                  <View key={ev.id} style={styles.eventRow}>
                    <View style={styles.timeCol}>
                      <Text style={styles.eventTime}>{ev.start_date.slice(5)}</Text>
                      <View style={[styles.eventDot, { backgroundColor: C.lime }]} />
                    </View>
                    <View style={styles.eventCard}>
                      <Text style={styles.eventTitle}>{ev.title}</Text>
                      <Text style={styles.eventPlace}>{`${ev.start_date} 至 ${ev.end_date}`}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {isLoading ? '校历加载中…' : '当日暂无校历安排'}
              </Text>
            )}
          </View>
        </Sticker>
      </ScrollView>

      {/* ===================== 年月选择底部抽屉（通用 BottomDrawer：贴底+弹簧入场+遮罩淡入+下拉关闭） ===================== */}
      <BottomDrawer open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <YearMonthPicker
          initialYear={viewYear}
          initialMonth={viewMonth}
          onClose={() => setPickerOpen(false)}
          onConfirm={confirmPicker}
        />
      </BottomDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.cream,
  },
  scroll: {
    padding: 12,
  },
  hero: {
    padding: 16,
    gap: 12,
  },

  // ===================== 月份条 =====================
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontFamily: DISPLAY,
    fontSize: 36,
    lineHeight: 42,
    color: C.ink,
    includeFontPadding: false,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===================== 月历卡 =====================
  calendarCard: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 2,
  },
  weekCell: {
    flex: 1,
    height: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 11,
    color: inkA(0.55),
    includeFontPadding: false,
  },
  dayCell: {
    flex: 1,
  },
  dayBox: {
    height: 42,
    margin: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  dayLabel: {
    fontSize: 8,
    fontWeight: '700',
    includeFontPadding: false,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    height: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: C.ink,
  },

  // ===================== 日程卡 =====================
  detailCard: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderRadius: R.card,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
    gap: 16,
  },
  detailHeader: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailDate: {
    fontFamily: DISPLAY,
    fontSize: 18,
    color: C.ink,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventList: {
    gap: 12,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeCol: {
    width: 40,
    alignItems: 'center',
    gap: 4,
  },
  eventTime: {
    fontSize: 11,
    fontWeight: '700',
    color: C.ink,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
    gap: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  eventPlace: {
    fontSize: 11,
    color: '#6B675F',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B675F',
    paddingVertical: 8,
  },

  // ===================== 年月选择抽屉（样式由 BottomDrawer 托管，以下仅内容区） =====================
  panelHeader: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    fontFamily: DISPLAY,
    fontSize: 20,
    color: C.ink,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: C.cream,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    gap: 8,
  },
  blockLabel: {
    fontSize: 11,
    color: inkA(0.55),
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    height: 40,
  },
  yearChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    width: '23%',
    height: 40,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: C.ink,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  chipTextOn: {
    color: C.lime,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: C.oat,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    height: 48,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.lime,
  },
});
