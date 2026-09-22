/**
 * 校内生活服务契约 —— 宿舍 §3.5、电费 §3.7、校园网 §3.8、洗衣 §3.9、图书馆 §3.10。
 *
 * ⚠️ 本文件的电费与校园网部分**大幅超出接口文档**：
 * 文档只列了 `/electricity/balance` 与 `/network` 的 4 个只读接口，
 * 但后端 `internal/electricity/interfaces/router.go` 与
 * `internal/network/interfaces/router.go` 里实际还有「电费充值（含微信支付链接）
 * + 订单状态/明细」和「绑定设备 `/network/devices`」。
 * 字段全部取自后端结构体，不是推测。
 *
 * 全部需要登录令牌（`/dorm/buildings` 除外，它是公开接口）。
 */
import type { PagedResult, UnverifiedRecord } from './index';

// ===================== 校区 / 楼栋（宿舍与电费共用） =====================

/**
 * 校区代码。**不是数字** —— 传 `xiaoqu=1` 会被后端以 400 拒绝
 * （常量定义在 `internal/shared/domain/building.go`）。
 */
export const CAMPUS_OLD = 'OldS'; // 本部
export const CAMPUS_NEW = 'NewS'; // 东区

export type CampusCode = typeof CAMPUS_OLD | typeof CAMPUS_NEW;

/** 校区下拉选项，供筛选器直接渲染 */
export const CAMPUS_OPTIONS: { value: CampusCode; label: string }[] = [
  { value: CAMPUS_NEW, label: '东区' },
  { value: CAMPUS_OLD, label: '本部' },
];

/** GET /dorm/buildings 查询参数（**公开接口，无需登录**） */
export interface BuildingsQuery {
  xiaoqu: CampusCode;
}

/**
 * 楼栋条目（后端 `shared/domain.BuildingItem`）。
 * 注意后端字段是 Go 的 `LdId`/`LdName`，但 JSON tag 是 `id`/`name`。
 */
export interface Building {
  id: string;
  name: string;
}

// ===================== 宿舍房间绑定（电费查询的前置条件） =====================

/**
 * POST /dorm/bind 请求体（后端 `DormBindingRequest`）。
 * 三个字段全部 required，`room_no` 必须是 **3 位数字**。
 */
export interface DormBindRequest {
  xiaoqu: CampusCode;
  /** 楼栋 ID，取自 GET /dorm/buildings */
  ld_id: string;
  /** 房间号，3 位数字（如 '101'） */
  room_no: string;
}

/** POST /dorm/bind 响应；GET /dorm/binding 返回同一结构 */
export interface DormBinding {
  xiaoqu: string;
  ld_id: string;
  room_no: string;
}

// ===================== 晚寝签到 =====================

/**
 * GET /dorm/task —— 宿舍签到任务信息（后端 `DormTaskInfo`）。
 * ⚠️ 这个结构用的是 **camelCase**（后端直接透传上游字段），
 * 与教务模块的 snake_case 风格不一致，别照抄。
 */
export interface DormTaskInfo {
  /** 床位 ID */
  bedId: string;
  userId: string;
  /** 楼栋 ID */
  dormId: string;
  /** 楼栋编号 */
  dormNo: string;
  /** 楼栋名称 */
  dormName: string;
  roomId: string;
  /** 房间号 */
  roomNo: string;
  locationLat: string;
  locationLng: string;
}

/** GET /dorm/sign-status —— 当日签到状态。后端只给一个状态文案 */
export interface DormSignStatus {
  /** 如 '已签到' / '未签到' */
  signStatusName: string;
}

/** GET /dorm/sign-records 条目。后端刻意只保留日期与状态两个字段 */
export interface DormSignRecord {
  /** 签到日期 */
  signDate: string;
  signStatusName: string;
}

/**
 * POST /dorm/sign 成功时 `data` 是**一个字符串**（后端把上游的 msg 透出来），
 * 不是对象。签到失败会走业务错误（UPSTREAM_ERROR）而不是 200。
 */
export type DormSignResult = string;

// ===================== 电费 =====================

