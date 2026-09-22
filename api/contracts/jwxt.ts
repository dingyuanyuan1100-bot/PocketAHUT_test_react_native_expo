/**
 * 教务系统（jwxt）契约 —— 对应接口文档 §3.4。
 *
 * 字段全部来自后端 Go 结构体（`internal/jwxt/domain/*.go`）与解析器
 * （`internal/jwxt/infrastructure/parser/*.go`），不是从文档表格推测的。
 *
 * ⚠️ 三个反直觉的实测结论，改动前务必先读：
 *
 *   1. `weekday` 与 `section` 都是**中文字符串**，不是数字。
 *      - weekday: '星期一' … '星期日'（parser 里写死的 weekdays 数组）
 *      - section: '第1,2节' / '第3,4节' / '第9,10,11节' / '第12节'
 *        且不同教务页面存在 '第1-2节' 这种连字符变体（见 handler_test.go 样本）。
 *      数字化的责任在 `lib/schedule.ts`，不在这里硬转 —— 契约要如实描述载荷。
 *
 *   2. `week_range` 是**纯数字串**，如 '1-9,11'，不含「周」也不含括号
 *      （parser 的 extractWeekOnly 已把 `(周)[09-10-11节]` 这段削掉）。
 *
 *   3. **没有「结束节 / 连堂节数」字段**。一门连上 4 节的课会以 2 条记录出现
 *      （section 分别为 '第1,2节' 与 '第3,4节'），合并逻辑只能前端做。
 *
 * 认证：全部需登录；课表/成绩等还需教务已绑定，未绑定时后端返回业务码
 * `NOT_BOUND`（HTTP 400，Class=Bind），前端应引导绑定而非当作网络错误。
 */
import type { Paged } from './index';

// ===================== 通用查询参数 =====================

/** 教务查询通用参数。`semester` 形如 '2026-2027-1'，缺省时后端取当前学期 */
export interface JwxtQuery {
  semester?: string;
}

// ===================== 课表 =====================

/**
 * 我的课程表条目（后端 `JwxtClassScheduleResponse`）。
 *
 * 注意 `weekday` / `section` 是中文串，见文件头说明。
 */
export interface CourseItem {
  course_name: string;
  teacher: string;
  /** 星期几，中文：'星期一' … '星期日' */
  weekday: string;
  /** 节次块，如 '第1,2节' / '第9,10,11节' / '第12节' */
  section: string;
  /** 周次，纯数字串，如 '1-9,11' */
  week_range: string;
  class_room: string;
}

/** GET /jwxt/course 查询参数 */
export type CourseQuery = JwxtQuery;

/**
 * 实体课表条目（后端 `JwxtScheduleTableItem`）——
 * 班级课表 / 教师课表 / 教室课表 / 课程课表共用。
 */
export interface ScheduleTableItem {
  /** 行表头实体名（班级名 / 教师名 / 教室名 / 课程名） */
  entity_name: string;
  course_name: string;
  teacher: string;
  /** 中文星期，同 CourseItem.weekday */
  weekday: string;
  /** 节次组标签，如 '第1,2节'、'第5,6节'（来自表头 jieciGroup） */
  section: string;
  week_range: string;
  class_room: string;
  /** 上课班级列表（教室课表特有，其余为空串） */
  class_names: string;
}

/**
 * 班级/教师/教室/课程课表共用的筛选参数
 * （后端 `JwxtScheduleFilter`，字段为 form 绑定，即 query 参数）。
 */
export interface JwxtScheduleFilter {
  /** 学年学期，如 '2024-2025-1' */
  semester?: string;
  /** 上课院系编码 */
  department?: string;
  /** 起始周次 */
  week_from?: string;
  /** 结束周次 */
  week_to?: string;
  /** 起始星期（1-7） */
  weekday_from?: string;
  /** 结束星期 */
  weekday_to?: string;
  /** 起始节次（01-12） */
  section_from?: string;
  /** 结束节次 */
  section_to?: string;
}

/** GET /jwxt/class-schedule。**semester 与 class_name 必填** */
export interface ClassScheduleQuery extends JwxtScheduleFilter {
  /** 班级名称，如 '242' */
  class_name: string;
  /** 学年学期（此处必填，覆盖基类可选） */
  semester: string;
}

/** GET /jwxt/teacher-schedule。**semester 与 teacher_name 必填** */
export interface TeacherScheduleQuery extends JwxtScheduleFilter {
  /** 教师姓名 */
  teacher_name: string;
  /** 教师职称编码 */
  teacher_title?: string;
  /** 教师 ID */
  teacher_id?: string;
  semester: string;
}

/** GET /jwxt/classroom-schedule。**semester 与 campus_id 必填** */
export interface ClassroomScheduleQuery extends JwxtScheduleFilter {
  /** 校区 ID */
  campus_id: string;
  /** 教学楼 ID */
  building_id?: string;
  semester: string;
}

/** GET /jwxt/course-schedule（文档未收录，但路由存在）。**semester 与 course_name 必填** */
export interface CourseScheduleQuery extends JwxtScheduleFilter {
  /** 课程名称 */
  course_name: string;
  /** 开课院系编码 */
  course_dept?: string;
  /** 授课院系编码 */
  course_major?: string;
  /** 课程性质（必修/限选/任选/公选） */
  course_nature?: string;
  semester: string;
}

// ===================== 空教室 =====================

