import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dormApi, electricityApi } from '../api/endpoints/campus';
import type {
  Building,
  ChargeOrderStatus,
  CreateChargeOrderRequest,
  CreateChargeOrderResult,
  DormBindRequest,
  DormBinding,
  ElectricityBalance,
} from '../api/contracts/campus';
import { useAuthedQuery } from './useAuthedQuery';

export const electricityKeys = {
  balance: ['electricity', 'balance'] as const,
  binding: ['dorm', 'binding'] as const,
  buildings: (xiaoqu: string) => ['dorm', 'buildings', xiaoqu] as const,
  order: (orderNo: string) => ['electricity', 'order', orderNo] as const,
};

/**
 * 电费余额。
 *
 * 后端 `GetBalanceByUser` 在用户没绑定宿舍时返回
 * `ErrCodeNotBound` +「请先绑定宿舍信息」（HTTP 400，Class=Bind），
 * 所以未绑定态会被 `useAuthedQuery` 识别成 `not_bound` ——
 * 页面据此引导去绑定宿舍，而不是给一个注定失败的重试按钮。
 */
export function useElectricityBalance() {
  const { status, data, error, refetch, isRefreshing } = useAuthedQuery<ElectricityBalance>({
    queryKey: electricityKeys.balance,
    queryFn: () => electricityApi.getBalance(),
    queryOptions: { staleTime: 60 * 1000 },
  });

  return {
    status,
    balance: data,
    error,
    refetch,
    isRefreshing,
  };
}

/**
 * 楼栋列表。
 * ⚠️ `/dorm/buildings` 是**公开接口**（后端挂的是 PublicRateLimit，没有 Auth），
 * 所以这里用原生 useQuery 而不是 useAuthedQuery，未登录也能列出来。
 */
export function useDormBuildings(xiaoqu: string) {
  return useQuery<Building[], Error>({
    queryKey: electricityKeys.buildings(xiaoqu),
    queryFn: () => dormApi.getBuildings(xiaoqu),
    enabled: !!xiaoqu,
    // 楼栋是静态表，缓存久一点
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * 宿舍房间绑定状态。
 *
 * 未绑定时后端返回 **404 / NOT_FOUND**（不是空对象），语义是「缺前置条件」，
 * 因此显式映射成 `not_bound`。
 */
export function useDormBinding() {
  const { status, data, error, refetch } = useAuthedQuery<DormBinding>({
    queryKey: electricityKeys.binding,
    queryFn: () => dormApi.getBinding(),
    notFoundStatus: 'not_bound',
    queryOptions: { staleTime: 5 * 60 * 1000 },
  });

  return { status, binding: data, error, refetch };
}

/** 绑定宿舍房间。成功后余额与绑定状态一起失效（余额依赖房间） */
export function useDormBind() {
  const qc = useQueryClient();
  return useMutation<DormBinding, unknown, DormBindRequest>({
    mutationFn: (body) => dormApi.bind(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.binding });
      void qc.invalidateQueries({ queryKey: electricityKeys.balance });
    },
  });
}

/**
 * 创建充值订单。
 *
 * ⚠️ 有副作用且涉及资金，调用方必须先做二次确认。
 * 注意后端在「上游结果未知」时返回 **502 且可能同时带 data**
 * （见 `FailWithErrorData`）—— 那种情况下不能当普通失败重试，
 * 应拿返回的 order_no 去查订单状态。
 */
export function useCreateChargeOrder() {
  return useMutation<CreateChargeOrderResult, unknown, CreateChargeOrderRequest>({
    mutationFn: (body) => electricityApi.createChargeOrder(body),
  });
}

/**
 * 轮询充值订单状态。
 *
 * 传入 orderNo 后每 3 秒查一次，`paid` 为真即自动停止轮询并让余额失效
 * —— 支付到账后余额会变，不刷新等于给用户看旧数字。
 */
export function useChargeOrderStatus(orderNo: string | null) {
  const qc = useQueryClient();

  return useQuery<ChargeOrderStatus, Error>({
    queryKey: electricityKeys.order(orderNo ?? ''),
    queryFn: async () => {
      const status = await electricityApi.getChargeOrderStatus(orderNo as string);
      if (status.paid) {
        void qc.invalidateQueries({ queryKey: electricityKeys.balance });
      }
      return status;
    },
    enabled: !!orderNo,
    refetchInterval: (query) => (query.state.data?.paid ? false : 3000),
  });
}
