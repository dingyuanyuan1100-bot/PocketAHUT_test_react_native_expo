import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import SubPageShell from '../template/SubPageShell';
import StateCard from '../template/StateCard';
import StatusPill, { GuestPill } from '../template/StatusPill';
import Chip from '../template/Chip';
import Sticker from '../template/Sticker';
import LoadingCard from '../template/LoadingCard';
import { C, DISPLAY, R, SHADOW, inkA } from '../template/theme';
import {
  useForceOffline,
  useNetworkAccount,
  useNetworkBoundDevices,
  useNetworkHistory,
  useNetworkOnline,
} from '../hooks/useNetwork';
import {
  formatDurationShort,
  formatMinutes,
  formatTimestampMs,
  formatTrafficMB,
  maskMac,
} from '../lib/network';
import type { NetworkLoginRecord, NetworkOnlineDevice } from '../api/contracts/campus';

type Tab = 'account' | 'online' | 'history';

const TABS: { value: Tab; label: string }[] = [
  { value: 'account', label: '账户' },
  { value: 'online', label: '在线设备' },
  { value: 'history', label: '上网记录' },
];

export default function NetworkPage() {
  const [tab, setTab] = useState<Tab>('account');

  const accountQ = useNetworkAccount();
  const onlineQ = useNetworkOnline();
  const devicesQ = useNetworkBoundDevices();
  const historyQ = useNetworkHistory();

  // 状态胶囊跟随当前 tab 的数据源，避免「账户正常但设备加载失败」时胶囊说谎
  const current =
    tab === 'account' ? accountQ : tab === 'online' ? onlineQ : historyQ;
  const status = current.status;

  const refreshAll = () => {
    void accountQ.refetch();
    void onlineQ.refetch();
    void devicesQ.refetch();
    void historyQ.refetch();
  };

  const statusPill =
    status === 'guest' ? (
      <GuestPill />
    ) : status === 'not_bound' ? (
      <StatusPill label="未绑定校园网" />
    ) : status === 'loading' ? (
      <StatusPill label="查询中" />
    ) : status === 'empty' ? (
      <StatusPill label="暂无数据" />
    ) : status === 'error' ? (
      <StatusPill label="加载失败" />
    ) : (
      <StatusPill label="已连接" />
    );

  return (
    <SubPageShell
      title="校园网"
      statusPill={statusPill}
      onRefresh={refreshAll}
      refreshing={accountQ.isRefreshing || onlineQ.isRefreshing}
      refreshEnabled={status !== 'loading' && status !== 'guest'}
      toolbar={
        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              active={tab === t.value}
              onPress={() => setTab(t.value)}
            />
          ))}
        </View>
      }
    >
      {status === 'guest' && (
        <StateCard
          tone="guest"
          icon={<Feather name="wifi" size={34} color={C.ink} />}
          title="登录后查看校园网"
          description={'网费余额、在线设备与上网记录\n需要登录并绑定校园网账号'}
          primaryAction={{ label: '立即登录', onPress: () => router.push('/login') }}
        />
      )}

      {status === 'not_bound' && (
        <StateCard
          tone="not_bound"
          icon={<Feather name="wifi" size={30} color={C.ink} />}
          badge={<Text style={styles.bang}>!</Text>}
          title="绑定校园网账号"
          description={current.error?.message ?? '需先绑定校园网账号才能查询上网信息'}
          primaryAction={{
            label: '立即绑定',
            onPress: () => router.push('/login'),
            arrow: true,
          }}
        />
      )}

      {status === 'error' && (
        <StateCard
          tone="error"
          icon={<Feather name="alert-circle" size={34} color={C.ink} />}
          badge={<Text style={styles.bang}>!</Text>}
          title="校园网数据加载失败"
          description="可能是自助服务系统繁忙或网络异常"
          errorBar={{
            code: current.error?.errorCode ?? `HTTP ${current.error?.code ?? 0}`,
            message: current.error?.message ?? '未知错误',
          }}
          primaryAction={{ label: '重新加载', onPress: refreshAll }}
        />
      )}

      {status === 'loading' && (
        <Sticker style={styles.loadingCard} wrapStyle={styles.loadingWrap} fill={C.white} radius={R.menu} offset={SHADOW.xl}>
          <LoadingCard label="正在查询校园网状态…" />
        </Sticker>
      )}

      {/* ===================== 账户 ===================== */}
      {tab === 'account' && accountQ.status === 'ready' && (
        <>
          <View style={styles.meterRow}>
            <Sticker
              style={styles.meterCard}
              wrapStyle={styles.meterWrap}
              fill={C.ink}
              radius={R.menu}
              offset={SHADOW.xl}
            >
              <View style={styles.meterHead}>
                <Feather name="clock" size={14} color={C.lime} />
                <Text style={[styles.meterLabel, styles.meterLabelDark]}>已用时长</Text>
              </View>
              <Text style={[styles.meterValue, { color: C.lime }]} numberOfLines={1} adjustsFontSizeToFit>
                {splitNumber(formatMinutes(accountQ.account?.used_minutes)).num}
              </Text>
              <Text style={[styles.meterUnit, styles.meterUnitDark]}>
                {splitNumber(formatMinutes(accountQ.account?.used_minutes)).unit}
              </Text>
            </Sticker>

            <Sticker style={styles.meterCard} fill={C.white} radius={R.menu} offset={SHADOW.xl}>
              <View style={styles.meterHead}>
                <Feather name="bar-chart-2" size={14} color={C.ink} />
                <Text style={styles.meterLabel}>已用流量</Text>
              </View>
              <Text style={styles.meterValue} numberOfLines={1} adjustsFontSizeToFit>
                {splitNumber(formatTrafficMB(accountQ.account?.used_traffic)).num}
              </Text>
              <Text style={styles.meterUnit}>
                {splitNumber(formatTrafficMB(accountQ.account?.used_traffic)).unit}
              </Text>
            </Sticker>
          </View>

          <Sticker style={styles.noteCard} fill={C.oat} radius={R.card} offset={0}>
            <Feather name="info" size={13} color={C.ink} />
            <Text style={styles.noteText}>
              数据来自 Dr.COM 自助服务系统的当日统计，可能有数分钟延迟。
            </Text>
          </Sticker>

          <SectionTitle
            title="已绑定设备"
            count={devicesQ.devices.length}
            loading={devicesQ.status === 'loading'}
          />
          {devicesQ.status === 'empty' && (
            <EmptyRow text="校园网账号下暂无绑定设备" />
          )}
          {devicesQ.devices.map((d, i) => (
            <Sticker key={`${d.mac}-${i}`} style={styles.deviceRow} fill={C.white} radius={R.card} offset={SHADOW.lg}>
              <View style={styles.deviceIcon}>
                <Feather name="hard-drive" size={15} color={C.ink} />
              </View>
              <View style={styles.deviceBody}>
                <Text style={styles.deviceTitle} numberOfLines={1}>
                  {d.terminal || '未知终端'}
                </Text>
                <Text style={styles.deviceMeta} numberOfLines={1}>
                  {maskMac(d.mac)}
                  {d.last_login_at ? ` · 最近 ${d.last_login_at}` : ''}
                </Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: isOnline(d.online) ? C.lime : C.oat }]} />
            </Sticker>
          ))}
        </>
      )}

      {/* ===================== 在线设备 ===================== */}
      {tab === 'online' && onlineQ.status === 'ready' && (
        <>
          <Text style={styles.sectionHint}>
            强行下线会让该设备立即断网，操作不可撤销，请确认是自己的设备。
          </Text>
          {onlineQ.devices.map((d, i) => (
            <OnlineRow key={d.session_id || `${d.mac}-${i}`} device={d} />
          ))}
        </>
      )}

      {tab === 'online' && onlineQ.status === 'empty' && (
        <StateCard
          tone="empty"
          icon={<Feather name="wifi-off" size={34} color={C.ink} />}
          title="当前没有在线设备"
          description="校园网账号下未检测到在线终端"
          secondaryAction={{ label: '重新加载', onPress: () => void onlineQ.refetch() }}
        />
      )}

      {/* ===================== 上网记录 ===================== */}
      {tab === 'history' && historyQ.status === 'ready' && (
        <>
          {historyQ.records.map((r, i) => (
            <HistoryRow key={`${r.online_time}-${r.mac}-${i}`} record={r} />
          ))}
        </>
      )}

      {tab === 'history' && historyQ.status === 'empty' && (
        <StateCard
          tone="empty"
          icon={<Feather name="file-text" size={34} color={C.ink} />}
          title="暂无上网记录"
          description="自助服务系统未返回近期上网记录"
          secondaryAction={{ label: '重新加载', onPress: () => void historyQ.refetch() }}
        />
      )}
    </SubPageShell>
  );
}

