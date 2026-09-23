import { Stack } from 'expo-router/js-stack';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { LogBox } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../store/AuthContext';
import { C } from '../template/theme';

// expo-router 57 内置的 JS Stack（react-navigation/Stack/Card.js）仍在调用 RN 0.86 已标记废弃的
// InteractionManager（Card.js:87/92，卡片的进场动画与会话句柄）。这不是本项目代码的问题：
// 上游已在 expo-router 58 中改为不依赖它，而 SDK 57 线（含最新 57.0.22）仍然如此。
// 这里只做开发期日志过滤，不改变任何运行时行为；等 SDK 升到 58 后可删除本段。
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DingTalkJinBuTi: require('../assets/fonts/DingTalkJinBuTi.ttf'),
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
          },
        },
      }),
  );
  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack
          screenOptions={{
            // 入栈从右侧滑入，返回时反向滑回（露出下层页面）
            animation: 'slide_from_right',
            headerShown: false, // 关掉顶部导航栏，干净
            // 关键：不要把底层页面从视图层级摘掉，否则返回时底层页需要重新挂载 → 先白一下再滑入
            detachPreviousScreen: false,
            // 兜底底色，避免转场瞬间露出系统白
            cardStyle: { backgroundColor: C.cream },
            // gesture-handler 已对齐 Expo Go 内置的 2.32，滑动返回手势可用
            gestureEnabled: true,
          }}
          // 关闭 react-native-screens 的 detach 优化，让进出场由同一套 JS 动画驱动
          detachInactiveScreens={false}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
