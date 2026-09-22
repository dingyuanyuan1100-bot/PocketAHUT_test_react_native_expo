import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import Sticker from './Sticker';
import StaggerIn from './StaggerIn';
import { C, DISPLAY, FeatherName, inkA, limeA, R, SHADOW } from './theme';

// ===================== Q 版角色贴纸 =====================
const CHIBI = {
  calendar: require('../assets/chibi/chibi-calendar.png') as ImageSourcePropType,
  dorm: require('../assets/chibi/chibi-dorm.png') as ImageSourcePropType,
  water: require('../assets/chibi/chibi-water.png') as ImageSourcePropType,
  laundry: require('../assets/chibi/chibi-laundry.png') as ImageSourcePropType,
  news: require('../assets/chibi/chibi-news.png') as ImageSourcePropType,
  map: require('../assets/chibi/chibi-map.png') as ImageSourcePropType,
};

// ===================== Bento 数据配置 =====================
type TileVariant = 'lime' | 'ink' | 'cream';

export type BentoTile = {
  title: string;
  sub: string;
  icon: FeatherName;
  variant: TileVariant;
  height: number;
  chibi: ImageSourcePropType;
  iconRotate: string;
  chibiRotate: string;
  /** 已落地的第 2 层页面路由；留空表示尚未实现，点击不跳转 */
  route?: string;
};

export const LEFT_TILES: BentoTile[] = [
  { title: '校历', sub: '学期 · 假期安排', icon: 'calendar', variant: 'lime', height: 78, chibi: CHIBI.calendar, iconRotate: '5deg', chibiRotate: '5deg', route: '/calendar' },
  { title: '宿舍签到', sub: '归寝 · 打卡', icon: 'home', variant: 'ink', height: 92, chibi: CHIBI.dorm, iconRotate: '-6deg', chibiRotate: '6deg', route: '/dorm-sign' },
  { title: '智慧控水', sub: '水费 · 用水', icon: 'droplet', variant: 'cream', height: 78, chibi: CHIBI.water, iconRotate: '6deg', chibiRotate: '-5deg', route: '/smart-water' },
];

export const RIGHT_TILES: BentoTile[] = [
  { title: '洗衣机查询', sub: '空闲 · 预约', icon: 'loader', variant: 'lime', height: 78, chibi: CHIBI.laundry, iconRotate: '-6deg', chibiRotate: '-6deg', route: '/washer' },
  { title: '校园资讯', sub: '动态 · 热榜', icon: 'rss', variant: 'cream', height: 92, chibi: CHIBI.news, iconRotate: '5deg', chibiRotate: '5deg', route: '/campus-news' },
  { title: '校园地图', sub: '导航 · 找楼', icon: 'map-pin', variant: 'ink', height: 78, chibi: CHIBI.map, iconRotate: '5deg', chibiRotate: '6deg', route: '/campus-map' },
];

/** 瓷片配色：浅色底用墨黑前景，墨黑底用青柠前景 */
const TONE: Record<TileVariant, { bg: string; fg: string; sub: string }> = {
  lime: { bg: C.lime, fg: C.ink, sub: inkA(0.6) },
  ink: { bg: C.ink, fg: C.lime, sub: limeA(0.75) },
  cream: { bg: C.white, fg: C.ink, sub: inkA(0.6) },
};

/** Bento 单格：贴纸（2px 墨黑描边 + 零模糊硬投影） */
function Tile({
  tile,
  animate,
  index,
}: {
  tile: BentoTile;
  animate?: boolean;
  index?: number;
}) {
  const tone = TONE[tile.variant];
  return (
    <StaggerIn index={index} active={animate}>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!tile.route}
        onPress={() => {
          if (tile.route) router.push(tile.route as never);
        }}
      >
        <Sticker
          clip
          fill={tone.bg}
          radius={R.card}
          offset={SHADOW.md}
          style={[styles.tile, { height: tile.height }]}
        >
          <Text style={[styles.tileTitle, { color: tone.fg }]}>{tile.title}</Text>
          <Text style={[styles.tileSub, { color: tone.sub }]}>{tile.sub}</Text>
          <View style={[styles.tileIcon, { transform: [{ rotate: tile.iconRotate }] }]}>
            <Feather name={tile.icon} size={22} color={tone.fg} />
          </View>
          <Image
            source={tile.chibi}
            style={[styles.tileChibi, { top: tile.height === 92 ? 26 : 14, transform: [{ rotate: tile.chibiRotate }] }]}
            resizeMode="contain"
          />
        </Sticker>
      </TouchableOpacity>
    </StaggerIn>
  );
}

/** Bento 单列：startIndex / step 用于让左右两列交错落位 */
export default function TileColumn({
  tiles,
  animate,
  startIndex = 0,
  step = 1,
}: {
  tiles: BentoTile[];
  animate?: boolean;
  startIndex?: number;
  step?: number;
}) {
  return (
    <View style={styles.tileColumn}>
      {tiles.map((t, i) => (
        <Tile key={t.title} tile={t} animate={animate} index={startIndex + i * step} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tileColumn: {
    flex: 1,
    gap: 12,
  },
  tile: {
    padding: 12,
  },
  tileTitle: {
    fontFamily: DISPLAY,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  tileSub: {
    fontSize: 11,
    marginTop: 2,
  },
  tileIcon: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
  },
  tileChibi: {
    position: 'absolute',
    right: 12,
    width: 48,
    height: 48,
  },
});
