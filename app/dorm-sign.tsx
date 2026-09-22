import { SafeAreaView } from 'react-native-safe-area-context';

import DormSignPage from '../page/DormSignPage';
import { C } from '../template/theme';

/** 路由壳：宿舍签到（第 2 层压栈页，无底部 tab） */
export default function DormSignRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <DormSignPage />
    </SafeAreaView>
  );
}
