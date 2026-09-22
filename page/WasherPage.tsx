import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { LaundryDeviceVO } from '../api/contracts/campus';
import { LAUNDRY_STATE_TEXT, isDeviceFree, useLaundry } from '../hooks/useLaundry';
import LoadingCard from '../template/LoadingCard';
import PageHeader from '../template/PageHeader';
import StateCard from '../template/StateCard';
import Sticker from '../template/Sticker';
import SubPageShell from '../template/SubPageShell';
import { C, DISPLAY, inkA, R, SHADOW } from '../template/theme';

/**
 * 第 2 层页面：洗衣机查询
 *
 * 对应设计稿 32:135 —— 一整张青柠 Hero 卡压在奶油底上，卡内自上而下：
 *   页头（‹ BACK + 标题）→ 大数字统计 → 白色洗衣机状态卡 → 墨黑 CTA
 *
 * 数据：GET /laundry。
 *
 * ⚠️ 三个后端事实决定了这页能做什么、不能做什么：
 *   1. 需要登录；未绑定宿舍时返回 `NOT_BOUND / 请先绑定宿舍信息`，
 *      房间号非 3 位返回 `INVALID_PARAM / 房间号必须为3位数字`。
 *   2. 设备是**按绑定宿舍的楼栋 + 楼层过滤**的，所以这页是「我这一层的洗衣机」，
 *      不是全校列表 —— 标题与文案不能暗示可以看别的楼。
 *   3. 后端把上游设备对象裁成了 `{name, state, finishTime}`，**没有设备 ID**，
 *      所以「扫码启动 / 预约 / 单台刷新」一律做不了，CTA 只能是「刷新状态」。
 */

/** 只在这台设备真的给了结束时间时才显示，不做任何推算 */
function finishText(device: LaundryDeviceVO): string | null {
  const t = device.finishTime;
  if (typeof t === 'string' && t.trim()) return `预计 ${t.trim()} 结束`;
  return null;
}

