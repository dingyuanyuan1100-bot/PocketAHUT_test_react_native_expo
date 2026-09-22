import type { ExamItem } from '../api/contracts/jwxt';

/**
 * 考试时间解析与分组。
 *
 * ⚠️ 后端 `JwxtExamScheduleResponse.exam_time` 是**教务表格单元格的原始文本**，
 * 解析器只做了 trim，格式不由后端约定（见 `parser/exam.go`，它直接取第 8 列的文本）。
 * 因此：
 *
 *   - 这里**只做「尽力提取日期」**用于分组展示，识别失败不报错、不丢弃，
 *     而是归入「时间待定」组，原样把文案显示给用户；
 *   - **绝不**凭这个字符串推断「还剩几天」这类结论 —— 解析不可靠时推断出来的
 *     倒计时比没有倒计时更糟。
 */

/** 从原始考试时间文本里尽力提取 `YYYY-MM-DD`；提取不到返回 null */
export function parseExamDate(examTime: string | undefined | null): string | null {
  if (!examTime) return null;
  const text = String(examTime);

  // 2026-01-12 / 2026/01/12 / 2026.01.12
  const full = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (full) {
    const [, y, m, d] = full;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 「01月12日」这类不带年份的写法：无法确定年份，不敢补 -> 放弃
  return null;
}

/** 从原始文本里提取 `HH:mm` 起点时间（可选，仅用于展示排序）；失败返回 null */
export function parseExamStartTime(examTime: string | undefined | null): string | null {
  if (!examTime) return null;
  const m = String(examTime).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export type ExamGroup = {
  /** 分组键：'YYYY-MM-DD' 或 'unknown' */
  key: string;
  /** 分组标题：'2026-01-12' 或 '时间待定' */
  title: string;
  items: ExamItem[];
};

/**
 * 按考试日期分组。
 *
 * 排序规则：有日期的组按日期升序在前，无法解析日期的组固定排在最后
 * （它们不是「更晚」，只是「不知道」，混在日期序列里会让人误读）。
 */
export function groupExamsByDate(items: ExamItem[]): ExamGroup[] {
  const dated = new Map<string, ExamItem[]>();
  const unknown: ExamItem[] = [];

  items.forEach((item) => {
    const date = parseExamDate(item.exam_time);
    if (!date) {
      unknown.push(item);
      return;
    }
    const bucket = dated.get(date) ?? [];
    bucket.push(item);
    dated.set(date, bucket);
  });

  const groups: ExamGroup[] = [...dated.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      key: date,
      title: date,
      items: [...list].sort((a, b) => {
        const ta = parseExamStartTime(a.exam_time);
        const tb = parseExamStartTime(b.exam_time);
        if (ta && tb) return ta.localeCompare(tb);
        if (ta) return -1;
        if (tb) return 1;
        return 0;
      }),
    }));

  if (unknown.length) {
    groups.push({ key: 'unknown', title: '时间待定', items: unknown });
  }
  return groups;
}

/** 把 '2026-01-12' 显示成 '01/12 周一' */
export function formatExamDate(date: string): { md: string; weekday: string } {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { md: date, weekday: '' };
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return { md: `${mm}/${dd}`, weekday: labels[d.getDay()] };
}
