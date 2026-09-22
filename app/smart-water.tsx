import { SafeAreaView } from 'react-native-safe-area-context';

import SmartWaterPage from '../page/SmartWaterPage';
import { C } from '../template/theme';

/** 路由壳：智慧控水（第 2 层压栈页，无底部 tab） */
export default function SmartWaterRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <SmartWaterPage />
    </SafeAreaView>
  );
}
