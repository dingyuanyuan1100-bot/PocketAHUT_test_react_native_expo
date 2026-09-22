import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';

import { useNewsArticle } from '../hooks/useNewsArticle';
import type { NewsBlock, NewsRun } from '../lib/newsHtml';
import PageHeader from '../template/PageHeader';
import Sticker from '../template/Sticker';
import { BORDER, C, DISPLAY, inkA, R, SHADOW } from '../template/theme';

/**
 * 第 3 层页面：资讯详情
 *
 * 数据分两段拿，这是权限差异决定的、不是设计选择：
 *   ・列表 `GET /news`（公开）已经带了一份 ~240 字的摘要，点进来立刻有东西看；
 *   ・全文 `GET /news/article?url=` **需要登录**（`middleware.Auth()`），
 *     未登录会 401，所以未登录时页面停在「摘要 + 登录引导」，不会闪错误卡。
 *
 * 全文的 `content` 是 HTML 片段（见 api/contracts/content.ts 的说明），
 * 由 `lib/newsHtml.ts` 解析成块后交给 ArticleBody 渲染 —— 不引 WebView，
 * 也不把标签当文本直接显示出来。
 */

type Params = {
  title?: string;
  date?: string;
  url?: string;
  content?: string;
  cat?: string;
};

export default function NewsDetailPage() {
  const params = useLocalSearchParams<Params>();

  const title = params.title || '资讯详情';
  const date = params.date || '';
  const url = params.url || '';
  const cat = params.cat || '';
  /** 列表带来的摘要 —— 全文不可用时它就是本页的内容兜底 */
  const summary = (params.content || '').trim();

  const { status, blocks, error, refetch } = useNewsArticle(url);

  /** 正文字号档位：对应工具条左侧的 A- / A+ 两枚圆形贴纸 */
  const [big, setBig] = useState(false);
  const bodyFont = big ? 17 : 14;
  const bodyLine = big ? 28 : 24;

  const openOrigin = () => {
    if (url) void Linking.openURL(url);
  };

  /** 全文是否真的到了（blocks 里只要有一段文字就算，纯图片也算内容） */
  const hasFullText = status === 'ready' && blocks.length > 0;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ===================== 页头条 ===================== */}
        <Sticker fill={C.lime} radius={R.menu} offset={SHADOW.xl} style={styles.headerStrip}>
          <PageHeader
            title="新闻详情"
            iconSize={36}
            fg={C.ink}
            badgeBg={C.ink}
            badgeFg={C.lime}
            onBack={() => router.back()}
            backLeft
            extra={
              <View style={styles.headerActions}>
                <TouchableOpacity activeOpacity={0.8} onPress={openOrigin} disabled={!url}>
                  <View style={[styles.headerActionBtn, !url && styles.dim]}>
                    <Feather name="external-link" size={16} color={C.ink} />
                  </View>
                </TouchableOpacity>
              </View>
            }
          />
        </Sticker>

        {/* ===================== 文章卡 ===================== */}
        <Sticker
          fill={C.white}
          radius={R.hero}
          offset={SHADOW.lg}
          wrapStyle={styles.articleCardWrap}
          style={styles.articleCard}
        >
          {cat ? (
            <View style={styles.catPill}>
              <Text style={styles.catPillText}>{cat}</Text>
            </View>
          ) : null}

          <Text style={[styles.articleTitle, big && styles.articleTitleBig]}>{title}</Text>

          <Text style={styles.articleMeta}>
            {['安徽工业大学新闻网', date, hasFullText ? '全文' : '摘要'].filter(Boolean).join(' · ')}
          </Text>
        </Sticker>

        {/* ===================== 正文卡 ===================== */}
        <Sticker
          fill={C.white}
          radius={R.hero}
          offset={SHADOW.lg}
          wrapStyle={styles.bodyCardWrap}
          style={styles.bodyCard}
        >
          {/* ---------- 全文已到 ---------- */}
          {hasFullText && <ArticleBody blocks={blocks} font={bodyFont} line={bodyLine} />}

          {/* ---------- 全文没到：先用列表摘要兜底 ---------- */}
          {!hasFullText && (
            <>
              <Text style={[styles.paragraph, { fontSize: bodyFont, lineHeight: bodyLine }]}>
                {summary || '这条资讯没有随列表返回摘要内容。'}
              </Text>

              {status === 'loading' && (
                <View style={styles.pendingRow}>
                  <View style={styles.pendingDot} />
                  <Text style={styles.pendingText}>正在获取全文…</Text>
                </View>
              )}

              {status === 'guest' && (
                <>
                  <View style={styles.hintBox}>
                    <Feather name="lock" size={14} color={C.ink} />
                    <Text style={styles.hintText}>
                      以上是资讯摘要。正文全文需要登录后才能获取。
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push('/login' as never)}
                    style={styles.ctaWrap}
                  >
                    <Sticker fill={C.ink} radius={R.pill} offset={SHADOW.lg} style={styles.cta}>
                      <Text style={styles.ctaText}>登录查看全文</Text>
                      <Feather name="arrow-right" size={16} color={C.lime} />
                    </Sticker>
                  </TouchableOpacity>
                </>
              )}

              {status === 'empty' && (
                <View style={styles.hintBox}>
                  <Feather name="info" size={14} color={C.ink} />
                  <Text style={styles.hintText}>
                    后端拿到网页了，但没能从中解析出正文区域 —— 这类版面（纯图集 / 特殊模板）只能去原文看。
                  </Text>
                </View>
              )}

              {status === 'error' && (
                <>
                  <View style={styles.hintBox}>
                    <Feather name="alert-triangle" size={14} color={C.ink} />
                    <Text style={styles.hintText}>
                      <Text style={styles.errorCode}>{error?.errorCode ?? 'UPSTREAM_ERROR'}</Text>
                      {` · ${error?.message ?? '获取文章失败'}`}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => refetch()}
                    style={styles.ctaWrap}
                  >
                    <Sticker fill={C.ink} radius={R.pill} offset={SHADOW.lg} style={styles.cta}>
                      <Text style={styles.ctaText}>重新加载全文</Text>
                    </Sticker>
                  </TouchableOpacity>
                </>
              )}

              {/* 全文拿不到时，原文永远是可靠的出口 */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openOrigin}
                disabled={!url}
                style={styles.ctaWrap}
              >
                <Sticker
                  fill={C.white}
                  radius={R.pill}
                  offset={url ? SHADOW.md : 0}
                  border={BORDER}
                  style={styles.cta}
                >
                  <Text style={[styles.ctaText, { color: C.ink }]}>在浏览器打开原文</Text>
                  {url ? <Feather name="arrow-up-right" size={16} color={C.ink} /> : null}
                </Sticker>
              </TouchableOpacity>
            </>
          )}

          {/* ---------- 全文已到时，底部仍留一个原文出口 ---------- */}
          {hasFullText && (
            <View style={styles.originBox}>
              <Feather name="check-circle" size={14} color={C.ink} />
              <Text style={styles.originText}>
                正文来自学校新闻网原文，图片与排版都做了移动端简化。
              </Text>
            </View>
          )}
        </Sticker>
      </ScrollView>

      {/* ===================== 底部工具条 ===================== */}
      <View style={styles.barWrap} pointerEvents="box-none">
        <Sticker fill={C.white} radius={R.pill} offset={SHADOW.xl} style={styles.bar}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setBig(false)} hitSlop={6}>
            <View style={[styles.fontBtn, styles.fontBtnOat, !big && styles.fontBtnOn]}>
              <Text style={styles.fontBtnSmallText}>A</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={() => setBig(true)} hitSlop={6}>
            <View style={[styles.fontBtn, styles.fontBtnInk, big && styles.fontBtnOn]}>
              <Text style={styles.fontBtnBigText}>A</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.barDivider} />
          <View style={styles.barSpacer} />

          <TouchableOpacity activeOpacity={0.85} onPress={openOrigin} disabled={!url}>
            <View style={[styles.shareBtn, !url && styles.dim]}>
              <Feather name="external-link" size={14} color={C.ink} />
              <Text style={styles.shareBtnText}>打开原文</Text>
            </View>
          </TouchableOpacity>
        </Sticker>
      </View>
    </View>
  );
}

