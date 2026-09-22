import { StyleSheet, Text, View } from 'react-native';
import Sticker from './Sticker';
import { C, SHADOW, inkA } from './theme';

type Props = {
  /** 胶囊文案 */
  label: string;
  /** 胶囊底色，默认白 */
  fill?: string;
  /** 文字颜色 */
  color?: string;
  /**
   * 左侧标记样式：
   *   - 'bar'  青柠 11×3 横条（用于「已登录但缺前置条件」「通用状态规范」）
   *   - 'dot'  圆形圆点（用于「未登录」，弱一档）
   */
  sign?: 'bar' | 'dot';
  /** 圆点 / 横条颜色 */
  signColor?: string;
};

/**
 * 状态胶囊 —— 页面标题右侧的状态标识。
 *
 * 视觉规范（对齐画布「课程表 未登录」「课程表 未绑定教务」与通用状态三屏）：
 *   白底 / oat 底 + 2px 墨黑内描边 + 零模糊硬投影（2,2）+ 左侧标记 + 11px 半粗文字
 *
 * 层级约定：
 *   未登录         → oat 底 + 灰圆点（最低一层信息）
 *   已登录缺前置    → 白底 + 青柠横条（强调「只差一步」）
 *   通用状态规范    → 白底 + 青柠横条 + 英文态名（Empty / Loading / Error）
 */
export default function StatusPill({
  label,
  fill = C.white,
  color = C.ink,
  sign = 'bar',
  signColor = C.lime,
}: Props) {
  return (
    <Sticker
      style={styles.pill}
      fill={fill}
      radius={999}
      offset={SHADOW.sm}
      wrapStyle={styles.wrap}
    >
      {sign === 'bar' ? (
        <View style={[styles.bar, { backgroundColor: signColor }]} />
      ) : (
        <View style={[styles.dot, { backgroundColor: signColor }]} />
      )}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Sticker>
  );
}

/** 未登录态的预设：oat 底 + 灰圆点 */
export function GuestPill({ label = '未登录' }: { label?: string }) {
  return <StatusPill label={label} fill={C.oat} color={C.gray} sign="dot" signColor={inkA(0.45)} />;
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingLeft: 9,
    paddingRight: 11,
    paddingVertical: 5,
  },
  bar: {
    width: 11,
    height: 3,
    borderRadius: 999,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
