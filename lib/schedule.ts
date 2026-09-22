import type { CourseItem } from '../api/contracts/jwxt';

/**
 * 课表数据整形工具。
 *
 * ⚠️ 关于接口载荷的三点事实（来自后端 parser，不是推测）：
 *
 *   1. `weekday` 是中文串：'星期一' … '星期日'，**不是 1-7 的数字**。
 *   2. `section` 是节次组标签：'第1,2节' / '第9,10,11节' / '第12节'，
 *      并且不同教务页面存在 '第1-2节' 这种连字符变体；**不是单个数字**。
 *   3. **没有「结束节 / 节数」字段**。一门连上 4 节的课会以 2 条记录出现
 *      （'第1,2节' 与 '第3,4节'），所以「连堂合并」只能在前端做。
 *
 * 本模块负责把 1、2 数字化，并把 3 用「相邻节次 + 同课程」的规则合并成块。
 * 这是**渲染层的整形**，不是对字段的猜测。
 */

export type CourseBlock = {
  /** 星期几：1=周一 … 7=周日 */
  weekday: number;
  /** 起始节次 */
  startSection: number;
  /** 结束节次（含） */
  endSection: number;
  /** 覆盖节数（>=1） */
  span: number;
  course: CourseItem;
};

// ===================== 载荷 → 数字 =====================

const WEEKDAY_MAP: Record<string, number> = {
  星期一: 1,
  星期二: 2,
  星期三: 3,
  星期四: 4,
  星期五: 5,
  星期六: 6,
  星期日: 7,
  // 兼容「周X」「星期天」这类写法，成本极低
  周一: 1,
  周二: 2,
  周三: 3,
  周四: 4,
  周五: 5,
  周六: 6,
  周日: 7,
  星期天: 7,
  周天: 7,
};

/**
 * 中文星期 → 1-7。识别不出来返回 null（调用方应把该条归入「未能定位」，
 * 而不是塞到周一去 —— 放错格子比不显示更糟）。
 */
export function parseWeekdayCn(weekday: string | undefined | null): number | null {
  if (!weekday) return null;
  const key = String(weekday).trim();
  if (!key) return null;
  if (WEEKDAY_MAP[key]) return WEEKDAY_MAP[key];

  // 兜底：抓「星期X / 周X」里的那个汉字
  const m = key.match(/^(?:星期|周)\s*([一二三四五六日天])$/);
  if (m) {
    const ch = m[1] === '天' ? '日' : m[1];
    return WEEKDAY_MAP[`星期${ch}`] ?? null;
  }
  return null;
}

/**
 * 节次标签 → 节次号数组。
 *
 * 支持 '第1,2节' → [1,2]、'第9,10,11节' → [9,10,11]、'第1-2节' → [1,2]、
 * '第12节' → [12]。识别不出来返回空数组。
 */
export function parseSections(section: string | undefined | null): number[] {
  if (!section) return [];
  // 去掉「节」及其后内容（如 '第1,2节(第1-2节)' 只取前半段）
  const head = String(section).split('节')[0].replace(/[第\s]/g, '');
  if (!head) return [];

  // 连字符写法：'1-2' / '1—2' / '1~2'
  const range = head.match(/^(\d+)\s*[-–—~]\s*(\d+)$/);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
    const out: number[] = [];
    for (let n = Math.min(from, to); n <= Math.max(from, to); n++) out.push(n);
    return out;
  }

  // 逗号 / 顿号 / 加号列举：'1,2' / '9,10,11'
  const parts = head.split(/[,，、+\u3001]/).map((p) => p.trim()).filter(Boolean);
  const nums = parts
    .map((p) => (/^\d+$/.test(p) ? Number(p) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);

  return nums.length === parts.length ? nums : [];
}

/** 该条记录能否定位到网格（星期与节次都解析得出来） */
export function isPlaceable(course: CourseItem): boolean {
  return parseWeekdayCn(course?.weekday) !== null && parseSections(course?.section).length > 0;
}

// ===================== 周次 =====================

/**
 * 解析周次范围字符串。
 *
 * 后端给的是纯数字串（'1-9,11'），但也容忍带「周」和单双周标记的写法
 * （'1-9,11周[双周]'）。解析不出来时返回 null —— 调用方应据此**放宽**过滤
 * （宁可多显示，不要漏课）。
 */
