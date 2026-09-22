import { SafeAreaView } from 'react-native-safe-area-context';

import CanteenPage from '../page/CanteenPage';
import { C } from '../template/theme';

/** 路由壳：食堂查询（第 2 层压栈页，无底部 tab） */
export default function CanteenRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <CanteenPage />
    </SafeAreaView>
  );
}
