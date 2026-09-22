import { SafeAreaView } from 'react-native-safe-area-context';

import CampusNewsPage from '../page/CampusNewsPage';
import { C } from '../template/theme';

/** 路由壳：校园资讯（第 2 层压栈页，无底部 tab） */
export default function CampusNewsRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <CampusNewsPage />
    </SafeAreaView>
  );
}
