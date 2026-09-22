import { http } from '../client';
import type {
  BookDetail,
  Building,
  ChargeOrderDetail,
  ChargeOrderStatus,
  CreateChargeOrderRequest,
  CreateChargeOrderResult,
  DormBindRequest,
  DormBinding,
  DormSignRecord,
  DormSignResult,
  DormSignStatus,
  DormTaskInfo,
  ElectricityBalance,
  LaundryDeviceResult,
  LibraryDetailQuery,
  LibrarySearchPage,
  LibrarySearchQuery,
  NetworkAccount,
  NetworkBoundDevice,
  NetworkLoginRecord,
  NetworkOfflineResult,
  NetworkOnlineDevice,
} from '../contracts/campus';

// ===================== 宿舍（dorm） =====================

export const dormApi = {
  /**
   * 楼栋列表。**公开接口，无需登录**。
   * `xiaoqu` 取 'OldS'（本部）/ 'NewS'（东区）—— 传数字会被 400 拒绝。
   */
  getBuildings: (xiaoqu: string) =>
    http.get<Building[]>('/dorm/buildings', { query: { xiaoqu }, auth: false }),

  /** 房间绑定状态。未绑定时后端返回 404（业务码 NOT_FOUND），不是空对象 */
  getBinding: () => http.get<DormBinding>('/dorm/binding'),

  /** 绑定房间：{xiaoqu, ld_id, room_no(3 位数字)} */
  bind: (body: DormBindRequest) => http.post<DormBinding>('/dorm/bind', body),

  /** 解除房间绑定 */
  unbind: () => http.del<string>('/dorm/binding'),

  /**
   * 晚寝签到。后端不接受任何参数（任务信息由后端自己取），
   * 成功时 data 是一个字符串提示语。
   * ⚠️ 有副作用：签到失败会走业务错误（UPSTREAM_ERROR），不是 200 带 false。
   */
  sign: () => http.post<DormSignResult>('/dorm/sign'),

  /** 签到记录（只有日期 + 状态文案） */
  getSignRecords: () => http.get<DormSignRecord[]>('/dorm/sign-records'),

  /** 当日签到状态 */
  getSignStatus: () => http.get<DormSignStatus>('/dorm/sign-status'),

  /** 宿舍签到任务信息（含楼栋/房间/经纬度） */
  getTask: () => http.get<DormTaskInfo>('/dorm/task'),
};

// ===================== 电费（electricity） =====================

export const electricityApi = {
  /**
   * 电费余额。**不接受参数**，后端按已绑定的宿舍房间去查 ——
   * 未绑定宿舍时必然失败，页面必须先处理「未绑定」态。
   */
  getBalance: () => http.get<ElectricityBalance>('/electricity/balance'),

  /**
   * 创建充值订单，返回微信 Native 支付链接。
   * ⚠️ 有副作用且涉及资金：
   *   - amount 后端约束 0 < amount <= 500；
   *   - 收到 502 表示「上游操作结果未知」，**不能当普通失败直接重试**，
   *     应先用 `getChargeOrderStatus(order_no)` 确认实际状态。
   */
  createChargeOrder: (body: CreateChargeOrderRequest) =>
    http.post<CreateChargeOrderResult>('/electricity/charge/orders', body),

  /** 查询订单支付状态（W=等待支付，S=支付成功） */
  getChargeOrderStatus: (orderNo: string) =>
    http.get<ChargeOrderStatus>(`/electricity/charge/orders/${encodeURIComponent(orderNo)}`),

  /** 查询订单支付明细 */
  getChargeOrderDetail: (orderNo: string) =>
    http.get<ChargeOrderDetail>(
      `/electricity/charge/orders/${encodeURIComponent(orderNo)}/detail`,
    ),
};

// ===================== 校园网（network） =====================

export const networkApi = {
  /** 账户状态（已用时长 / 已用流量） */
  getAccount: () => http.get<NetworkAccount>('/network/account'),

  /** 在线设备列表。条目里的 session_id 是强制下线的凭据 */
  getOnline: () => http.get<NetworkOnlineDevice[]>('/network/online'),

  /** 已绑定设备（接口文档未收录此路由） */
  getDevices: () => http.get<NetworkBoundDevice[]>('/network/devices'),

  /** 上网记录 */
  getLoginHistory: () => http.get<NetworkLoginRecord[]>('/network/login-history'),

  /**
   * 强制下线指定会话。
   * ⚠️ 有副作用：会让用户的设备断网。调用前必须二次确认，
   * 且收到 502 时应提示「结果未知，请刷新在线列表后再操作」而不是直接重试。
   */
  forceOffline: (sessionId: string) =>
    http.post<NetworkOfflineResult>('/network/offline', { session_id: sessionId }),
};

// ===================== 洗衣（laundry） =====================

export const laundryApi = {
  /**
   * 洗衣机列表（按当前用户绑定的宿舍楼栋 + 楼层过滤）。
   *
   * 需要登录；未绑定宿舍返回 `NOT_BOUND / 请先绑定宿舍信息`，
   * 房间号非 3 位返回 `INVALID_PARAM / 房间号必须为3位数字`。
   * 响应是 `{total, items}`，不是裸数组。
   */
  getServices: () => http.get<LaundryDeviceResult>('/laundry'),
};

// ===================== 图书馆（library） =====================

export const libraryApi = {
  /**
   * 图书搜索。✅ 实测响应是 `{page,pageSize,results,total}`（注意不是 `{rows,total}`）。
   */
  search: (query: LibrarySearchQuery) => http.get<LibrarySearchPage>('/library/search', { query }),

  /** 图书详情 */
  getDetail: (query: LibraryDetailQuery) => http.get<BookDetail>('/library/detail', { query }),
};
