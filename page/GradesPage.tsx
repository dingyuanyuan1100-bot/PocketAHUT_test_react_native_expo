import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import SubPageShell from '../template/SubPageShell';
import StateCard, { toErrorBar } from '../template/StateCard';
import StatusPill, { GuestPill } from '../template/StatusPill';
import Chip from '../template/Chip';
import Sticker from '../template/Sticker';
import StickerField, { FieldInput } from '../template/StickerField';
import LoadingCard from '../template/LoadingCard';
import LoadingShell from '../template/LoadingShell';
import RevealGroup from '../template/RevealGroup';
import { C, DISPLAY, R, SHADOW, inkA } from '../template/theme';
import { useGradeDetail, useGrades } from '../hooks/useGrades';
import {
  canLoadGradeDetail,
  gradeTone,
  summarizeGrades,
  toNumber,
} from '../lib/grades';
import type { GradeItem } from '../api/contracts/jwxt';

/** 课程性质筛选项 —— 取值来自后端 `JwxtGradeQueryRequest.Type` 的注释（必修、选修） */
const TYPE_FILTERS = [
  { value: '', label: '全部' },
  { value: '必修', label: '必修' },
  { value: '选修', label: '选修' },
];

const TONE_COLOR = {
  high: C.lime,
  pass: C.white,
  low: C.oat,
  unknown: C.oat,
} as const;

export default function GradesPage() {
  const [type, setType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [draft, setDraft] = useState('');

  // 后端支持按课程名模糊 + 课程性质过滤，直接交给后端做，前端不重复实现
  const query = useMemo(
    () => ({ ...(type ? { type } : {}), ...(keyword ? { course: keyword } : {}) }),
    [type, keyword],
  );
  const { status, grades, error, refetch, isRefreshing } = useGrades(query);
  const summary = useMemo(() => summarizeGrades(grades), [grades]);

  const [detailItem, setDetailItem] = useState<GradeItem | null>(null);

  const statusPill =
    status === 'guest' ? (
      <GuestPill />
    ) : status === 'not_bound' ? (
      <StatusPill label="未绑定教务" />
    ) : status === 'loading' ? (
      <StatusPill label="同步中" />
    ) : status === 'empty' ? (
      <StatusPill label="暂无成绩" />
    ) : status === 'error' ? (
      <StatusPill label="加载失败" />
    ) : (
      <StatusPill label={`共 ${grades.length} 门`} />
    );

  return (
    <SubPageShell
      title="成绩查询"
      statusPill={statusPill}
      onRefresh={() => void refetch()}
      refreshing={isRefreshing}
      refreshEnabled={status === 'ready' || status === 'empty'}
      toolbar={
        status === 'ready' ? (
          <View style={styles.toolbar}>
            <View style={styles.chipRow}>
              {TYPE_FILTERS.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  active={type === f.value}
                  onPress={() => setType(f.value)}
                />
              ))}
            </View>
            <StickerField style={styles.searchBox} fill={C.white} radius={R.card}>
              <Feather name="search" size={14} color={inkA(0.5)} />
              <FieldInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => setKeyword(draft.trim())}
                placeholder="搜索课程名后回车"
                placeholderTextColor={inkA(0.4)}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {!!draft && (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setDraft('');
                    setKeyword('');
                  }}
                >
                  <Feather name="x" size={14} color={inkA(0.5)} />
                </Pressable>
              )}
            </StickerField>
          </View>
        ) : null
      }
    >
      {status === 'loading' && (
        <LoadingShell>
          <LoadingCard label="正在同步成绩…" />
        </LoadingShell>
      )}

      {status === 'guest' && (
        <StateCard
          tone="guest"
          icon={<Feather name="award" size={34} color={C.ink} />}
          bang
          title="登录后查看成绩"
          description={'成绩来自学校教务系统\n登录并绑定教务账号后，自动同步历学期成绩'}
          primaryAction={{ label: '立即登录', onPress: () => router.push('/login') }}
        />
      )}

      {status === 'not_bound' && (
        <StateCard
          tone="not_bound"
          icon={<Feather name="award" size={30} color={C.ink} />}
          bang
          title="绑定教务账号查看成绩"
          description={'成绩由学校教务系统提供\n绑定后可查看成绩、绩点与单科明细'}
          primaryAction={{
            label: '立即绑定教务',
            onPress: () => router.push('/login'),
            arrow: true,
          }}
        />
      )}

      {status === 'empty' && (
        <StateCard
          tone="empty"
          icon={<Feather name="award" size={34} color={C.ink} />}
          title={keyword || type ? '没有符合条件的成绩' : '暂无成绩记录'}
          description={
            keyword || type
              ? '换个课程名或课程性质再试'
              : '教务系统尚未发布成绩\n期末成绩通常在考后两周内公布'
          }
          secondaryAction={{ label: '重新加载', onPress: () => void refetch() }}
        />
      )}

      {status === 'error' && (
        <StateCard
          tone="error"
          icon={<Feather name="alert-circle" size={34} color={C.ink} />}
          bang
          title="成绩加载失败"
          description="可能是教务系统繁忙或网络异常"
          errorBar={toErrorBar(error)}
          primaryAction={{ label: '重新加载', onPress: () => void refetch() }}
        />
      )}

      {status === 'ready' && (
        /* 数据到位后逐块浮现：汇总卡先落，成绩列表每 4 帧跟一条 */
        <RevealGroup>
          <SummaryCard summary={summary} />

          {grades.map((item, idx) => (
            <GradeRow
              key={`${item.course_name}-${item.serial_number}-${idx}`}
              item={item}
              onPress={canLoadGradeDetail(item) ? () => setDetailItem(item) : undefined}
            />
          ))}
        </RevealGroup>
      )}

      <GradeDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />
    </SubPageShell>
  );
}

