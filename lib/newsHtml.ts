/**
 * 新闻正文 HTML → RN 可渲染的块数组。
 *
 * 为什么需要它：
 *   `GET /news/article?url=` 返回的 `content` **是 HTML 片段，不是纯文本**。
 *   后端 `internal/news/infrastructure/parser/parser.go:ParseArticleContent`
 *   把上游博达 CMS 的正文容器（`#vsb_content` / `[id^=vsb_content]` / `.v_news_content` …）
 *   取 `.Html()` 原样返回，只做两件事：
 *     (1) 把正文里的 `img[src]`、`a[href]` 相对路径补成绝对地址（`resolveURL`）；
 *     (2) jwc 文章走 VPN 时，把内网图片下载后替换成 `data:image/...;base64,…`。
 *   真实样本（news.ahut.edu.cn/info/1130/69170.htm）的正文形如：
 *     `<div class="v_news_content">
 *        <p class="vsbcontent_start">9月11日下午，校党委副书记…</p>
 *        <p class="vsbcontent_img"><img src="https://news.ahut.edu.cn/__local/…jpg"></p>
 *        <p class="">…<span style="text-indent: 2em;">…</span></p>
 *      </div>`
 *   —— 全是 `<p>` / `<span>` / `<img>`，没有一行是需要真的浏览器引擎才能理解的。
 *
 * 本项目没有 WebView（也不打算为一个正文页引进来），所以这里做**受控子集**解析：
 *   ・保留：段落 / 标题 / 列表项 / 引用 / 图片 / 加粗 / 斜体 / 下划线 / 链接 / <br> 换行
 *   ・丢弃：script、style、注释、表单控件、表格布局细节、内联 style、class
 *
 * 这是一个纯函数模块（零 import），因此可以用
 *   node --experimental-strip-types lib/newsHtml.ts
 * 直接对真实抓下来的文章 HTML 跑回归。
 */

// ===================== 输出结构 =====================

/** 一段文字里的连续同格式片段 */
export type NewsRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** 站内/站外链接（后端已补全为绝对地址）；仅 http(s) 会被保留 */
  href?: string;
};

export type NewsBlock =
  | { type: 'paragraph'; runs: NewsRun[] }
  | { type: 'heading'; level: number; runs: NewsRun[] }
  | { type: 'listItem'; runs: NewsRun[] }
  | { type: 'quote'; runs: NewsRun[] }
  | { type: 'image'; uri: string; alt?: string; ratio?: number };

// ===================== 标签分类 =====================

/** 块级标签：开闭都触发「把当前段落收尾」 */
const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'aside',
  'blockquote',
  'figure',
  'figcaption',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** 直接丢弃的标签（含其内容） */
const DROP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'svg',
  'canvas',
  'video',
  'audio',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'meta',
  'link',
  'title',
  'base',
]);

/** 会被当作「标题」的块 */
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** 内联样式标签 → 影响 run 的格式位 */
const INLINE_BOLD = new Set(['strong', 'b']);
const INLINE_ITALIC = new Set(['i', 'em']);
const INLINE_UNDERLINE = new Set(['u', 'ins']);

// ===================== 实体解码 =====================

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  minus: '−',
  times: '×',
  divide: '÷',
  middot: '·',
  bull: '•',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
  sect: '§',
  para: '¶',
  dagger: '†',
  permil: '‰',
  prime: '′',
  Prime: '″',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  hArr: '⇔',
  rArr: '⇒',
  lArr: '⇐',
  infin: '∞',
  ne: '≠',
  le: '≤',
  ge: '≥',
  shysh: '',
  shy: '',
  zwj: '',
  zwnj: '',
};

/** 解码 `&nbsp;` `&#8220;` `&#x201C;` 三类实体；认不出的原样保留 */
export function decodeEntities(input: string): string {
  return input.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[body];
    return named === undefined ? whole : named;
  });
}

// ===================== 标签解析 =====================

