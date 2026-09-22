import { SafeAreaView } from 'react-native-safe-area-context';

import CampusMapPage from '../page/CampusMapPage';
import { C } from '../template/theme';

/** 路由壳：校园地图（第 2 层压栈页，无底部 tab） */
export default function CampusMapRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <CampusMapPage />
    </SafeAreaView>
  );
}