export default function WasherPage() {
  const { status, devices, summary, error, refetch, isRefreshing } = useLaundry();

  // ===================== 非数据态：交给通用状态卡 =====================
  if (status !== 'ready') {
    return (
      <SubPageShell
        title="洗衣机查询"
        onRefresh={status === 'error' ? () => refetch() : undefined}
        refreshing={isRefreshing}
        refreshEnabled={status === 'error'}
      >
        {status === 'loading' && <LoadingCard label="正在查询本层洗衣机…" />}

        {status === 'guest' && (
          <StateCard
            tone="guest"
            icon={<Feather name="user-x" size={30} color={C.ink} />}
            title="登录后查看洗衣机"
            description="洗衣机按你绑定的宿舍楼层查询，需要先登录才能确定查哪一层。"
            primaryAction={{ label: '去登录', onPress: () => router.push('/login'), arrow: true }}
            link={{ label: '返回上一页', onPress: () => router.back() }}
          />
        )}

        {status === 'not_bound' && (
          <StateCard
            tone="not_bound"
            icon={<Feather name="home" size={30} color={C.ink} />}
            title="请先绑定宿舍信息"
            description="洗衣机列表按宿舍楼栋与房间楼层过滤，绑定后才知道显示哪一层。"
            primaryAction={{
              label: '去绑定宿舍',
              onPress: () => router.push('/dorm-bind'),
              arrow: true,
            }}
            link={{ label: '返回上一页', onPress: () => router.back() }}
          />
        )}

        {status === 'empty' && (
          <StateCard
            tone="empty"
            icon={<Feather name="inbox" size={30} color={C.ink} />}
            title="本层暂无可用洗衣机"
            description="你绑定宿舍所在的楼层没有查询到设备，可能是该楼栋尚未接入。"
            secondaryAction={{ label: '刷新', onPress: () => refetch() }}
          />
        )}

        {status === 'error' && (
          <StateCard
            tone="error"
            icon={<Feather name="alert-triangle" size={30} color={C.ink} />}
            title="洗衣机状态加载失败"
            description="上游洗衣机平台暂时没有响应，稍后再试一般就能恢复。"
            errorBar={{
              code: (error as { errorCode?: string } | null)?.errorCode ?? 'UPSTREAM_ERROR',
              message: error?.message ?? '洗衣服务暂不可用',
            }}
            primaryAction={{ label: '重新加载', onPress: () => refetch() }}
            link={{ label: '返回上一页', onPress: () => router.back() }}
          />
        )}
      </SubPageShell>
    );
  }

  // ===================== 有数据：设计稿 32:135 的青柠 Hero =====================
  const allFree = summary.freeCount === summary.total;
  const noneFree = summary.freeCount === 0;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Sticker fill={C.lime} radius={24} offset={SHADOW.xl} style={styles.hero}>
          {/* ===================== 页头 ===================== */}
          <PageHeader
            title="洗衣机查询"
            fg={C.ink}
            badgeBg={C.ink}
            badgeFg={C.lime}
            onBack={() => router.back()}
            backLeft
          />

          {/* ===================== 大数字统计 ===================== */}
          <View style={styles.heroStat}>
            <View style={styles.heroCountRow}>
              <Text style={styles.heroNumber}>{summary.total}</Text>
              <Text style={styles.heroUnit}>台洗衣机</Text>
            </View>

            <View style={styles.statusPill}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: noneFree ? C.ink : C.limeDeep },
                ]}
              />
              <Text style={styles.statusPillText}>
                {allFree ? '全部空闲' : noneFree ? '全部使用中' : `${summary.freeCount} 台空闲`}
              </Text>
            </View>

            <Text style={styles.heroCaption}>
              设备按你绑定的宿舍楼栋与楼层筛选 · {summary.busyCount} 台使用中
            </Text>
          </View>

          {/* ===================== 洗衣机状态卡 ===================== */}
          <View style={styles.statusCard}>
            <Text style={styles.statusCardTitle}>洗衣机状态</Text>
            <View style={styles.divider} />

            {devices.map((w, i) => {
              const free = isDeviceFree(w);
              const finish = finishText(w);
              return (
                <View key={`${w.name}-${i}`}>
                  <View style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Feather name="loader" size={18} color={C.ink} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLocation} numberOfLines={1}>
                        {w.name}
                      </Text>
                      {finish ? <Text style={styles.rowSub}>{finish}</Text> : null}
                    </View>
                    <View style={[styles.stateBadge, { backgroundColor: free ? C.lime : C.oat }]}>
                      <Text style={styles.stateBadgeText}>
                        {LAUNDRY_STATE_TEXT[w.state] ?? '使用中'}
                      </Text>
                    </View>
                  </View>
                  {i < devices.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>

          {/* ===================== CTA =====================
              只能刷新：后端没有给设备 ID，也没有洗衣的扫码/下单接口 */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.cta, isRefreshing && styles.ctaBusy]}
            onPress={() => refetch()}
            disabled={isRefreshing}
          >
            <Feather name="refresh-cw" size={16} color={C.lime} />
            <Text style={styles.ctaText}>{isRefreshing ? '刷新中…' : '刷新状态'}</Text>
          </TouchableOpacity>
        </Sticker>
      </ScrollView>
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
    padding: 20,
    gap: 16,
  },

  // ===================== 统计 =====================
  heroStat: {
    gap: 8,
  },
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroNumber: {
    fontFamily: DISPLAY,
    fontSize: 80,
    lineHeight: 88,
    color: C.ink,
    includeFontPadding: false,
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.white,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.limeDeep,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },
  heroCaption: {
    fontSize: 11,
    color: inkA(0.62),
  },

  // ===================== 状态卡 =====================
  statusCard: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    borderRadius: R.hero,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.ink,
  },
  statusCardTitle: {
    fontFamily: DISPLAY,
    fontSize: 18,
    color: C.ink,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: C.oat,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLocation: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  rowSub: {
    fontSize: 11,
    color: inkA(0.55),
  },
  stateBadge: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },

  // ===================== CTA =====================
  cta: {
    height: 48,
    borderRadius: 999,
    backgroundColor: C.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBusy: {
    opacity: 0.7,
  },
  ctaText: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.lime,
  },
});
