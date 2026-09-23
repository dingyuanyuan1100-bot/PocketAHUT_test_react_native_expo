import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import SubPageShell from '../template/SubPageShell';
import StateCard from '../template/StateCard';
import StatusPill, { GuestPill } from '../template/StatusPill';
import Chip from '../template/Chip';
import Sticker from '../template/Sticker';
import StickerField, { FieldInput } from '../template/StickerField';
import { C, DISPLAY, R, SHADOW, inkA } from '../template/theme';
import { useDormBind, useDormBinding, useDormBuildings } from '../hooks/useElectricity';
import { useAuth } from '../store/AuthContext';
import { CAMPUS_NEW, CAMPUS_OLD, CAMPUS_OPTIONS, type CampusCode } from '../api/contracts/campus';

/**
 * 宿舍房间绑定。
 *
 * 这一屏是「电费」的前置条件：后端 `/electricity/balance` 按当前用户
 * 绑定的房间查电费，未绑定时直接返回 NOT_BOUND。
 *
 * ⚠️ 别和「晚寝账号绑定」混了 —— 那是 `POST /user/sys/bind {sys_code:'dorm'}`，
 * 绑的是晚寝系统的登录凭据；这里绑的是**房间**（校区 + 楼栋 + 3 位房号），
 * 用于查电费。两者互不替代。
 */
