import { SafeAreaView } from 'react-native-safe-area-context';

import ElectricityPage from '../page/ElectricityPage';
import { C } from '../template/theme';

/** 路由壳：电费（第 2 层压栈页） */
export default function ElectricityRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <ElectricityPage />
    </SafeAreaView>
  );
}