/**
 * GET /electricity/balance —— 电费余额（后端 `ElectricityBalanceResult`）。
 *
 * ⚠️ 这个接口**不接受房间参数**：后端按当前用户已绑定的宿舍（`/dorm/bind`）
 * 去查。所以未绑定宿舍时一定会失败 —— 页面必须先处理「未绑定」态，
 * 引导去绑定而不是给一个「重试」的死按钮。
 *
 * 空调与房间照明是两套独立电表，余额分开返回。
 */
export interface ElectricityBalance {
  /** 空调剩余电量（度） */
  air_remain_amp: number;
  /** 房间照明剩余电量（度） */
  room_remain_amp: number;
}

/** 充值类型（后端 `ChargeType`） */
export const CHARGE_TYPE_ROOM = 'room'; // 房间（照明），默认
export const CHARGE_TYPE_AIR = 'air'; // 空调

export type ChargeType = typeof CHARGE_TYPE_ROOM | typeof CHARGE_TYPE_AIR;

/**
 * POST /electricity/charge/orders 请求体。
 * `amount` required；后端约束 0 < amount <= 500 元。`type` 缺省为 room。
 */
export interface CreateChargeOrderRequest {
  /** 充值金额（元） */
  amount: number;
  type?: ChargeType;
}

/** POST /electricity/charge/orders 响应 */
export interface CreateChargeOrderResult {
  /** 平台订单号 */
  order_no: string;
  /**
   * 微信 Native 支付链接（`weixin://wxpay/bizpayurl?pr=...`）。
   * ⚠️ 有时效性，且后端明确提示：502 表示「上游操作结果未知」，
   * 不能当普通失败直接重试，应先用 order_no 查订单状态。
   */
  wechat_pay_url: string;
  /** 支付金额（元） */
  amount: number;
}

/** GET /electricity/charge/orders/{orderNo} 响应 */
export interface ChargeOrderStatus {
  order_no: string;
  /** 'W' = 等待支付，'S' = 支付成功 */
  trade_state: string;
  /** 后端已把 trade_state 归一成布尔，优先用它 */
  paid: boolean;
}

/** GET /electricity/charge/orders/{orderNo}/detail 响应 */
export interface ChargeOrderDetail {
  /** 交易单号 */
  tran_no: string;
  /** 支付方式名称（微信 / 支付宝） */
  pay_way_name: string;
  /** 缴费人姓名 */
  spec_name: string;
  /** 支付金额 */
  tran_amt: number;
  /** 交易日期 */
  tran_date: string;
  /** 交易摘要 */
  tran_title: string;
  paid: boolean;
}

// ===================== 校园网（Dr.COM 自助服务） =====================

/** GET /network/account —— 账户状态。后端只解析出这两项 */
export interface NetworkAccount {
  /** 已用时长（分钟），字符串 */
  used_minutes: string;
  /** 已用流量（M），字符串 */
  used_traffic: string;
}

/** GET /network/login-history 条目（后端按位置映射数组，字段含义稳定） */
export interface NetworkLoginRecord {
  /** 上线时间（毫秒时间戳字符串） */
  online_time: string;
  /** 注销时间（毫秒时间戳字符串），未注销时可能为空 */
  offline_time: string;
  ip: string;
  /** MAC 信息 */
  mac: string;
  /** 使用时长（分钟） */
  duration: number;
  /** 使用流量（M） */
  traffic: number;
  /** 终端类型 */
  terminal: string;
}

/**
 * GET /network/online —— 在线设备（后端 `OnlineDevice`）。
 * `session_id` 是强制下线时的凭据，必须原样回传。
 */
export interface NetworkOnlineDevice {
  online_time: string;
  ip: string;
  mac: string;
  duration: number;
  /** ⚠️ 这里是字符串，同模块的 login-history 里 traffic 却是 number，别混用 */
  traffic: string;
  host_name: string;
  terminal: string;
  /** 会话 ID —— POST /network/offline 用 */
  session_id: string;
}

