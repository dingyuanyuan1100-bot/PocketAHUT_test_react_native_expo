/**
 * 校园网数据的展示格式化。
 *
 * ⚠️ 后端 `/network/*` 的字段类型很乱，实测（后端 DTO 可证）：
 *   - `AccountStatus.used_minutes` / `used_traffic` 是**字符串**
 *   - `OnlineDevice.traffic` 是**字符串**，而 `LoginHistoryItem.traffic` 是
 *     **number** —— 同一个模块两个接口类型不一致，别写通用函数想当然
 *   - `online_time` / `offline_time` 是**毫秒时间戳的字符串**，不是 ISO 时间
 *
 * 所有格式化函数在拿不准时返回 '—'，绝不显示 'NaN' 或 'Invalid Date'。
 */

/** 毫秒时间戳（字符串或数字）→ 'MM-DD HH:mm'；非法返回 '—' */
export function formatTimestampMs(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '—';
  const ms = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(ms) || ms <= 0) return '—';

  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';

  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 流量（单位 M）→ '512 MB' / '1.25 GB'；非法返回 '—' */
export function formatTrafficMB(value: string | number | undefined | null): string {
  const mb = toFinite(value);
  if (mb === null) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Math.round(mb)} MB`;
}

/** 分钟数 → '2 小时 15 分' / '45 分'；非法返回 '—' */
export function formatMinutes(value: string | number | undefined | null): string {
  const min = toFinite(value);
  if (min === null) return '—';
  const total = Math.round(min);
  if (total < 60) return `${total} 分`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

/** 时长（分钟，数字）→ 紧凑写法，用于列表右侧 */
export function formatDurationShort(value: number | undefined | null): string {
  const min = toFinite(value);
  if (min === null) return '—';
  const total = Math.round(min);
  if (total < 60) return `${total} 分钟`;
  return `${(total / 60).toFixed(1)} 小时`;
}

/** MAC 地址脱敏：只保留前 3 段，避免在列表里暴露完整硬件地址 */
export function maskMac(mac: string | undefined | null): string {
  if (!mac) return '—';
  const parts = String(mac).split(/[:-]/).filter(Boolean);
  if (parts.length < 4) return String(mac);
  return `${parts.slice(0, 3).join(':')}:··:··:··`;
}

function toFinite(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}
