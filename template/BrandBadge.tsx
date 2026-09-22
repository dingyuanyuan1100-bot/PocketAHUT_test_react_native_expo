import { StyleSheet, Text, View } from 'react-native';
import Sticker from './Sticker';
import { C, DISPLAY, SHADOW } from './theme';

type Props = {
  /** 徽章文案 */
  label?: string;
  /** 是否带贴纸硬投影 */
  hardShadow?: boolean;
};

/** 品牌徽章：黑底 + 绿点 + 文字 */
export default function BrandBadge({
  label = '校园服务 · 课程表',
  hardShadow = true,
}: Props) {
  return (
    <Sticker
      wrapStyle={styles.wrap}
      style={styles.badge}
      fill={C.ink}
      radius={999}
      offset={hardShadow ? SHADOW.sm : 0}
      border={0}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>{label}</Text>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.lime,
  },
  text: {
    fontFamily: DISPLAY,
    fontSize: 11,
    fontWeight: '600',
    color: C.cream,
  },
});
