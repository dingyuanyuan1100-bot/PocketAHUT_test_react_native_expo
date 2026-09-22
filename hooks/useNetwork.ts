import { useMutation, useQueryClient } from '@tanstack/react-query';
import { networkApi } from '../api/endpoints/campus';
import type {
  NetworkAccount,
  NetworkBoundDevice,
  NetworkLoginRecord,
  NetworkOfflineResult,
  NetworkOnlineDevice,
} from '../api/contracts/campus';
import { useAuthedQuery } from './useAuthedQuery';

export const networkKeys = {
  all: ['network'] as const,
  account: ['network', 'account'] as const,
  online: ['network', 'online'] as const,
  devices: ['network', 'devices'] as const,
  history: ['network', 'login-history'] as const,
};

/** 账户状态（已用时长 / 已用流量）。未绑定校园网账号时后端返回 NOT_BOUND */
export function useNetworkAccount() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<NetworkAccount>({
    queryKey: networkKeys.account,
    queryFn: () => networkApi.getAccount(),
    queryOptions: { staleTime: 60 * 1000 },
  });
  return { status, account: data, error, refetch, isRefreshing };
}

/** 在线设备。条目里的 session_id 是强制下线的凭据 */
export function useNetworkOnline() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<NetworkOnlineDevice[]>({
    queryKey: networkKeys.online,
    queryFn: () => networkApi.getOnline(),
    queryOptions: { staleTime: 30 * 1000 },
  });
  return { status, devices: data ?? [], error, refetch, isRefreshing };
}

/** 已绑定设备（MAC 白名单视角，与「在线设备」不是一回事） */
export function useNetworkBoundDevices() {
  const { status, data, error, refetch } = useAuthedQuery<NetworkBoundDevice[]>({
    queryKey: networkKeys.devices,
    queryFn: () => networkApi.getDevices(),
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });
  return { status, devices: data ?? [], error, refetch };
}

/** 上网记录 */
export function useNetworkHistory() {
  const { status, data, error, refetch } = useAuthedQuery<NetworkLoginRecord[]>({
    queryKey: networkKeys.history,
    queryFn: () => networkApi.getLoginHistory(),
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });
  return { status, records: data ?? [], error, refetch };
}

/**
 * 强制下线。
 *
 * ⚠️ 有副作用：会让目标设备断网。调用方必须先二次确认。
 * 后端在「上游结果未知」时返回 502，此时**不要**直接重试，
 * 应提示用户刷新在线列表确认现状（`success` 只在上游明确应答时才可信）。
 */
export function useForceOffline() {
  const qc = useQueryClient();
  return useMutation<NetworkOfflineResult, unknown, string>({
    mutationFn: (sessionId) => networkApi.forceOffline(sessionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: networkKeys.online });
    },
  });
}
