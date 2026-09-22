import { StyleSheet, View } from 'react-native';
import { C } from './theme';
import SquareJellyBox from './SquareJellyBox';

/** 骨架块的基础色：燕麦色，和教学网格同源 */
const BLOCK = C.oat;

/** 每一列（星期）里骨架块的相对高度，模仿真实课表的疏密节奏 */
const COLUMN_PATTERN: number[][] = [
  [26, 34, 22],
  [32, 26, 24],
  [26, 26, 30],
  [34, 22, 26],
  [26, 30, 26],
];

/**
 * 课表骨架屏 —— 对齐画布「通用状态规范 加载中」(`120:157`) 的结构。
 *
 * 为什么用骨架而不是转圈：
 *   骨架保留了页面的**结构轮廓**，数据到达时内容不会整体跳动；
 *   转圈只有一个中心点，切换瞬间布局会「长出来」，体感更差。
 *
 * 加载态刻意不提供任何可点击元素。
 */
export default function ScheduleSkeleton({
  /** 进度条填充比例（0-1），没有真实进度时传 undefined 走满格待定样式 */
  progress,
}: {
  progress?: number;
}) {
  return (
    <View style={styles.wrap}>
      {/* 果冻方块动效：真实进度拿不到，用节奏明确的循环动画提示「正在加载」 */}
      <SquareJellyBox size={44} color={C.ink} duration={620} />

      {/* 进度轨道 */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            progress === undefined
              ? styles.fillIndeterminate
              : { width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` },
          ]}
        />
      </View>

      {/* 标题 / 副标题骨架 */}
      <View style={styles.titleSk} />
      <View style={styles.subSk} />

      {/* 网格骨架 */}
      <View style={styles.grid}>
        {COLUMN_PATTERN.map((col, ci) => (
          <View key={ci} style={styles.col}>
            {col.map((h, ri) => (
              <View key={ri} style={[styles.cell, { height: h }]} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: 14,
    alignItems: 'center',
  },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 999,
    backgroundColor: BLOCK,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.lime,
  },
  fillIndeterminate: {
    width: '38%',
  },
  titleSk: {
    width: 168,
    height: 22,
    borderRadius: 8,
    backgroundColor: BLOCK,
  },
  subSk: {
    width: 232,
    height: 12,
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  grid: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  col: {
    flex: 1,
    gap: 5,
  },
  cell: {
    borderRadius: 8,
    backgroundColor: BLOCK,
  },
});
