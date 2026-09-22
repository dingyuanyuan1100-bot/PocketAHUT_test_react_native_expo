import { SafeAreaView } from 'react-native-safe-area-context';

import NetworkPage from '../page/NetworkPage';
import { C } from '../template/theme';

/** 路由壳：校园网（第 2 层压栈页） */
export default function NetworkRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <NetworkPage />
    </SafeAreaView>
  );
}
