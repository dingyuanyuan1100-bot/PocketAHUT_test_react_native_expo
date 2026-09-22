import { http } from '../client';
import { API_TIMEOUT_LONG_MS } from '../config';
import type {
  ClassScheduleQuery,
  ClassroomScheduleQuery,
  CourseItem,
  CourseQuery,
  CourseScheduleQuery,
  ExamItem,
  ExamQuery,
  GradeDetail,
  GradeDetailQuery,
  GradeItem,
  GradeQuery,
  IdleClassroom,
  IdleClassroomQuery,
  RankingProof,
  RankingQuery,
  ScheduleTableItem,
  TeacherScheduleQuery,
  TextbookItem,
  TextbookQuery,
  TrainingPlanPage,
  TrainingPlanQuery,
} from '../contracts/jwxt';

/**
 * 教务系统（jwxt）接口封装。
 *
 * 路由与必填参数以后端 `internal/jwxt/interfaces/router.go` 为准 ——
 * 该文件里还有 **`/jwxt/course-schedule`**（课程课表）和 **`/jwxt/app/*`**
 * 三个智慧教务 JSON 通道接口，接口文档的 65 条清单漏收了它们。
 *
 * 全部需要登录令牌；课表 / 成绩等还需教务已绑定，未绑定时后端返回业务码
 * `NOT_BOUND`（HTTP 400，Class=Bind）。
 */
export const jwxtApi = {
  // ===================== 课表 =====================

  /** 我的课程表（整学期） */
  getCourse: (query?: CourseQuery) => http.get<CourseItem[]>('/jwxt/course', { query }),

  /** 班级课表。semester + class_name 必填，缺一返回 MISSING_PARAM */
  getClassSchedule: (query: ClassScheduleQuery) =>
    http.get<ScheduleTableItem[]>('/jwxt/class-schedule', { query }),

  /** 教师课表。semester + teacher_name 必填 */
  getTeacherSchedule: (query: TeacherScheduleQuery) =>
    http.get<ScheduleTableItem[]>('/jwxt/teacher-schedule', { query }),

  /** 教室课表。semester + campus_id 必填 */
  getClassroomSchedule: (query: ClassroomScheduleQuery) =>
    http.get<ScheduleTableItem[]>('/jwxt/classroom-schedule', { query }),

  /** 课程课表。semester + course_name 必填（接口文档未收录此路由） */
  getCourseSchedule: (query: CourseScheduleQuery) =>
    http.get<ScheduleTableItem[]>('/jwxt/course-schedule', { query }),

  /**
   * 空闲教室。四个参数全部必填。
   * 返回体只有教室名，没有容量/设备信息。
   */
  getIdleClassroom: (query: IdleClassroomQuery) =>
    http.get<IdleClassroom[]>('/jwxt/idle-classroom', { query }),

  // ===================== 成绩 =====================

  /** 成绩列表 */
  getGrades: (query?: GradeQuery) => http.get<GradeItem[]>('/jwxt/grades', { query }),

  /**
   * 成绩明细。必须原样回传成绩列表条目里的
   * `jx0404id` / `cj0708id` / `zcj`，后端三者缺一即报 MISSING_PARAM。
   */
  getGradeDetail: (query: GradeDetailQuery) =>
    http.get<GradeDetail>('/jwxt/grades/detail', { query }),

  /**
   * 排名证明。后端要抓取并解析教务的 PDF，接口文档约定超时 60000ms，
   * 这里显式放宽（后端侧还有 4 小时缓存）。
   */
  getRanking: (query?: RankingQuery) =>
    http.get<RankingProof>('/jwxt/ranking', {
      query,
      timeoutMs: API_TIMEOUT_LONG_MS,
    }),

  // ===================== 考试 / 培养方案 / 教材 =====================

  /** 考试安排 */
  getExam: (query?: ExamQuery) => http.get<ExamItem[]>('/jwxt/exam', { query }),

  /** 培养方案（分页，返回 `{total,rows}` 而非裸数组） */
  getTrainingPlan: (query?: TrainingPlanQuery) =>
    http.get<TrainingPlanPage>('/jwxt/training-plan', { query }),

  /** 教材信息。xnxqid 缺省时后端取当前学期 */
  getTextbooks: (query?: TextbookQuery) =>
    http.get<TextbookItem[]>('/jwxt/textbooks', { query }),
};
