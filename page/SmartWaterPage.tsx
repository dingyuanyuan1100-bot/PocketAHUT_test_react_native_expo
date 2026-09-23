import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { WiseOrder } from '../api/contracts/wise';
import { useWiseOrders } from '../hooks/useWiseOrders';
import { useWiseScan } from '../hooks/useWiseScan';
import LoadingCard from '../template/LoadingCard';
import PageHeader from '../template/PageHeader';
import RevealGroup from '../template/RevealGroup';
import StateCard from '../template/StateCard';
import Sticker from '../template/Sticker';
import WiseScanCard from './WiseScanCard';
import { C, DISPLAY, inkA, R, SHADOW } from '../template/theme';

/**
 * 第 2 层页面：智慧用水 / 一码通
 *
 * 版面隐喻 = 「扫码即用」：整页奶油壳体（F3F0E8），中间压一块墨黑扫码面板（屏幕）。
 *
 * 数据：GET /wise/orders（当日订单，真实接口，裸数组）。
 *
 * ⚠️ 能力边界（后端源码 `Service.ensureSession` 确证，不要越界）：
 *   1. 订单依赖「先扫一次设备码」建立的会话；从未扫码时返回
 *      `UNAUTHORIZED / 请先扫码建立会话` —— 这是引导扫码，不是报错重试。
 *   2. 会话存在时还会校验 vpncas 绑定，未绑定返回 `NOT_BOUND / 未绑定智慧校园账号`。
 *   3. session 与 portal 缓存都是 **1 小时**（`sessionTTL` / `portalTTL`）。过期后
 *      服务端会拿缓存的 portal + idToken 自动重登录 88wise；一旦重登录失败，就返回
 *      `UPSTREAM_ERROR / 建立88wise会话失败` —— 此时**重试必然再失败**，
 *      唯一出路是重新扫码（`POST /wise/scan` 写入新 portal 并重建会话）。
 *   4. `/wise/pay` 会真实扣款、`/wise/ctrl` 会真实启停设备端口。
 *      本页**只做只读展示**，不代用户按支付按钮 —— 字段名虽已确证，
 *      但没有真实业务确认流程前不接。
 */

function money(n: number): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `¥${v.toFixed(2)}`;
}

/** createDate 是上游原文，可能带日期也可能带时分，原样展示不做解析 */
function shortTime(createDate: string): string {
  const s = (createDate ?? '').trim();
  if (!s) return '—';
  return s.length > 16 ? s.slice(11, 16) : s;
}

