import { SafeAreaView } from 'react-native-safe-area-context';

import GradesPage from '../page/GradesPage';
import { C } from '../template/theme';

/** 路由壳：成绩查询（第 2 层压栈页） */
export default function GradesRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <GradesPage />
    </SafeAreaView>
  );
}