// ===================== 正文渲染 =====================

/**
 * 正文块渲染器。
 *
 * 刻意不给每段套独立卡片 —— 一篇文章几十段，套卡会把零模糊硬投影叠成一片黑边
 * （这个坑在绑定页踩过一次）。整篇只在一张白卡里，段与段之间靠间距和段首缩进分层。
 */
function ArticleBody({ blocks, font, line }: { blocks: NewsBlock[]; font: number; line: number }) {
  return (
    <View style={styles.body}>
      {blocks.map((block, index) => {
        if (block.type === 'image') {
          return <ArticleImage key={`img-${index}`} uri={block.uri} alt={block.alt} ratio={block.ratio} />;
        }

        if (block.type === 'heading') {
          return (
            <Text key={`h-${index}`} style={styles.heading}>
              <RunText runs={block.runs} />
            </Text>
          );
        }

        if (block.type === 'listItem') {
          return (
            <View key={`li-${index}`} style={styles.listRow}>
              <View style={styles.listDot} />
              <Text style={[styles.paragraph, styles.listText, { fontSize: font, lineHeight: line }]}>
                <RunText runs={block.runs} />
              </Text>
            </View>
          );
        }

        if (block.type === 'quote') {
          return (
            <View key={`q-${index}`} style={styles.quoteRow}>
              <View style={styles.quoteBar} />
              <Text style={[styles.paragraph, styles.quoteText, { fontSize: font, lineHeight: line }]}>
                <RunText runs={block.runs} />
              </Text>
            </View>
          );
        }

        return (
          <Text key={`p-${index}`} style={[styles.paragraph, { fontSize: font, lineHeight: line }]}>
            <RunText runs={block.runs} />
          </Text>
        );
      })}
    </View>
  );
}