type Tag = {
  raw: string;
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attrs: Record<string, string>;
};

/** 取出 `name="value"` / `name='value'` / `name=value` 三类属性 */
function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (const m of raw.matchAll(re)) {
    const key = m[1].toLowerCase();
    if (key === '' || key === '/') continue;
    attrs[key] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function parseTag(token: string): Tag | null {
  const m = /^<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)>?$/.exec(token);
  if (!m) return null;
  const name = m[2].toLowerCase();
  if (DROP_TAGS.has(name)) return { raw: token, name, closing: !!m[1], selfClosing: true, attrs: {} };
  const rest = m[3] ?? '';
  const selfClosing = /\/\s*$/.test(rest);
  return { raw: token, name, closing: !!m[1], selfClosing, attrs: parseAttrs(rest) };
}

/** 相对地址补全（后端已做过一遍，这里只兜底协议相对与根相对） */
function normalizeUrl(value: string, base: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^data:image\//i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  if (!base) return '';
  if (v.startsWith('/')) return `${base.replace(/\/+$/, '')}${v}`;
  return `${base.replace(/\/+$/, '')}/${v}`;
}

/** 从 `width` / `height` 属性推一个宽高比，失败则返回 undefined（调用方按 16:9 兜底） */
function ratioOf(attrs: Record<string, string>): number | undefined {
  const w = parseFloat(attrs.width || attrs.vwidth || '');
  const h = parseFloat(attrs.height || attrs.vheight || '');
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return w / h;
  return undefined;
}

// ===================== 主解析器 =====================

/**
 * 把正文 HTML 解析成块数组。
 *
 * @param html 后端返回的正文 HTML 片段
 * @param baseUrl 用于兜底补全相对地址（通常是文章原始 URL 的 origin）
 */
