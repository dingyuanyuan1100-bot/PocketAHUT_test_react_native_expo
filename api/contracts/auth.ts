/**
 * 登录 / 绑定相关契约 —— 与后端 internal/user/domain 严格对齐。
 * 后端统一信封 { code, message, data } 已在 ./contracts.ts 的 ApiResponse 中定义。
 */

/** 用户信息（GET /user/info、登录/注册返回的 user_info） */
export interface UserVO {
  id: number;
  username: string;
  student_id: string;
  email: string;
  wechat_id: string;
  qq_number: string;
  has_password: boolean;
  created_at: number;
  last_login_at: number;
}

/** 登录 / 微信登录 / 邮箱登录 返回 */
export interface LoginResponse {
  token: string; // access token（JWT HS256，TTL 24h）
  refresh_token: string; // refresh token（TTL 30d，可轮换）
  user_info: UserVO;
}

export interface RefreshTokenResponse {
  token: string;
  refresh_token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string; // 3-20
  password: string; // 6-20
  email: string;
  verify_code: string; // 邮箱验证码
}

export interface EmailLoginRequest {
  email: string;
  verify_code: string;
}

export interface WeChatLoginRequest {
  code: string;
}

export interface SendEmailCodeRequest {
  email: string;
}

export interface SendResetCodeRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  verify_code: string;
  new_password: string; // 6-20
}

export interface BindRequest {
  account: string; // 学工号 / 系统账号
  password: string;
  sys_code: string; // jwxt | dorm | chaoxing | vpncas
}

export interface UnbindRequest {
  sys_code: string;
}

export interface VpnToggleRequest {
  enabled: boolean;
}

/** 已绑定系统项（GET /user/sys/list） */
export interface SysUserVO {
  user_id: string;
  sys_code: string;
  username: string; // 绑定的系统账号
  vpn_enabled?: boolean | null;
  created_at: number;
  last_login_at: number;
}

/**
 * 后端支持的外部系统代码全集。
 * 取值来源：后端 `storage/redis/ext_sys_user/syscredential_repo.go` 的 sys_code 常量定义。
 */
export type SysCode = 'jwxt' | 'dorm' | 'vpncas' | 'chaoxing' | 'drcom' | 'wise';

/** 系统元信息（前端展示用，后端无对应接口，集中维护） */
export const SYS_META: Record<SysCode, { name: string; icon: string; desc: string }> = {
  jwxt: { name: '教务系统', icon: 'book', desc: '课表 / 成绩 / 考试' },
  dorm: { name: '宿舍晚寝', icon: 'moon', desc: '晚归打卡 / 归寝记录' },
  vpncas: { name: '校园 VPN', icon: 'shield', desc: '校外访问校内资源' },
  chaoxing: { name: '超星学习通', icon: 'book-open', desc: '网课 / 作业进度' },
  drcom: { name: '校园网', icon: 'wifi', desc: '网络账号 / 在线设备' },
  wise: { name: '一码通', icon: 'credit-card', desc: '扫码 / 门禁 / 订单' },
};

// ===================== 个人资料 / 密码 / 邮箱 =====================

/**
 * PUT /user/profile —— 更新个人资料。
 * ⚠️ 后端只接受 `{username, qq_number}` 两个字段，**没有头像上传接口**。
 */
export interface UpdateProfileRequest {
  username?: string;
  qq_number?: string;
}

/** PUT /user/password —— 修改密码 */
export interface UpdatePasswordRequest {
  /** 原密码；微信注册首次设置密码时可留空 */
  old_password?: string;
  /** 新密码，6-20 位 */
  new_password: string;
}

/** POST /user/email/bind —— 绑定 / 换绑邮箱（无解绑接口） */
export interface BindEmailRequest {
  email: string;
  verify_code: string;
  password?: string;
}

// ===================== 订阅任务（user/tasks） =====================

/** 订阅任务类型 —— 后端仅支持这两类 */
export type TaskKind = 'electricity' | 'grade';

/**
 * 订阅任务的公共时段 / 节流配置，三类字段全部来自后端 schedule 模块入参。
 */
export interface TaskWindowConfig {
  /** 允许推送的起始分钟（0-1440，如 480 = 08:00） */
  window_start_minute: number;
  /** 允许推送的结束分钟（0-1440） */
  window_end_minute: number;
  /** 检查间隔（分钟） */
  check_interval_minutes: number;
}

/** PUT /user/tasks/electricity —— 电费提醒任务设置 */
export interface ElectricityTaskConfig extends TaskWindowConfig {
  enabled: boolean;
  /** 空调余额提醒阈值 */
  air_remind_threshold: number;
  /** 房间余额提醒阈值 */
  room_remind_threshold: number;
}

/** PUT /user/tasks/grade —— 成绩提醒任务设置 */
export interface GradeTaskConfig extends TaskWindowConfig {
  enabled: boolean;
}

/** GET /user/tasks —— 任务列表（字段待运行时确认） */
export type UserTaskList = Record<string, unknown>[];
