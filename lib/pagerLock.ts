import { useSyncExternalStore } from 'react';

/**
 * 横向分页容器的「临时锁」。
 *
 * 背景：首页是一个 `pagingEnabled` 的横向 ScrollView，课程表页里又嵌了一个
 * 横向 ScrollView（课表 7 列超出屏宽）。同方向嵌套滚动时，外层分页器会
 * 抢走手势 → 用户一划就翻页，课表根本滑不动。
 *
 * 这里用一个极小的外部 store 让**内层**在触摸期间把**外层**锁住：
 *   - 内层 onTouchStart → setPagerLocked(true)
 *   - 内层 onTouchEnd / onTouchCancel → setPagerLocked(false)
 *
 * 之所以不用 Context：分页器在 `app/index.tsx`，课表在 `page/CourseTablePage.tsx`，
 * 中间隔了多层且课表是被当作普通子节点渲染的，Context 要把 Provider 提到根布局；
 * 而 `useSyncExternalStore` 可以让两边零耦合地读写同一个布尔值。
 *
 * ⚠️ 必须成对释放（end / cancel），否则分页器会永久卡死。
 */

let locked = false;
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): boolean {
  return locked;
}

/** 锁住 / 解锁外层横向分页器 */
export function setPagerLocked(next: boolean): void {
  if (locked === next) return;
  locked = next;
  listeners.forEach((fn) => fn());
}

/** 分页器侧订阅：true = 暂时不要响应横向手势 */
export function usePagerLocked(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
