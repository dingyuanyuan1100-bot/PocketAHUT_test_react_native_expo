import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { C, DISPLAY } from './theme';

type Props = {
  visible: boolean;
  title: string;
  /** 标题下的灰色说明，用来交代「这个功能到底是不是后端能力」 */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * 贴纸风底部弹层（课表的「添加课程 / 显示设置」用）。
 *
 * 刻意做成**底部贴合 + 顶部圆角 + 2px 墨黑描边**、不做硬投影 ——
 * 弹层本身就是浮在页面上方的层，再叠硬投影会变成三层黑边。
 */
export default function BottomSheet({ visible, title, subtitle, onClose, children }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={styles.title}>{title}</Text>
                {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <Feather name="x" size={16} color={C.ink} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // RN 新版类型里没有 StyleSheet.absoluteFillObject，直接写死等价样式
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,18,20,0.45)',
  },
  sheetWrap: {
    width: '100%',
    maxHeight: '84%',
  },
  sheet: {
    maxHeight: '100%',
    backgroundColor: C.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: C.ink,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(17,18,20,0.25)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 20,
    lineHeight: 24,
    color: C.ink,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
    color: C.gray,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: C.ink,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 24,
  },
});
