import { Children } from 'react';
import type { ReactNode } from 'react';
import StaggerIn from './StaggerIn';

/**
 * 错峰淡入的间隔：**4 帧 @60fps ≈ 66.7ms**。
 *
 * 为什么把「帧」直接写成常量而不是让调用方传毫秒：
 * 这个节奏是按「每 4 帧落一块」约定的，换算成 ms 后是个无限小数（66.666…），
 * 直接写 67 会在内容块多的时候逐块累积误差（12 块就差 4ms）。留在这里统一换算。
 */
export const STEP_4_FRAMES = (1000 / 60) * 4;

type Props = {
  /** 是否开始揭示。传 false 时全部保持隐藏，等外部信号（如数据就绪）再一起落位 */
  active?: boolean;
  /** 相邻内容的错峰间隔，默认 4 帧 */
  step?: number;
  /** 整组起始延迟 */
  delay?: number;
  /**
   * 错峰序号的上限：序号超过它的子项与第 maxStagger 项**同时**落位。
   *
   * 必要性来自成绩这类长列表：一门课错峰 4 帧，几十门就要排好几秒，
   * 而用户其实只看得到一屏。默认 6 大致覆盖一屏可见的内容块，
   * 屏外的部分与第 6 块一起出现，总时长始终可控。
   */
  maxStagger?: number;
  children: ReactNode;
};

/**
 * 内容错峰淡入：把 children **逐个**包进 `StaggerIn`，按 4 帧间隔依次落位。
 *
 * 典型用法是配合六态查询，让内容在数据到位后才依次浮现：
 *
 * ```tsx
 * {status === 'ready' && (
 *   <RevealGroup>
 *     <OverviewCard />
 *     <CourseCard />
 *   </RevealGroup>
 * )}
 * ```
 *
 * 之所以用 Fragment 平铺而不套一层容器：调用方（如 `SubPageShell` 的 content）
 * 通常已经用 `gap` 排好了子元素间距，多包一层会把间距吃掉。
 * `Children.toArray` 会自动剔除 null / undefined / 布尔值，所以条件渲染的子项
 * 不会在序号上留空洞，错峰节奏始终是连续的。
 */
export default function RevealGroup({
  active = true,
  step = STEP_4_FRAMES,
  delay = 0,
  maxStagger = 6,
  children,
}: Props) {
  const items = Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <StaggerIn key={i} index={Math.min(i, maxStagger)} step={step} delay={delay} active={active}>
          {child}
        </StaggerIn>
      ))}
    </>
  );
}
