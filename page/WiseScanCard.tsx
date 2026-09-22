import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';

import Sticker from '../template/Sticker';
import { C, DISPLAY, R, SHADOW } from '../template/theme';
import { ApiError } from '../api/contracts';
import type { WiseDeviceInfo } from '../api/contracts/wise';

/**
 * 智慧用水 · 「扫码即用」翻转卡片
 *
 * 交互（本页唯一入口，旧的全屏底部弹层已废弃）：
 *   1. 点「扫一扫连接设备」→ 整张卡片绕 Y 轴翻转 180°（420ms）翻到背面；
 *   2. 背面 = 取景器：摄像头画面直接嵌在卡片里（不再用全屏弹层把页面盖住），
 *      四角青柠取景框 + 「将二维码放入框内」；
 *   3. 扫到二维码 → 卡片内浮出「识别中…」；`POST /wise/scan` 成功后浮层
 *      换成青柠对号 + 「识别成功」，停留 900ms；
 *   4. 之后自动翻回正面，正面已是「设备已连接」（设备名 / 在线 / 计费模式）。
 *
 * 正面与背面共用同一个固定高度，翻面过程中不会跳高。
 * 动画结束会把 transform 归位（而不是常驻 180°/360°），因为 CameraView
 * 在 Android 上长期处于 transform 父层会有渲染问题。
 *
 * 数据契约：只用 `POST /wise/scan { url }`（见 api/endpoints/wise.ts）。
 * ⚠️ 不触碰 `/wise/pay`（真实扣款）与 `/wise/ctrl`（真实启停设备）。
 */

/** 卡片固定高度：正/反两面共用，保证翻转时不跳高 */
const CARD_H = 366;
const FLIP_MS = 420;
/** 识别成功后对号停留时长，之后自动翻回正面 */
const OK_HOLD_MS = 900;
const PERSPECTIVE = 1000;

const ABS_FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
const isWeb = Platform.OS === 'web';

/** front / back = 静止态（无 transform）；toBack / toFront = 翻转中（两面同时在） */
type Phase = 'front' | 'toBack' | 'back' | 'toFront';

type Props = {
  /** 登录且已绑定智慧校园账号才允许扫码（否则卡片锁定） */
  canScan: boolean;
  /** 最近一次识别到的设备（会话已建立） */
  device: WiseDeviceInfo | null;
  /** 真实调用 POST /wise/scan 建立会话 */
  scan: (url: string) => Promise<WiseDeviceInfo>;
  scanning: boolean;
  scanError: Error | null;
  resetScan: () => void;
  /** 识别并连接成功后触发（父级刷新订单） */
  onConnected: () => void;
  /** 锁定原因（未登录 / 未绑定），直接展示后端原文口径 */
  lockedNote: string;
  /**
   * 父级请求翻开扫码（会话失效时，订单错误卡的「去重新扫码」直接落到这里）。
   * 传一个自增的数字即可；0 / undefined 表示不请求。
   */
  openSignal?: number;
};