export function parseWeekRange(range: string | undefined | null): number[] | null {
  if (!range) return null;
  let text = String(range).trim();
  if (!text) return null;

  // 单双周标记：目前返回给前端前已被后端削掉，但保留兼容
  const isEven = /\[双周\]/.test(text);
  const isOdd = /\[单周\]/.test(text);
  text = text.replace(/\[(双|单)周\]/g, '').replace(/周/g, '').replace(/[()（）]/g, '').trim();

  const weeks = new Set<number>();
  for (const segment of text.split(/[,，、]/)) {
    const part = segment.trim();
    if (!part) continue;

    const rangeMatch = part.match(/^(\d+)\s*[-–~]\s*(\d+)$/);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
      for (let w = Math.min(from, to); w <= Math.max(from, to); w++) weeks.add(w);
      continue;
    }

    const singleMatch = part.match(/^(\d+)$/);
    if (singleMatch) {
      weeks.add(Number(singleMatch[1]));
      continue;
    }

    // 出现无法理解的片段 → 整体放弃过滤（宁可多显示）
    return null;
  }

  if (!weeks.size) return null;
  let list = [...weeks];
  if (isEven) list = list.filter((w) => w % 2 === 0);
  if (isOdd) list = list.filter((w) => w % 2 === 1);
  return list.sort((a, b) => a - b);
}

/** 该课程是否出现在指定周。周次不可解析时一律返回 true（安全兜底） */
export function isCourseInWeek(course: CourseItem, week: number): boolean {
  const weeks = parseWeekRange(course.week_range);
  if (!weeks) return true;
  return weeks.includes(week);
}

// ===================== 连堂合并 =====================

/** 两条记录是否属于同一门课（同课名 + 同教师 + 同教室） */
function sameCourse(a: CourseItem, b: CourseItem): boolean {
  return (
    a.course_name === b.course_name &&
    a.teacher === b.teacher &&
    a.class_room === b.class_room
  );
}

/** 把一条原始记录展开成按节次排列的中间项（一条记录可能覆盖多节） */
type Segment = { weekday: number; sections: number[]; course: CourseItem };

function toSegments(courses: CourseItem[]): { segments: Segment[]; unplaced: CourseItem[] } {
  const segments: Segment[] = [];
  const unplaced: CourseItem[] = [];

  for (const course of courses) {
    const weekday = parseWeekdayCn(course?.weekday);
    const sections = parseSections(course?.section);
    if (weekday === null || !sections.length) {
      unplaced.push(course);
      continue;
    }
    segments.push({ weekday, sections, course });
  }

  segments.sort(
    (a, b) => a.weekday - b.weekday || a.sections[0] - b.sections[0],
  );
  return { segments, unplaced };
}

/**
 * 把接口返回的扁平课表整理成按星期分组的连堂块。
 *
 * 合并规则：同一 weekday、同一门课（课名/教师/教室全等）、且节次**首尾相接**
 * （上一条结束节 + 1 === 下一条起始节）时并成一块。
 *
 * 解析不出星期或节次的记录会被**丢弃**，同时可通过 `findUnplacedCourses`
 * 取出，交页面提示用户（默默吞掉数据是不可接受的）。
 *
 * @param courses 接口原始数据
 * @param week    需要过滤的周次；不传则不过滤
 */
export function buildCourseBlocks(courses: CourseItem[], week?: number): CourseBlock[] {
  const filtered =
    week === undefined ? courses : courses.filter((c) => isCourseInWeek(c, week));
  const { segments } = toSegments(filtered);

  const blocks: CourseBlock[] = [];
  for (const seg of segments) {
    const last = blocks[blocks.length - 1];
    const canMerge =
      !!last &&
      last.weekday === seg.weekday &&
      seg.sections[0] === last.endSection + 1 &&
      sameCourse(last.course, seg.course);

    if (canMerge) {
      last.endSection = seg.sections[seg.sections.length - 1];
      last.span = last.endSection - last.startSection + 1;
      continue;
    }

    blocks.push({
      weekday: seg.weekday,
      startSection: seg.sections[0],
      endSection: seg.sections[seg.sections.length - 1],
      span: seg.sections[seg.sections.length - 1] - seg.sections[0] + 1,
      course: seg.course,
    });
  }

  return blocks;
}

/**
 * 取不出星期 / 节次、无法放进网格的课程。
 * 正常情况下应为空数组；非空说明教务系统的课表格式变了，页面应显式提示。
 */
export function findUnplacedCourses(courses: CourseItem[], week?: number): CourseItem[] {
  const filtered =
    week === undefined ? courses : courses.filter((c) => isCourseInWeek(c, week));
  return toSegments(filtered).unplaced;
}

