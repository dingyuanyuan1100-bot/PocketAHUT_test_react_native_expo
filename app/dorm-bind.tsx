import { SafeAreaView } from 'react-native-safe-area-context';

import DormBindPage from '../page/DormBindPage';
import { C } from '../template/theme';

/**
 * 路由壳：宿舍房间绑定（电费前置条件）。
 *
 * 注意与 `app/dorm-sign.tsx` 区分：
 *   /dorm-bind → 绑定**房间**（校区+楼栋+房号），用于查电费
 *   /dorm-sign → 晚寝**签到**
 */
export default function DormBindRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <DormBindPage />
    </SafeAreaView>
  );
}