export default function WiseScanCard({
  canScan,
  device,
  scan,
  scanning,
  scanError,
  resetScan,
  onConnected,
  lockedNote,
  openSignal = 0,
}: Props) {
  const flip = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = useState<Phase>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manual, setManual] = useState('');
  const [ok, setOk] = useState(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const granted = permission?.status === 'granted';
  const connected = !!device;
  const flipping = phase === 'toBack' || phase === 'toFront';

  /* 翻转动画：只在过渡态跑，结束后落到静止态（transform 归位） */
  useEffect(() => {
    if (phase !== 'toBack' && phase !== 'toFront') return;
    const toBack = phase === 'toBack';
    Animated.timing(flip, {
      toValue: toBack ? 1 : 0,
      duration: FLIP_MS,
      easing: toBack ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (toBack) {
        setPhase('back');
      } else {
        setPhase('front');
        setOk(false);
        setScanned(false);
      }
    });
  }, [phase, flip]);

  useEffect(
    () => () => {
      if (holdRef.current) clearTimeout(holdRef.current);
    },
    [],
  );

  const open = () => {
    if (!canScan || phase !== 'front') return;
    resetScan();
    setScanned(false);
    setManual('');
    setOk(false);
    flip.setValue(0);
    setPhase('toBack');
  };

  const close = () => {
    if (holdRef.current) clearTimeout(holdRef.current);
    if (phase === 'toFront' || phase === 'front') return;
    setPhase('toFront');
  };

  /**
   * 由父级（订单错误卡）请求翻开扫码。
   * 只在静止正面时响应：已经在翻 / 已经在背面就不重复触发。
   */
  useEffect(() => {
    if (!openSignal || phase !== 'front') return;
    open();
    // 只应在 openSignal 变化时触发；open 每次渲染都是新引用，不入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  const showOk = () => {
    setOk(true);
    pop.setValue(0.4);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  };

  const doScan = async (url: string) => {
    const value = (url ?? '').trim();
    if (!canScan || scanning || ok || !value) return;
    setScanned(true);
    try {
      await scan(value);
      showOk();
      onConnected();
      holdRef.current = setTimeout(() => close(), OK_HOLD_MS);
    } catch {
      // 失败信息由 scanError 呈现；重置 scanned 让取景器可以重新识别
      setScanned(false);
    }
  };

  const onBarcode = (data: string) => {
    if (scanned || ok) return;
    void doScan(data);
  };

  const animFace = (side: 'front' | 'back') => {
    // 静止态：只有当前那一面会被渲染，直接给恒等变换（transform 归位）
    if (!flipping) return { opacity: 1, transform: [] as [] };
    return {
      opacity: flip.interpolate({
        inputRange: [0, 0.49, 0.51, 1],
        outputRange: side === 'front' ? [1, 1, 0, 0] : [0, 0, 1, 1],
      }),
      transform: [
        { perspective: PERSPECTIVE },
        {
          rotateY: flip.interpolate({
            inputRange: [0, 1],
            outputRange: side === 'front' ? ['0deg', '180deg'] : ['180deg', '360deg'],
          }),
        },
      ],
    };
  };

  const showFront = phase === 'front' || flipping;
  const showBack = phase === 'back' || flipping;

  return (
    <Sticker
      fill={C.ink}
      radius={R.hero}
      offset={SHADOW.xl}
      shadowColor={C.limeDeep}
      style={styles.card}
    >
      <View style={styles.stage}>
        {/* ===================== 正面：连接设备 ===================== */}
        {showFront && (
          <Animated.View style={[styles.face, animFace('front')]}>
            <View style={styles.front}>
              <View style={styles.iconCircle}>
                <Feather name={connected ? 'check' : 'zap'} size={36} color={C.ink} />
              </View>

              <Text style={styles.title}>{connected ? '设备已连接' : '连接设备'}</Text>
              <Text style={styles.sub}>
                {connected
                  ? '会话已建立，今日订单会实时出现在下方。'
                  : '扫码或粘贴设备链接，识别成功后即可查看今日用水 / 洗衣订单。'}
              </Text>

              {device && (
                <View style={styles.deviceBox}>
                  <View style={styles.deviceTop}>
                    <Feather name="wifi" size={15} color={C.lime} />
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {device.posName || '未知设备'}
                    </Text>
                    <View style={[styles.online, device.online && styles.onlineOn]}>
                      <Text style={[styles.onlineText, device.online && styles.onlineTextOn]}>
                        {device.online ? '在线' : '离线'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.deviceMeta} numberOfLines={1}>
                    {[device.siteName, device.modeName].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={open}
                disabled={!canScan}
                style={styles.ctaWrap}
              >
                <Sticker
                  fill={C.lime}
                  radius={R.pill}
                  offset={0}
                  style={[styles.cta, !canScan && styles.dim]}
                >
                  <Feather name="camera" size={18} color={C.ink} />
                  <Text style={styles.ctaText}>{connected ? '重新扫码连接' : '扫一扫连接设备'}</Text>
                </Sticker>
              </TouchableOpacity>

              {!canScan && <Text style={styles.note}>{lockedNote}</Text>}
            </View>
          </Animated.View>
        )}

        {/* ===================== 背面：取景器 ===================== */}
        {showBack && (
          <Animated.View style={[styles.face, animFace('back')]}>
            <View style={styles.back}>
              <View style={styles.backHead}>
                <View style={styles.backTitleRow}>
                  <View style={styles.dot} />
                  <Text style={styles.backTitle}>扫描设备二维码</Text>
                </View>
                <TouchableOpacity
                  onPress={close}
                  hitSlop={10}
                  activeOpacity={0.8}
                  style={styles.closeBtn}
                >
                  <Feather name="x" size={16} color={C.lime} />
                </TouchableOpacity>
              </View>

              <View style={styles.camFrame}>
                {granted ? (
                  <CameraView
                    style={ABS_FILL}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scanned || ok ? undefined : ({ data }) => onBarcode(data)}
                  />
                ) : (
                  <View style={styles.camFallback}>
                    <Feather name="camera-off" size={26} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.camFallbackText}>
                      {isWeb
                        ? '网页预览无法调用摄像头，可在下方手动粘贴设备链接。'
                        : '需要摄像头权限才能扫描设备二维码。'}
                    </Text>
                    {!isWeb && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => requestPermission()}
                        style={styles.permWrap}
                      >
                        <Sticker fill={C.lime} radius={R.pill} offset={0} style={styles.permBtn}>
                          <Text style={styles.permBtnText}>允许使用摄像头</Text>
                        </Sticker>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {granted && (
                  <View style={styles.overlay} pointerEvents="none">
                    <View style={[styles.corner, styles.tl]} />
                    <View style={[styles.corner, styles.tr]} />
                    <View style={[styles.corner, styles.bl]} />
                    <View style={[styles.corner, styles.br]} />
                    <View style={styles.hintWrap}>
                      <Text style={styles.hint}>将二维码放入框内</Text>
                    </View>
                  </View>
                )}

                {/* 识别中 / 识别成功：直接盖在取景画面中央，不再另起一条横条 */}
                {(scanning || ok) && (
                  <View style={styles.busy}>
                    {ok ? (
                      <Animated.View style={[styles.okCircle, { transform: [{ scale: pop }] }]}>
                        <Feather name="check" size={36} color={C.ink} />
                      </Animated.View>
                    ) : (
                      <View style={styles.busyPill}>
                        <ActivityIndicator size="small" color={C.ink} />
                        <Text style={styles.busyText}>识别中…</Text>
                      </View>
                    )}
                    {ok && <Text style={styles.okText}>识别成功</Text>}
                  </View>
                )}
              </View>

              <View style={styles.manualRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="或粘贴设备二维码链接"
                  placeholderTextColor="rgba(17,18,20,0.4)"
                  value={manual}
                  onChangeText={setManual}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!scanning && !ok}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => doScan(manual)}
                  disabled={scanning || ok || !manual.trim()}
                  style={styles.manualBtnWrap}
                >
                  <Sticker
                    fill={C.lime}
                    radius={R.pill}
                    offset={0}
                    style={[styles.manualBtn, (scanning || ok || !manual.trim()) && styles.dim]}
                  >
                    <Text style={styles.manualBtnText}>连接</Text>
                  </Sticker>
                </TouchableOpacity>
              </View>

              {scanError && (
                <View style={styles.errBox}>
                  <Text style={styles.errText}>
                    {(scanError instanceof ApiError ? scanError.errorCode : '') || '识别失败'}：
                    {scanError.message}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_H,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  stage: {
    flex: 1,
    position: 'relative',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },

  // ---------- 正面 ----------
  front: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: C.lime,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 22,
    lineHeight: 28,
    color: C.lime,
    marginTop: 18,
  },
  sub: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 6,
    textAlign: 'center',
  },
  deviceBox: {
    width: '100%',
    marginTop: 12,
    padding: 12,
    borderRadius: R.card,
    backgroundColor: 'rgba(198,232,68,0.14)',
    borderWidth: 2,
    borderColor: C.lime,
    gap: 4,
  },
  deviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    flex: 1,
    fontFamily: DISPLAY,
    fontSize: 14,
    color: C.lime,
  },
  online: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  onlineOn: {
    backgroundColor: C.lime,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  onlineTextOn: {
    color: C.ink,
  },
  deviceMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
  },
  ctaWrap: {
    marginTop: 16,
  },
  cta: {
    height: 46,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dim: {
    opacity: 0.55,
  },
  ctaText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    color: C.ink,
  },
  note: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },

  // ---------- 背面 ----------
  back: {
    flex: 1,
    gap: 10,
  },
  backHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: C.lime,
  },
  backTitle: {
    fontFamily: DISPLAY,
    fontSize: 15,
    color: C.lime,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },

  camFrame: {
    flex: 1,
    minHeight: 150,
    borderRadius: R.card,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  camFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  camFallbackText: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  permWrap: {
    marginTop: 2,
  },
  permBtn: {
    height: 40,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: {
    fontFamily: DISPLAY,
    fontSize: 13,
    color: C.ink,
  },

  overlay: ABS_FILL,
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: C.lime,
    borderWidth: 3,
  },
  tl: { top: 12, left: 12, borderBottomWidth: 0, borderRightWidth: 0 },
  tr: { top: 12, right: 12, borderBottomWidth: 0, borderLeftWidth: 0 },
  bl: { bottom: 12, left: 12, borderTopWidth: 0, borderRightWidth: 0 },
  br: { bottom: 12, right: 12, borderTopWidth: 0, borderLeftWidth: 0 },
  hintWrap: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    fontSize: 11,
    color: C.white,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  busy: {
    ...ABS_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    /** 压到接近实黑：否则取景画面 / 兜底文案会从对号旁边透出来，看着很脏 */
    backgroundColor: 'rgba(0,0,0,0.84)',
  },
  busyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: C.lime,
  },
  busyText: {
    fontFamily: DISPLAY,
    fontSize: 14,
    color: C.ink,
  },
  okCircle: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: C.lime,
    borderWidth: 3,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: {
    fontFamily: DISPLAY,
    fontSize: 14,
    color: C.lime,
  },

  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualInput: {
    flex: 1,
    height: 46,
    backgroundColor: C.cream,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: R.pill,
    paddingHorizontal: 16,
    fontSize: 13,
    color: C.ink,
  },
  manualBtnWrap: {},
  manualBtn: {
    height: 46,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnText: {
    fontFamily: DISPLAY,
    fontSize: 14,
    color: C.ink,
  },

  errBox: {
    padding: 10,
    borderRadius: R.card,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  errText: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.8)',
  },
});