/** 需要渲染的星期列。产品要求周一到周日**常驻 7 列**（周末没课也占位），列宽固定、超出横向滚动 */
export function resolveWeekdays(blocks: CourseBlock[]): number[] {
  return Array.from({ length: 7 }, (_, i) => i + 1);
}

/** 需要渲染的节次数：取数据最大节次，至少 5 节，最多 12 节 */
export function resolveSectionCount(blocks: CourseBlock[]): number {
  const max = blocks.reduce((acc, b) => Math.max(acc, b.endSection), 5);
  return Math.min(Math.max(max, 5), 12);
}

// ===================== 节次 → 大节（网格行） =====================

/**
 * 设计稿 `19:6` 的网格一行 = **2 个节次**（一个「大节」）。
 *
 * 依据（都在画布上，不是推测）：
 *   - `Grid Row` 高度固定 434，而 5 行 × 82 + 4 行距 × 6 = 434，正好 5 行；
 *   - 第 1 行标注 08:00–09:35（95 分钟 = 45+5+45），即第 1、2 节连上。
 *
 * 所以第 1,2 节 → 第 1 行，第 3,4 节 → 第 2 行……第 9,10 节 → 第 5 行。
 * 若以后教务排到第 11 节，会落到第 6 行（设计稿没给第 6 行的时间，不编）。
 */
export const SECTIONS_PER_ROW = 2;

/**
 * 设计稿固定 **5 个大节**（`Grid Row` 高 434 = 5×82 + 4×6），没有第 6 节。
 *
 * 第 5 大节是晚上的「第 9,10,11 节」连堂（19:00–21:30），
 * 所以第 11 节**不单独成行**，直接并进第 5 行 —— 这就是这里封顶的原因。
 */
export const ROW_COUNT = 5;

/** 节次号 → 所在大节行号（1 起）。第 1、2 节 → 1；第 9、10、11 节 → 5 */
export function sectionRow(section: number): number {
  return Math.min(Math.ceil(section / SECTIONS_PER_ROW), ROW_COUNT);
}

/**
 * 需要渲染的大节行数：设计稿锁定 5 行，不随数据增减。
 * （`ROW_COUNT` 是画布常量；若以后画布加行，改这一个常量即可。）
 */
export function resolveRowCount(blocks: CourseBlock[]): number {
  const max = blocks.reduce((acc, b) => Math.max(acc, sectionRow(b.endSection)), 1);
  return Math.min(Math.max(max, ROW_COUNT), ROW_COUNT);
}

// ===================== 学期周次推算 =====================

/**
 * 由开学日期推算当前教学周（第几周）。
 *
 * 开学日期来自公开接口 `GET /calendar`（实测返回真实校历，如开学 2026-08-31）。
 * 解析失败返回 null，调用方应退化为「不显示周次」。
 */
export function currentWeekFromTermStart(
  termStart: string | undefined | null,
  now: Date = new Date(),
): number | null {
  if (!termStart) return null;
  const start = new Date(`${termStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

/** 取该周周一 / 周五的 M/D 区间文案，用于「第 N 周」下方的小字 */
export function weekRangeLabel(week: number, termStart: string | undefined | null): string {
  const start = termStart ? new Date(`${termStart}T00:00:00`) : null;
  if (!start || Number.isNaN(start.getTime())) return `第 ${week} 周`;

  // 开学日期按周一计；第 1 周的周一就是开学日
  const monday = new Date(start.getTime() + (week - 1) * 7 * 86_400_000);
  const friday = new Date(monday.getTime() + 4 * 86_400_000);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(monday)} – ${fmt(friday)}`;
}

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export type WeekDay = {
  /** 1=周一 … 7=周日 */
  weekday: number;
  label: string;
  /** 该天的 M/D 文案，推不出日期时为空串 */
  date: string;
  today: boolean;
};

/**
 * 推算某一周里每一天的真实日期。
 * 推不出开学日期时返回 null，页面应退化成「只显示星期几、不显示日期」。
 */
export function resolveWeekDates(
  week: number,
  termStart: string | null | undefined,
  now: Date = new Date(),
): WeekDay[] | null {
  const start = termStart ? new Date(`${termStart}T00:00:00`) : null;
  const valid = start && !Number.isNaN(start.getTime());

  const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  return DAY_LABELS.map((label, idx) => {
    const weekday = idx + 1;
    if (!valid) return { weekday, label, date: '', today: false };

    const d = new Date((start as Date).getTime() + ((week - 1) * 7 + idx) * 86_400_000);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return {
      weekday,
      label,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      today: key === todayKey,
    };
  });
}
