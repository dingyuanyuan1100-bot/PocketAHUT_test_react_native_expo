import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import PageHeader from '../template/PageHeader';
import Sticker from '../template/Sticker';
import { C, DISPLAY, R, SHADOW, BORDER } from '../template/theme';
import { useAuth } from '../store/AuthContext';
import { authApi } from '../api/endpoints/auth';
import { SYS_META } from '../api/contracts/auth';
import type { SysCode, SysUserVO } from '../api/contracts/auth';

type Mode = 'login' | 'register';

const SYS_ORDER: SysCode[] = ['jwxt', 'dorm', 'chaoxing', 'vpncas'];

export default function LoginBindPage() {
  const { user, isAuthed, login, register } = useAuth();

  // ============ 账号视图状态 ============
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 验证码倒计时（注册 / 找回密码共用一个发送入口，按当前面板判断）
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = useCallback(() => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        return c - 1;
      });
    }, 1000);
  }, []);

  const sendCode = useCallback(async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('请输入正确的邮箱');
      return;
    }
    try {
      if (forgotOpen) await authApi.sendResetCode(email);
      else await authApi.sendRegisterCode(email);
      startCountdown();
      setError(null);
      Alert.alert('已发送', `验证码已发送至 ${email}`);
    } catch (e) {
      setError((e as Error).message || '发送失败');
    }
  }, [email, forgotOpen, startCountdown]);

  const onSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register({
          username: username.trim(),
          password,
          email: email.trim(),
          verify_code: code.trim(),
        });
      }
      // 登录/注册成功：回到上一页（如「我的」），由 useAuth 驱动重渲染
      router.back();
    } catch (e) {
      setError((e as Error).message || '操作失败');
    } finally {
      setLoading(false);
    }
  }, [mode, username, password, email, code, login, register]);

  const onForgot = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword({
        email: email.trim(),
        verify_code: code.trim(),
        new_password: password,
      });
      Alert.alert('成功', '密码已重置，请用新密码登录');
      setForgotOpen(false);
      setMode('login');
    } catch (e) {
      setError((e as Error).message || '重置失败');
    } finally {
      setLoading(false);
    }
  }, [email, code, password]);

  // ============ 绑定视图状态 ============
  const [binds, setBinds] = useState<SysUserVO[]>([]);
  const [bindLoading, setBindLoading] = useState(false);
  const [openSys, setOpenSys] = useState<SysCode | null>(null);
  const [bindForm, setBindForm] = useState<Record<string, { account: string; password: string }>>({});
  const [bindBusy, setBindBusy] = useState<SysCode | null>(null);

  const loadBinds = useCallback(async () => {
    setBindLoading(true);
    try {
      setBinds(await authApi.listSysBinds());
    } catch (e) {
      Alert.alert('加载失败', (e as Error).message);
    } finally {
      setBindLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) loadBinds();
  }, [isAuthed, loadBinds]);

  const doBind = useCallback(async (sys: SysCode) => {
    const f = bindForm[sys] || { account: '', password: '' };
    if (!f.account || !f.password) { Alert.alert('提示', '请填写账号与密码'); return; }
    setBindBusy(sys);
    try {
      await authApi.bindSys({ account: f.account, password: f.password, sys_code: sys });
      Alert.alert('已绑定', `${SYS_META[sys].name} 绑定成功`);
      setOpenSys(null);
      await loadBinds();
    } catch (e) {
      Alert.alert('绑定失败', (e as Error).message);
    } finally {
      setBindBusy(null);
    }
  }, [bindForm, loadBinds]);

  const doUnbind = useCallback(async (sys: SysCode) => {
    try {
      await authApi.unbindSys(sys);
      await loadBinds();
    } catch (e) {
      Alert.alert('解绑失败', (e as Error).message);
    }
  }, [loadBinds]);

  const doToggleVpn = useCallback(async (sys: SysUserVO, next: boolean) => {
    try {
      await authApi.toggleVpn(next);
      await loadBinds();
    } catch (e) {
      Alert.alert('切换失败', (e as Error).message);
    }
  }, [loadBinds]);

  // ============ 渲染 ============
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PageHeader
        title="登录 / 绑定"
        icon="user"
        fg={C.ink}
        badgeBg={C.lime}
        badgeFg={C.ink}
        onBack={() => router.back()}
        backLeft
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isAuthed ? (
          <AuthCard
            mode={mode}
            setMode={setMode}
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            email={email}
            setEmail={setEmail}
            code={code}
            setCode={setCode}
            showPwd={showPwd}
            setShowPwd={setShowPwd}
            forgotOpen={forgotOpen}
            setForgotOpen={setForgotOpen}
            countdown={countdown}
            sendCode={sendCode}
            loading={loading}
            error={error}
            onSubmit={onSubmit}
            onForgot={onForgot}
          />
        ) : (
          <BindCard
            user={user}
            binds={binds}
            bindLoading={bindLoading}
            openSys={openSys}
            setOpenSys={setOpenSys}
            bindForm={bindForm}
            setBindForm={setBindForm}
            bindBusy={bindBusy}
            doBind={doBind}
            doUnbind={doUnbind}
            doToggleVpn={doToggleVpn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============================ 账号视图 ============================ */

function AuthCard(props: {
  mode: Mode;
  setMode: (m: Mode) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  showPwd: boolean;
  setShowPwd: (v: boolean) => void;
  forgotOpen: boolean;
  setForgotOpen: (v: boolean) => void;
  countdown: number;
  sendCode: () => void;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
  onForgot: () => void;
}) {
  const {
    mode, setMode, username, setUsername, password, setPassword, email, setEmail,
    code, setCode, showPwd, setShowPwd, forgotOpen, setForgotOpen, countdown, sendCode,
    loading, error, onSubmit, onForgot,
  } = props;

  const registerMode = mode === 'register';

  return (
    <View style={styles.authWrap}>
      {/* 模式切换：登录 / 注册（贴纸胶囊） */}
      <View style={styles.segment}>
        <SegmentPill label="登录" active={mode === 'login'} onPress={() => { setMode('login'); setForgotOpen(false); }} />
        <SegmentPill label="注册" active={registerMode} onPress={() => { setMode('register'); setForgotOpen(false); }} />
      </View>

      <Sticker fill={C.white} radius={R.cardXl} offset={SHADOW.xl} style={styles.authCard}>
        <Field icon="user" placeholder="学工号 / 用户名" value={username} onChange={setUsername} autoCapitalize="none" />
        <View style={styles.gap} />
        <Field
          icon="lock"
          placeholder="密码"
          value={password}
          onChange={setPassword}
          secure={!showPwd}
          right={
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={10}>
              <Feather name={showPwd ? 'eye-off' : 'eye'} size={18} color={C.gray} />
            </TouchableOpacity>
          }
        />

        {registerMode && (
          <>
            <View style={styles.gap} />
            <Field icon="mail" placeholder="邮箱" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <View style={styles.gap} />
            <Field
              icon="hash"
              placeholder="邮箱验证码"
              value={code}
              onChange={setCode}
              keyboardType="number-pad"
              right={
                <TouchableOpacity onPress={sendCode} disabled={countdown > 0} hitSlop={8}>
                  <Text style={[styles.codeBtn, countdown > 0 && styles.codeBtnDisabled]}>
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Text>
                </TouchableOpacity>
              }
            />
          </>
        )}

        {forgotOpen && (
          <>
            <View style={styles.gap} />
            <Field icon="mail" placeholder="邮箱" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <View style={styles.gap} />
            <Field
              icon="hash"
              placeholder="重置验证码"
              value={code}
              onChange={setCode}
              keyboardType="number-pad"
              right={
                <TouchableOpacity onPress={sendCode} disabled={countdown > 0} hitSlop={8}>
                  <Text style={[styles.codeBtn, countdown > 0 && styles.codeBtnDisabled]}>
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Text>
                </TouchableOpacity>
              }
            />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.gap} />
        <StickerButton
          label={forgotOpen ? '重置密码' : registerMode ? '注册并登录' : '登录'}
          fill={C.lime}
          fg={C.ink}
          loading={loading}
          onPress={forgotOpen ? onForgot : onSubmit}
        />

        {!forgotOpen && (
          <TouchableOpacity style={styles.linkRow} onPress={() => setForgotOpen(!forgotOpen)}>
            <Text style={styles.link}>{registerMode ? '已有账号？去登录' : '忘记密码？'}</Text>
          </TouchableOpacity>
        )}
      </Sticker>

      {/* 微信登录（需接入微信 SDK；未接入前入口可见但提示） */}
      {!forgotOpen && (
        <View style={styles.gap} />
      )}
      {!forgotOpen && (
        <StickerButton
          label="微信一键登录"
          fill={C.ink}
          fg={C.white}
          onPress={() => Alert.alert('待接入', '微信登录需接入微信开放平台 SDK（已在后端 /user/wechat/login 就绪）。')}
        />
      )}
    </View>
  );
}

function SegmentPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Sticker fill={active ? C.lime : C.white} radius={R.pill} offset={active ? SHADOW.sm : 0} border={BORDER} style={styles.segPill}>
        <Text style={[styles.segText, { color: C.ink }]}>{label}</Text>
      </Sticker>
    </TouchableOpacity>
  );
}

function Field({
  icon, placeholder, value, onChange, secure, right, keyboardType, autoCapitalize,
}: {
  icon: any;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  right?: React.ReactNode;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <Sticker fill={C.oat} radius={R.card} offset={SHADOW.sm} border={BORDER} style={styles.field}>
      <Feather name={icon} size={18} color={C.gray} style={styles.fieldIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={C.gray}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        underlineColorAndroid="transparent"
      />
      {right}
    </Sticker>
  );
}

function StickerButton({
  label, fill, fg, onPress, loading, disabled,
}: {
  label: string;
  fill: string;
  fg: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Sticker fill={fill} radius={R.btn} offset={SHADOW.md} border={BORDER} style={styles.btnWrap}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={styles.btnTouch}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        )}
      </TouchableOpacity>
    </Sticker>
  );
}