export default function DormBindPage() {
  const { isAuthed, booted } = useAuth();
  const bindingQ = useDormBinding();

  const [xiaoqu, setXiaoqu] = useState<CampusCode>(CAMPUS_NEW);
  const [ldId, setLdId] = useState('');
  const [roomNo, setRoomNo] = useState('');

  const buildingsQ = useDormBuildings(xiaoqu);
  const bindMutation = useDormBind();

  const roomValid = /^\d{3}$/.test(roomNo);
  const canSubmit = !!ldId && roomValid;

  const statusPill = !booted ? (
    <StatusPill label="加载中" />
  ) : !isAuthed ? (
    <GuestPill />
  ) : bindingQ.status === 'ready' ? (
    <StatusPill label="已绑定" />
  ) : bindingQ.status === 'not_bound' ? (
    <StatusPill label="未绑定" />
  ) : (
    <StatusPill label="加载失败" />
  );

  const submit = () => {
    if (!canSubmit) return;
    bindMutation.mutate(
      { xiaoqu, ld_id: ldId, room_no: roomNo },
      {
        onSuccess: () => {
          Alert.alert('绑定成功', `已绑定 ${buildingName(buildingsQ.data, ldId)} ${roomNo} 室`, [
            { text: '去查电费', onPress: () => router.replace('/electricity') },
            { text: '留在本页', style: 'cancel' },
          ]);
        },
        onError: (err) => {
          const message =
            typeof err === 'object' && err && 'message' in err
              ? String((err as { message?: string }).message ?? '')
              : '';
          Alert.alert('绑定失败', message || '请检查校区、楼栋与房间号是否正确。');
        },
      },
    );
  };

  if (booted && !isAuthed) {
    return (
      <SubPageShell title="绑定宿舍" statusPill={<GuestPill />}>
        <StateCard
          tone="guest"
          icon={<Feather name="home" size={34} color={C.ink} />}
          title="登录后绑定宿舍"
          description={'宿舍房间用于查询电费余额\n请先登录账号'}
          primaryAction={{ label: '立即登录', onPress: () => router.push('/login') }}
        />
      </SubPageShell>
    );
  }

  return (
    <SubPageShell title="绑定宿舍" statusPill={statusPill}>
      {/* ===================== 已有绑定 ===================== */}
      {bindingQ.status === 'ready' && bindingQ.binding && (
        <Sticker style={styles.currentCard} fill={C.white} radius={R.menu} offset={SHADOW.xl}>
          <View style={styles.currentHead}>
            <View style={styles.currentIcon}>
              <Feather name="check" size={18} color={C.ink} />
            </View>
            <View style={styles.currentBody}>
              <Text style={styles.currentTitle}>当前已绑定</Text>
              <Text style={styles.currentValue}>
                {campusLabel(bindingQ.binding.xiaoqu)} · {bindingQ.binding.ld_id} 栋 ·{' '}
                {bindingQ.binding.room_no} 室
              </Text>
            </View>
          </View>
          <Text style={styles.currentHint}>
            重新绑定会覆盖当前记录。电费按房间计量，换房间后请及时更新。
          </Text>
        </Sticker>
      )}

      {/* ===================== 表单 ===================== */}
      <Sticker style={styles.formCard} fill={C.white} radius={R.menu} offset={SHADOW.xl}>
        <Text style={styles.formTitle}>宿舍房间</Text>

        <Text style={styles.fieldLabel}>校区</Text>
        <View style={styles.chipRow}>
          {CAMPUS_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={xiaoqu === opt.value}
              onPress={() => {
                setXiaoqu(opt.value);
                // 换校区后原楼栋 ID 在新校区可能不存在，清掉避免提交无效组合
                setLdId('');
              }}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>楼栋</Text>
        {buildingsQ.isLoading ? (
          <View style={styles.buildingLoading}>
            <ActivityIndicator size="small" color={C.gray} />
            <Text style={styles.buildingLoadingText}>正在获取楼栋列表…</Text>
          </View>
        ) : buildingsQ.isError ? (
          <View style={styles.errorBar}>
            <Feather name="alert-triangle" size={13} color={C.ink} />
            <Text style={styles.errorText}>楼栋列表获取失败，请下拉刷新页面重试</Text>
          </View>
        ) : (
          /* 真实楼栋表有 40+ 栋（如东区），全部平铺会把房间号与 CTA 挤出屏幕，
             因此限制高度在容器内滚动，保证表单其余部分始终可见 */
          <ScrollView style={styles.buildingScroll} nestedScrollEnabled>
            <View style={styles.chipRow}>
              {(buildingsQ.data ?? []).map((b) => (
                <Chip
                  key={b.id}
                  label={b.name}
                  active={ldId === b.id}
                  onPress={() => setLdId(b.id)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        <Text style={styles.fieldLabel}>房间号</Text>
        <StickerField
          style={styles.inputBox}
          fill={roomNo && !roomValid ? C.oat : C.white}
          radius={R.card}
        >
          <FieldInput
            value={roomNo}
            onChangeText={(t) => setRoomNo(t.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="3 位数字，如 101"
            placeholderTextColor={inkA(0.4)}
            style={styles.input}
            maxLength={3}
          />
          <Text style={styles.inputSuffix}>{roomNo.length}/3</Text>
        </StickerField>
        {!!roomNo && !roomValid && (
          <Text style={styles.fieldError}>房间号必须是 3 位数字（后端强校验）</Text>
        )}

        <Pressable onPress={submit} disabled={!canSubmit || bindMutation.isPending} style={styles.ctaWrap}>
          <Sticker
            style={styles.cta}
            fill={canSubmit ? C.ink : C.oat}
            radius={999}
            offset={canSubmit ? SHADOW.lg : 0}
          >
            {bindMutation.isPending ? (
              <ActivityIndicator color={C.lime} />
            ) : (
              <Text style={[styles.ctaText, !canSubmit && styles.ctaTextDisabled]}>
                {bindingQ.status === 'ready' ? '覆盖绑定' : '确认绑定'}
              </Text>
            )}
          </Sticker>
        </Pressable>

        <Text style={styles.footNote}>
          房间号与电表一一对应，填错会导致查到别处的余额，请核对宿舍门牌。
        </Text>
      </Sticker>
    </SubPageShell>
  );
}

// ===================== 小工具 =====================

function campusLabel(code: string | undefined): string {
  if (code === CAMPUS_OLD) return '本部';
  if (code === CAMPUS_NEW) return '东区';
  return code ?? '—';
}

function buildingName(
  list: { id: string; name: string }[] | undefined,
  id: string,
): string {
  return list?.find((b) => b.id === id)?.name ?? `${id} 栋`;
}

const styles = StyleSheet.create({
  currentCard: {
    padding: 16,
    gap: 10,
  },
  currentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentIcon: {
    width: 40,
    height: 40,
    borderRadius: R.iconBox,
    backgroundColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentBody: {
    flex: 1,
    gap: 3,
  },
  currentTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: inkA(0.55),
  },
  currentValue: {
    fontFamily: DISPLAY,
    fontSize: 16,
    letterSpacing: -0.4,
    color: C.ink,
  },
  currentHint: {
    fontSize: 10.5,
    lineHeight: 15,
    color: inkA(0.5),
  },

  formCard: {
    padding: 16,
    gap: 10,
  },
  formTitle: {
    fontFamily: DISPLAY,
    fontSize: 18,
    color: C.ink,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: inkA(0.55),
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buildingScroll: {
    // 限高：约 4 行 chip 的高度，其余在容器内滚动
    maxHeight: 212,
    flexGrow: 0,
  },
  buildingLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  buildingLoadingText: {
    fontSize: 11.5,
    color: C.gray,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.oat,
  },
  errorText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: C.gray,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontFamily: DISPLAY,
    fontSize: 18,
    letterSpacing: 2,
    color: C.ink,
    padding: 0,
  },
  inputSuffix: {
    fontSize: 11,
    fontWeight: '700',
    color: inkA(0.4),
  },
  fieldError: {
    fontSize: 10.5,
    fontWeight: '600',
    color: inkA(0.6),
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: 10,
  },
  cta: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: DISPLAY,
    fontSize: 16,
    color: C.lime,
  },
  ctaTextDisabled: {
    color: inkA(0.4),
  },
  footNote: {
    fontSize: 10.5,
    lineHeight: 15,
    color: inkA(0.5),
  },
});
