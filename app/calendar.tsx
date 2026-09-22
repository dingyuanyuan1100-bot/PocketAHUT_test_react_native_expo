import { SafeAreaView } from 'react-native-safe-area-context';

import CalendarPage from '../page/CalendarPage';
import { C } from '../template/theme';

/** 路由壳：校历（第 2 层压栈页，无底部 tab） */
export default function CalendarRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <CalendarPage />
    </SafeAreaView>
  );
}
