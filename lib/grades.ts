import type { GradeItem } from '../api/contracts/jwxt';

/**
 * 成绩数据的客户端汇总。
 *
 * ⚠️ 后端 `JwxtGradeResponse` 里 `score` / `credit` / `gpa` **全是字符串**
 * （后端直接透传教务表格的文本），而且 `score` 可能是 '优秀' / '通过' / '合格'
 * 这类非数字。因此这里只统计**能解析成数字**的记录，并把统计口径
 * （'基于 N 门'）一并返回 —— 页面必须把口径显示出来，
 * 否则「平均分 82」这种数字在含等级制成绩时会误导用户。
 */

/** 把字符串安全转成数字；不是数字返回 null */
export function toNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  // 只接受纯数字（可带小数 / 负号），'优秀' '通过' '缓考' 一律返回 null
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** 该条成绩是否为数值制（能参与平均分计算） */
export function isNumericScore(item: GradeItem): boolean {
  return toNumber(item.score) !== null;
}

export type GradeSummary = {
  /** 课程总门数 */
  count: number;
  /** 学分合计（仅统计学分可解析的课程） */
  creditSum: number;
  /** 参与学分统计的课程数 */
  creditCount: number;
  /** 数值制成绩的平均分（仅统计分数可解析的课程） */
  scoreAvg: number | null;
  /** 参与平均分统计的课程数 */
  scoreCount: number;
  /** 平均绩点（仅统计绩点可解析的课程） */
  gpaAvg: number | null;
  /** 参与绩点统计的课程数 */
  gpaCount: number;
};

/** 汇总成绩列表。所有统计口径都随结果一起返回，便于页面如实标注 */
export function summarizeGrades(items: GradeItem[]): GradeSummary {
  let creditSum = 0;
  let creditCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let gpaSum = 0;
  let gpaCount = 0;

  for (const item of items) {
    const credit = toNumber(item.credit);
    if (credit !== null) {
      creditSum += credit;
      creditCount += 1;
    }

    const score = toNumber(item.score);
    if (score !== null) {
      scoreSum += score;
      scoreCount += 1;
    }

    const gpa = toNumber(item.gpa);
    if (gpa !== null) {
      gpaSum += gpa;
      gpaCount += 1;
    }
  }

  return {
    count: items.length,
    creditSum: Math.round(creditSum * 10) / 10,
    creditCount,
    scoreAvg: scoreCount ? Math.round((scoreSum / scoreCount) * 100) / 100 : null,
    scoreCount,
    gpaAvg: gpaCount ? Math.round((gpaSum / gpaCount) * 100) / 100 : null,
    gpaCount,
  };
}

/** 成绩色调：>=90 青柠（优秀）/ >=60 白 / <60 燕麦（警示，但不是错误态） */
export type GradeTone = 'high' | 'pass' | 'low' | 'unknown';

export function gradeTone(score: string | undefined | null): GradeTone {
  const n = toNumber(score);
  if (n === null) return 'unknown';
  if (n >= 90) return 'high';
  if (n >= 60) return 'pass';
  return 'low';
}

/**
 * 该条成绩能否展开明细。
 * 后端要求 `jx0404id` + `cj0708id` + `zcj` 三者齐全，缺一即 MISSING_PARAM，
 * 所以 UI 只能在这三个字段都在时才给出「查看明细」入口。
 */
export function canLoadGradeDetail(item: GradeItem): boolean {
  return !!item.jx0404id && !!item.cj0708id && !!item.zcj;
}