// ===================== 汇总卡 =====================

function SummaryCard({ summary }: { summary: ReturnType<typeof summarizeGrades> }) {
  const cells: { label: string; value: string; note?: string }[] = [
    { label: '课程', value: String(summary.count), note: '门' },
    {
      label: '学分',
      value: summary.creditCount ? summary.creditSum.toFixed(1) : '—',
      note: summary.creditCount ? `基于 ${summary.creditCount} 门` : '学分未标注',
    },
    {
      label: '平均分',
      value: summary.scoreAvg !== null ? String(summary.scoreAvg) : '—',
      note:
        summary.scoreCount && summary.scoreCount < summary.count
          ? `基于 ${summary.scoreCount} 门数值制`
          : summary.scoreCount
            ? `基于 ${summary.scoreCount} 门`
            : '无数值制成绩',
    },
    {
      label: '平均绩点',
      value: summary.gpaAvg !== null ? summary.gpaAvg.toFixed(2) : '—',
      note: summary.gpaCount ? `基于 ${summary.gpaCount} 门` : '绩点未标注',
    },
  ];

  return (
    <Sticker style={styles.summaryCard} fill={C.ink} radius={R.menu} offset={SHADOW.xl}>
      <View style={styles.summaryGrid}>
        {cells.map((cell) => (
          <View key={cell.label} style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>{cell.label}</Text>
            <Text style={styles.summaryValue}>{cell.value}</Text>
            {!!cell.note && <Text style={styles.summaryNote}>{cell.note}</Text>}
          </View>
        ))}
      </View>
      <Text style={styles.summaryFoot}>
        统计口径已标注：等级制成绩（优秀 / 通过等）不计入平均分
      </Text>
    </Sticker>
  );
}

// ===================== 单条成绩 =====================

function GradeRow({ item, onPress }: { item: GradeItem; onPress?: () => void }) {
  const tone = gradeTone(item.score);
  const gpa = toNumber(item.gpa);

  const body = (
    <Sticker style={styles.row} fill={C.white} radius={R.card} offset={SHADOW.lg}>
      {/* 分数贴纸 */}
      <View style={[styles.scoreBox, { backgroundColor: TONE_COLOR[tone] }]}>
        <Text
          style={[styles.scoreText, tone === 'low' && styles.scoreTextLow]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {item.score || '—'}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.courseName} numberOfLines={2}>
          {item.course_name}
        </Text>
        <View style={styles.metaRow}>
          {!!item.course_nature && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.course_nature}</Text>
            </View>
          )}
          {!!item.credit && <Text style={styles.meta}>学分 {item.credit}</Text>}
          {gpa !== null && <Text style={styles.meta}>绩点 {item.gpa}</Text>}
          {!!item.score_tag && <Text style={styles.meta}>{item.score_tag}</Text>}
        </View>
      </View>

      {/* 只有三个明细凭据齐全时才给入口 —— 缺一个后端就直接 MISSING_PARAM */}
      {onPress && <Feather name="chevron-right" size={16} color={inkA(0.35)} />}
    </Sticker>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

// ===================== 成绩明细弹层 =====================