/** 段落内的富文本：格式位靠嵌套 Text 表达，链接可点开浏览器 */
function RunText({ runs }: { runs: NewsRun[] }) {
  return (
    <>
      {runs.map((run, i) => {
        const style = [
          run.bold && styles.runBold,
          run.italic && styles.runItalic,
          run.underline && styles.runUnderline,
          run.href && styles.runLink,
        ];
        if (run.href) {
          return (
            <Text key={i} style={style} onPress={() => void Linking.openURL(run.href as string)}>
              {run.text}
            </Text>
          );
        }
        return (
          <Text key={i} style={style}>
            {run.text}
          </Text>
        );
      })}
    </>
  );
}

/**
 * 正文配图。
 *
 * 上游图片是 `news.ahut.edu.cn/__local/...`（博达 CMS 的附件路径），
 * 后端只把 src 补成绝对地址，没做转存 —— 所以存在**被防盗链拦住**的可能。
 * 加载失败时整块撤掉（不留空洞），而不是留一个破图图标。
 */
function ArticleImage({ uri, alt, ratio }: { uri: string; alt?: string; ratio?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <View style={styles.figure}>
      <Image
        source={{ uri }}
        style={[styles.figureImg, { aspectRatio: ratio && ratio > 0 ? ratio : 4 / 3 }]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
      {alt ? (
        <Text style={styles.figureCaption} numberOfLines={2}>
          {alt}
        </Text>
      ) : null}
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
    paddingTop: 12,
    // 给底部悬浮工具条 + 它的 4px 硬投影留位置
    paddingBottom: 100,
  },

  // ===================== 页头条 =====================
  headerStrip: {
    padding: 20,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: R.btn,
    backgroundColor: C.white,
    borderWidth: BORDER,
    borderColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.4,
  },

  // ===================== 文章卡 =====================
  articleCardWrap: {
    marginTop: 12,
  },
  articleCard: {
    padding: 20,
    gap: 12,
  },
  catPill: {
    alignSelf: 'flex-start',
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catPillText: {
    fontFamily: DISPLAY,
    fontSize: 10,
    color: C.lime,
  },
  articleTitle: {
    fontFamily: DISPLAY,
    fontSize: 20,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: C.ink,
  },
  articleTitleBig: {
    fontSize: 23,
    lineHeight: 34,
  },
  articleMeta: {
    fontSize: 11,
    color: inkA(0.55),
  },

  // ===================== 正文卡 =====================
  bodyCardWrap: {
    marginTop: 12,
  },
  bodyCard: {
    padding: 20,
    gap: 16,
  },
  body: {
    gap: 14,
  },
  paragraph: {
    color: inkA(0.78),
  },
  runBold: {
    fontWeight: '700',
    color: C.ink,
  },
  runItalic: {
    fontStyle: 'italic',
  },
  runUnderline: {
    textDecorationLine: 'underline',
  },
  runLink: {
    color: C.limeDeep,
    textDecorationLine: 'underline',
  },
  heading: {
    fontFamily: DISPLAY,
    fontSize: 16,
    lineHeight: 24,
    color: C.ink,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.limeDeep,
    marginTop: 9,
  },
  listText: {
    flex: 1,
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  quoteBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: C.lime,
  },
  quoteText: {
    flex: 1,
    color: inkA(0.62),
    fontStyle: 'italic',
  },

  // 配图
  figure: {
    gap: 8,
  },
  figureImg: {
    width: '100%',
    borderRadius: R.card,
    borderWidth: BORDER,
    borderColor: C.ink,
    backgroundColor: C.oat,
  },
  figureCaption: {
    fontSize: 11,
    lineHeight: 16,
    color: inkA(0.5),
    textAlign: 'center',
  },

  // 状态提示
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.limeDeep,
  },
  pendingText: {
    fontSize: 12,
    color: inkA(0.55),
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.oat,
  },
  hintText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.gray,
  },
  errorCode: {
    fontWeight: '800',
    color: C.ink,
  },
  ctaWrap: {
    alignSelf: 'stretch',
  },
  cta: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    color: C.lime,
  },
  originBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.oat,
  },
  originText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.gray,
  },

  // ===================== 底部工具条 =====================
  barWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
  },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  fontBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER,
    borderColor: 'transparent',
  },
  fontBtnOat: {
    backgroundColor: C.oat,
  },
  fontBtnInk: {
    backgroundColor: C.ink,
  },
  /** 当前生效的字号档位：补一圈墨黑描边，像被按下的贴纸 */
  fontBtnOn: {
    borderColor: C.ink,
  },
  fontBtnSmallText: {
    fontFamily: DISPLAY,
    fontSize: 12,
    color: inkA(0.78),
  },
  fontBtnBigText: {
    fontFamily: DISPLAY,
    fontSize: 17,
    color: C.lime,
  },
  barDivider: {
    width: 1,
    height: 20,
    backgroundColor: C.oat,
  },
  barSpacer: {
    flex: 1,
  },
  shareBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.lime,
    borderWidth: BORDER,
    borderColor: C.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareBtnText: {
    fontFamily: DISPLAY,
    fontSize: 12,
    color: C.ink,
  },
});
