import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dormApi } from '../api/endpoints/campus';
import type {
  DormSignRecord,
  DormSignResult,
  DormSignStatus,
  DormTaskInfo,
} from '../api/contracts/campus';
import { useAuthedQuery } from './useAuthedQuery';

export const dormSignKeys = {
  task: ['dorm', 'task'] as const,
  status: ['dorm', 'sign-status'] as const,
  records: ['dorm', 'sign-records'] as const,
};

/**
 * 宿舍签到任务信息（楼栋 / 房间 / 床位）。
 *
 * ⚠️ 未绑定晚寝系统时后端返回 `ErrCodeNotBound` +「未绑定宿舍」（HTTP 400），
 * `useAuthedQuery` 会把它识别成 `not_bound` —— 页面据此引导去绑定，
 * 而不是给一个注定失败的重试按钮。
 */
export function useDormTask() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<DormTaskInfo>({
    queryKey: dormSignKeys.task,
    queryFn: () => dormApi.getTask(),
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });

  return { status, task: data, error, refetch, isRefreshing };
}

/**
 * 当日签到状态。后端只给一个状态文案（`signStatusName`，如「已签到」「未签到」）。
 *
 * 这里不在前端猜测「已签到 / 未签到」的枚举：文案由上游晚寝系统给什么就显示什么，
 * 只有**是否等于「已签到」**这一个判断是前端必须做的（决定按钮是否可点）。
 */
export function useDormSignStatus() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<DormSignStatus>({
    queryKey: dormSignKeys.status,
    queryFn: () => dormApi.getSignStatus(),
    queryOptions: { staleTime: 30 * 1000 },
  });

  return { status, signStatus: data, error, refetch, isRefreshing };
}

/**
 * 签到记录列表。后端刻意只保留 `signDate` 与 `signStatusName` 两个字段，
 * 没有时间点、没有楼栋 —— 页面不要再去编「21:04 签到」这种细节。
 */
export function useDormSignRecords() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<DormSignRecord[]>({
    queryKey: dormSignKeys.records,
    queryFn: () => dormApi.getSignRecords(),
    queryOptions: { staleTime: 60 * 1000 },
  });

  return { status, records: data, error, refetch, isRefreshing };
}

/**
 * 执行签到。
 *
 * ⚠️ 有副作用：后端内部先取任务信息再调上游，失败走业务错误
 * （`UPSTREAM_ERROR` / `UPSTREAM_TIMEOUT`），**不是** 200 带 false。
 * 成功时 data 是上游透出的提示字符串，直接展示给用户即可。
 */
export function useDormSign() {
  const qc = useQueryClient();
  return useMutation<DormSignResult, unknown, void>({
    mutationFn: () => dormApi.sign(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dormSignKeys.status });
      void qc.invalidateQueries({ queryKey: dormSignKeys.records });
    },
  });
}
