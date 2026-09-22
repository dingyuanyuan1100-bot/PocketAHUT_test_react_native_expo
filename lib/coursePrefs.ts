import { tokenStorage } from './storage';

/**
 * 课程表的**本地显示偏好**（右上角齿轮按钮修改的那部分）。
 *
 * ⚠️ 这同样不是后端能力：后端没有「用户课表偏好」相关路由，
 * 所以这两项只存在本机，换设备不继承。
 */
export type CoursePrefs = {
  /** 是否显示周六 / 周日两列（关掉后 7 列变 5 列，横向溢出也随之减少） */
  showWeekend: boolean;
  /** 节次列是否显示起止时间（关掉后只留大节序号） */
  showTimes: boolean;
};

const KEY = 'course.prefs.v1';

export const DEFAULT_PREFS: CoursePrefs = { showWeekend: true, showTimes: true };

export const prefsStore = {
  async load(): Promise<CoursePrefs> {
    try {
      const raw = await tokenStorage.get(KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw) as Partial<CoursePrefs>;
      return {
        showWeekend: parsed.showWeekend ?? DEFAULT_PREFS.showWeekend,
        showTimes: parsed.showTimes ?? DEFAULT_PREFS.showTimes,
      };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  },
  async save(p: CoursePrefs): Promise<void> {
    await tokenStorage.set(KEY, JSON.stringify(p));
  },
};
