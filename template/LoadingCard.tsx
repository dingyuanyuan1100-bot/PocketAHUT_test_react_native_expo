import { StyleSheet, Text, View } from 'react-native';
import { C, DISPLAY } from './theme';
import SquareJellyBox from './SquareJellyBox';

/**
 * 通用加载卡 —— 二级页面的首屏加载态。
 *
 * 与课表骨架屏（ScheduleSkeleton）的分工：
 *   - 有明确结构可保留（课表网格）→ 用骨架屏，数据到达时布局不跳动；
 *   - 结构简单（列表/详情/表单）→ 用本组件，只给动效 + 一句说明。
 *
 * 加载态刻意**不提供任何可点击元素**（通用状态规范约定）。
 */
export default function LoadingCard({
  /** 说明文案 */
  label = '正在加载…',
  /** 是否撑满剩余高度（页面级加载传 true） */
  fill = true,
  /** 果冻方块边长 */
  size = 44,
}: {
  label?: string;
  fill?: boolean;
  size?: number;
}) {
  return (
    <View style={[styles.wrap, fill && styles.fill]}>
      <SquareJellyBox size={size} color={C.ink} duration={620} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  fill: {
    flexGrow: 1,
  },
  label: {
    fontFamily: DISPLAY,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    color: C.gray,
    textAlign: 'center',
  },
});