// ===================== 行组件 =====================

function OnlineRow({ device }: { device: NetworkOnlineDevice }) {
  const forceOffline = useForceOffline();

  const confirm = () => {
    Alert.alert(
      '确认强制下线',
      `将断开「${device.terminal || device.ip}」的网络连接。\n` +
        `${device.host_name ? `主机名：${device.host_name}\n` : ''}` +
        '设备需要重新认证才能再次上网。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '强制下线',
          style: 'destructive',
          onPress: () =>
            forceOffline.mutate(device.session_id, {
              onSuccess: (res) => {
                if (res?.success === false) {
                  Alert.alert('下线未成功', '请刷新在线列表后重试。');
                }
              },
              onError: (err) => {
                // 后端 502 = 上游结果未知，明确提示不要盲目重试
                Alert.alert(
                  '结果未知',
                  '自助服务系统未明确应答，请刷新在线设备列表确认后再操作。',
                );
                void err;
              },
            }),
        },
      ],
    );
  };

  return (
    <Sticker style={styles.onlineRow} fill={C.white} radius={R.card} offset={SHADOW.lg}>
      <View style={styles.onlineHead}>
        <View style={styles.deviceIcon}>
          <Feather name="monitor" size={15} color={C.ink} />
        </View>
        <View style={styles.deviceBody}>
          <Text style={styles.deviceTitle} numberOfLines={1}>
            {device.terminal || device.host_name || '未知终端'}
          </Text>
          <Text style={styles.deviceMeta} numberOfLines={1}>
            {device.ip || '—'} · {maskMac(device.mac)}
          </Text>
        </View>
        <View style={styles.liveDot} />
      </View>

      <View style={styles.onlineMeta}>
        <MetaItem label="上线" value={formatTimestampMs(device.online_time)} />
        <MetaItem label="时长" value={formatDurationShort(device.duration)} />
        <MetaItem label="流量" value={formatTrafficMB(device.traffic)} />
      </View>

      {!!device.host_name && (
        <Text style={styles.hostName} numberOfLines={1}>
          主机名 {device.host_name}
        </Text>
      )}

      <Pressable
        onPress={confirm}
        disabled={forceOffline.isPending || !device.session_id}
        style={({ pressed }) => [styles.offlineWrap, pressed && styles.pressed]}
      >
        <Sticker style={styles.offlineBtn} fill={C.white} radius={999} offset={SHADOW.sm}>
          {forceOffline.isPending ? (
            <ActivityIndicator size="small" color={C.ink} />
          ) : (
            <>
              <Feather name="power" size={13} color={C.ink} />
              <Text style={styles.offlineText}>强制下线</Text>
            </>
          )}
        </Sticker>
      </Pressable>
    </Sticker>
  );
}

