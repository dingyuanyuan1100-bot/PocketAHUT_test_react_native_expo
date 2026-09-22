import { Pressable, StyleSheet, Text } from 'react-native';
import Sticker from './Sticker';
import { C, SHADOW } from './theme';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** 选中态底色，默认青柠 */
  activeFill?: string;
  /** 未选中态底色，默认白 */
  idleFill?: string;
  disabled?: boolean;
};

/**
 * 可选择的贴纸胶囊 —— 用于筛选（成绩的必修/选修）与金额档位（电费充值）。
 *
 * 选中态用青柠实心 + 墨黑描边，未选中态用白底 + 墨黑描边：
 * 两者描边一致，只靠填色区分 —— 这样一排胶囊不会因为粗细不一而歪掉。
 */
export default function Chip({
  label,
  active = false,
  onPress,
  activeFill = C.lime,
  idleFill = C.white,
  disabled,
}: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Sticker
        style={styles.chip}
        fill={active ? activeFill : idleFill}
        radius={999}
        offset={active ? SHADOW.sm : 0}
      >
        <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
      </Sticker>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: C.gray,
  },
  textActive: {
    color: C.ink,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
});
