/**
 * 前后端契约层 —— 所有后端数据模型与响应信封的单一事实来源。
 * 后端若小改字段，只需动这里，页面 / hooks 不动。
 *
 * 组织方式：
 *   - 本文件：统一响应信封、错误类型、跨模块共享类型
 *   - ./auth    用户 / 认证 / 校内系统绑定
 *   - ./jwxt    教务系统
 *   - ./campus  宿舍 / 电费 / 校园网 / 洗衣 / 图书馆
 *   - ./content 新闻 / 通知 / 校历 / 校园地图 / 食堂 / 学习通
 *   - ./wise    一码通 / 智慧校园
 *
 * ⚠️ 字段来源原则：只声明「接口文档明确给出」或「后端 DTO 可证实」的字段。
 * 文档未展开的 data 结构一律用 UnverifiedRecord 兜住，禁止凭感觉补字段。
 */

/** 后端统一响应信封 —— 接口文档 §2：`{ code, message, data, errorCode? }` */
export interface ApiResponse<T> {
  code: number; // 业务状态码（成功恒为 200）
  errorCode?: string; // 机器可读错误码
  message: string; // 提示信息
  data?: T; // 返回数据
}

/** 后端业务错误（code !== 200 时抛出） */
export class ApiError extends Error {
  /** 业务码或 HTTP 状态码 */
  code: number;
  /** 机器可读错误码，如 NOT_BOUND / UPSTREAM_TIMEOUT */
  errorCode?: string;
  /** 真实 HTTP 状态码（信封解析成功时与 code 一致，解析失败时是响应状态） */
  httpStatus?: number;

  constructor(code: number, message: string, errorCode?: string, httpStatus?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.errorCode = errorCode;
    this.httpStatus = httpStatus ?? code;
  }

  /** 未登录 / 令牌失效（HTTP 401） */
  get isUnauthorized(): boolean {
    return this.httpStatus === 401 || this.code === 401;
  }

  /** 未绑定前置系统（业务码 NOT_BOUND） */
  get isNotBound(): boolean {
    return this.errorCode === 'NOT_BOUND';
  }
}

/**
 * ⚠️ 未核实结构占位。
 *
 * 接口文档 §3 只给出路径与部分参数名，未展开 `data` 内部字段
 * （文档 §6.3 已明确说明）。凡未拿到确证的结构一律落到这里，
 * 页面侧请按「取到就渲染、取不到走空态」实现，不要假设字段一定存在。
 * 拿到真实响应后，应把它替换为具名 interface。
 */
export type UnverifiedRecord = Record<string, unknown>;

/** 列表类响应在未核实阶段的统一写法 */
export type UnverifiedList = UnverifiedRecord[];

/**
 * 分页信封 A —— `{rows, total}`。
 *
 * 实测于 `/canteen/dishes`、`/canteen/windows`、`/campus-map/places`。
 * ⚠️ 这几个接口**不是裸数组**，早期按数组写会直接拿不到数据。
 */
export interface Paged<T> {
  rows: T[];
  total: number;
}

/**
 * 分页信封 B —— `{page, pageSize, results, total}`。
 * 实测于 `/library/search`。后端不同模块用了两套分页结构，接入时注意区分。
 */
export interface PagedResult<T> {
  page: number;
  pageSize: number;
  results: T[];
  total: number;
}

export * from './auth';
export * from './jwxt';
export * from './campus';
export * from './content';
export * from './wise';
