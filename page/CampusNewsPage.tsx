import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { NEWS_TYPE_OPTIONS, type NewsItem, type NewsType } from '../api/contracts/content';
import { useNews } from '../hooks/useNews';
import LoadingCard from '../template/LoadingCard';
import PageHeader from '../template/PageHeader';
import StateCard from '../template/StateCard';
import Sticker from '../template/Sticker';
import { BORDER, C, DISPLAY, inkA, R, SHADOW } from '../template/theme';

/**
 * 第 2 层页面：校园资讯
 *
 * 版面隐喻 = 「报刊 / 布告栏」：奶油壳体当布告板，墨黑头条卡 + 白色清单卡钉在上面。
 * 全页不放任何图片位 —— 用日期方块建立阅读节奏，信息流广告没有生长的地方。
 *
 * 数据：GET /news（公开接口）。
 *
 * ⚠️ 两个必须记住的后端事实：
 *   1. 分类 `type` 是**英文枚举** announcement / academic / school。
 *      传中文会让上游炸掉（500 UPSTREAM_ERROR），所以筛选条走后端参数，
 *      但传给后端的必须是枚举值，中文只在界面上用。
 *   2. 条目**没有分类字段**，所以「全部」模式下无法知道每条属于哪个栏目 ——
 *      此时不显示栏目胶囊，宁可空着也不编一个。
 */

/** 把 'YYYY-MM-DD' 拆成日期方块要的月 / 日；解析不出来就退化为占位 */
function splitDate(date: string): { month: string; day: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  if (!m) return { month: '--月', day: '--' };
  return { month: `${m[2]}月`, day: m[3] };
}

/** 列表里的 content 是上游截断过的摘要（约 240 字），直接展示即可，不要再截断 */
function excerpt(content: string): string {
  return (content ?? '').trim();
}