/** GET /network/devices —— 已绑定设备（后端 `BoundDevice`）。接口文档未收录此路由 */
export interface NetworkBoundDevice {
  /** 在线状态（上游给的是字符串） */
  online: string;
  mac: string;
  terminal: string;
  last_login_at: string;
  last_login_ip: string;
}

/** POST /network/offline 请求体。`session_id` required */
export interface NetworkOfflineRequest {
  session_id: string;
}

/** POST /network/offline 响应 */
export interface NetworkOfflineResult {
  success: boolean;
}

// ===================== 洗衣（laundry） =====================

/**
 * 洗衣机设备（GET /laundry 的 `items[]`）。
 *
 * ✅ 源码确证（`internal/laundry/domain/device.go` 的 `LaundryDeviceVO`）：
 *   `{"name":"…","state":1,"finishTime":null}`
 *
 * ⚠️ 只有这三个字段 —— 后端把上游海尔 / 趣开业的完整设备对象
 *   （id / imei / floorCode / deviceId / enableReserve …）全部裁掉了，
 *   前端**拿不到设备 ID**，因此无法做「单台刷新」或「预约」，只能整列表刷新。
 */
export interface LaundryDeviceVO {
  /** 设备名（上游原文，形如「K3栋5楼」） */
  name: string;
  /**
   * 设备状态。
   *
   * ✅ 语义由 `QiekjStatusToState` 确证：
   *   `1` = 空闲；`2` = 使用中（上游 qiekj 里 status=1 为空闲，其余值一律折算成 2）。
   * 除 1 / 2 之外的值按「使用中」兜底处理，不要当成未知态报错。
   */
  state: number;
  /**
   * 结束时间。后端声明为 `any`（上游给字符串或 null 都可能），
   * 所以这里是 unknown —— 渲染前必须自行判别，不能当 string 用。
   */
  finishTime?: unknown;
}

/** 设备状态语义常量（`LaundryDeviceVO.state`） */
export const LAUNDRY_STATE_FREE = 1;
export const LAUNDRY_STATE_BUSY = 2;

/** GET /laundry —— 洗衣机列表。✅ 源码确证为 `{total, items}`，不是裸数组 */
export interface LaundryDeviceResult {
  total: number;
  items: LaundryDeviceVO[];
}

/**
 * GET /laundry 的前置条件（源码 `Service.QueryByUser` 确证）：
 *  1. 必须登录（路由挂了 `middleware.MustGetUserIDInt`）；
 *  2. 必须已绑定宿舍，否则 `NOT_BOUND / 请先绑定宿舍信息`；
 *  3. 房间号必须是 3 位数字，否则 `INVALID_PARAM / 房间号必须为3位数字`。
 *
 * 另外设备是**按用户绑定宿舍的楼栋 + 楼层过滤**的，所以这是「我这一层的洗衣机」，
 * 不是全校列表 —— UI 上不能暗示用户可以看别的楼。
 */
export type LaundryUnavailable =
  | 'NOT_BOUND'
  | 'INVALID_PARAM'
  | 'UPSTREAM_ERROR';

// ===================== 图书馆（library） =====================

/** GET /library/search 查询参数（`keyword` 与 `page` 由接口文档确证） */
export interface LibrarySearchQuery {
  keyword: string;
  page?: number;
}

/** GET /library/search 响应形态为 `{page,pageSize,results,total}` */
export type LibrarySearchPage = PagedResult<UnverifiedRecord>;

/** GET /library/detail 查询参数（`id` 由接口文档确证） */
export interface LibraryDetailQuery {
  id: string | number;
}

/** 图书详情。文档未展开 data 结构，按未知键值对处理 */
export type BookDetail = UnverifiedRecord;

// ===================== 空闲教室的校区/楼栋参数来源 =====================
//
// `/jwxt/idle-classroom` 需要 campus_id + building_id，但它用的是**教务系统**
// 自己的校区/楼栋 ID 体系，与 `/dorm/buildings` 的 OldS/NewS 体系**不是一套**。
// 文档未给出教务侧的取值枚举，因此本文件不提供常量；页面应先让用户选择，
// 或在拿到真实值后补充此处，禁止把楼栋名当成 building_id 硬塞。
