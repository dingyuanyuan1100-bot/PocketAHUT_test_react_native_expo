import { tokenStorage } from './storage';

/**
 * 自定义课程（课表右上「+」添加的那部分）。
 *
 * ⚠️ 这不是后端能力：`/jwxt/course` 是只读的教务同步接口，
 * 后端**没有**任何「新增课程」的路由。所以自定义课程只存在**本机**，
 * 不会同步到教务，也不会出现在其他设备上 —— 界面上必须讲清楚这一点。
 *
 * 存储复用 `lib/storage.ts` 的 `tokenStorage`（SecureStore + 内存兜底）。
 * 注意 SecureStore 单条有体积上限，这里刻意只存必要字段、不存富文本。
 */
export type CustomCourse = {
  id: string;
  course_name: string;
  teacher?: string;
  class_room?: string;
  /** 1=周一 … 7=周日 */
  weekday: number;
  /** 起始节次（1-11） */
  startSection: number;
  /** 结束节次（含） */
  endSection: number;
};

const KEY = 'course.custom.v1';

function safeParse(raw: string | null): CustomCourse[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomCourse[]) : [];
  } catch {
    return [];
  }
}

export const customCourseStore = {
  async load(): Promise<CustomCourse[]> {
    return safeParse(await tokenStorage.get(KEY));
  },
  async save(list: CustomCourse[]): Promise<void> {
    await tokenStorage.set(KEY, JSON.stringify(list));
  },
};

const WEEKDAY_CN = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

/**
 * 把自定义课程伪装成教务返回的 `CourseItem` 形状，
 * 这样它能直接喂给 `buildCourseBlocks`，复用同一套连堂合并与周次过滤逻辑。
 */
export function toCourseItem(c: CustomCourse) {
  const sections: number[] = [];
  for (let n = Math.min(c.startSection, c.endSection); n <= Math.max(c.startSection, c.endSection); n++) {
    sections.push(n);
  }
  return {
    course_name: c.course_name,
    teacher: c.teacher ?? '',
    weekday: WEEKDAY_CN[c.weekday] ?? '星期一',
    section: `第${sections.join(',')}节`,
    week_range: '1-16',
    class_room: c.class_room ?? '',
    __customId: c.id,
  };
}
