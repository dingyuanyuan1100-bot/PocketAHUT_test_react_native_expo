import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import PageHeader from './PageHeader';
import { C } from './theme';

type Props = {
  title: string;
  /** 标题右侧的状态胶囊（StatusPill / GuestPill） */
  statusPill?: ReactNode;
  /** 头部下方的筛选条等内容（不参与滚动，固定在头部） */
  toolbar?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** 是否禁用下拉刷新（如加载中、错误态无需再刷） */
  refreshEnabled?: boolean;
  /** 返回按钮回调，缺省用 router.back() */
  onBack?: () => void;
  children: ReactNode;
};

/**
 * 二级页外壳 —— 统一头部、滚动容器与下拉刷新。
 *
 * 布局要点（踩过的坑）：
 *   - `contentContainerStyle` 必须 `flexGrow: 1`，否则状态卡撑不满一屏，
 *     卡片会浮在页面顶部，与画布上「垂直居中」的规范不符；
 *   - 页面底部留 32 而非 130：二级页没有悬浮 Tab 栏，不需要额外让位。
 */
export default function SubPageShell({
  title,
  statusPill,
  toolbar,
  onRefresh,
  refreshing = false,
  refreshEnabled = true,
  onBack,
  children,
}: Props) {
  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh && refreshEnabled ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.ink}
              colors={[C.limeDeep]}
            />
          ) : undefined
        }
      >
        <View style={styles.headerRow}>
          <PageHeader
            title={title}
            fg={C.ink}
            badgeBg={C.lime}
            badgeFg={C.ink}
            onBack={onBack ?? (() => router.back())}
            backLeft
            extra={statusPill}
          />
        </View>
        {toolbar}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.cream,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  headerRow: {
    paddingHorizontal: 4,
  },
});
