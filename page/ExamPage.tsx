import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import SubPageShell from '../template/SubPageShell';
import StateCard, { toErrorBar } from '../template/StateCard';
import StatusPill, { GuestPill } from '../template/StatusPill';
import Sticker from '../template/Sticker';
import LoadingCard from '../template/LoadingCard';
import LoadingShell from '../template/LoadingShell';
import { C, DISPLAY, R, SHADOW, inkA } from '../template/theme';
import { useExam } from '../hooks/useExam';
import { formatExamDate, groupExamsByDate, parseExamStartTime } from '../lib/exam';
import type { ExamItem } from '../api/contracts/jwxt';

export default function ExamPage() {
  const { status, exams, error, refetch, isRefreshing } = useExam();
  const groups = useMemo(() => groupExamsByDate(exams), [exams]);
  const undatedCount = useMemo(
    () => exams.filter((e) => !parseExamStartTime(e.exam_time)).length,
    [exams],
  );

  const statusPill =
    status === 'guest' ? (
      <GuestPill />
    ) : status === 'not_bound' ? (
      <StatusPill label="未绑定教务" />
    ) : status === 'loading' ? (
      <StatusPill label="同步中" />
    ) : status === 'empty' ? (
      <StatusPill label="暂无安排" />
    ) : status === 'error' ? (
      <StatusPill label="加载失败" />
    ) : (
      <StatusPill label={`共 ${exams.length} 场`} />
    );

  return (
    <SubPageShell
      title="考试安排"
      statusPill={statusPill}
      onRefresh={() => void refetch()}
      refreshing={isRefreshing}
      refreshEnabled={status === 'ready' || status === 'empty'}
    >
      {status === 'loading' && (
        <LoadingShell>
          <LoadingCard label="正在同步考试安排…" />
        </LoadingShell>
      )}

      {status === 'guest' && (
        <StateCard
          tone="guest"
          icon={<Feather name="clipboard" size={34} color={C.ink} />}
          title="登录后查看考试安排"
          description={'考试时间与考场来自学校教务系统\n登录并绑定教务账号后自动同步'}
          primaryAction={{ label: '立即登录', onPress: () => router.push('/login') }}
        />
      )}

      {status === 'not_bound' && (
        <StateCard
          tone="not_bound"
          icon={<Feather name="clipboard" size={30} color={C.ink} />}
          bang
          title="绑定教务账号查看考试"
          description={'考试安排由学校教务系统提供\n绑定后可见正考与补考的全部安排'}
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
          icon={<Feather name="clipboard" size={34} color={C.ink} />}
          title="暂无考试安排"
          description={'教务系统尚未发布考试计划\n一般在考前两周左右公布'}
          secondaryAction={{ label: '重新加载', onPress: () => void refetch() }}
        />
      )}

      {status === 'error' && (
        <StateCard
          tone="error"
          icon={<Feather name="alert-circle" size={34} color={C.ink} />}
          bang
          title="考试安排加载失败"
          description="可能是教务系统繁忙或网络异常"
          errorBar={toErrorBar(error)}
          primaryAction={{ label: '重新加载', onPress: () => void refetch() }}
        />
      )}

      {status === 'ready' && (
        <>
          {groups.map((group) => {
            const isUnknown = group.key === 'unknown';
            const { md, weekday } = isUnknown
              ? { md: '时间待定', weekday: '' }
              : formatExamDate(group.key);

            return (
              <View key={group.key} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupDate}>{md}</Text>
                  {!!weekday && <Text style={styles.groupWeekday}>{weekday}</Text>}
                  <View style={styles.groupCount}>
                    <Text style={styles.groupCountText}>{group.items.length} 场</Text>
                  </View>
                </View>

                {group.items.map((item, idx) => (
                  <ExamRow key={`${group.key}-${item.course_name}-${idx}`} item={item} />
                ))}
              </View>
            );
          })}

          {/*
            时间列解析不出来时，把原始文案直接给用户看，并说明这是教务原文。
            不猜「还剩几天」—— 解析不可靠时的倒计时比没有倒计时更糟。
          */}
          {undatedCount > 0 && (
            <Text style={styles.footNote}>
              有 {undatedCount} 场考试的时间为教务系统原文，未标注标准日期格式，
              已归入「时间待定」并按原文展示。
            </Text>
          )}
        </>
      )}
    </SubPageShell>
  );
}

function ExamRow({ item }: { item: ExamItem }) {
  const start = parseExamStartTime(item.exam_time);

  return (
    <Sticker style={styles.row} fill={C.white} radius={R.card} offset={SHADOW.lg}>
      <View style={styles.timeBox}>
        <Text style={styles.timeText} numberOfLines={1} adjustsFontSizeToFit>
          {start ?? '—'}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.courseName} numberOfLines={2}>
          {item.course_name}
        </Text>

        <View style={styles.infoRow}>
          {!!item.exam_room && (
            <View style={styles.infoItem}>
              <Feather name="map-pin" size={11} color={inkA(0.5)} />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.exam_room}
              </Text>
            </View>
          )}
          {!!item.seat_num && (
            <View style={styles.infoItem}>
              <Feather name="hash" size={11} color={inkA(0.5)} />
              <Text style={styles.infoText}>座位 {item.seat_num}</Text>
            </View>
          )}
          {!!item.teacher && (
            <View style={styles.infoItem}>
              <Feather name="user" size={11} color={inkA(0.5)} />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.teacher}
              </Text>
            </View>
          )}
        </View>

        {/* 原始时间文案：解析成功时它是补充信息，失败时它是唯一可信来源 */}
        {!!item.exam_time && (
          <Text style={styles.rawTime} numberOfLines={2}>
            {item.exam_time}
          </Text>
        )}
      </View>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  groupDate: {
    fontFamily: DISPLAY,
    fontSize: 17,
    letterSpacing: -0.4,
    color: C.ink,
  },
  groupWeekday: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gray,
  },
  groupCount: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.oat,
  },
  groupCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.gray,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  timeBox: {
    width: 54,
    alignSelf: 'flex-start',
    height: 54,
    borderRadius: R.card,
    backgroundColor: C.lime,
    borderWidth: 2,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  timeText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    letterSpacing: -0.4,
    color: C.ink,
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
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  infoText: {
    fontSize: 10.5,
    color: inkA(0.6),
  },
  rawTime: {
    fontSize: 10,
    lineHeight: 14,
    color: inkA(0.45),
  },
  footNote: {
    fontSize: 10.5,
    lineHeight: 16,
    color: inkA(0.5),
    paddingHorizontal: 4,
  },
});
