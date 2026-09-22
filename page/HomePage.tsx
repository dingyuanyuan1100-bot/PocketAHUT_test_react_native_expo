import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import BrandBadge from '../template/BrandBadge';
import HeroCard from '../template/HeroCard';
import Sticker from '../template/Sticker';
import StaggerIn from '../template/StaggerIn';
import TileColumn, { LEFT_TILES, RIGHT_TILES } from '../template/Tile';
import { C, DISPLAY, inkA, SHADOW } from '../template/theme';

/**
 * 第 1 页：首页（品牌徽章 + 标题 + 问候 + 功能卡片）
 *
 * animate=false 时所有元素保持隐藏，等启动页开始淡出再统一错峰落位，
 * 两段动画首尾相接，不会出现「内容先出现、再被遮住」的割裂感。
 */
export default function HomePage({ animate = false }: { animate?: boolean }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 品牌徽章 */}
      <StaggerIn index={0} active={animate}>
        <BrandBadge />
      </StaggerIn>

      {/* 标题 */}
      <StaggerIn index={1} active={animate}>
        <Text style={styles.pageTitle}>校园服务</Text>
      </StaggerIn>

      {/* 问候行 + 灵可头像贴纸 */}
      <StaggerIn index={2} active={animate} style={styles.greetingRow}>
        <View style={styles.greetingTextCol}>
          <Text style={styles.greetingHi}>Hi ~ 今天也要元气满满</Text>
        </View>
        <Sticker clip fill={C.lime} radius={999} offset={SHADOW.md} style={styles.avatar}>
          <Image source={require('../assets/chibi/avatar.png')} style={styles.avatarImg} resizeMode="contain" />
        </Sticker>
      </StaggerIn>

      {/* 大卡片：成绩查询（青柠实心 + NEW）→ /grades，页面已是真实接口 */}
      <StaggerIn index={3} active={animate}>
        <HeroCard title="成绩查询" sub="绩点 · 学分 · 排名" icon="award" badge="NEW" route="/grades" />
      </StaggerIn>

      {/* 6 分区 Bento 网格（双列错落）：左右两列交错落位，startIndex 错开 1 */}
      <View style={styles.bentoGrid}>
        <TileColumn tiles={LEFT_TILES} animate={animate} startIndex={4} step={2} />
        <TileColumn tiles={RIGHT_TILES} animate={animate} startIndex={5} step={2} />
      </View>

      {/* 大卡片：食堂查询（墨黑实心 + HOT）→ /canteen，接真实 /canteen 接口 */}
      <StaggerIn index={10} active={animate}>
        <HeroCard title="食堂查询" sub="今日菜单 · 热评" icon="coffee" badge="HOT" dark route="/canteen" />
      </StaggerIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    paddingBottom: 130, // 给悬浮导航栏留出空间
  },
  pageTitle: {
    fontFamily: DISPLAY,
    fontSize: 28,
    letterSpacing: -0.5,
    color: C.ink,
    alignSelf: 'flex-start',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  greetingTextCol: {
    flex: 1,
    gap: 3,
  },
  greetingHi: {
    fontFamily: DISPLAY,
    fontSize: 16,
    letterSpacing: -0.2,
    color: C.ink,
  },
  greetingSub: {
    fontSize: 11,
    color: inkA(0.55),
  },
  avatar: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 54,
    height: 54,
  },
  bentoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
});
