import { CONFIG, PROFILE, NEWS, NEWS_BODY } from './board-data.js';
import { BUILDINGS, TOWNS, addressOf } from './data.js';
import { localDate } from './game-state.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const dateLabel = value => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/u, '$1年$2月$3日');
export function timeLabel(timestamp) {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp));
}
export function makeRoute(base, view, extra = {}) {
  const params = new URLSearchParams({ view, ...extra });
  return base + '?' + params;
}
export function articleHTML(state, compact = false) {
  const published = state.restoredAt ?? state.startedAt;
  return `<article class="news-article${compact ? ' news-article--quoted' : ''}">
    <div class="article-byline"><span>${NEWS.publisher}</span><time>${dateLabel(localDate(published))} ${timeLabel(published)}</time></div>
    <h3>${NEWS.title}</h3>
    ${NEWS.paragraphs.map(text => `<p>${text}</p>`).join('')}
    <div class="article-bottom"><span>社会／霧原市</span><button type="button" data-action="copy-news">記事本文をコピー</button><span class="copy-result" role="status"></span></div>
  </article>`;
}
export function threadListHTML(threads, base, state) {
  return `<div class="board-introduction"><h2>霧原市 市民掲示板</h2><p>エレベーターのこと、町で聞いた話など。ご自由にどうぞ。</p></div>
    <p class="board-rules">個人情報の書き込み、無断転載はおやめください。</p>
    <div class="thread-table"><div class="thread-table-head"><span>スレッド一覧</span><span>書き込み</span></div>
    ${threads.map(thread => `<a class="thread-row${thread.dynamic ? ' thread-row--new' : ''}" href="${makeRoute(base, 'board', { thread: thread.id })}">
      <span><span class="thread-index">${thread.dynamic ? '新' : '›'}</span><strong>${escapeHTML(thread.title)}</strong><small>${thread.dynamic ? dateLabel(localDate(state.restoredAt)) + '　更新' : dateLabel(thread.date)}</small></span><span class="thread-replies">${thread.posts.length}</span></a>`).join('')}
    </div><p class="board-readonly">${base.includes('/archive/') ? '保存された掲示板です。新しい書き込みはできません。' : '掲示板への新規書き込みは、現在受け付けていません。事故情報は「事故情報の投稿」からお寄せください。'}</p>`;
}
export function postHTML(post, index, thread, state) {
  const day = thread.dynamic ? localDate(state.restoredAt) : thread.date;
  const clock = thread.dynamic ? timeLabel((thread.id === 'revival' ? state.restoredAt + CONFIG.newsDelay : state.publishedAt) + index * 900) : '21:' + String(10 + index * 2).padStart(2, '0');
  return `<article class="board-post" id="post-${index + 1}">
    <div class="post-meta"><span class="post-number">${index + 1}</span> ： <strong class="${post.name === '管理人' ? 'post-admin' : ''}">${escapeHTML(post.name)}</strong> <time>${escapeHTML(day.replaceAll('-', '/'))} ${clock}</time><span class="post-id">ID:${(thread.id.slice(0, 3) + (index * 139 + 42).toString(36)).padEnd(8, '0')}</span></div>
    ${post.special === 'news' ? articleHTML(state, true) : `<p>${escapeHTML(post.body)}</p>`}
  </article>`;
}
export function threadHTML(thread, base, state) {
  return `<div class="thread-nav"><a href="${makeRoute(base, 'board')}">← スレッド一覧</a><span>${thread.posts.length}件の書き込み</span></div>
    <h2 class="thread-title">${escapeHTML(thread.title)}</h2>
    <div class="thread-posts" data-thread-posts="${thread.id}">${thread.posts.map((post, index) => postHTML(post, index, thread, state)).join('')}</div>
    <div class="thread-bottom"><a href="${makeRoute(base, 'board')}">スレッド一覧へ戻る</a><span>書き込みは受け付けていません。</span></div>`;
}
export function profileHTML(snapshot) {
  return `<div class="profile-heading"><span class="profile-avatar" aria-hidden="true">管</span><div><p>三栖田えれ(β)</p><h2 id="modal-title">管理人について</h2></div></div>
    <p class="preserve-lines">${escapeHTML(snapshot === 'oldest' ? '霧原市出身・在住。\n町内のエレベーター事故について、個人で情報を集めています。' : PROFILE.common)}</p>
    ${snapshot === 'middle' ? `<dl class="profile-facts">${PROFILE.facts.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>` : ''}
    ${snapshot === 'latest' || snapshot === 'live' ? `<p class="profile-edited">${PROFILE.edited}</p>` : ''}`;
}
export function reportHTML() {
  return `<h2 id="modal-title">事故情報の投稿</h2><p class="form-intro">事故のあった場所と、事故を確認できるニュース記事をお知らせください。</p>
    <form id="incident-form" class="incident-form">
      <fieldset><legend>事故のあった場所</legend><div class="address-fields">
        <label>地名<select name="town" required><option value="">地名を選択</option>${TOWNS.map(name => `<option>${name}</option>`).join('')}</select></label>
        <label>丁目<select name="chome" required><option value="">選択</option>${[1, 2, 3].map(value => `<option value="${value}">${value}丁目</option>`).join('')}</select></label>
        <label>番地<select name="lot" required><option value="">選択</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}">${index + 1}番地</option>`).join('')}</select></label>
      </div></fieldset>
      <label>情報の出典<textarea name="source" rows="6" maxlength="5000" required placeholder="ニュース記事のタイトル、または記事本文を貼り付けてください"></textarea></label>
      <p class="form-note">投稿内容を確認後、地図に掲載します。一部の地点は即時掲載に対応しています。</p>
      <p id="incident-status" class="form-status" role="status"></p>
      <button class="button button--primary" type="submit">事故情報を投稿する</button>
    </form>`;
}
export function mapHTML(records, base, published, sightings = []) {
  return `<div class="map-heading"><div><p class="section-label">霧原市／事故記録</p><h2>エレベーター事故マップ</h2></div><span class="record-total"><strong>${records.length + (published ? 1 : 0)}</strong> 件</span></div>
    <div class="map-stage" id="map-stage" tabindex="0" role="region" aria-label="霧原市の地図。矢印キーで移動、プラス・マイナスで拡大縮小できます。">
      <div class="map-world" id="map-world"></div>
      <div class="map-location"><span>霧原市</span><small>Kirihara</small></div>
      <div class="map-controls"><button type="button" data-map-action="in" aria-label="地図を拡大">＋</button><button type="button" data-map-action="out" aria-label="地図を縮小">−</button><button type="button" data-map-action="reset" aria-label="市全域を表示">⌖</button></div>
      <div class="map-north" aria-hidden="true">N<span>↑</span></div>
      <div class="map-legend" aria-label="地図の表示レイヤー"><button type="button" data-map-layer="accidents" aria-pressed="true"><i aria-hidden="true">!</i> 事故記録 ${records.length + (published ? 1 : 0)}</button><button type="button" data-map-layer="sightings" aria-pressed="true" ${sightings.length ? '' : 'disabled'}><i class="legend-sighting" aria-hidden="true">目</i> 目撃情報 ${sightings.length}</button></div>
      <div class="map-attribution">地図・施設情報：三栖田えれ(β)　<span id="map-scale">500 m</span></div>
      <aside id="map-detail" class="map-detail" aria-labelledby="detail-title" hidden></aside>
    </div>
    <div class="map-below"><p>赤い印は事故、青い印は目撃・証言です。拡大すると施設名と詳しい番地を確認できます。</p><button class="text-link" data-action="report">事故情報の投稿 →</button></div>
    <details class="facility-index"><summary>地図の施設を一覧で見る</summary><div>${BUILDINGS.map(place => `<a href="${makeRoute(base, 'map', { building: place.id })}"><span>${place.name}</span><small>${addressOf(place)}</small></a>`).join('')}</div></details>`;
}
export function postingHelpHTML(isArchive) {
  return `<div class="document-page"><p class="section-label">ご利用案内</p><h2>投稿方法</h2>
    <p>町内のエレベーター事故について、情報をお持ちの方はご協力ください。</p>
    <h3>1. 事故のあった場所を確認する</h3><p>地図で所在地を確認し、投稿画面で「地名」「丁目」「番地」の正しい組み合わせを選んでください。建物名を押すと、所在地と施設情報が表示されます。</p>
    <h3>2. ニュース記事を添える</h3><p>情報の出典として、事故を伝えるニュース記事のタイトル、または記事本文を貼り付けてください。出典の分からない情報は掲載できません。</p>
    <h3>3. 管理人による確認</h3><p>確認できた情報を地図に掲載します。一部の地点は、投稿を即時反映するよう設定しています。</p>
    <p class="document-note">個人の名前や連絡先など、事故と関係のない個人情報は入力しないでください。</p>
    ${isArchive ? '<p class="archive-warning">このページはアーカイブです。投稿機能は利用できません。</p>' : '<button class="button button--primary" data-action="report">事故情報を投稿する</button>'}</div>`;
}
export function latestHTML(snapshot, date, records) {
  return `<div class="document-page"><p class="section-label">更新履歴</p><h2>新着情報</h2><dl class="updates">
    <div><dt>${dateLabel(date)}</dt><dd>${snapshot === 'live' ? 'サイトを復元しました。' : snapshot === 'latest' ? '掲載情報を更新しました。管理人プロフィールの一部を修正しました。' : snapshot === 'middle' ? '市民掲示板を更新しました。情報をお寄せくださった皆さま、ありがとうございます。' : '「三栖田えれ(β)」を開設しました。エレベーター事故の情報を集めています。'}</dd></div>
    ${records.slice(0, 5).map(item => `<div><dt>${dateLabel(item.date)}</dt><dd>事故記録 ${item.id} を掲載しました。</dd></div>`).join('')}
    </dl><p>情報の訂正・追加は「事故情報の投稿」からお寄せください。</p></div>`;
}
export function archivedNewsHTML(records, base) {
  return `<div class="document-page"><p class="section-label">町内の事故報道</p><h2>ニュース</h2><p>エレベーター事故に関する報道を記録しています。</p><div class="news-index">${records.map(record => `<a href="${makeRoute(base, 'map', { building: record.buildingId })}"><time>${dateLabel(record.date)}</time><strong>${BUILDINGS.find(item => item.id === record.buildingId).name}で${record.type}</strong><small>${record.source}</small></a>`).join('')}</div></div>`;
}
export function newsClipboardText() { return NEWS_BODY; }