/** 空闲教室查询。**四个参数全部必填**，缺任一项后端返回 MISSING_PARAM */
export interface IdleClassroomQuery {
  /** 校区 ID */
  campus_id: string;
  /** 教学楼 ID */
  building_id: string;
  /** 日期，格式 '2026-09-01' */
  date: string;
  /** 节次编码：'0102' | '0304' | '0506' | '0708' | '091011' | '12' */
  section: string;
}

/**
 * 空闲教室条目（后端 `IdleClassroomResponse`）。
 * 这个接口**只返回教室名**，没有容纳人数、设备等字段。
 */
export interface IdleClassroom {
  class_room: string;
}

// ===================== 成绩 =====================

/** GET /jwxt/grades 查询参数（后端 `JwxtGradeQueryRequest`） */
export interface GradeQuery extends JwxtQuery {
  /** 课程名称，模糊查询 */
  course?: string;
  /** 课程性质：'必修' | '选修' */
  type?: string;
}

/**
 * 成绩条目（后端 `JwxtGradeResponse`）。
 *
 * 除 `course_name` / `score` 等展示字段外，后端还会透出三个**明细查询凭据**
 * （`jx0404id` / `cj0708id` / `zcj`），成功时存在、为空时字段被 omitempty 省略。
 * 要查某门课的平时分/期末分，必须把这三个值原样回传给 `/jwxt/grades/detail`。
 */
export interface GradeItem {
  /** 序号 */
  serial_number: string;
  course_name: string;
  /** 成绩（可能是 '85'、'优秀'、'通过' 等，不要当数字解析） */
  score: string;
  /** 成绩标识（如 '初修' / '重修'） */
  score_tag: string;
  /** 学分 */
  credit: string;
  /** 总学时 */
  total_hours: string;
  /** 绩点 */
  gpa: string;
  /** 课程属性 */
  course_attr: string;
  /** 课程性质 */
  course_nature: string;
  /** 教学任务 ID —— 查明细用 */
  jx0404id?: string;
  /** 成绩记录 ID —— 查明细用 */
  cj0708id?: string;
  /** 总成绩 —— 查明细用 */
  zcj?: string;
}

/** GET /jwxt/grades/detail 查询参数。**三个参数全部必填** */
export interface GradeDetailQuery {
  jx0404id: string;
  cj0708id: string;
  zcj: string;
}

/**
 * 成绩明细（后端 `JwxtGradeDetailResponse`）。
 * 全部为字符串；某门课若没有实验/平时分环节，对应字段为空串。
 */
export interface GradeDetail {
  /** 期末成绩 */
  final_exam_score: string;
  /** 期末成绩比例 */
  final_exam_ratio: string;
  /** 实验成绩 */
  lab_score: string;
  /** 实验成绩比例 */
  lab_ratio: string;
  /** 平时成绩 */
  regular_score: string;
  /** 平时成绩比例 */
  regular_ratio: string;
  /** 总成绩 */
  total_score: string;
}

/** GET /jwxt/ranking 排名证明（后端 `JwxtRankingProofResponse`） */
export interface RankingProof {
  /** 专业排名 */
  major_rank: string;
  /** 专业总人数 */
  major_total: string;
  /** 平均学分绩 */
  avg_score: string;
}

// ===================== 考试安排 =====================

/** GET /jwxt/exam 查询参数（后端 `JwxtExamScheduleRequest`） */
export type ExamQuery = JwxtQuery;

/**
 * 考试安排条目（后端 `JwxtExamScheduleResponse`）。
 * 注意 `exam_time` / `seat_num` 都是字符串 —— 时间不做结构化，原样展示。
 */
export interface ExamItem {
  course_name: string;
  /** 授课教师 */
  teacher: string;
  /** 考试时间（原始文案，如 '2026-01-12(14:00-16:00)'） */
  exam_time: string;
  /** 考场 */
  exam_room: string;
  /** 座位号 */
  seat_num: string;
}

// ===================== 培养方案 / 教材 =====================

/** GET /jwxt/training-plan 查询参数（后端 `JwxtTrainingPlanFilter` + 分页） */
export interface TrainingPlanQuery {
  /** 课程体系 */
  course_system?: string;
  /** 课程属性（必修/选修） */
  course_attr?: string;
  /** 课程名称，模糊搜索 */
  course_name?: string;
  /** 开设学期 */
  semester?: string;
  page?: number;
  /** 每页条数，默认 20，最大 100 */
  size?: number;
}

/**
 * 培养方案条目。
 *
 * ⚠️ 后端 handler 用 `map[string]any` 直接透出解析结果（见 interfaces/misc.go），
 * 没有 Go 结构体可以对照，因此**字段名未经确证**。这里只声明"未知键值对"，
 * 页面必须做存在性判断后再渲染，不得硬取某一个键。
 */
export type TrainingPlanItem = Record<string, unknown>;

/** GET /jwxt/training-plan 响应：`{total, rows}` 分页包（非裸数组） */
export type TrainingPlanPage = Paged<TrainingPlanItem>;

/**
 * GET /jwxt/textbooks —— 教材信息。
 * 后端同理由解析器直接产出，字段未经确证，按未知键值对处理。
 */
export type TextbookItem = Record<string, unknown>;

/** GET /jwxt/textbooks 查询参数。`xnxqid` 缺省时后端取当前学期 */
export interface TextbookQuery {
  /** 开课学期，如 '2025-2026-1' */
  xnxqid?: string;
}

/** GET /jwxt/ranking 查询参数 */
export interface RankingQuery {
  /** 打印纸张类型，默认 '0' */
  dyz?: string;
}
