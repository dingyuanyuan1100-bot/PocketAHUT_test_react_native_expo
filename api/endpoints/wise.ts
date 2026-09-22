import { http } from '../client';
import type {
  WiseCtrlRequest,
  WiseCtrlResult,
  WiseOrderList,
  WisePayRequest,
  WisePayResult,
  WiseScanResult,
} from '../contracts/wise';

/**
 * 一码通 / 智慧校园（wise）接口封装 —— 接口文档 §3.14。
 *
 * ✅ 字段名均已从后端源码确证，但**调用纪律不变**：
 *
 * ⚠️ `pay` 会真实发起一卡通 / 支付宝扣款，`ctrl` 会真实启停设备端口。
 *    两者都是写操作，页面侧只在用户明确操作后才可调用，且必须处理
 *    502（`WrapUpstreamOutcome`）—— 502 表示**上游结果未知**，
 *    不能自动重试，否则可能重复扣款。
 */
export const wiseApi = {
  /** 扫码识别设备，同时建立会话（后续 orders / pay / ctrl 都依赖这次扫码） */
  scan: (url: string) => http.post<WiseScanResult>('/wise/scan', { url }),

  /** 发起支付。⚠️ 真实扣款，必须用户显式确认后再调 */
  pay: (body: WisePayRequest) => http.post<WisePayResult>('/wise/pay', body),

  /** 控制设备端口（开始 / 暂停 / 结束）。⚠️ 真实控制设备 */
  ctrl: (body: WiseCtrlRequest) => http.post<WiseCtrlResult>('/wise/ctrl', body),

  /** 当日订单列表。✅ 源码确证为**裸数组** `[]OrderVO` */
  getOrders: () => http.get<WiseOrderList>('/wise/orders'),
};
