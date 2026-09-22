import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import BrandBadge from '../template/BrandBadge';
import Sticker from '../template/Sticker';
import { C, DISPLAY, FeatherName, R, SHADOW, inkA, limeA } from '../template/theme';
import { useAuth } from '../store/AuthContext';

// ===================== 页面数据 =====================
/**
 * 统计砖的配色（对齐画布 6:1 的 Stats Grid）。
 *
 * ⚠️ 为什么数值是 `—`：
 *   这三个口径在接口文档 §3 里**没有可用的端点和字段** ——
 *   「一卡通余额」「二课积分」查无接口；「绩点」虽有 `GET /jwxt/grades`，
 *   但文档 §6.3 明确声明未展开 data 结构，字段名无从确证。
 *   所以这里宁可显示 `—`，也不填一个看起来真实的假数字。
 *   等对应接口就绪后，把 value 换成真实字段即可，界面结构完全不用动。
 */
const STAT_DEFS = [
  { label: '一卡通', value: '—', fill: C.lime, valueColor: C.ink, labelColor: inkA(0.72) },
  { label: '绩点', value: '—', fill: C.ink, valueColor: C.lime, labelColor: limeA(0.85) },
  { label: '二课积分', value: '—', fill: C.white, valueColor: C.ink, labelColor: C.gray },
];

type MenuRow = {
  icon: FeatherName;
  label: string;
  sub: string;
  fill: string;
  iconColor: string;
  /** 已实现的目标路由；没有路由的行只作展示 */
  route?: string;
};

const MENU_ACCOUNT: MenuRow[] = [
  { icon: 'star', label: '高级功能', sub: '定时推送提醒，邮件自动通知', fill: C.lime, iconColor: C.ink },
  // 绑定账号走登录/绑定页（未登录时它就是登录页，已登录时是系统绑定面板）
  { icon: 'link', label: '绑定账号', sub: '绑定教务系统、宿舍系统账号', fill: C.ink, iconColor: C.lime, route: '/login' },
  // ⚠️ 房间绑定（查电费）与晚寝账号签到是两件事：
  //    /dorm-bind  绑房间（校区+楼栋+3 位房号）→ 查电费
  //    /dorm-sign  晚寝签到
  // 早先这里误指到 /dorm-sign，点「宿舍绑定」会跳到签到页。
  { icon: 'home', label: '宿舍房间绑定', sub: '绑定房间后可查询电费余额', fill: C.limeDeep, iconColor: C.ink, route: '/dorm-bind' },
];

const MENU_OTHER: MenuRow[] = [
  { icon: 'settings', label: '设置', sub: '主题、字体等个性化设置', fill: C.ink, iconColor: C.lime },
  { icon: 'message-circle', label: '意见反馈', sub: '加入用户群，帮助我们做得更好', fill: C.lime, iconColor: C.ink },
  { icon: 'file-text', label: '免责声明', sub: '使用条款与用户协议', fill: C.white, iconColor: C.ink },
  { icon: 'info', label: '关于我们', sub: '版本信息与使用说明', fill: C.limeDeep, iconColor: C.ink },
];

