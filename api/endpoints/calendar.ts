import { http } from '../client';
import { CalendarEvent } from '../contracts';

/**
 * GET /calendar
 * 获取已发布的校历活动，后端按开始日期升序返回。
 * 公开接口，无需鉴权。
 */
export function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  return http.get<CalendarEvent[]>('/calendar');
}