export function parseNewsHtml(html: string, baseUrl = ''): NewsBlock[] {
  if (!html) return [];

  // 先整体去掉注释与脚本/样式内容，避免它们混进文本
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  const blocks: NewsBlock[] = [];
  /** 当前正在累积的块类型 */
  let kind: 'paragraph' | 'heading' | 'listItem' | 'quote' = 'paragraph';
  let headingLevel = 2;
  let runs: NewsRun[] = [];

  /** 内联格式状态：标签名 → 是否生效（用数组充当栈，支持嵌套） */
  const boldStack: string[] = [];
  const italicStack: string[] = [];
  const underlineStack: string[] = [];
  const hrefStack: string[] = [];

  const pushText = (raw: string) => {
    // HTML 中换行与连续空白折叠成单个空格（<br> 会单独插入 \n）
    const text = decodeEntities(raw).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
    if (text === '') return;
    runs.push({
      text,
      bold: boldStack.length > 0 || undefined,
      italic: italicStack.length > 0 || undefined,
      underline: underlineStack.length > 0 || undefined,
      href: hrefStack.length > 0 ? hrefStack[hrefStack.length - 1] : undefined,
    });
  };

  /** 合并相邻同格式片段、去掉块首尾空白；为空则丢弃 */
  const flush = () => {
    const merged: NewsRun[] = [];
    for (const run of runs) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        !!prev.bold === !!run.bold &&
        !!prev.italic === !!run.italic &&
        !!prev.underline === !!run.underline &&
        prev.href === run.href
      ) {
        prev.text += run.text;
      } else {
        merged.push({ ...run });
      }
    }
    // 去掉纯空白片段（含 <br> 造成的换行）
    const kept = merged
      .map((r) => r)
      .filter((r) => r.text.trim() !== '' || r.text.includes('\n'));
    if (kept.length > 0) {
      kept[0] = { ...kept[0], text: kept[0].text.replace(/^\s+/, '') };
      const last = kept[kept.length - 1];
      kept[kept.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };
    }
    const tidy = kept.filter((r) => r.text !== '');
    if (tidy.length > 0) {
      if (kind === 'heading') blocks.push({ type: 'heading', level: headingLevel, runs: tidy });
      else if (kind === 'listItem') blocks.push({ type: 'listItem', runs: tidy });
      else if (kind === 'quote') blocks.push({ type: 'quote', runs: tidy });
      else blocks.push({ type: 'paragraph', runs: tidy });
    }
    runs = [];
    kind = 'paragraph';
  };

  const tokens = cleaned.match(/<[^>]*>|[^<]+/g) ?? [];

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      pushText(token);
      continue;
    }

    const tag = parseTag(token);
    if (!tag) continue;
    if (DROP_TAGS.has(tag.name)) continue;

    const { name, closing, selfClosing, attrs } = tag;

    // ---- 图片：单独成块，并把之前的文字收尾 ----
    if (name === 'img') {
      flush();
      const uri = normalizeUrl(attrs.src || attrs['data-src'] || attrs['data-original'] || '', baseUrl);
      if (/^(https?:|data:image\/)/i.test(uri)) {
        const alt = (attrs.alt || attrs.name || '').trim() || undefined;
        blocks.push({ type: 'image', uri, alt, ratio: ratioOf(attrs) });
      }
      continue;
    }

    // ---- 换行 / 水平线 ----
    if (name === 'br') {
      pushText('\n');
      continue;
    }
    if (name === 'hr') {
      flush();
      continue;
    }

    // ---- 内联格式 ----
    if (INLINE_BOLD.has(name)) {
      if (closing) popStack(boldStack, name);
      else if (!selfClosing) boldStack.push(name);
      continue;
    }
    if (INLINE_ITALIC.has(name)) {
      if (closing) popStack(italicStack, name);
      else if (!selfClosing) italicStack.push(name);
      continue;
    }
    if (INLINE_UNDERLINE.has(name)) {
      if (closing) popStack(underlineStack, name);
      else if (!selfClosing) underlineStack.push(name);
      continue;
    }
    if (name === 'a') {
      if (closing) {
        popStack(hrefStack, 'a');
      } else {
        const href = normalizeUrl(attrs.href || '', baseUrl);
        hrefStack.push(/^https?:\/\//i.test(href) ? href : '');
      }
      continue;
    }

    // ---- 块级 ----
    if (BLOCK_TAGS.has(name)) {
      if (HEADING_TAGS.has(name)) {
        if (closing) flush();
        else {
          flush();
          kind = 'heading';
          headingLevel = Number(name[1]) || 2;
        }
        continue;
      }
      if (name === 'li') {
        if (closing) flush();
        else {
          flush();
          kind = 'listItem';
        }
        continue;
      }
      if (name === 'blockquote') {
        if (closing) flush();
        else {
          flush();
          kind = 'quote';
        }
        continue;
      }
      // 其余块级（p / div / td / tr / …）：开闭都收尾。
      // 对 `<div><p>…</p></div>` 这类嵌套只是多 flush 一次（空 flush 会被丢弃），无副作用。
      flush();
      continue;
    }

    // 其它未知标签一律忽略，只保留其文本内容
  }

  flush();
  return blocks;
}

/** 关闭最靠近的同名内联标签；找不到就忽略（HTML 容错） */
function popStack(stack: string[], name: string) {
  const idx = stack.lastIndexOf(name);
  if (idx >= 0) stack.splice(idx, 1);
}

// ===================== 便捷出口 =====================

/** 正文块 → 纯文本（用于字数统计 / 摘要兜底） */
export function blocksToPlainText(blocks: NewsBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'image') return '';
      return b.runs.map((r) => r.text).join('');
    })
    .filter((s) => s.trim() !== '')
    .join('\n\n');
}

/** 正文是否只解析出「空壳」（后端拿到页面但选择器没命中正文容器时会返回空 content） */
export function isEmptyArticle(blocks: NewsBlock[]): boolean {
  return blocks.every((b) => b.type === 'image');
}
