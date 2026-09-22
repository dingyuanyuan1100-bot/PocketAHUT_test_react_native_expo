import { Stack } from 'expo-router/js-stack';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../store/AuthContext';
import { C } from '../template/theme';

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
        // JS 驱动的水平转场：进场从右滑入，退场向右滑出（原生 stack 在 Android 上退场会丢帧/直接消失）
        animation: "slide_from_right",
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
