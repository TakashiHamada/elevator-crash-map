// 公開サイト（魚拓の保存世代と復元後の現行サイト）の画面部品のHTMLと、共通の表示用ヘルパー。
// 文面の正典は board-data.js / data.js。ここでは並べ方だけを決め、データ由来の文字列は必ず escapeHTML を通す。
import { CONFIG, PROFILE, NEWS, UPDATE_NOTES } from './board-data.js';
import { TOWNS, CHOME_OPTIONS, LOT_OPTIONS, getBuilding } from './data.js';
import { localDate } from './game-state.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const dateLabel = value => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/u, '$1年$2月$3日');
const tokyoTimeFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
export function timeLabel(timestamp) {
  return tokyoTimeFormat.format(new Date(timestamp));
}
/** 公開サイト内の画面へのハッシュURL（例: #/live?view=board&thread=revival）を作る。 */
export function makeRoute(base, view, extra = {}) {
  const params = new URLSearchParams({ view, ...extra });
  return base + '?' + params;
}
export function articleHTML(state, compact = false) {
  // 記事の配信時刻は、サイトを復元した時刻として見せる。
  const postedAt = state.restoredAt ?? state.startedAt;
  return `<article class="news-article${compact ? ' news-article--quoted' : ''}">
    <div class="article-byline"><span>${escapeHTML(NEWS.publisher)}</span><time>${dateLabel(localDate(postedAt))} ${timeLabel(postedAt)}</time></div>
    <h3>${escapeHTML(NEWS.title)}</h3>
    ${NEWS.paragraphs.map(text => `<p>${escapeHTML(text)}</p>`).join('')}
    <div class="article-bottom"><span>社会／三栖田市</span><button type="button" data-action="copy-news">記事本文をコピー</button><span class="copy-result" role="status"></span></div>
  </article>`;
}
/** ニュース画面の先頭に出す速報（ニュース到着後の現行サイトのみ）。 */
export function breakingNewsHTML(state) {
  return `<div class="document-page breaking-news"><p class="section-label">最新のニュース</p><h2>市内の事故報道</h2>${articleHTML(state)}</div>`;
}
// ヒントを出す掲示板の範囲。スレッドID → 表示先のbase。登録した組み合わせでだけ、
// スレッド一覧のタイトルを赤くし、投稿データの hintText を赤文字にする。
const HINT_THREAD_BASES = {
  profile: ['#/archive/latest'],
  purpose: ['#/archive/latest', '#/archive/middle'],
  privacy: ['#/live']
};
const isHintedThread = (thread, base) => HINT_THREAD_BASES[thread.id]?.includes(base) ?? false;
export function threadListHTML(threads, base, state) {
  const readonlyNote = base.includes('/archive/') ? '保存された掲示板です。新しい書き込みはできません。' : '掲示板への新規書き込みは、現在受け付けていません。事故情報は「事故情報を投稿する」からお寄せください。';
  const rows = threads.map(thread => {
    const updated = thread.dynamic ? dateLabel(localDate(state.restoredAt)) + '　更新' : dateLabel(thread.date);
    return `<a class="thread-row${thread.dynamic ? ' thread-row--new' : ''}" href="${makeRoute(base, 'board', { thread: thread.id })}" data-thread-id="${thread.id}">
      <span><span class="thread-index">${thread.dynamic ? '新' : '›'}</span><strong${isHintedThread(thread, base) ? ' data-hint="text"' : ''}>${escapeHTML(thread.title)}</strong><small>${updated}</small></span><span class="thread-replies">${thread.posts.length}</span></a>`;
  }).join('');
  return `<div class="board-introduction"><h2>三栖田市 市民掲示板</h2><p>エレベーターのこと、町で聞いた話など。ご自由にどうぞ。</p></div>
    <p class="board-rules">個人情報の書き込み、無断転載はおやめください。</p>
    <div class="thread-table"><div class="thread-table-head"><span>スレッド一覧</span><span>書き込み</span></div>
    ${rows}
    </div><p class="board-readonly">${readonlyNote}</p>`;
}
function postClock(thread, index, state) {
  if (thread.dynamic) {
    // 復元スレッドはニュース到着時刻から、それ以外の動的スレッドは掲載時刻から並べる。
    const firstPostAt = thread.id === 'revival' ? state.restoredAt + CONFIG.newsDelay : state.publishedAt;
    return timeLabel(firstPostAt + index * CONFIG.dynamicPostSpacing);
  }
  const { startHour, startMinute, minuteStep } = CONFIG.archivedPostClock;
  return startHour + ':' + String(startMinute + index * minuteStep).padStart(2, '0');
}
export function postHTML(post, index, thread, state, base = '') {
  const day = thread.dynamic ? localDate(state.restoredAt) : thread.date;
  // 掲示板らしく見せるための表示用ID。スレッドと投稿番号から毎回同じ値になるように作る。
  const postId = (thread.id.slice(0, 3) + (index * 139 + 42).toString(36)).padEnd(8, '0');
  const body = isHintedThread(thread, base) ? hintTextHTML(post.body, post.hintText) : escapeHTML(post.body);
  return `<article class="board-post" id="post-${index + 1}">
    <div class="post-meta"><span class="post-number">${index + 1}</span> ： <strong class="${post.name === '管理人' ? 'post-admin' : ''}">${escapeHTML(post.name)}</strong> <time>${escapeHTML(day.replaceAll('-', '/'))} ${postClock(thread, index, state)}</time><span class="post-id">ID:${postId}</span></div>
    ${post.special === 'news' ? articleHTML(state, true) : `<p>${body}</p>`}
  </article>`;
}
export function threadHTML(thread, base, state) {
  return `<div class="thread-nav"><a href="${makeRoute(base, 'board')}">← スレッド一覧</a><span data-post-count>${thread.posts.length}件の書き込み</span></div>
    <h2 class="thread-title">${escapeHTML(thread.title)}</h2>
    <div class="thread-posts" data-thread-posts="${thread.id}">${thread.posts.map((post, index) => postHTML(post, index, thread, state, base)).join('')}</div>
    <div class="thread-bottom"><a href="${makeRoute(base, 'board')}">スレッド一覧へ戻る</a><span>書き込みは受け付けていません。</span></div>`;
}
// データで指定した部分を赤文字用の要素で囲む。本文とヒント文字列を別々にエスケープする。
function hintTextHTML(value, hintText) {
  const hints = (Array.isArray(hintText) ? hintText : [hintText]).filter(Boolean)
    .map(text => ({ text, index: value.indexOf(text) }))
    .filter(hint => hint.index >= 0).sort((a, b) => a.index - b.index);
  const parts = [];
  let cursor = 0;
  for (const hint of hints) {
    if (hint.index < cursor) continue;
    parts.push(escapeHTML(value.slice(cursor, hint.index)), `<span data-hint="text">${escapeHTML(hint.text)}</span>`);
    cursor = hint.index + hint.text.length;
  }
  parts.push(escapeHTML(value.slice(cursor)));
  return parts.join('');
}
// 中間・最古の保存には手掛かりを載せ、最新・現行サイトには修正の注記を出す。
export function profileHTML(snapshot) {
  const facts = ['middle', 'oldest'].includes(snapshot) ? `<dl class="profile-facts">${PROFILE.facts.map(([key, value, options]) => `<div><dt>${escapeHTML(key)}</dt><dd>${hintTextHTML(value, options?.hintText)}</dd></div>`).join('')}</dl>` : '';
  const editedNote = snapshot === 'latest' || snapshot === 'live' ? `<p class="profile-edited">${escapeHTML(PROFILE.edited)}</p>` : '';
  return `<div class="profile-heading"><img class="profile-avatar" src="assets/admin-avatar.webp" alt="管理人のアイコン" width="53" height="53"><div><p>${escapeHTML(CONFIG.name)}</p><h2>管理人について</h2></div></div>
    <p class="preserve-lines">${escapeHTML(snapshot === 'oldest' ? PROFILE.oldest : PROFILE.common)}</p>
    ${facts}
    ${editedNote}`;
}
export function reportHTML() {
  return `<h2 id="modal-title">事故情報の投稿</h2><p class="form-intro">事故のあった場所と、事故を確認できるニュース記事をお知らせください。</p>
    <form id="incident-form" class="incident-form">
      <fieldset><legend>事故のあった場所</legend><div class="address-fields">
        <label>地名<select name="town" required><option value="">地名を選択</option>${TOWNS.map(name => `<option>${escapeHTML(name)}</option>`).join('')}</select></label>
        <label>丁目<select name="chome" required><option value="">選択</option>${CHOME_OPTIONS.map(value => `<option value="${value}">${value}丁目</option>`).join('')}</select></label>
        <label>番地<select name="lot" required><option value="">選択</option>${LOT_OPTIONS.map(value => `<option value="${value}">${value}番地</option>`).join('')}</select></label>
      </div></fieldset>
      <label>情報の出典<textarea name="source" rows="6" maxlength="5000" required placeholder="ニュース記事のタイトル、または記事本文を貼り付けてください"></textarea></label>
      <p class="form-note">投稿内容を確認後、地図に掲載します。一部の地点は即時掲載に対応しています。</p>
      <p id="incident-status" class="form-status" role="status"></p>
      <button class="button button--primary" type="submit">事故情報を投稿する</button>
    </form>`;
}
/** 地図画面の枠。plottedRecords は地図に出す事故（掲載済みなら投稿分を含む。map.js の mapRecords で作る）。 */
export function mapHTML(plottedRecords) {
  const recordCount = plottedRecords.length;
  return `<div class="map-heading"><div><p class="section-label">三栖田市／事故記録</p><h2>エレベーター事故マップ</h2></div><span class="record-total"><strong>${recordCount}</strong> 件</span></div>
    <div class="map-stage" id="map-stage" tabindex="0" role="region" aria-label="三栖田市の地図。矢印キーで移動、プラス・マイナスで拡大縮小できます。">
      <div class="map-world" id="map-world"></div>
      <div class="map-controls"><button type="button" data-map-action="in" aria-label="地図を拡大">＋</button><button type="button" data-map-action="out" aria-label="地図を縮小">−</button></div>
      <div class="map-legend" aria-label="地図の表示レイヤー"><button type="button" data-map-layer="accidents" aria-pressed="true"><i aria-hidden="true">!</i> 事故記録 ${recordCount}</button></div>
      <div class="map-scale-box"><span id="map-scale">500 m</span></div>
      <aside id="map-detail" class="map-detail" aria-labelledby="detail-title" hidden></aside>
    </div>
    <div class="map-below"><p>地図は上が北。赤いピンは事故記録。建物を押すと詳細、拡大で施設名・番地を表示。</p></div>`;
}
export function postingHelpHTML(archived = false) {
  return `<div class="document-page"><p class="section-label">ご利用案内</p><h2>投稿方法</h2>
    <p>市内のエレベーター事故について、情報をお持ちの方はご協力ください。</p>
    <h3>1. 事故のあった場所を確認する</h3><p>地図で所在地を確認し、投稿画面で「地名」「丁目」「番地」の正しい組み合わせを選んでください。建物名を押すと、所在地と施設情報が表示されます。</p>
    <h3>2. ニュース記事を添える</h3><p>情報の出典として、事故を伝えるニュース記事のタイトル、または記事本文を貼り付けてください。出典の分からない情報は掲載できません。</p>
    <h3>3. 管理人による確認</h3><p>確認できた情報を地図に掲載します。一部の地点は、投稿を即時反映するよう設定しています。</p>
    <p class="document-note">個人の名前や連絡先など、事故と関係のない個人情報は入力しないでください。</p>
    <button class="button button--primary" data-action="report" ${archived ? 'disabled' : ''}>事故情報を投稿する</button></div>`;
}
/** 「更新履歴」画面。snapshot は保存世代か 'live'、date はその世代の更新日。 */
export function updatesHTML(snapshot, date, records) {
  return `<div class="document-page"><p class="section-label">更新履歴</p><h2>更新履歴</h2><dl class="updates">
    <div><dt>${dateLabel(date)}</dt><dd${snapshot === 'latest' ? ' data-hint="text"' : ''}>${escapeHTML(UPDATE_NOTES[snapshot])}</dd></div>
    ${records.slice(0, 5).map(item => `<div><dt>${dateLabel(item.date)}</dt><dd>事故記録 ${escapeHTML(item.id)} を掲載しました。</dd></div>`).join('')}
    </dl><p>情報の訂正・追加は「事故情報を投稿する」からお寄せください。</p></div>`;
}
/** 「事故一覧」画面の事故報道一覧（保存世代・現行サイト共通）。 */
export function newsIndexHTML(records, base) {
  const items = records.map(record => `<a href="${makeRoute(base, 'map', { building: record.buildingId })}"><time>${dateLabel(record.date)}</time><strong>${escapeHTML(getBuilding(record.buildingId).name)}で${escapeHTML(record.type)}</strong><small>${escapeHTML(record.source)}</small></a>`).join('');
  return `<div class="document-page"><p class="section-label">市内の事故報道</p><h2>事故一覧</h2><p>これまでに掲載したエレベーター事故の記録です。</p><div class="news-index">${items}</div></div>`;
}