export default function CampusNewsPage() {
  const [type, setType] = useState<NewsType | ''>('');
  const { news, isLoading, isError, error, refetch, isRefreshing } = useNews(type);

  const activeLabel = useMemo(
    () => NEWS_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? '全部',
    [type],
  );

  const headline = news.length > 0 ? news[0] : null;
  const rest = news.length > 1 ? news.slice(1) : [];

  const openDetail = (item: NewsItem) => {
    router.push({
      pathname: '/news-detail',
      params: {
        title: item.title,
        date: item.date,
        url: item.url,
        content: item.content,
        cat: type ? activeLabel : '',
      },
    } as never);
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.shellWrap}>
          {/* 奶油壳体：纯背景层（无描边 / 无外投影，对齐设计稿 32:202） */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.cream, borderRadius: R.hero }]} />

          <View style={styles.shellBody}>
            <PageHeader
              title="校园资讯"
              fg={C.ink}
              badgeBg={C.ink}
              badgeFg={C.cream}
              onBack={() => router.back()}
              backLeft
              style={styles.header}
            />

            {/* 分类筛选 —— 走后端 type（英文枚举），中文只在界面上出现 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {NEWS_TYPE_OPTIONS.map((o) => {
                const on = o.value === type;
                return (
                  <TouchableOpacity key={o.label} activeOpacity={0.8} onPress={() => setType(o.value)}>
                    <Sticker
                      fill={on ? C.ink : C.white}
                      radius={R.pill}
                      offset={0}
                      border={on ? 0 : BORDER}
                      style={styles.chip}
                    >
                      <Text style={[styles.chipText, { color: on ? C.lime : C.ink }]}>{o.label}</Text>
                    </Sticker>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ---------------- 加载中 ---------------- */}
            {isLoading && <LoadingCard label="正在拉取校园资讯…" />}

            {/* ---------------- 加载失败 ---------------- */}
            {isError && !isLoading && (
              <StateCard
                tone="error"
                icon={<Feather name="wifi-off" size={30} color={C.ink} />}
                title="资讯加载失败"
                description="学校新闻网上游暂时没有响应，这可能是网络波动导致的。"
                errorBar={{
                  code: error?.errorCode ?? 'UPSTREAM_ERROR',
                  message: error?.message ?? '获取新闻失败',
                }}
                primaryAction={{ label: '重新加载', onPress: () => refetch() }}
                link={{ label: '返回上一页', onPress: () => router.back() }}
              />
            )}

            {/* ---------------- 空 ---------------- */}
            {!isLoading && !isError && !headline && (
              <StateCard
                tone="empty"
                icon={<Feather name="inbox" size={30} color={C.ink} />}
                title="该栏目暂无资讯"
                description="学校新闻网这个栏目当前没有发布内容，换一个栏目看看？"
                secondaryAction={{
                  label: '查看全部资讯',
                  onPress: () => setType(''),
                }}
              />
            )}

            {/* ---------------- 有数据 ---------------- */}
            {!isLoading && !isError && headline && (
              <>
                {/* 置顶头条 */}
                <TouchableOpacity activeOpacity={0.9} onPress={() => openDetail(headline)}>
                  <Sticker
                    fill={C.ink}
                    radius={R.hero}
                    offset={SHADOW.xl}
                    shadowColor={C.limeDeep}
                    wrapStyle={styles.headlineWrap}
                    style={styles.headline}
                  >
                    <View style={styles.headlineTop}>
                      <View style={styles.topBadge}>
                        <Text style={styles.topBadgeText}>最新</Text>
                      </View>
                      <Text style={styles.headlineCat}>
                        {type ? activeLabel : '校园资讯'} · {headline.date}
                      </Text>
                    </View>

                    <Text style={styles.headlineTitle} numberOfLines={2}>
                      {headline.title}
                    </Text>

                    <Text style={styles.headlineExcerpt} numberOfLines={2}>
                      {excerpt(headline.content)}
                    </Text>

                    <View style={styles.headlineFoot}>
                      <Text style={styles.headlineMeta}>安徽工业大学新闻网</Text>
                      <Feather name="chevron-right" size={20} color={C.lime} />
                    </View>
                  </Sticker>
                </TouchableOpacity>

                {/* 资讯清单 */}
                {rest.length > 0 && (
                  <Sticker
                    fill={C.white}
                    radius={R.hero}
                    offset={SHADOW.lg}
                    wrapStyle={styles.listWrap}
                    style={styles.list}
                  >
                    {rest.map((n, i) => {
                      const d = splitDate(n.date);
                      return (
                        <View key={n.url || n.title}>
                          {i > 0 && <View style={styles.rowDivider} />}
                          <TouchableOpacity
                            style={styles.listItem}
                            activeOpacity={0.7}
                            onPress={() => openDetail(n)}
                          >
                            <View style={styles.dateBlock}>
                              <Text style={styles.dateMonth}>{d.month}</Text>
                              <Text style={styles.dateDay}>{d.day}</Text>
                            </View>

                            <View style={styles.itemText}>
                              {/* 栏目胶囊只在筛选了具体栏目时才渲染 —— 全部模式下后端不给分类 */}
                              {type ? (
                                <View style={[styles.catPill, { backgroundColor: C.lime }]}>
                                  <Text style={styles.catPillText}>{activeLabel}</Text>
                                </View>
                              ) : null}
                              <Text style={styles.itemTitle} numberOfLines={2}>
                                {n.title}
                              </Text>
                              <Text style={styles.itemExcerpt} numberOfLines={1}>
                                {excerpt(n.content)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    })}

                    <View style={styles.listDivider} />
                    <View style={styles.footerRow}>
                      <Text style={styles.footerText}>
                        共 {news.length} 条 · 来源 news.ahut.edu.cn
                      </Text>
                      {isRefreshing ? <Text style={styles.footerText}>更新中…</Text> : null}
                    </View>
                  </Sticker>
                )}
              </>
            )}
          </View>
        </View>
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
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  shellWrap: {
    flex: 1,
    position: 'relative',
  },
  shellBody: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  header: {
    marginHorizontal: 16,
  },

  // 分类筛选
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginHorizontal: 16,
    paddingRight: 16,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // 置顶头条
  headlineWrap: {
    marginTop: 18,
  },
  headline: {
    padding: 20,
  },
  headlineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBadge: {
    backgroundColor: C.lime,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 11,
    transform: [{ rotate: '-6deg' }],
  },
  topBadgeText: {
    fontFamily: DISPLAY,
    fontSize: 10,
    color: C.ink,
  },
  headlineCat: {
    fontFamily: DISPLAY,
    fontSize: 10,
    color: C.lime,
  },
  headlineTitle: {
    fontFamily: DISPLAY,
    fontSize: 17,
    lineHeight: 26,
    color: C.white,
    marginTop: 10,
  },
  headlineExcerpt: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  headlineFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  headlineMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
  },

  // 资讯清单
  listWrap: {
    marginTop: 18,
  },
  list: {
    paddingVertical: 0,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    height: 1,
    backgroundColor: C.oat,
  },
  dateBlock: {
    width: 48,
    height: 48,
    borderRadius: R.iconBox,
    backgroundColor: C.oat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateMonth: {
    fontSize: 9,
    color: inkA(0.62),
  },
  dateDay: {
    fontFamily: DISPLAY,
    fontSize: 18,
    color: C.ink,
    marginTop: -2,
  },
  itemText: {
    flex: 1,
    gap: 4,
  },
  catPill: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.ink,
  },
  itemTitle: {
    fontFamily: DISPLAY,
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
  },
  itemExcerpt: {
    fontSize: 11,
    lineHeight: 16,
    color: inkA(0.55),
  },
  listDivider: {
    height: 1,
    backgroundColor: C.oat,
  },
  footerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    color: inkA(0.55),
  },
});
