import { SafeAreaView } from 'react-native-safe-area-context';

import ExamPage from '../page/ExamPage';
import { C } from '../template/theme';

/** 路由壳：考试安排（第 2 层压栈页） */
export default function ExamRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <ExamPage />
    </SafeAreaView>
  );
}
