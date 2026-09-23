import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import RevealGroup from '../template/RevealGroup';
import SubPageShell from '../template/SubPageShell';
import Chip from '../template/Chip';
import LoadingCard from '../template/LoadingCard';
import StateCard from '../template/StateCard';
import Sticker from '../template/Sticker';
import { C, DISPLAY, R, SHADOW, inkA } from '../template/theme';

import { canteenApi } from '../api/endpoints/canteen';
import type {
  CanteenCategory,
  CanteenComment,
  Dish,
} from '../api/contracts/content';
import type { Paged } from '../api/contracts';

/** 价格格式化：整数不带小数，否则两位 */
function fmtPrice(n: number): string {
  return Number.isInteger(n) ? `¥${n}` : `¥${n.toFixed(2)}`;
}

/** 把 tags 字符串拆成标签数组（兼容中英文逗号） */
function splitTags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function CanteenPage() {
  const [catId, setCatId] = useState<number | ''>('');

  // 分类（裸数组，公开）
  const catsQ = useQuery<CanteenCategory[]>({
    queryKey: ['canteen', 'categories'],
    queryFn: () => canteenApi.getCategories(),
  });

  // 菜品（{rows,total}，可按分类过滤，公开）
  const dishesQ = useQuery<Paged<Dish>>({
    queryKey: ['canteen', 'dishes', catId],
    queryFn: () =>
      canteenApi.getDishes(catId === '' ? undefined : { category_id: catId }),
  });

  // 随机评论（裸数组，公开）
  const commentsQ = useQuery<CanteenComment[]>({
    queryKey: ['canteen', 'comments', 'random'],
    queryFn: () => canteenApi.getRandomComment(),
  });

  const dishes = dishesQ.data?.rows ?? [];
  const total = dishesQ.data?.total ?? 0;
  const comments = commentsQ.data ?? [];
  const categories = catsQ.data ?? [];

  // ---------- 分类筛选条 ----------
  const filterBar = (
    <View style={styles.filterWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <Chip
          label="全部"
          active={catId === ''}
          onPress={() => setCatId('')}
        />
        {catsQ.isLoading
          ? [0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.chipSkeleton} />
            ))
          : categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={catId === c.id}
                onPress={() => setCatId(c.id)}
              />
            ))}
      </ScrollView>
    </View>
  );

  // ---------- 主内容 ----------
  let body: React.ReactNode;

  if (dishesQ.isLoading) {
    body = <LoadingCard label="正在加载今日菜单…" />;
  } else if (dishesQ.isError) {
    const err = dishesQ.error as { errorCode?: string; message?: string };
    body = (
      <StateCard
        tone="error"
        icon={<Feather name="coffee" size={30} color={C.ink} />}
        title="菜单加载失败"
        description="食堂服务暂不可用，请稍后重试"
        errorBar={{
          code: err.errorCode ?? 'UPSTREAM_ERROR',
          message: err.message ?? '获取菜品失败',
        }}
        primaryAction={{
          label: '重新加载',
          arrow: true,
          onPress: () => void dishesQ.refetch(),
        }}
      />
    );
  } else if (dishes.length === 0) {
    body = (
      <StateCard
        tone="empty"
        icon={<Feather name="coffee" size={30} color={C.ink} />}
        title="这个分类暂时没有菜品"
        description="换个分类，或看看全部窗口的菜单"
        secondaryAction={
          catId !== ''
            ? {
                label: '清除筛选',
                onPress: () => setCatId(''),
              }
            : undefined
        }
      />
    );
  } else {
    body = (
      <View style={styles.list}>
        <RevealGroup>
          <View style={styles.countRow}>
            <Text style={styles.countText}>共 {total} 道菜</Text>
            <Text style={styles.countHint}>点击上方分类可筛选</Text>
          </View>
          {dishes.map((d) => (
            <DishCard key={d.id} dish={d} />
          ))}
        </RevealGroup>
      </View>
    );
  }

  // ---------- 评论区（仅在有数据时展示，不阻塞主列表） ----------
  const commentsBlock =
    !dishesQ.isLoading && !dishesQ.isError && comments.length > 0 ? (
      <View style={styles.list}>
        <RevealGroup>
          <Text style={styles.sectionTitle}>同学们怎么说</Text>
          {comments.slice(0, 5).map((c) => (
            <CommentCard key={c.id} comment={c} />
          ))}
        </RevealGroup>
      </View>
    ) : null;

  return (
    <SubPageShell
      title="食堂查询"
      toolbar={filterBar}
      onRefresh={() => void Promise.all([dishesQ.refetch(), catsQ.refetch()])}
      refreshing={dishesQ.isFetching && !dishesQ.isLoading}
      refreshEnabled={!dishesQ.isLoading && !dishesQ.isError}
    >
      {body}
      {commentsBlock}
    </SubPageShell>
  );
}

