import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import SubPageShell from '../template/SubPageShell';
import StateCard, { toErrorBar } from '../template/StateCard';
import StatusPill, { GuestPill } from '../template/StatusPill';
import Chip from '../template/Chip';
import Sticker from '../template/Sticker';
import LoadingCard from '../template/LoadingCard';
import LoadingShell from '../template/LoadingShell';
import { C, DISPLAY, R, SHADOW, inkA } from '../template/theme';
import {
  useChargeOrderStatus,
  useCreateChargeOrder,
  useDormBinding,
  useElectricityBalance,
} from '../hooks/useElectricity';
import {
  CHARGE_TYPE_AIR,
  CHARGE_TYPE_ROOM,
  type ChargeType,
  type CreateChargeOrderResult,
} from '../api/contracts/campus';

/** 充值档位（元）。后端约束 0 < amount <= 500，这里只给合规档位，不开放自由输入 */
const AMOUNTS = [10, 20, 50, 100, 200, 500];

export default function ElectricityPage() {
  const balanceQ = useElectricityBalance();
  const bindingQ = useDormBinding();
  const [type, setType] = useState<ChargeType>(CHARGE_TYPE_ROOM);
  const [amount, setAmount] = useState(50);

  const createOrder = useCreateChargeOrder();
  const [pendingOrder, setPendingOrder] = useState<CreateChargeOrderResult | null>(null);

  const status = balanceQ.status;

  const statusPill =
    status === 'guest' ? (
      <GuestPill />
    ) : status === 'not_bound' ? (
      <StatusPill label="未绑定宿舍" />
    ) : status === 'loading' ? (
      <StatusPill label="查询中" />
    ) : status === 'error' ? (
      <StatusPill label="加载失败" />
    ) : (
      <StatusPill label="已绑定" />
    );

  const submitOrder = () => {
    Alert.alert(
      '确认充值',
      `将为${type === CHARGE_TYPE_AIR ? '空调' : '房间照明'}充值 ¥${amount}，` +
        `随后跳转微信支付。请确认房间号无误 —— 电费充错房间无法自助退款。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '生成订单',
          onPress: () => {
            createOrder.mutate(
              { amount, type },
              { onSuccess: (order) => setPendingOrder(order) },
            );
          },
        },
      ],
    );
  };

  return (
    <SubPageShell
      title="电费"
      statusPill={statusPill}
      onRefresh={() => {
        void balanceQ.refetch();
        void bindingQ.refetch();
      }}
      refreshing={balanceQ.isRefreshing}
      refreshEnabled={status === 'ready' || status === 'error'}
    >
      {status === 'loading' && (
        <LoadingShell>
          <LoadingCard label="正在查询电费余额…" />
        </LoadingShell>
      )}

      {status === 'guest' && (
        <StateCard
          tone="guest"
          icon={<Feather name="zap" size={34} color={C.ink} />}
          title="登录后查询电费"
          description={'电费按宿舍房间查询\n登录并绑定宿舍后即可查看余额与充值'}
          primaryAction={{ label: '立即登录', onPress: () => router.push('/login') }}
        />
      )}

      {/*
        未绑定宿舍 —— 后端在缺绑定时返回 NOT_BOUND +「请先绑定宿舍信息」。
        这里直接显示后端原文，而不是自己编一句文案，保证口径一致。
      */}
      {status === 'not_bound' && (
        <StateCard
          tone="not_bound"
          icon={<Feather name="home" size={30} color={C.ink} />}
          bang
          title="先绑定宿舍房间"
          description={
            balanceQ.error?.message ??
            '电费按房间计量，需要先绑定宿舍信息\n绑定后即可查看空调与照明余额'
          }
          primaryAction={{
            label: '去绑定宿舍',
            onPress: () => router.push('/dorm-bind'),
            arrow: true,
          }}
        />
      )}

      {status === 'error' && (
        <StateCard
          tone="error"
          icon={<Feather name="alert-circle" size={34} color={C.ink} />}
          bang
          title="电费查询失败"
          description="可能是缴费平台繁忙或网络异常"
          errorBar={toErrorBar(balanceQ.error)}
          primaryAction={{ label: '重新查询', onPress: () => void balanceQ.refetch() }}
        />
      )}

      {status === 'ready' && balanceQ.balance && (
        <>
          <View style={styles.roomRow}>
            <Sticker style={styles.roomChip} fill={C.oat} radius={999} offset={0}>
              <Feather name="home" size={12} color={C.ink} />
              <Text style={styles.roomText}>
                {bindingQ.binding
                  ? `${bindingQ.binding.xiaoqu} · ${bindingQ.binding.ld_id} 栋 · ${bindingQ.binding.room_no} 室`
                  : '已绑定房间'}
              </Text>
            </Sticker>
            <Pressable onPress={() => router.push('/dorm-bind')} hitSlop={8}>
              <Text style={styles.changeRoom}>更换</Text>
            </Pressable>
          </View>

          <View style={styles.meterRow}>
            <MeterCard
              label="空调"
              value={balanceQ.balance.air_remain_amp}
              icon="wind"
              fill={C.ink}
              valueColor={C.lime}
            />
            <MeterCard
              label="房间照明"
              value={balanceQ.balance.room_remain_amp}
              icon="sun"
              fill={C.white}
              valueColor={C.ink}
            />
          </View>

          <Sticker style={styles.chargeCard} fill={C.white} radius={R.menu} offset={SHADOW.xl}>
            <Text style={styles.chargeTitle}>电费充值</Text>

            <Text style={styles.fieldLabel}>充值类型</Text>
            <View style={styles.chipRow}>
              <Chip
                label="房间照明"
                active={type === CHARGE_TYPE_ROOM}
                onPress={() => setType(CHARGE_TYPE_ROOM)}
              />
              <Chip
                label="空调"
                active={type === CHARGE_TYPE_AIR}
                onPress={() => setType(CHARGE_TYPE_AIR)}
              />
            </View>

            <Text style={styles.fieldLabel}>充值金额</Text>
            <View style={styles.chipRow}>
              {AMOUNTS.map((a) => (
                <Chip
                  key={a}
                  label={`¥${a}`}
                  active={amount === a}
                  onPress={() => setAmount(a)}
                />
              ))}
            </View>

            <Pressable
              onPress={submitOrder}
              disabled={createOrder.isPending}
              style={styles.ctaWrap}
            >
              <Sticker style={styles.cta} fill={C.ink} radius={999} offset={SHADOW.lg}>
                {createOrder.isPending ? (
                  <ActivityIndicator color={C.lime} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>生成支付订单</Text>
                    <Feather name="arrow-right" size={18} color={C.lime} />
                  </>
                )}
              </Sticker>
            </Pressable>

            {createOrder.isError && (
              <View style={styles.warnBar}>
                <Feather name="alert-triangle" size={13} color={C.ink} />
                <Text style={styles.warnText}>
                  下单未完成。若提示「上游操作结果未知」，请勿重复下单 ——
                  先下拉刷新余额确认是否已到账。
                </Text>
              </View>
            )}

            <Text style={styles.chargeFoot}>
              单笔限额 0 ~ 500 元。充值前请确认房间号，电费充错房间无法自助退款。
            </Text>
          </Sticker>
        </>
      )}

      <PayOrderSheet order={pendingOrder} onClose={() => setPendingOrder(null)} />
    </SubPageShell>
  );
}

// ===================== 电表卡 =====================

function MeterCard({
  label,
  value,
  icon,
  fill,
  valueColor,
}: {
  label: string;
  value: number;
  icon: 'wind' | 'sun';
  fill: string;
  valueColor: string;
}) {
  const isDark = fill === C.ink;
  // 低于 20 度给一个弱提示；不写具体阈值文案，避免暗示平台规则
  const low = value <= 20;

  return (
    <Sticker
      style={styles.meterCard}
      wrapStyle={styles.meterWrap}
      fill={fill}
      radius={R.menu}
      offset={SHADOW.xl}
    >
      <View style={styles.meterHead}>
        <Feather name={icon} size={14} color={isDark ? C.lime : C.ink} />
        <Text style={[styles.meterLabel, isDark && styles.meterLabelDark]}>{label}</Text>
        {low && (
          <View style={[styles.lowTag, isDark && styles.lowTagDark]}>
            <Text style={[styles.lowTagText, isDark && styles.lowTagTextDark]}>偏低</Text>
          </View>
        )}
      </View>

      <Text style={[styles.meterValue, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {Number.isFinite(value) ? value.toFixed(1) : '—'}
      </Text>
      <Text style={[styles.meterUnit, isDark && styles.meterUnitDark]}>度</Text>
    </Sticker>
  );
}

// ===================== 支付订单弹层 =====================

function PayOrderSheet({
  order,
  onClose,
}: {
  order: CreateChargeOrderResult | null;
  onClose: () => void;
}) {
  const orderNo = order?.order_no ?? null;
  const statusQ = useChargeOrderStatus(orderNo);
  const paid = statusQ.data?.paid ?? false;

  const openWechat = async () => {
    if (!order?.wechat_pay_url) return;
    try {
      await Linking.openURL(order.wechat_pay_url);
    } catch {
      Alert.alert('无法唤起微信', '请复制支付链接后手动打开。');
    }
  };

  return (
    <Modal visible={!!order} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetWrap}>
          <Sticker style={styles.sheet} fill={C.white} radius={R.menu} offset={SHADOW.xl}>
            <View style={styles.sheetHead}>
              <View style={[styles.sheetIcon, { backgroundColor: paid ? C.lime : C.ink }]}>
                <Feather
                  name={paid ? 'check' : 'smartphone'}
                  size={20}
                  color={paid ? C.ink : C.lime}
                />
              </View>
              <Text style={styles.sheetTitle}>{paid ? '支付成功' : '等待支付'}</Text>
              <Text style={styles.sheetSub}>
                {paid ? '余额稍后到账，可下拉刷新查看' : '请在微信中完成支付'}
              </Text>
            </View>

            <View style={styles.orderRows}>
              <OrderRow label="充值金额" value={order ? `¥${order.amount}` : '—'} strong />
              <OrderRow label="订单号" value={order?.order_no ?? '—'} />
              <OrderRow
                label="订单状态"
                value={paid ? '已支付' : statusQ.data ? '等待支付' : '查询中…'}
              />
            </View>

            {!paid && (
              <View style={styles.timerRow}>
                <ActivityIndicator size="small" color={C.gray} />
                <Text style={styles.timerText}>正在自动查询支付结果（每 3 秒）</Text>
              </View>
            )}

            <Text style={styles.sheetFoot}>
              支付链接由缴费平台生成、具有时效性，请尽快完成。若已支付但状态未更新，
              稍后重新查询即可。
            </Text>

            {!paid && (
              <Pressable onPress={() => void openWechat()} style={styles.ctaWrap}>
                <Sticker style={styles.cta} fill={C.lime} radius={999} offset={SHADOW.lg}>
                  <Text style={[styles.ctaText, { color: C.ink }]}>打开微信支付</Text>
                  <Feather name="external-link" size={17} color={C.ink} />
                </Sticker>
              </Pressable>
            )}

            <Pressable onPress={onClose} style={styles.ctaWrap}>
              <Sticker style={styles.cta} fill={paid ? C.ink : C.white} radius={999} offset={SHADOW.lg}>
                <Text style={[styles.ctaText, paid ? { color: C.lime } : { color: C.ink }]}>
                  {paid ? '完成' : '稍后再说'}
                </Text>
              </Sticker>
            </Pressable>
          </Sticker>
        </View>
      </View>
    </Modal>
  );
}

function OrderRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.orderRow}>
      <Text style={styles.orderLabel}>{label}</Text>
      <Text style={[styles.orderValue, strong && styles.orderValueStrong]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
  },
  roomText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: C.ink,
  },
  changeRoom: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gray,
  },

  meterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  meterWrap: {
    flex: 1,
  },
  meterCard: {
    flexGrow: 1,
    padding: 14,
    gap: 4,
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meterLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.ink,
  },
  meterLabelDark: {
    color: 'rgba(243,240,232,0.75)',
  },
  lowTag: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: C.oat,
  },
  lowTagDark: {
    backgroundColor: 'rgba(198,232,68,0.18)',
  },
  lowTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.gray,
  },
  lowTagTextDark: {
    color: C.lime,
  },
  meterValue: {
    fontFamily: DISPLAY,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.2,
    marginTop: 6,
  },
  meterUnit: {
    fontSize: 10.5,
    color: inkA(0.5),
  },
  meterUnitDark: {
    color: 'rgba(243,240,232,0.45)',
  },

  chargeCard: {
    padding: 16,
    gap: 10,
  },
  chargeTitle: {
    fontFamily: DISPLAY,
    fontSize: 17,
    color: C.ink,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: inkA(0.55),
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  cta: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.lime,
  },
  warnBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.oat,
  },
  warnText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: C.gray,
  },
  chargeFoot: {
    fontSize: 10.5,
    lineHeight: 15,
    color: inkA(0.5),
  },

  // 支付弹层
  backdrop: {
    flex: 1,
    backgroundColor: inkA(0.45),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheetWrap: {
    alignSelf: 'stretch',
  },
  sheet: {
    padding: 18,
    gap: 12,
  },
  sheetHead: {
    alignItems: 'center',
    gap: 6,
  },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: DISPLAY,
    fontSize: 19,
    color: C.ink,
  },
  sheetSub: {
    fontSize: 11.5,
    color: inkA(0.55),
    textAlign: 'center',
  },
  orderRows: {
    marginTop: 2,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  orderLabel: {
    fontSize: 12,
    color: C.gray,
  },
  orderValue: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: C.ink,
  },
  orderValueStrong: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.ink,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontSize: 11,
    color: C.gray,
  },
  sheetFoot: {
    fontSize: 10.5,
    lineHeight: 15,
    color: inkA(0.5),
  },
});
