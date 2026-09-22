import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { BORDER, C, R, SHADOW } from './theme';

type Props = {
  /** 卡片本体样式：尺寸、内边距、排列方式写在这里 */
  style?: StyleProp<ViewStyle>;
  /** 外层定位容器样式：position / flex / margin 写在这里 */
  wrapStyle?: StyleProp<ViewStyle>;
  /** 卡片填充色 */
  fill?: string;
  /** 圆角 */
  radius?: number;
  /** 硬投影偏移，0 = 不投影 */
  offset?: number;
  /** 描边粗细 */
  border?: number;
  /** 描边颜色 */
  borderColor?: string;
  /** 硬投影颜色 */
  shadowColor?: string;
  /** 是否把子元素裁切到圆角内（菜单卡这类需要） */
  clip?: boolean;
  children?: ReactNode;
};

/**
 * 贴纸容器：2px 墨黑描边 + 零模糊硬投影。
 *
 * 这里刻意不用 elevation / shadowRadius —— Android 的 elevation 一定是模糊阴影，
 * 会把「贴纸」的硬边质感糊掉。改为自己画一层向右下偏移的墨黑底板，
 * 双端呈现完全一致，也正好对应设计稿里 radius: 0 的 DROP_SHADOW。
 */
export default function Sticker({
  style,
  wrapStyle,
  fill = C.white,
  radius = R.card,
  offset = SHADOW.lg,
  border = BORDER,
  borderColor = C.ink,
  shadowColor = C.ink,
  clip = false,
  children,
}: Props) {
  return (
    <View style={wrapStyle}>
      {offset > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.slab,
            {
              left: offset,
              top: offset,
              right: -offset,
              bottom: -offset,
              backgroundColor: shadowColor,
              borderRadius: radius,
            },
          ]}
        />
      )}
      <View
        style={[
          {
            backgroundColor: fill,
            borderRadius: radius,
            borderWidth: border,
            borderColor,
          },
          clip && styles.clip,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slab: {
    position: 'absolute',
  },
  clip: {
    overflow: 'hidden',
  },
});
