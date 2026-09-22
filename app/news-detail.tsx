import { SafeAreaView } from 'react-native-safe-area-context';

import NewsDetailPage from '../page/NewsDetailPage';
import { C } from '../template/theme';

/** 路由壳：新闻详情（第 3 层压栈页，无底部 tab） */
export default function NewsDetailRoute() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={['top']}>
      <NewsDetailPage />
    </SafeAreaView>
  );
}