/** 第 4 页：我的（个人中心） */
export default function ProfilePage() {
  const { user, isAuthed, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      // logout 内部会撤销 refresh token 并清空安全存储，失败也不会卡住 UI
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }, [logout]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 品牌徽章（对齐画布 6:1 顶部 32:1） */}
      <BrandBadge />

      {/* ===================== 头部主卡（青柠实心贴纸） ===================== */}
      <View style={styles.headerWrap}>
        <Sticker style={styles.headerCard} fill={C.lime} radius={R.cardXl} offset={SHADOW.xxl}>
          {/* 标题行 */}
          <View style={styles.headerTopRow}>
            <Text style={styles.pageTitle}>我的</Text>
            <Sticker
              style={styles.iconBtn}
              fill={C.white}
              radius={R.iconBox}
              offset={SHADOW.md}
            >
              <Feather name="settings" size={20} color={C.ink} />
            </Sticker>
          </View>

          {/* 用户行 */}
          <View style={styles.userRow}>
            <Sticker
              style={styles.avatar}
              fill={C.cream}
              radius={R.pill}
              border={2.5}
              offset={SHADOW.lg}
              clip
            >
              <Image
                source={require('../assets/chibi/avatar.png')}
                style={styles.avatarImg}
              />
            </Sticker>

            <View style={styles.userInfo}>
              {/* 真实用户：昵称取 /user/info 的 username，ID 取 user.id */}
              <Text style={styles.nickname} numberOfLines={1}>
                {isAuthed ? user?.username || '已登录' : '未登录'}
              </Text>
              <Text style={styles.userId}>
                {isAuthed ? `ID: ${user?.id ?? '—'}` : '登录后同步你的校园数据'}
              </Text>
            </View>

            {!isAuthed && (
              <Pressable onPress={() => router.push('/login')} hitSlop={6}>
                <Sticker style={styles.loginChip} fill={C.ink} radius={R.pill} offset={SHADOW.md}>
                  <Text style={styles.loginChipText}>登录</Text>
                </Sticker>
              </Pressable>
            )}

            <Sticker
              style={styles.iconBtn}
              fill={C.white}
              radius={R.iconBox}
              offset={SHADOW.md}
            >
              <Feather name="edit-2" size={18} color={C.ink} />
            </Sticker>

            {/* 旋转贴纸星点缀 */}
            <Sticker
              wrapStyle={styles.starWrap}
              style={styles.starBox}
              fill={C.ink}
              radius={10}
              borderColor={C.lime}
              offset={SHADOW.sm}
            >
              <MaterialCommunityIcons name="star-four-points" size={14} color={C.lime} />
            </Sticker>
          </View>
        </Sticker>
      </View>

      {/* ===================== 主体 ===================== */}
      <View style={styles.body}>
        {/* 统计行 */}
        <View style={styles.statsRow}>
          {STAT_DEFS.map((s) => (
            <Sticker
              key={s.label}
              wrapStyle={styles.statWrap}
              style={styles.statBox}
              fill={s.fill}
              radius={R.stat}
              offset={SHADOW.lg}
            >
              <Text style={[styles.statValue, { color: s.valueColor }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: s.labelColor }]}>{s.label}</Text>
            </Sticker>
          ))}
        </View>

        {/* 说明为什么是「—」，避免用户以为是加载失败 */}
        <Text style={styles.statsNote}>一卡通 / 绩点 / 二课积分 将在接入对应接口后显示</Text>

        {/* 支持我们 */}
        <Sticker
          style={styles.supportCard}
          fill={C.ink}
          radius={R.cardLg}
          offset={SHADOW.xl}
        >
          <View style={styles.supportLeft}>
            <Sticker style={styles.supportIconBox} fill={C.lime} radius={R.iconBox} offset={0}>
              <Feather name="heart" size={18} color={C.ink} />
            </Sticker>
            <View style={styles.supportText}>
              <Text style={styles.supportTitle}>支持我们</Text>
              <Text style={styles.supportSub}>观看广告，为项目做贡献</Text>
            </View>
          </View>

          <Sticker
            style={styles.supportBtn}
            fill={C.lime}
            radius={R.pill}
            offset={SHADOW.md}
          >
            <Text style={styles.supportBtnText}>观看广告</Text>
          </Sticker>
        </Sticker>

        {/* 账号管理 / 其他 */}
        <MenuGroup title="账号管理" rows={MENU_ACCOUNT} />
        <MenuGroup title="其他" rows={MENU_OTHER} />

        {/* 退出登录：真实调用 POST /user/logout，成功后清空会话并回到未登录态 */}
        {isAuthed ? (
          <Pressable onPress={onLogout} disabled={loggingOut}>
            <Sticker style={styles.logoutBtn} fill={C.ink} radius={R.pill} offset={SHADOW.xl}>
              {loggingOut ? (
                <ActivityIndicator color={C.lime} />
              ) : (
                <Text style={styles.logoutText}>退出登录</Text>
              )}
            </Sticker>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/login')}>
            <Sticker style={styles.logoutBtn} fill={C.ink} radius={R.pill} offset={SHADOW.xl}>
              <Text style={styles.logoutText}>登录 / 注册</Text>
            </Sticker>
          </Pressable>
        )}

        {/* 版本信息 */}
        <Text style={styles.version}>campus-app v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

