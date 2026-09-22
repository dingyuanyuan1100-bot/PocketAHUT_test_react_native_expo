import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import PageHeader from '../template/PageHeader';
import Sticker from '../template/Sticker';
import { C, DISPLAY, FeatherName, inkA, R, SHADOW } from '../template/theme';

/**
 * 第 2 层页面：校园地图
 *
 * 设计稿只给了「智慧地图」这张墨黑 Hero 卡（32:217：青柠 MapPin 图标 + 标题 + NEW 徽章），
 * 卡下方没有内容。这里沿用同一套贴纸语言补齐：搜索框 → 分类 chips → 常用地点列表。
 * 若你后面在画布上补了地图区域，把 <MapCanvasArea /> 那段替换掉即可。
 */

const CATS = ['全部', '教学楼', '宿舍', '食堂', '图书馆'] as const;

type Spot = {
  name: string;
  zone: string;
  distance: string;
  icon: FeatherName;
  cat: (typeof CATS)[number];
};

const SPOTS: Spot[] = [
  { name: '东教学楼 D302', zone: '教学区', distance: '320m', icon: 'map-pin', cat: '教学楼' },
  { name: '图书馆', zone: '教学区', distance: '450m', icon: 'book-open', cat: '图书馆' },
  { name: 'K3 学生公寓', zone: '生活区', distance: '180m', icon: 'home', cat: '宿舍' },
  { name: '第一食堂', zone: '生活区', distance: '260m', icon: 'coffee', cat: '食堂' },
  { name: '体育馆', zone: '运动区', distance: '600m', icon: 'activity', cat: '教学楼' },
];

export default function CampusMapPage() {
  const [cat, setCat] = useState<(typeof CATS)[number]>('全部');
  const list = cat === '全部' ? SPOTS : SPOTS.filter((s) => s.cat === cat);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ===================== 墨黑 Hero：智慧地图 ===================== */}
        <Sticker fill="#000000" radius={R.hero} offset={SHADOW.xl} style={styles.hero}>
          <PageHeader
            title="智慧地图"
            fg={C.lime}
            badgeBg={C.lime}
            badgeFg={C.ink}
            onBack={() => router.back()}
            backLeft
          />

          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Feather name="map-pin" size={26} color={C.ink} />
            </View>
            <Text style={styles.heroCaption}>校内导航 · 找楼 · 找教室</Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </View>
        </Sticker>

        {/* ===================== 搜索框 ===================== */}
        <Sticker fill={C.white} radius={12} offset={SHADOW.md} wrapStyle={styles.searchWrap} style={styles.search}>
          <Feather name="search" size={16} color={inkA(0.55)} />
          <Text style={styles.searchPlaceholder}>搜索目的地</Text>
        </Sticker>

        {/* ===================== 分类 chips ===================== */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATS.map((c) => {
            const on = c === cat;
            return (
              <TouchableOpacity key={c} activeOpacity={0.8} onPress={() => setCat(c)}>
                <View style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ===================== 地点列表 ===================== */}
        <Sticker fill={C.white} radius={R.hero} offset={SHADOW.lg} style={styles.listCard}>
          {list.map((s, i) => (
            <View key={s.name}>
              <TouchableOpacity activeOpacity={0.8} style={styles.spotRow}>
                <View style={styles.spotIcon}>
                  <Feather name={s.icon} size={18} color={C.ink} />
                </View>
                <View style={styles.spotText}>
                  <Text style={styles.spotName}>{s.name}</Text>
                  <Text style={styles.spotMeta}>
                    {s.zone} · {s.distance}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={inkA(0.45)} />
              </TouchableOpacity>
              {i < list.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          {list.length === 0 && <Text style={styles.empty}>该分类下暂无地点</Text>}
        </Sticker>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: C.cream,
  },
  scroll: {
    padding: 12,
    gap: 12,
  },

  // ===================== Hero =====================
  hero: {
    padding: 16,
    gap: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  heroCaption: {
    flex: 1,
    fontSize: 12,
    color: inkA(0.75),
  },
  newBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.lime,
  },
  newBadgeText: {
    fontFamily: DISPLAY,
    fontSize: 10,
    color: C.ink,
  },

  // ===================== 搜索 =====================
  searchWrap: {
    marginTop: 12,
  },
  search: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  searchPlaceholder: {
    fontSize: 13,
    color: inkA(0.55),
  },

  // ===================== chips =====================
  chips: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.oat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: inkA(0.7),
  },
  chipTextOn: {
    color: C.lime,
  },

  // ===================== 列表 =====================
  listCard: {
    padding: 8,
  },
  spotRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  spotIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotText: {
    flex: 1,
    gap: 2,
  },
  spotName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  spotMeta: {
    fontSize: 11,
    color: inkA(0.55),
  },
  divider: {
    height: 1,
    backgroundColor: C.oat,
  },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
    fontSize: 12,
    color: inkA(0.5),
  },
});