/* ============================ 绑定视图 ============================ */

function BindCard(props: {
  user: any;
  binds: SysUserVO[];
  bindLoading: boolean;
  openSys: SysCode | null;
  setOpenSys: (s: SysCode | null) => void;
  bindForm: Record<string, { account: string; password: string }>;
  setBindForm: (f: Record<string, { account: string; password: string }>) => void;
  bindBusy: SysCode | null;
  doBind: (s: SysCode) => void;
  doUnbind: (s: SysCode) => void;
  doToggleVpn: (s: SysUserVO, next: boolean) => void;
}) {
  const { user, binds, bindLoading, openSys, setOpenSys, bindForm, setBindForm, bindBusy, doBind, doUnbind, doToggleVpn } = props;

  return (
    <View style={styles.bindWrap}>
      {/* ============ 用户信息卡（页头主卡） ============ */}
      <Sticker
        fill={C.lime}
        radius={R.cardXl}
        offset={SHADOW.xxl}
        style={styles.userCard}
      >
        <Text style={styles.userName} numberOfLines={1}>
          {user?.username || '校园用户'}
        </Text>
        <Text style={styles.userMeta} numberOfLines={1}>
          {user?.email || '未绑定邮箱'}
        </Text>
      </Sticker>

      {/* ============ 分区标题：绑定校园系统 ============ */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>绑定校园系统</Text>
        {bindLoading && binds.length > 0 && (
          <ActivityIndicator size="small" color={C.gray} />
        )}
      </View>

      {/* ============ 系统卡列表 ============ */}
      {bindLoading && !binds.length ? (
        <Sticker fill={C.white} radius={R.menu} offset={SHADOW.lg} style={styles.sysLoading}>
          <ActivityIndicator color={C.ink} />
          <Text style={styles.sysLoadingText}>正在获取绑定状态…</Text>
        </Sticker>
      ) : (
        /* 列表用 gap 控制间距，绝不用带高度的 spacer ——
           之前每张卡外面套 height:12 的 View，叠加硬投影后 4 张卡的
           投影互相覆盖，整块区域被压成一条黑边叠黑边 */
        <View style={styles.sysList}>
          {SYS_ORDER.map((sys) => {
            const meta = SYS_META[sys];
            const bound = binds.find((b) => b.sys_code === sys);
            const isOpen = openSys === sys;
            const f = bindForm[sys] || { account: '', password: '' };
            const busy = bindBusy === sys;

            return (
              <Sticker
                key={sys}
                fill={C.white}
                radius={R.menu}
                offset={SHADOW.lg}
                border={BORDER}
                style={styles.sysCard}
              >
                {/* --- 卡头：图标 + 名称/说明 + 右侧状态 --- */}
                <View style={styles.sysHead}>
                  <Sticker
                    fill={bound ? C.lime : C.ink}
                    radius={R.iconBox}
                    offset={0}
                    style={styles.sysIcon}
                  >
                    <Feather
                      name={meta.icon as any}
                      size={18}
                      color={bound ? C.ink : C.lime}
                    />
                  </Sticker>

                  <View style={styles.sysTitleBox}>
                    <Text style={styles.sysName} numberOfLines={1}>
                      {meta.name}
                    </Text>
                    <Text style={styles.sysDesc} numberOfLines={1}>
                      {meta.desc}
                    </Text>
                  </View>

                  {bound ? (
                    <View style={styles.boundBadge}>
                      <Feather name="check" size={11} color={C.ink} />
                      <Text style={styles.boundText}>已绑定</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setOpenSys(isOpen ? null : sys)}
                      hitSlop={8}
                      activeOpacity={0.8}
                    >
                      <View style={styles.bindCta}>
                        <Text style={styles.bindCtaText}>{isOpen ? '收起' : '去绑定'}</Text>
                        <Feather
                          name={isOpen ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={C.ink}
                        />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {/* --- 已绑定：账号 + VPN 开关 + 解绑 --- */}
                {bound && (
                  <View style={styles.boundPanel}>
                    <View style={styles.boundInfoRow}>
                      <Text style={styles.boundInfoLabel}>账号</Text>
                      <Text style={styles.boundInfoValue} numberOfLines={1}>
                        {bound.username}
                      </Text>
                    </View>

                    <View style={styles.boundActions}>
                      {sys === 'jwxt' && (
                        <TouchableOpacity
                          style={styles.vpnToggle}
                          onPress={() => doToggleVpn(bound, !bound.vpn_enabled)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.vpnDot,
                              { backgroundColor: bound.vpn_enabled ? C.lime : C.oat },
                            ]}
                          />
                          <Text style={styles.vpnText}>
                            VPN {bound.vpn_enabled ? '已开启' : '已关闭'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.boundSpacer} />

                      <TouchableOpacity
                        style={styles.unbindBtn}
                        onPress={() => doUnbind(sys)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.unbindText}>解绑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* --- 未绑定且展开：账号密码表单 --- */}
                {!bound && isOpen && (
                  <View style={styles.bindForm}>
                    <Field
                      icon="user"
                      placeholder={`${meta.name}账号`}
                      value={f.account}
                      onChange={(v) => setBindForm({ ...bindForm, [sys]: { ...f, account: v } })}
                      autoCapitalize="none"
                    />
                    <View style={styles.formGap} />
                    <Field
                      icon="lock"
                      placeholder="密码"
                      value={f.password}
                      onChange={(v) => setBindForm({ ...bindForm, [sys]: { ...f, password: v } })}
                      secure
                    />
                    <View style={styles.formGap} />
                    <StickerButton
                      label={busy ? '绑定中…' : '确认绑定'}
                      fill={C.lime}
                      fg={C.ink}
                      loading={busy}
                      onPress={() => doBind(sys)}
                    />
                    <Text style={styles.bindNote}>
                      凭据仅用于代查该系统的数据，不会用于其他用途。
                    </Text>
                  </View>
                )}
              </Sticker>
            );
          })}
        </View>
      )}

    </View>
  );
}

/* ============================ 样式 ============================ */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // 账号视图
  authWrap: { marginTop: 8 },
  segment: { flexDirection: 'row', gap: 12, marginBottom: 16, paddingHorizontal: 4 },
  segPill: { paddingHorizontal: 22, paddingVertical: 9 },
  segText: { fontFamily: DISPLAY, fontSize: 16 },
  authCard: { padding: 18, gap: 0 },
  field: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 4, height: 52 },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, fontFamily: DISPLAY, fontSize: 16, color: C.ink },
  codeBtn: { fontFamily: DISPLAY, fontSize: 13, color: C.ink, backgroundColor: C.lime, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  codeBtnDisabled: { color: C.gray, backgroundColor: C.oat },
  gap: { height: 12 },
  error: { color: '#D23B3B', fontSize: 13, marginTop: 10 },
  btnWrap: { height: 52 },
  btnTouch: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: DISPLAY, fontSize: 18, letterSpacing: 0.5 },
  linkRow: { alignItems: 'center', marginTop: 14 },
  link: { color: C.gray, fontSize: 13 },

  // ===================== 绑定视图 =====================
  bindWrap: { marginTop: 8 },

  // 页头主卡
  userCard: { padding: 20 },
  userName: { fontFamily: DISPLAY, fontSize: 24, lineHeight: 30, color: C.ink },
  userMeta: { fontSize: 14, lineHeight: 19, color: C.inkSoft, marginTop: 2 },

  // 分区标题
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontFamily: DISPLAY, fontSize: 18, lineHeight: 24, color: C.ink },

  // 系统卡列表 —— 用 gap 排间距（不要用带高度的 spacer 包卡片）
  sysList: { gap: 14 },

  sysLoading: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sysLoadingText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.gray },

  sysCard: { padding: 16 },

  sysHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sysIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sysTitleBox: { flex: 1, gap: 2 },
  sysName: { fontFamily: DISPLAY, fontSize: 16, lineHeight: 21, color: C.ink },
  sysDesc: { fontSize: 11.5, lineHeight: 16, color: C.gray },

  // 已绑定徽章
  boundBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.lime,
    borderRadius: R.pill,
    borderWidth: BORDER,
    borderColor: C.ink,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  boundText: { fontFamily: DISPLAY, fontSize: 11.5, lineHeight: 15, color: C.ink },

  // 去绑定按钮
  bindCta: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.oat,
    borderRadius: R.pill,
    borderWidth: BORDER,
    borderColor: C.ink,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  bindCtaText: { fontFamily: DISPLAY, fontSize: 12.5, lineHeight: 16, color: C.ink },

  // 已绑定详情面板
  boundPanel: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
    gap: 10,
  },
  boundInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
  boundInfoLabel: { fontSize: 12, lineHeight: 16, color: C.gray },
  boundInfoValue: {
    flex: 1,
    fontFamily: DISPLAY,
    fontSize: 13,
    lineHeight: 17,
    color: C.ink,
    textAlign: 'right',
  },
  boundActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boundSpacer: { flex: 1 },
  vpnToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.oat,
    borderRadius: R.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  vpnDot: { width: 8, height: 8, borderRadius: 999, borderWidth: 1.5, borderColor: C.ink },
  vpnText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.ink },
  unbindBtn: {
    borderRadius: R.pill,
    borderWidth: BORDER,
    borderColor: C.ink,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: C.white,
  },
  unbindText: { fontFamily: DISPLAY, fontSize: 12.5, lineHeight: 16, color: C.ink },

  // 展开的绑定表单
  bindForm: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  formGap: { height: 10 },
  bindNote: { fontSize: 10.5, lineHeight: 15, color: C.gray, marginTop: 10, paddingHorizontal: 2 },

});