function GradeDetailSheet({ item, onClose }: { item: GradeItem | null; onClose: () => void }) {
  const mutation = useGradeDetail();
  const detail = mutation.data;
  const { mutate, reset } = mutation;

  // 用 effect 驱动请求，而不是在 render 里直接调 —— 后者会在渲染期间触发
  // 状态更新，React 会告警且可能重复请求。依赖只看明细身份，换课才重新拉。
  const detailKey = item?.cj0708id ?? null;
  useEffect(() => {
    if (!detailKey || !item) {
      return;
    }
    mutate({ item });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailKey]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const rows: { label: string; score?: string; ratio?: string }[] = detail
    ? [
        { label: '期末', score: detail.final_exam_score, ratio: detail.final_exam_ratio },
        { label: '平时', score: detail.regular_score, ratio: detail.regular_ratio },
        { label: '实验', score: detail.lab_score, ratio: detail.lab_ratio },
      ].filter((r) => r.score || r.ratio)
    : [];

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable onPress={() => {}} style={styles.sheetWrap}>
          <Sticker style={styles.sheet} fill={C.white} radius={R.menu} offset={SHADOW.xl}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {item?.course_name ?? ''}
            </Text>
            <Text style={styles.sheetSub}>
              {item?.score ? `总成绩 ${item.score}` : '总成绩未公布'}
              {item?.credit ? ` · 学分 ${item.credit}` : ''}
            </Text>

            {mutation.isPending && (
              <View style={styles.sheetLoading}>
                <ActivityIndicator color={C.ink} />
                <Text style={styles.sheetLoadingText}>正在获取明细…</Text>
              </View>
            )}

            {mutation.isError && (
              <View style={styles.sheetError}>
                <Feather name="alert-triangle" size={14} color={C.ink} />
                <Text style={styles.sheetErrorText}>明细获取失败，请稍后再试</Text>
              </View>
            )}

            {!!rows.length && (
              <View style={styles.detailList}>
                {rows.map((r) => (
                  <View key={r.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{r.label}</Text>
                    <Text style={styles.detailValue}>
                      {r.score || '—'}
                      {r.ratio ? ` · ${r.ratio}` : ''}
                    </Text>
                  </View>
                ))}
                {!!detail?.total_score && (
                  <View style={[styles.detailRow, styles.detailTotal]}>
                    <Text style={styles.detailLabelStrong}>总评</Text>
                    <Text style={styles.detailValueStrong}>{detail.total_score}</Text>
                  </View>
                )}
              </View>
            )}

            {!mutation.isPending && !mutation.isError && !rows.length && detail && (
              <Text style={styles.sheetEmpty}>教务系统未提供该课程的明细构成</Text>
            )}

            <Pressable onPress={handleClose} style={styles.sheetCtaWrap}>
              <Sticker style={styles.sheetCta} fill={C.ink} radius={999} offset={SHADOW.lg}>
                <Text style={styles.sheetCtaText}>关闭</Text>
              </Sticker>
            </Pressable>
          </Sticker>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: C.ink,
    padding: 0,
  },

  // 汇总
  summaryCard: {
    padding: 16,
    gap: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryCell: {
    width: '50%',
    paddingVertical: 6,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: 'rgba(243,240,232,0.6)',
  },
  summaryValue: {
    fontFamily: DISPLAY,
    fontSize: 26,
    letterSpacing: -1,
    color: C.lime,
    lineHeight: 30,
  },
  summaryNote: {
    fontSize: 10,
    color: 'rgba(243,240,232,0.5)',
  },
  summaryFoot: {
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(243,240,232,0.45)',
  },

  // 单条
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  scoreBox: {
    width: 56,
    height: 56,
    borderRadius: R.card,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  scoreText: {
    fontFamily: DISPLAY,
    fontSize: 20,
    letterSpacing: -0.5,
    color: C.ink,
  },
  scoreTextLow: {
    color: C.gray,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  courseName: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: C.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.oat,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.gray,
  },
  meta: {
    fontSize: 10.5,
    color: inkA(0.55),
  },
  pressed: {
    opacity: 0.85,
  },

  // 明细弹层
  backdrop: {
    flex: 1,
    backgroundColor: inkA(0.45),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheetWrap: {
    alignSelf: 'stretch',
  },
  sheet: {
    padding: 18,
    gap: 8,
  },
  sheetTitle: {
    fontFamily: DISPLAY,
    fontSize: 19,
    lineHeight: 25,
    color: C.ink,
  },
  sheetSub: {
    fontSize: 12,
    color: inkA(0.55),
  },
  sheetLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  sheetLoadingText: {
    fontSize: 12,
    color: C.gray,
  },
  sheetError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.oat,
  },
  sheetErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: C.gray,
  },
  detailList: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  detailTotal: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 12.5,
    color: C.gray,
  },
  detailLabelStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  detailValueStrong: {
    fontFamily: DISPLAY,
    fontSize: 17,
    color: C.ink,
  },
  sheetEmpty: {
    fontSize: 12,
    color: inkA(0.5),
    paddingVertical: 12,
  },
  sheetCtaWrap: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  sheetCta: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCtaText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    color: C.lime,
  },
});
