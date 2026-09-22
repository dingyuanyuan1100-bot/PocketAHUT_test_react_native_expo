import { useQuery } from '@tanstack/react-query';
import { fetchCalendarEvents } from '../api/endpoints/calendar';
import { CalendarEvent } from '../api/contracts';

/** 查询键工厂（便于后续做精确失效/刷新） */
export const calendarKeys = {
  all: ['calendar'] as const,
  events: () => [...calendarKeys.all, 'events'] as const,
};

/**
 * 校历活动数据钩子（react-query 托管缓存/重试/loading/error）。
 * 5 分钟 staleTime，避免频繁穿透后端。
 */
export function useCalendarEvents() {
  return useQuery<CalendarEvent[], Error>({
    queryKey: calendarKeys.events(),
    queryFn: fetchCalendarEvents,
  });
}
