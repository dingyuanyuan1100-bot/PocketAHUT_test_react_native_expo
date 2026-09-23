import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import Sticker from './Sticker';
import { C, R, SHADOW } from './theme';

/**
 * 二级页首屏加载态的贴纸外壳：白底通栏 + 零模糊硬投影 + 撑满剩余高度。
 *
 * 抽出来是因为 6 个页面各写了一遍同样的 5 行 Sticker 属性加两份同样的样式，
 * 区别只在于里面装的是 `<LoadingCard>` 还是课表骨架屏。
 *
 * 内容与外壳的分工和原先一致：
 *   - 装 `<LoadingCard>` → 动效 + 一句说明；
 *   - 装 `<ScheduleSkeleton>` + 文字 → 有明确结构可保留时用骨架屏，数据到达时布局不跳动。
 *
 * 关于内边距与 gap：它们是原先课表那版（内部有两个子元素）的取值。
 * 对只装一个子元素的调用方，`gap` 不生效、而内层 `LoadingCard` 自带
 * `alignSelf: stretch` + `flexGrow: 1`，所以水平内边距与居中属性同样不影响其落位 ——
 * 也就是两种内容共用这套取值在视觉上是等价的。
 */
export default function LoadingShell({ children }: { children: ReactNode }) {
  return (
    <Sticker
      style={styles.card}
      wrapStyle={styles.wrap}
      fill={C.white}
      radius={R.menu}
      offset={SHADOW.xl}
    >
      {children}
    </Sticker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
});