function HistoryRow({ record }: { record: NetworkLoginRecord }) {
  return (
    <Sticker style={styles.historyRow} fill={C.white} radius={R.card} offset={SHADOW.lg}>
      <View style={styles.historyHead}>
        <Text style={styles.deviceTitle} numberOfLines={1}>
          {record.terminal || '未知终端'}
        </Text>
        <Text style={styles.historyTraffic}>{formatTrafficMB(record.traffic)}</Text>
      </View>
      <Text style={styles.deviceMeta} numberOfLines={1}>
        {record.ip || '—'} · {maskMac(record.mac)} · {formatDurationShort(record.duration)}
      </Text>
      <View style={styles.historyTimes}>
        <Text style={styles.historyTime}>
          上线 {formatTimestampMs(record.online_time)}
        </Text>
        <Text style={styles.historyTime}>
          注销 {formatTimestampMs(record.offline_time)}
        </Text>
      </View>
    </Sticker>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  count,
  loading,
}: {
  title: string;
  count?: number;
  loading?: boolean;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={C.gray} />
      ) : (
        count !== undefined && <Text style={styles.sectionCount}>{count} 台</Text>
      )}
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Sticker style={styles.emptyRow} fill={C.oat} radius={R.card} offset={0}>
      <Text style={styles.emptyRowText}>{text}</Text>
    </Sticker>
  );
}

