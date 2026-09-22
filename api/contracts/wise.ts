/**
 * 一码通 / 智慧校园（wise）契约 —— 对应接口文档 §3.14。
 *
 * ✅ 本文件除 `UnverifiedRecord` 外，字段名均已从后端源码确证
 *   （`internal/wise/application/service.go` + `interfaces/handler.go`），
 *   不再是「文档未展开」的状态。
 *
 * ⚠️ 但**确证了字段 ≠ 可以随便调**：`/wise/pay` 会真的发起一卡通扣款，
 *   `/wise/ctrl` 会真的启停设备。这两个入口在 UI 上仍然是只读展示的边界，
 *   页面只负责把「设备信息 / 订单」呈现出来，不代用户按支付按钮。
 */
import type { UnverifiedRecord } from './index';

/** POST /wise/scan —— 扫码。✅ 源码确证 body 只有 `url` 且 required */
export interface WiseScanRequest {
  /** 二维码解析出的链接（后端叫 portal URL） */
  url: string;
}

/**
 * 扫码识别出的设备信息。
 *
 * ✅ 源码确证（`application.DeviceInfo`）。
 * 注意**没有金额 / 档位**字段 —— 支付档位在上游 `Pos.Mode` 里，
 * 后端没有透出，所以「选档位付款」这件事前端做不了，只能交给上游页面。
 */
export interface WiseDeviceInfo {
  siteName: string;
  siteID: number;
  posID: number;
  posName: string;
  posNum: number;
  /** 计费模式名 */
  modeName: string;
  online: boolean;
}

export type WiseScanResult = WiseDeviceInfo;

/** POST /wise/pay 请求体。✅ 源码确证（`application.PayRequest`） */
export interface WisePayRequest {
  /** 设备端口 ID，来自扫码结果 */
  posID: number;
  /** 档位下标（可选，取决于设备是否多档） */
  optionIndex?: number;
  /** `ykt` 一卡通 / `alipay` 支付宝 */
  payType?: 'ykt' | 'alipay';
}

/** 支付结果。✅ 源码确证（`application.PayResult`） */
export interface WisePayResult {
  serial: string;
}

/** POST /wise/ctrl 请求体。✅ 源码确证（`CtrlOrderPortRequest`） */
export interface WiseCtrlRequest {
  /** 订单流水号 */
  serial: string;
  /** 端口下标 */
  portIndex?: number;
  /** 动作：2 开始 / 3 暂停 / 4 结束 */
  orderAct: 2 | 3 | 4;
}

/** 控制结果（后端只回 `data: null`） */
export type WiseCtrlResult = UnverifiedRecord;

/**
 * 当日订单（GET /wise/orders 的 `data[]`）。
 *
 * ✅ 源码确证（`internal/wise/application/service.go` 的 `OrderVO`）：
 *   响应是**裸数组**，不是 `{rows,total}`。
 */
export interface WiseOrder {
  /** 订单流水号 */
  serial: string;
  /** 下单时间（上游原文字符串） */
  createDate: string;
  /** 场景名（如「洗衣」「饮水」） */
  sceneName: string;
  /** 位置名，后端拼成 `"${PosID} ${PosName}"` */
  posName: string;
  /** 预付费（元） */
  prepay: number;
  /** 实际扣费（元） */
  actualPay: number;
  /** 订单状态名（上游原文，如「使用中」「已完成」） */
  stateName: string;
}

/** GET /wise/orders —— 当日订单列表（裸数组） */
export type WiseOrderList = WiseOrder[];

/**
 * GET /wise/orders 的前置条件（源码 `Service.ensureSession` 确证）：
 *  1. 必须登录；
 *  2. 会话缓存命中时，会校验 `vpncas` 绑定 → 未绑定返回 `NOT_BOUND / 未绑定智慧校园账号`；
 *  3. 从未扫码（无 portal 缓存）时返回 `UNAUTHORIZED / 请先扫码建立会话`
 *     —— 注意这是 **401 而不是 NOT_BOUND**，UI 不能把它当「去绑定」处理，
 *     正确引导是「先扫一次设备码」。
 */
export type WiseUnavailable = 'NOT_BOUND' | 'UNAUTHORIZED' | 'UPSTREAM_ERROR';
