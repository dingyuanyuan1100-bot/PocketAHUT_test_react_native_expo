import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, FeatherName } from './theme';

/** 占位页：图标 + 大字标题 + 建设中提示 */
export default function PlaceholderPage({ title, icon }: { title: string; icon: FeatherName }) {
  return (
    <View style={styles.placeholder}>
      <View style={styles.placeholderIconBox}>
        <Feather name={icon} size={40} color={C.ink} />
      </View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSub}>页面建设中 · 敬请期待</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 40,
  },
  placeholderIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  placeholderTitle: {
    fontFamily: 'DingTalkJinBuTi',
    fontSize: 28,
    color: C.ink,
    marginTop: 8,
  },
  placeholderSub: {
    fontSize: 12,
    color: C.gray,
  },
});