// ===================== 小工具 =====================

/** 把 '12.5 GB' 拆成数值与单位，便于数值用大字、单位用小字 */
function splitNumber(text: string): { num: string; unit: string } {
  const m = text.match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return { num: text, unit: '' };
  return { num: m[1], unit: m[2] };
}

/** 上游的在线状态是字符串（可能是 '1' / 'true' / '在线'），宽松判定 */
function isOnline(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === '在线' || v === 'yes';
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bang: {
    fontFamily: DISPLAY,
    fontSize: 22,
    lineHeight: 24,
    color: C.ink,
    textAlign: 'center',
  },
  loadingWrap: {
    flexGrow: 1,
  },
  loadingCard: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexGrow: 1,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
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
    gap: 2,
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  meterLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.ink,
  },
  meterLabelDark: {
    color: 'rgba(243,240,232,0.75)',
  },
  meterValue: {
    fontFamily: DISPLAY,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1.2,
    color: C.ink,
  },
  meterUnit: {
    fontSize: 10.5,
    color: inkA(0.5),
  },
  meterUnitDark: {
    color: 'rgba(243,240,232,0.45)',
  },

  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: C.gray,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  sectionTitle: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.ink,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gray,
  },
  sectionHint: {
    fontSize: 11,
    lineHeight: 16,
    color: inkA(0.55),
    paddingHorizontal: 4,
  },

  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  deviceIcon: {
    width: 34,
    height: 34,
    borderRadius: R.iconBox,
    backgroundColor: C.oat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceBody: {
    flex: 1,
    gap: 3,
  },
  deviceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  deviceMeta: {
    fontSize: 10.5,
    color: inkA(0.55),
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: C.ink,
  },

  onlineRow: {
    padding: 12,
    gap: 10,
  },
  onlineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: C.lime,
    borderWidth: 2,
    borderColor: C.ink,
  },
  onlineMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaItem: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: inkA(0.45),
  },
  metaValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: C.ink,
  },
  hostName: {
    fontSize: 10.5,
    color: inkA(0.5),
  },
  offlineWrap: {
    alignSelf: 'flex-start',
  },
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
  },
  offlineText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.ink,
  },
  pressed: {
    opacity: 0.85,
  },

  historyRow: {
    padding: 12,
    gap: 6,
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyTraffic: {
    fontFamily: DISPLAY,
    fontSize: 14,
    color: C.ink,
  },
  historyTimes: {
    flexDirection: 'row',
    gap: 14,
  },
  historyTime: {
    fontSize: 10,
    color: inkA(0.45),
  },

  emptyRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyRowText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: C.gray,
  },
});