/** 单道菜卡片 */
function DishCard({ dish }: { dish: Dish }) {
  const tags = splitTags(dish.tags);
  const meta = [dish.canteen_name, dish.window_name].filter(Boolean).join(' · ');
  return (
    <Sticker
      fill={C.white}
      radius={R.menu}
      offset={SHADOW.lg}
      style={styles.dishCard}
    >
      <View style={styles.dishTop}>
        <Text style={styles.dishName} numberOfLines={2}>
          {dish.name}
        </Text>
        <View style={styles.priceCol}>
          {dish.is_lowest && (
            <View style={styles.lowestBadge}>
              <Text style={styles.lowestText}>全窗口最低</Text>
            </View>
          )}
          <Text style={styles.price}>{fmtPrice(dish.price)}</Text>
          {dish.origin_price > 0 && (
            <Text style={styles.originPrice}>{fmtPrice(dish.origin_price)}</Text>
          )}
        </View>
      </View>

      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((t, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {meta ? <Text style={styles.dishMeta}>{meta}</Text> : null}
    </Sticker>
  );
}

/** 单条评论卡片 */
function CommentCard({ comment }: { comment: CanteenComment }) {
  const who = [comment.canteen_name, comment.window_name].filter(Boolean).join(' · ');
  return (
    <Sticker
      fill={C.white}
      radius={R.menu}
      offset={SHADOW.md}
      style={styles.commentCard}
    >
      <View style={styles.commentHead}>
        <View style={styles.avatarDot}>
          <Feather name="user" size={14} color={C.ink} />
        </View>
        <Text style={styles.commentUser}>{comment.username}</Text>
        {who ? <Text style={styles.commentWho}>{who}</Text> : null}
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  filterWrap: {
    paddingHorizontal: 12,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chipSkeleton: {
    width: 56,
    height: 32,
    borderRadius: 999,
    backgroundColor: C.oat,
  },
  list: {
    gap: 14,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  countText: {
    fontFamily: DISPLAY,
    fontSize: 14,
    color: C.ink,
  },
  countHint: {
    fontSize: 11,
    color: C.gray,
  },
  dishCard: {
    padding: 16,
    gap: 10,
  },
  dishTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  dishName: {
    flex: 1,
    fontFamily: DISPLAY,
    fontSize: 17,
    lineHeight: 22,
    color: C.ink,
  },
  priceCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  lowestBadge: {
    backgroundColor: C.lime,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lowestText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.ink,
  },
  price: {
    fontFamily: DISPLAY,
    fontSize: 18,
    lineHeight: 22,
    color: C.ink,
  },
  originPrice: {
    fontSize: 12,
    color: C.gray,
    textDecorationLine: 'line-through',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: C.oat,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: inkA(0.8),
  },
  dishMeta: {
    fontSize: 12,
    color: C.gray,
  },
  sectionTitle: {
    fontFamily: DISPLAY,
    fontSize: 16,
    lineHeight: 22,
    color: C.ink,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  commentCard: {
    padding: 14,
    gap: 8,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarDot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: C.oat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  commentWho: {
    fontSize: 11,
    color: C.gray,
  },
  commentContent: {
    fontSize: 13,
    lineHeight: 19,
    color: inkA(0.85),
  },
});
