import Constants from 'expo-constants';

/**
 * API 基础地址解析（前后端分离的核心配置）。
 *
 * 优先级：
 *   1. 环境变量 EXPO_PUBLIC_API_BASE_URL（构建期注入，最灵活）
 *   2. app.json 的 expo.extra.apiBaseUrl
 *   3. 兜底值：线上环境 https://ahut.domye.top
 *
 * 真机调试请改用本机局域网 IP，例如：
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000 npx expo start
 */
const expoConfig = (Constants.expoConfig ?? null) as
  | { extra?: { apiBaseUrl?: string } }
  | null;

const envBase = (
  process.env as Record<string, string | undefined>
).EXPO_PUBLIC_API_BASE_URL;

/** 去掉末尾斜杠，避免拼出 `//user/login` 这种双斜杠路径 */
function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

export const API_BASE_URL = normalize(
  envBase || expoConfig?.extra?.apiBaseUrl || 'https://ahut.domye.top',
);

/** 默认请求超时（毫秒）—— 接口文档约定 30000 */
export const API_TIMEOUT_MS = 30_000;

/**
 * 长耗时接口超时（毫秒）—— 接口文档约定 `/jwxt/ranking` 为 60000，
 * 排名证明需聚合整学期成绩，服务端耗时明显高于普通接口。
 */
export const API_TIMEOUT_LONG_MS = 60_000;

/** 令牌持久化键名 */
export const TOKEN_KEY = 'campus_token';
export const REFRESH_TOKEN_KEY = 'campus_refresh_token';
