import { http } from '../client';
import { encryptPayload, removeSysCred, saveSysCred } from '../../lib/creds';
import type {
  BindEmailRequest,
  BindRequest,
  ElectricityTaskConfig,
  GradeTaskConfig,
  LoginResponse,
  RefreshTokenResponse,
  RegisterRequest,
  ResetPasswordRequest,
  SendEmailCodeRequest,
  SendResetCodeRequest,
  SysUserVO,
  UnbindRequest,
  UpdatePasswordRequest,
  UpdateProfileRequest,
  UserTaskList,
  UserVO,
  VpnToggleRequest,
  WeChatLoginRequest,
} from '../contracts/auth';

/**
 * 登录 / 绑定 / 账号 相关接口封装。
 * 路径与 internal/user/interfaces/router.go 一一对应。
 */
export const authApi = {
  // 账号密码登录
  login: (body: { username: string; password: string }) =>
    http.post<LoginResponse>('/user/login', body),

  // 注册（返回 UserVO，不含令牌 → 由 AuthContext 自动登录）
  register: (body: RegisterRequest) => http.post<UserVO>('/user/register', body),

  // 刷新令牌（轮换）。带 skipAuthRefresh，避免刷新失败时再触发一次刷新递归
  refresh: (refreshToken: string) =>
    http.post<RefreshTokenResponse>(
      '/user/token/refresh',
      { refresh_token: refreshToken },
      { auth: false, skipAuthRefresh: true },
    ),

  // 退出登录（传入 refresh_token 后端会撤销该会话；文档标注 skipAuthRefresh）
  logout: (refreshToken?: string) =>
    http.post<unknown>(
      '/user/logout',
      refreshToken ? { refresh_token: refreshToken } : undefined,
      { skipAuthRefresh: true },
    ),

  // 邮箱验证码登录
  emailLogin: (body: { email: string; verify_code: string }) =>
    http.post<LoginResponse>('/user/email/login', body),

  // 微信登录（code 由微信 SDK 换取；未接入微信时可先隐藏该入口）
  wechatLogin: (code: string) =>
    http.post<LoginResponse>('/user/wechat/login', { code } as WeChatLoginRequest),

  // 微信绑定（App 侧拿到微信 code 后绑定到当前账号，跳过设备凭证头）
  wechatBind: (code: string) =>
    http.post<unknown>('/user/wechat/bind', { code } as WeChatLoginRequest, {
      skipSystemCreds: true,
    }),

  // 注册用：向邮箱发验证码（公开，严格限流）
  sendRegisterCode: (email: string) =>
    http.post<unknown>('/auth/email-verification-codes', { email } as SendEmailCodeRequest),

  // 忘记密码：发重置验证码
  sendResetCode: (email: string) =>
    http.post<unknown>('/auth/password/reset/send-code', { email } as SendResetCodeRequest),

  // 忘记密码：用验证码重置
  resetPassword: (body: ResetPasswordRequest) => http.post<unknown>('/auth/password/reset', body),

  // 当前用户信息（用于恢复会话）
  me: () => http.get<UserVO>('/user/info'),

  // —— 个人资料 / 密码 / 邮箱 ——
  // ⚠️ 后端只接受 {username, qq_number}；没有头像上传、没有邮箱解绑、没有微信解绑
  updateProfile: (body: UpdateProfileRequest) => http.put<UserVO>('/user/profile', body),

  updatePassword: (body: UpdatePasswordRequest) => http.put<unknown>('/user/password', body),

  bindEmail: (body: BindEmailRequest) => http.post<unknown>('/user/email/bind', body),

  // —— 订阅任务（后端仅支持 electricity / grade 两类）——
  listTasks: () => http.get<UserTaskList>('/user/tasks'),
  updateElectricityTask: (body: ElectricityTaskConfig) =>
    http.put<unknown>('/user/tasks/electricity', body),
  updateGradeTask: (body: GradeTaskConfig) => http.put<unknown>('/user/tasks/grade', body),

  // —— 系统绑定（均需鉴权）——
  /**
   * 绑定子系统账号。
   * ⚠️ 后端要求 {sys_code, payload}：payload 是 {account, password} 的 RSA-OAEP 密文
   * （官方客户端同款，公钥见 lib/creds.ts）。绑定成功后把加密凭证存本地，
   * 供后续请求编码进 X-System-Creds 头。
   */
  bindSys: async (body: BindRequest) => {
    const payload = await encryptPayload(
      JSON.stringify({ account: body.account, password: body.password }),
    );
    const result = await http.post<unknown>('/user/sys/bind', {
      sys_code: body.sys_code,
      payload,
    });
    await saveSysCred(body.sys_code, body.account, body.password);
    return result;
  },
  listSysBinds: () => http.get<SysUserVO[]>('/user/sys/list'),
  unbindSys: async (sysCode: string) => {
    const result = await http.post<unknown>(
      '/user/sys/unbind',
      { sys_code: sysCode } as UnbindRequest,
    );
    await removeSysCred(sysCode);
    return result;
  },
  toggleVpn: (enabled: boolean) =>
    http.put<{ vpn_enabled: boolean }>('/user/sys/vpn', { enabled } as VpnToggleRequest),
};