/** 菜单分组 */
function MenuGroup({ title, rows }: { title: string; rows: MenuRow[] }) {
  return (
    <View style={styles.menuGroup}>
      <Text style={styles.menuGroupTitle}>{title}</Text>
      <Sticker style={styles.menuCard} fill={C.white} radius={R.menu} offset={SHADOW.xl} clip>
        {rows.map((r, i) => (
          <TouchableOpacity
            key={r.label}
            activeOpacity={0.7}
            onPress={r.route ? () => router.push(r.route as never) : undefined}
            style={[styles.menuItem, i < rows.length - 1 && styles.menuItemDivider]}
          >
            <Sticker style={styles.menuIconBox} fill={r.fill} radius={R.iconBox} offset={0}>
              <Feather name={r.icon} size={18} color={r.iconColor} />
            </Sticker>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuLabel}>{r.label}</Text>
              <Text style={styles.menuSub} numberOfLines={1}>
                {r.sub}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={inkA(0.35)} />
          </TouchableOpacity>
        ))}
      </Sticker>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 150, // 给悬浮导航栏留出空间
  },

  // ===================== 头部主卡 =====================
  headerWrap: {
    paddingHorizontal: 6,
    paddingTop: 10,
  },
  headerCard: {
    gap: 18,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 12,
    paddingBottom: 22,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontFamily: DISPLAY,
    fontSize: 34,
    letterSpacing: -1.4,
    color: C.ink,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: R.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    flex: 1,
    gap: 6,
  },
  nickname: {
    fontFamily: DISPLAY,
    fontSize: 26,
    letterSpacing: -0.8,
    color: C.ink,
  },
  userId: {
    fontSize: 11,
    fontWeight: '600',
    color: inkA(0.6),
  },
  loginChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R.pill,
  },
  loginChipText: {
    fontFamily: DISPLAY,
    fontSize: 13,
    color: C.lime,
  },
  starWrap: {
    position: 'absolute',
    left: 52,
    top: 54,
    transform: [{ rotate: '-12deg' }],
  },
  starBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===================== 主体 =====================
  body: {
    paddingHorizontal: 16,
    marginTop: 16, // 设计稿 Content Wrapper 的 paddingTop
    gap: 16,
  },

  // 统计行
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statWrap: {
    flex: 1,
  },
  statBox: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  statValue: {
    fontFamily: DISPLAY,
    fontSize: 24,
    letterSpacing: -1.1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  statsNote: {
    fontSize: 10.5,
    lineHeight: 15,
    color: inkA(0.5),
    textAlign: 'center',
    marginTop: -6,
  },

  // 支持我们
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  supportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  supportIconBox: {
    width: 40,
    height: 40,
    borderRadius: R.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportText: {
    gap: 2,
  },
  supportTitle: {
    fontFamily: DISPLAY,
    fontSize: 17,
    letterSpacing: -0.5,
    color: C.white,
  },
  supportSub: {
    fontSize: 11,
    fontWeight: '600',
    color: limeA(0.8),
  },
  supportBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },

  // 菜单分组
  menuGroup: {
    // 间距交给父级 gap 16
  },
  menuGroupTitle: {
    fontFamily: DISPLAY,
    fontSize: 17,
    letterSpacing: -0.4,
    color: C.ink,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: R.menu,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuItemDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: C.hairline,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: R.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextBox: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  menuSub: {
    fontSize: 11,
    color: C.gray,
  },

  // 退出登录
  logoutBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: C.lime,
  },

  // 版本信息
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: '#6B6E73',
  },
});
