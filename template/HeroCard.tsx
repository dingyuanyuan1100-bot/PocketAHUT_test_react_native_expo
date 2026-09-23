import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import Sticker from './Sticker';
import usePressFeedback from './motion/usePressFeedback';
import { C, DISPLAY, FeatherName, inkA, limeA, R, SHADOW } from './theme';

type Props = {
  title: string;
  sub: string;
  icon: FeatherName;
  badge: string;
  dark?: boolean;
  /**
   * 点击后跳转的路由（如 `/grades`）。
   *
   * 不传表示这张卡还只是装饰（对应页面尚未接入真实接口），
   * 此时**不加可按压效果**，避免给用户一个按了没反应的按钮。
   */
  route?: string;
  onPress?: () => void;
};

/**
 * 通栏大卡片：实心品牌色底 + 2px 墨黑描边 + 零模糊硬投影。
 * dark=true 走墨黑底 / 青柠前景，否则走青柠底 / 墨黑前景。
 *
 * 交互分两拍，都是「贴纸」语义下最直接的做法：
 *   1. 按下 → 本体朝硬投影方向平移 offset，把投影盖掉（视觉上「压到桌面上」）
 *   2. 松手 → `router.push(route)`，下一页由 Stack 从右侧滑入
 *      （转场交给导航层，见 `app/_layout.tsx` 的 `animation: 'slide_from_right'`）
 */
export default function HeroCard({ title, sub, icon, badge, dark, route, onPress }: Props) {
  const fg = dark ? C.white : C.ink;
  const subColor = dark ? limeA(0.85) : inkA(0.62);
  const fill = dark ? C.ink : C.lime;

  const { progress: press, pressIn, pressOut } = usePressFeedback();
  const handlePress = onPress ?? (route ? () => router.push(route as never) : undefined);

  const body = (
    <Sticker
      fill={fill}
      radius={R.hero}
      offset={SHADOW.lg}
      pressProgress={handlePress ? press : undefined}
      style={styles.heroCard}
    >
      <View style={styles.heroInner}>
        <View style={[styles.heroIconBox, { backgroundColor: dark ? C.lime : C.ink }]}>
          <Feather name={icon} size={26} color={dark ? C.ink : C.lime} />
        </View>
        <View style={styles.heroTextCol}>
          <Text style={[styles.heroTitle, { color: fg }]}>{title}</Text>
          <Text style={[styles.heroSub, { color: subColor }]}>{sub}</Text>
        </View>
        <View style={styles.heroRight}>
          <Badge text={badge} bg={dark ? C.lime : C.ink} color={dark ? C.ink : C.lime} />
          <Feather name="chevron-right" size={20} color={dark ? C.lime : C.ink} />
        </View>
      </View>
    </Sticker>
  );

  if (!handlePress) return body;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={styles.pressable}
    >
      {body}
    </Pressable>
  );
}

function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  heroCard: {
    height: 92,
  },
  heroInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    fontFamily: DISPLAY,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 11,
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: DISPLAY,
    fontSize: 10,
  },
});
