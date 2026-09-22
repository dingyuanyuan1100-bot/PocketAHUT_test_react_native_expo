import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DISPLAY, FeatherName } from './theme';

type Props = {
  /** 页面标题 —— 严格居中：文本框铺满整行，左右元素压在其上 */
  title: string;
  /** 左侧贴纸图标（与 iconNode 二选一） */
  icon?: FeatherName;
  /** 左侧自定义节点（如返回按钮贴纸），给了就不渲染 icon 贴纸 */
  iconNode?: ReactNode;
  /** 左侧贴纸边长（设计稿：44 / 52），默认 44 */
  iconSize?: number;
  iconBg?: string;
  iconFg?: string;
  /** 标题、chevron 与右组文字色 */
  fg: string;
  /** BACK 徽章底色 / 字色 */
  badgeBg: string;
  badgeFg: string;
  /** 返回回调；不传则不渲染 BACK 徽章 */
  onBack?: () => void;
  /** BACK 徽章之后的额外内容（默认落在右端） */
  extra?: ReactNode;
  /** 是否渲染右端 chevron（默认 true） */
  showChevron?: boolean;
  /** 是否渲染左侧大图标贴纸（默认 true；置 false 可纯留标题） */
  showIcon?: boolean;
  /** BACK + 箭头停靠位置：'right'（默认）或 'left'（贴最左，二级页常用） */
  backLeft?: boolean;
  /** 行高，默认取 iconSize */
  height?: number;
  /** 标题字号，默认 22 */
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
};

export default function PageHeader({
  title,
  icon,
  iconNode,
  iconSize = 44,
  iconBg = '#111214',
  iconFg = '#FFFFFF',
  fg,
  badgeBg,
  badgeFg,
  onBack,
  extra,
  showChevron = true,
  showIcon = true,
  backLeft = false,
  height,
  fontSize = 22,
  style,
}: Props) {
  const h = height ?? iconSize;

  // 返回按钮：箭头 + BACK 文字合成【一枚】按钮，整体可点（箭头不再游离在外）
  const backButton = onBack ? (
    <TouchableOpacity activeOpacity={0.8} onPress={onBack} hitSlop={8}>
      <View style={[styles.backBtn, { backgroundColor: badgeBg }]}>
        {showChevron && <Feather name="chevron-left" size={13} color={badgeFg} />}
        <Text style={[styles.badgeText, { color: badgeFg }]}>BACK</Text>
      </View>
    </TouchableOpacity>
  ) : null;

  return (
    <View style={[styles.row, { height: h }, style]}>
      {/* 标题：铺满整行 + 水平垂直双居中 */}
      <Text style={[styles.title, { color: fg, fontSize }]} numberOfLines={1}>
        {title}
      </Text>

      {backLeft ? (
        /* 左：返回按钮（贴最左，箭头与 BACK 同属一个按钮） */
        <View style={styles.leftGroup}>{backButton}</View>
      ) : (
        /* 左：旋转贴纸图标 */
        <View style={[styles.left, { top: (h - iconSize) / 2 }]}>
          {iconNode ?? (
            showIcon && (
              <View
                style={[
                  styles.iconSticker,
                  {
                    width: iconSize,
                    height: iconSize,
                    borderRadius: Math.round(iconSize * 0.34),
                    backgroundColor: iconBg,
                  },
                ]}
              >
                <Feather name={icon ?? 'circle'} size={Math.round(iconSize * 0.42)} color={iconFg} />
              </View>
            )
          )}
        </View>
      )}

      {/* 右：返回按钮（非 backLeft 时落在这里）+ 额外内容；backLeft 时仅留 extra */}
      <View style={styles.right}>
        {backLeft ? (
          extra
        ) : (
          <>
            {backButton}
            {extra}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    justifyContent: 'center',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    fontFamily: DISPLAY,
    letterSpacing: -0.3,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  left: {
    position: 'absolute',
    left: 0,
  },
  leftGroup: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconSticker: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  right: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  /** 返回按钮：‹ BACK 同一枚胶囊，箭头在文字之前 */
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: DISPLAY,
    fontSize: 10,
  },
});
