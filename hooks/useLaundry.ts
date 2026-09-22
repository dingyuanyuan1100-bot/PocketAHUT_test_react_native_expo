import { laundryApi } from '../api/endpoints/campus';
import {
  LAUNDRY_STATE_BUSY,
  LAUNDRY_STATE_FREE,
  type LaundryDeviceResult,
  type LaundryDeviceVO,
} from '../api/contracts/campus';
import { useAuthedQuery } from './useAuthedQuery';

export const laundryKeys = {
  all: ['laundry'] as const,
  devices: () => [...laundryKeys.all, 'devices'] as const,
};

/** 把 `state` 折算成界面语义 —— 除「空闲」外一律按「使用中」兜底 */
export function isDeviceFree(device: LaundryDeviceVO): boolean {
  return device.state === LAUNDRY_STATE_FREE;
}

export type LaundrySummary = {
  total: number;
  freeCount: number;
  busyCount: number;
};

export function summarizeDevices(items: LaundryDeviceVO[]): LaundrySummary {
  let freeCount = 0;
  for (const it of items) if (isDeviceFree(it)) freeCount += 1;
  return { total: items.length, freeCount, busyCount: items.length - freeCount };
}

/**
 * 洗衣机列表（按当前用户绑定宿舍的楼栋 + 楼层过滤）。
 *
 * 六态说明：
 *   guest     未登录
 *   not_bound 未绑定宿舍（`NOT_BOUND / 请先绑定宿舍信息`）
 *   error     其余失败，含 `INVALID_PARAM / 房间号必须为3位数字` 与上游故障
 *   empty     该楼层没有可用设备
 *   ready     有设备
 */
export function useLaundry() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<LaundryDeviceResult>({
    queryKey: laundryKeys.devices(),
    queryFn: () => laundryApi.getServices(),
    // 后端返回的是 `{total, items}`：total 是上游计数，items 可能被楼栋过滤剪短，
    // 所以「空」以 items 为准，不以 total 为准。
    isEmpty: (d) => (d?.items?.length ?? 0) === 0,
    // 设备状态变化快，30 秒即可认为过期
    queryOptions: { staleTime: 30 * 1000 },
  });

  const items = data?.items ?? [];

  return {
    status,
    devices: items,
    summary: summarizeDevices(items),
    error,
    refetch,
    isRefreshing,
  };
}

/** 供 UI 展示的状态文案（避免各页各写一套） */
export const LAUNDRY_STATE_TEXT: Record<number, string> = {
  [LAUNDRY_STATE_FREE]: '空闲',
  [LAUNDRY_STATE_BUSY]: '使用中',
};
