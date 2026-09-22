import { useMutation } from '@tanstack/react-query';
import { wiseApi } from '../api/endpoints/wise';
import type { WiseDeviceInfo } from '../api/contracts/wise';

/**
 * 扫码建立会话（POST /wise/scan）。
 *
 * 设备二维码本体就是一条 portal URL。`page/WiseScanCard.tsx` 在原生端用
 * expo-camera 扫出这条链接后喂进来；Web / 无摄像头时则手动粘贴同一条链接
 * （卡片背面的输入框走同一个入口）。
 * 成功后服务端会把这个 portal 缓存到当前用户下，之后 `GET /wise/orders` 才能返回数据。
 */
export function useWiseScan() {
  const mutation = useMutation<WiseDeviceInfo, Error, string>({
    mutationFn: (url: string) => wiseApi.scan(url.trim()),
  });

  return {
    /** 识别设备并建立会话 */
    scan: mutation.mutateAsync,
    /** 最近一次识别到的设备（session 已建立） */
    device: mutation.data ?? null,
    /** 识别中 */
    scanning: mutation.isPending,
    /** 识别失败的错误（如未登录 / 链接无效 / 上游无响应） */
    scanError: mutation.error,
    /** 清除上一次识别结果 */
    resetScan: mutation.reset,
  };
}
