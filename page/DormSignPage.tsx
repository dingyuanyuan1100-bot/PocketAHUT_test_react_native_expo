import { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import RevealGroup from '../template/RevealGroup';
import SubPageShell from '../template/SubPageShell';
import Sticker from '../template/Sticker';
import StateCard, { toErrorBar } from '../template/StateCard';
import StatusPill, { GuestPill } from '../template/StatusPill';
import LoadingCard from '../template/LoadingCard';
import LoadingShell from '../template/LoadingShell';
import { C, DISPLAY, R, SHADOW, inkA } from '../template/theme';
import { useDormSign, useDormSignRecords, useDormSignStatus, useDormTask } from '../hooks/useDormSign';
import type { DormSignRecord } from '../api/contracts/campus';

/**
 * 第 2 层页面：宿舍签到（晚寝打卡）。
 *
 * 版面隐喻 = 「贴纸印章」：奶油底 + 签到大卡 / 近 7 日卡两张贴纸压在上面。
 *
 * ⚠️ 这一屏原先是**纯前端占位**（楼栋「K3 楼」、房间「515」、周点阵、
 * 「21:00-23:00」、「21:04 签到」全是写死的）。现在全部换成真实接口：
 *   - `GET /dorm/task`         → 楼栋名 / 房间号
 *   - `GET /dorm/sign-status`  → 今日状态文案
 *   - `GET /dorm/sign-records` → 近 7 日点阵
 *   - `POST /dorm/sign`        → 签到（有副作用，失败走业务错误）
 *
 * 被删掉的两块是**没有接口支撑**的，不是忘了做：
 *   - 「签到开放 21:00 - 23:00」：后端没有任何时间窗字段，编一个会误导学生；
 *   - 「晚寝签到提醒」开关：订阅接口只有 electricity / grade 两类，
 *     没有 dorm 提醒，做出来就是一个点了没用的假开关。
 */

/** 近 7 日的点阵状态 */
type DotState = 'on' | 'off' | 'today';

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

/** 'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm:ss' → 'YYYY-M-D'，便于和记录里的日期做比较 */
function dayKeyOf(dateText: string | undefined | null): string {
  if (!dateText) return '';
  const m = String(dateText).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${Number(m[1])}-${Number(m[2])}-${Number(m[3])}` : '';
}

/**
 * 上游只给状态文案（如「已签到」「未签到」），没有枚举。
 * 是否「已签」按文案里有没有「已签」判断 —— 这是唯一必须做的语义判断，
 * 其余一律原样显示上游文案，不自己造枚举。
 */
function isSignedText(text: string | undefined): boolean {
  return !!text && text.includes('已签');
}

export default function DormSignPage() {
  const taskQ = useDormTask();
  const statusQ = useDormSignStatus();
  const recordsQ = useDormSignRecords();
  const signMutation = useDormSign();

  const task = taskQ.task;
  const todayName = statusQ.signStatus?.signStatusName ?? '';
  const signedToday = isSignedText(todayName);

  /**
   * 近 7 日点阵：以**今天**为锚点回推 6 天，逐日去记录里找。
   *
   * 后端记录没有「补齐未签到日」的保证（可能只返回有记录的日子），
   * 所以找不到的日子一律算 off，绝不拿前后日期去推断。
   */
  const week = useMemo(() => {
    const byDate = new Map<string, DormSignRecord>();
    for (const r of recordsQ.records ?? []) {
      const k = dayKeyOf(r.signDate);
      if (k && !byDate.has(k)) byDate.set(k, r);
    }

    const today = new Date();
    const out: { label: string; state: DotState; text: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const rec = byDate.get(key);
      const isToday = i === 0;
      // 周一=0 → WEEK_LABELS 从「一」开始
      const label = WEEK_LABELS[(d.getDay() + 6) % 7];

      if (rec) {
        out.push({ label, state: isSignedText(rec.signStatusName) ? 'on' : 'off', text: rec.signStatusName });
      } else {
        out.push({ label, state: isToday ? 'today' : 'off', text: isToday ? '今日' : '未签' });
      }
    }
    return out;
  }, [recordsQ.records]);

  const goBind = () => router.push('/login');

  // ===================== 未登录 =====================
  if (taskQ.status === 'guest') {
    return (
      <SubPageShell title="宿舍签到" statusPill={<GuestPill />}>
        <StateCard
          tone="guest"
          icon={<Feather name="moon" size={34} color={C.ink} />}
          title="登录后查看宿舍签到"
          description={'晚寝打卡来自学校晚寝系统\n登录并绑定后，可查看签到状态与近 7 日记录'}
          primaryAction={{ label: '立即登录', onPress: goBind }}
          link={{ label: '还没有账号？立即注册', onPress: goBind }}
        />
      </SubPageShell>
    );
  }

  // ===================== 已登录 · 未绑定宿舍 =====================
  if (taskQ.status === 'not_bound') {
    return (
      <SubPageShell title="宿舍签到" statusPill={<StatusPill label="未绑定" />}>
        <StateCard
          tone="not_bound"
          icon={<Feather name="moon" size={30} color={C.ink} />}
          title="绑定晚寝账号后打卡"
          description={'签到需要晚寝系统的身份凭据\n绑定后自动读取你的楼栋与房间'}
          primaryAction={{ label: '立即绑定', onPress: goBind, arrow: true }}
          link={{ label: '可在「我的 → 账号绑定」中管理', onPress: goBind }}
        />
      </SubPageShell>
    );
  }

  // ===================== 加载中 =====================
  if (taskQ.status === 'loading') {
    return (
      <SubPageShell title="宿舍签到" statusPill={<StatusPill label="同步中" />} refreshEnabled={false}>
        <LoadingShell>
          <LoadingCard label="正在读取宿舍信息…" />
        </LoadingShell>
      </SubPageShell>
    );
  }

  // ===================== 加载失败 =====================
  if (taskQ.status === 'error') {
    return (
      <SubPageShell title="宿舍签到" statusPill={<StatusPill label="加载失败" />}>
        <StateCard
          tone="error"
          icon={<Feather name="alert-circle" size={34} color={C.ink} />}
          title="宿舍信息加载失败"
          description="可能是晚寝系统繁忙或网络异常"
          errorBar={toErrorBar(taskQ.error)}
          primaryAction={{ label: '重新加载', onPress: () => void taskQ.refetch() }}
        />
      </SubPageShell>
    );
  }

  const onSign = () => {
    if (signedToday || signMutation.isPending) return;
    signMutation.mutate(undefined, {
      onSuccess: (msg) => {
        // 后端把上游的 msg 透出来（如「签到成功」）；为空时给个中性兜底
        Alert.alert('签到成功', typeof msg === 'string' && msg ? msg : '已完成今日晚寝签到');
      },
      onError: (err) => {
        const message =
          typeof err === 'object' && err && 'message' in err
            ? String((err as { message?: string }).message ?? '')
            : '';
        Alert.alert('签到失败', message || '晚寝系统未返回结果，请稍后重试。');
      },
    });
  };

  return (
    <SubPageShell
      title="宿舍签到"
      statusPill={<StatusPill label={signedToday ? '已签到' : '未签到'} />}
      onRefresh={() => {
        void taskQ.refetch();
        void statusQ.refetch();
        void recordsQ.refetch();
      }}
      refreshing={taskQ.isRefreshing || statusQ.isRefreshing || recordsQ.isRefreshing}
    >
      <RevealGroup>
        <SignCard
          dormName={task?.dormName || task?.dormNo || '—'}
          roomNo={task?.roomNo || '—'}
          statusText={todayName || '未签到'}
          signed={signedToday}
          pending={signMutation.isPending}
          onSign={onSign}
        />
        <WeekCard week={week} />
      </RevealGroup>
    </SubPageShell>
  );
}

// ===================== 签到大卡 =====================

function SignCard({
  dormName,
  roomNo,
  statusText,
  signed,
  pending,
  onSign,
}: {
  dormName: string;
  roomNo: string;
  statusText: string;
  signed: boolean;
  pending: boolean;
  onSign: () => void;
}) {
  return (
    <Sticker
      fill={C.white}
      radius={R.menu}
      offset={SHADOW.xl}
      shadowColor={C.limeDeep}
      wrapStyle={styles.signCardWrap}
      style={styles.signCard}
    >
      {/* 状态徽章：文案直接取 /dorm/sign-status 的 signStatusName */}
      <Sticker fill={signed ? C.lime : C.oat} radius={R.pill} offset={0} border={0} wrapStyle={styles.badgeWrap} style={styles.badge}>
        <Text style={styles.badgeText}>{statusText}</Text>
      </Sticker>

      {/* 楼栋 / 房间：来自 /dorm/task */}
      <View style={styles.stickerRow}>
        <Sticker fill={C.white} radius={R.stat} offset={0} wrapStyle={styles.infoStickerWrap} style={styles.infoSticker}>
          <Text style={styles.infoLabel}>楼栋</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {dormName}
          </Text>
        </Sticker>
        <Sticker
          fill={C.lime}
          radius={R.stat}
          offset={0}
          border={0}
          wrapStyle={[styles.infoStickerWrap, styles.infoStickerLime]}
          style={styles.infoSticker}
        >
          <Text style={styles.infoLabel}>房间</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {roomNo}
          </Text>
        </Sticker>
      </View>

      <View style={styles.divider} />

      {/* 位置提示。/dorm/task 里有 locationLat / locationLng，说明上游是定位核验的 */}
      <View style={styles.rangePill}>
        <Feather name="target" size={14} color={C.ink} />
        <Text style={styles.rangeText}>请在学校核验范围内签到</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onSign}
        disabled={signed || pending}
        style={styles.ctaWrap}
      >
        <Sticker
          fill={signed ? C.oat : C.lime}
          radius={R.pill}
          offset={0}
          style={styles.cta}
        >
          <Text style={[styles.ctaText, signed && styles.ctaTextDone]}>
            {pending ? '签到中…' : signed ? '今日已签到' : '立即签到'}
          </Text>
        </Sticker>
      </TouchableOpacity>
    </Sticker>
  );
}

// ===================== 最近 7 天 =====================

function WeekCard({ week }: { week: { label: string; state: DotState; text: string }[] }) {
  return (
    <Sticker fill={C.white} radius={R.hero} offset={SHADOW.lg} wrapStyle={styles.weekCardWrap} style={styles.weekCard}>
      <View style={styles.weekHead}>
        <Text style={styles.weekTitle}>最近 7 天</Text>
        <Text style={styles.weekNote}>数据来自晚寝系统</Text>
      </View>

      <View style={styles.dotsRow}>
        {week.map((d, i) => (
          <View key={`${d.label}-${i}`} style={styles.dayCol}>
            <View
              style={[
                styles.dot,
                d.state === 'on' && styles.dotOn,
                d.state === 'off' && styles.dotOff,
                d.state === 'today' && styles.dotToday,
              ]}
            >
              {d.state === 'on' && <Feather name="check" size={14} color={C.ink} />}
            </View>
            <Text style={[styles.dayLabel, d.state === 'today' && styles.dayLabelToday]}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.weekFoot}>{`仅返回日期与状态，不提供具体签到时刻`}</Text>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  // 签到大卡
  signCardWrap: {
    marginTop: 8,
  },
  signCard: {
    padding: 16,
    alignItems: 'flex-start',
  },
  badgeWrap: {
    alignSelf: 'flex-start',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: DISPLAY,
    fontSize: 10,
    color: C.ink,
  },
  stickerRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
    marginTop: 24,
  },
  infoStickerWrap: {
    flex: 1,
    height: 84,
  },
  infoStickerLime: {
    marginTop: -5,
  },
  infoSticker: {
    height: '100%',
    paddingHorizontal: 14,
    paddingTop: 13,
    justifyContent: 'flex-start',
  },
  infoLabel: {
    fontSize: 11,
    color: inkA(0.62),
  },
  infoValue: {
    fontFamily: DISPLAY,
    fontSize: 24,
    color: C.ink,
    marginTop: 6,
  },
  divider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: C.oat,
    marginTop: 18,
  },
  rangePill: {
    alignSelf: 'stretch',
    height: 34,
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: C.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rangeText: {
    fontSize: 12,
    color: inkA(0.62),
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: 14,
  },
  cta: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: DISPLAY,
    fontSize: 18,
    color: C.ink,
  },
  ctaTextDone: {
    color: inkA(0.55),
  },

  // 最近 7 天
  weekCardWrap: {
    marginTop: 16,
  },
  weekCard: {
    padding: 18,
  },
  weekHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekTitle: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.ink,
  },
  weekNote: {
    fontSize: 11,
    color: inkA(0.55),
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  dayCol: {
    width: 32,
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: {
    backgroundColor: C.lime,
    borderWidth: 2,
    borderColor: C.ink,
  },
  dotOff: {
    backgroundColor: C.oat,
  },
  dotToday: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
  },
  dayLabel: {
    fontSize: 11,
    color: inkA(0.55),
  },
  dayLabelToday: {
    color: C.ink,
    fontWeight: '700',
  },
  weekFoot: {
    marginTop: 12,
    fontSize: 10.5,
    lineHeight: 15,
    color: inkA(0.45),
  },
});