export default function SmartWaterPage() {
  const { status, needScan, needLogin, sessionLost, orders, error, refetch, isRefreshing } =
    useWiseOrders();
  const { scan, device, scanning, scanError, resetScan } = useWiseScan();

  const scrollRef = useRef<ScrollView>(null);
  /** 自增即请求扫码卡翻开（会话失效时从订单错误卡直接落到扫码） */
  const [scanSignal, setScanSignal] = useState(0);

  /** 未登录 / 未绑定智慧校园账号时，扫码无法建立会话，先锁定入口 */
  const canScan = status !== 'guest' && status !== 'not_bound';

  /** 会话失效时主行动：滚回顶部 + 翻开扫码卡 */
  const gotoScan = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setScanSignal((n) => n + 1);
  };

  /* TEMP PROBE — 截图验证用（#sessionlost），抓完必须整块删除 */
  const __F: string | null =
    typeof window !== 'undefined' ? (window.location.hash || '').replace('#', '') : null;
  const __LOST = __F === 'sessionlost';
  /* END TEMP PROBE */

  /** 今日真实出现过的场景名（来自订单，不是编的设备清单） */
  const scenes = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.sceneName) set.add(o.sceneName);
    return [...set];
  }, [orders]);

  const refreshing = isRefreshing;

  return (
    <View style={styles.page}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.shell, { backgroundColor: C.cream, borderRadius: R.menu }]}>
          <PageHeader
            title="智慧用水"
            fg={C.ink}
            badgeBg={C.ink}
            badgeFg={C.cream}
            onBack={() => router.back()}
            backLeft
          />

          {/* ===================== 连接设备（翻转扫码卡） ===================== */}
          <WiseScanCard
            canScan={canScan}
            device={device}
            scan={scan}
            scanning={scanning}
            scanError={scanError}
            resetScan={resetScan}
            onConnected={() => refetch()}
            openSignal={scanSignal}
            lockedNote={
              status === 'not_bound'
                ? '请先在登录页绑定智慧校园账号，再连接设备。'
                : '登录后即可连接设备并查看订单。'
            }
          />

          {/* ===================== 今日订单 ===================== */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>今日订单</Text>
            <TouchableOpacity
              style={styles.sectionLink}
              activeOpacity={0.7}
              onPress={() => refetch()}
              disabled={refreshing}
            >
              <Text style={styles.sectionLinkText}>{refreshing ? '刷新中…' : '刷新'}</Text>
              <Feather name="refresh-cw" size={13} color={inkA(0.5)} />
            </TouchableOpacity>
          </View>

          {status === 'loading' && <LoadingCard label="正在查询今日订单…" fill={false} />}

          {status === 'guest' && (
            <StateCard
              tone="guest"
              icon={<Feather name="user-x" size={30} color={C.ink} />}
              title="登录后查看订单"
              description="一码通订单与你的校园账号绑定，需要先登录才能查询。"
              primaryAction={{ label: '去登录', onPress: () => router.push('/login'), arrow: true }}
              link={{ label: '返回上一页', onPress: () => router.back() }}
            />
          )}

          {status === 'not_bound' && (
            <StateCard
              tone="not_bound"
              icon={<Feather name="link-2" size={30} color={C.ink} />}
              title="未绑定智慧校园账号"
              description="一码通订单要求已绑定智慧校园（vpncas）账号，绑定后才能建立会话。"
              primaryAction={{ label: '去绑定', onPress: () => router.push('/login'), arrow: true }}
              link={{ label: '返回上一页', onPress: () => router.back() }}
            />
          )}

          {/* 会话未建立：引导扫码，而不是给「重试」 */}
          {status === 'error' && needScan && (
            <StateCard
              tone="info"
              icon={<Feather name="maximize" size={30} color={C.ink} />}
              title="请先扫码建立会话"
              description="还没有扫过设备码，服务端无法确认你的会话。先扫一次设备上的二维码，再回来刷新。"
              primaryAction={{ label: '刷新订单', onPress: () => refetch() }}
              link={{ label: '返回上一页', onPress: () => router.back() }}
            />
          )}

          {/* 令牌过期：让用户去登录，而不是让他「重试」或「再扫一次码」 */}
          {status === 'error' && needLogin && (
            <StateCard
              tone="guest"
              icon={<Feather name="user-x" size={30} color={C.ink} />}
              title="登录已过期"
              description="一码通订单与你的校园账号绑定，需要重新登录后才能查询。"
              errorBar={{
                code: error?.errorCode ?? 'UNAUTHORIZED',
                message: error?.message ?? '未登录或登录已过期',
              }}
              primaryAction={{ label: '去登录', onPress: () => router.push('/login'), arrow: true }}
              link={{ label: '返回上一页', onPress: () => router.back() }}
            />
          )}

          {/* 会话已失效：重试一定再失败，必须重新扫码 */}
          {(__LOST || (status === 'error' && sessionLost)) && (
            <StateCard
              tone="error"
              icon={<Feather name="wifi-off" size={30} color={C.ink} />}
              title="设备会话已失效"
              description="一码通的会话和设备链接缓存都已过期（各 1 小时），服务端无法自动重建。重新扫一次设备码就能恢复，光点「重新加载」是没用的。"
              errorBar={{
                code: error?.errorCode ?? 'UPSTREAM_ERROR',
                message: error?.message ?? '建立88wise会话失败',
              }}
              primaryAction={{ label: '去重新扫码', onPress: gotoScan }}
              link={{ label: '返回上一页', onPress: () => router.back() }}
            />
          )}

          {status === 'error' && !needScan && !needLogin && !sessionLost && (
            <StateCard
              tone="error"
              icon={<Feather name="alert-triangle" size={30} color={C.ink} />}
              title="订单加载失败"
              description="一码通（88wise）上游本次没有正常返回，稍后重试一般可以恢复。"
              errorBar={{
                code: error?.errorCode ?? 'UPSTREAM_ERROR',
                message: error?.message ?? '查询订单失败',
              }}
              primaryAction={{ label: '重新加载', onPress: () => refetch() }}
              link={{ label: '返回上一页', onPress: () => router.back() }}
            />
          )}

          {status === 'empty' && (
            <Sticker fill={C.white} radius={R.card} offset={SHADOW.lg} style={styles.orderCard}>
              <View style={styles.emptyIcon}>
                <Feather name="inbox" size={20} color={inkA(0.5)} />
              </View>
              <Text style={styles.emptyText}>今日还没有用水订单</Text>
              <Text style={styles.emptySub}>扫码使用设备后，订单会出现在这里</Text>
            </Sticker>
          )}

          {status === 'ready' && (
            <View style={styles.orderList}>
              {/* 订单逐条落位；超过一屏的部分由 RevealGroup 的 maxStagger 收住 */}
              <RevealGroup>
                {orders.map((o) => (
                  <OrderRow key={o.serial || `${o.createDate}-${o.posName}`} order={o} />
                ))}
              </RevealGroup>
            </View>
          )}

          {/* ===================== 今日场景 =====================
               只列订单里真实出现过的场景，不预设「支持哪些设备」 */}
          {scenes.length > 0 && (
            <View style={styles.devices}>
              <Text style={styles.devicesLabel}>今日场景</Text>
              {scenes.map((s) => (
                <Sticker key={s} fill={C.white} radius={R.pill} offset={SHADOW.sm} style={styles.deviceChip}>
                  <Text style={styles.deviceChipText}>{s}</Text>
                </Sticker>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function OrderRow({ order }: { order: WiseOrder }) {
  const done = order.actualPay > 0;
  return (
    <Sticker fill={C.white} radius={R.card} offset={SHADOW.md} style={styles.orderRow}>
      <View style={styles.orderTop}>
        <View style={styles.orderScenePill}>
          <Text style={styles.orderSceneText}>{order.sceneName || '一码通'}</Text>
        </View>
        <Text style={styles.orderTime}>{shortTime(order.createDate)}</Text>
      </View>

      <Text style={styles.orderPos} numberOfLines={1}>
        {order.posName || '未知位置'}
      </Text>

      <View style={styles.orderFoot}>
        <Text style={[styles.orderState, done && styles.orderStateDone]}>{order.stateName}</Text>
        <View style={styles.orderMoney}>
          <Text style={styles.orderMoneyLabel}>实付</Text>
          <Text style={styles.orderMoneyValue}>{money(order.actualPay)}</Text>
          {order.prepay > 0 && order.prepay !== order.actualPay ? (
            <Text style={styles.orderPrepay}>预付 {money(order.prepay)}</Text>
          ) : null}
        </View>
      </View>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.cream,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  shell: {
    flex: 1,
    padding: 20,
    gap: 16,
  },

  // 今日订单
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: DISPLAY,
    fontSize: 18,
    color: C.ink,
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLinkText: {
    fontSize: 11,
    color: inkA(0.5),
  },
  orderList: {
    gap: 12,
  },
  orderRow: {
    padding: 16,
    gap: 8,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderScenePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.lime,
  },
  orderSceneText: {
    fontFamily: DISPLAY,
    fontSize: 11,
    color: C.ink,
  },
  orderTime: {
    fontSize: 11,
    color: inkA(0.55),
  },
  orderPos: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  orderFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  orderState: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gray,
  },
  orderStateDone: {
    color: C.ink,
  },
  orderMoney: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  orderMoneyLabel: {
    fontSize: 10,
    color: inkA(0.55),
  },
  orderMoneyValue: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.ink,
  },
  orderPrepay: {
    fontSize: 10,
    color: inkA(0.45),
  },

  orderCard: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: C.oat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: inkA(0.5),
  },
  emptySub: {
    fontSize: 11,
    color: inkA(0.4),
  },

  // 今日场景
  devices: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  devicesLabel: {
    fontSize: 11,
    color: inkA(0.62),
    marginRight: 2,
  },
  deviceChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  deviceChipText: {
    fontFamily: DISPLAY,
    fontSize: 11,
    color: C.ink,
  },
});
